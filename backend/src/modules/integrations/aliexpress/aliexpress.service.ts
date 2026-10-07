import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../../../database/prisma.service";

type AliExpressTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
  expire_time?: number | string;
  refresh_token_valid_time?: number | string;
  refresh_expires_in?: number | string;
};

export type AliExpressFreightOption = {
  code: string;
  company: string;
  feeFormat: string;
  currency: string;
  feeUzsMinor: number;
  minDeliveryDays: string;
  maxDeliveryDays: string;
  tracking: boolean | null;
};

@Injectable()
export class AliexpressService {
  private readonly gateway: string;
  private readonly timeoutMs = 15_000;
  private refreshPromise?: Promise<string>;
  private readonly currencyRateCache = new Map<string, { rate: number; expiresAt: number }>();

  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {
    this.gateway = this.config.get<string>("ALIEXPRESS_API_URL") ?? "https://api-sg.aliexpress.com/sync";
  }

  private requiredConfig(name: string): string {
    const value = this.config.get<string>(name);
    if (!value) throw new ServiceUnavailableException(`AliExpress configuration is missing ${name}`);
    return value;
  }

  validateSetupSecret(provided?: string): void {
    const expected = this.requiredConfig("ALIEXPRESS_OAUTH_SETUP_SECRET");
    const providedHash = createHash("sha256").update(provided ?? "").digest();
    const expectedHash = createHash("sha256").update(expected).digest();
    if (!provided || !timingSafeEqual(providedHash, expectedHash)) {
      throw new UnauthorizedException("Invalid AliExpress OAuth setup credentials");
    }
  }

  private encryptionKey(): Buffer {
    const encoded = this.requiredConfig("ALIEXPRESS_TOKEN_ENCRYPTION_KEY");
    if (!/^[A-Za-z0-9+/]{43}=$/.test(encoded)) {
      throw new ServiceUnavailableException("ALIEXPRESS_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
    }
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32) {
      throw new ServiceUnavailableException("ALIEXPRESS_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
    }
    return key;
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64")).join(".");
  }

  private decrypt(value: string): string {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    if (!ivValue || !tagValue || !encryptedValue) {
      throw new ServiceUnavailableException("Stored AliExpress credentials are invalid");
    }
    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey(), Buffer.from(ivValue, "base64"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64")),
      decipher.final()
    ]).toString("utf8");
  }

  async createAuthorizationUrl(): Promise<string> {
    const appKey = this.requiredConfig("ALIEXPRESS_APP_KEY");
    const redirectUri = this.requiredConfig("ALIEXPRESS_REDIRECT_URI");
    this.encryptionKey();

    const state = randomBytes(32).toString("base64url");
    const now = new Date();
    await this.prisma.aliexpressOAuthState.deleteMany({ where: { expiresAt: { lt: now } } });
    await this.prisma.aliexpressOAuthState.create({
      data: {
        stateHash: createHash("sha256").update(state).digest("hex"),
        expiresAt: new Date(now.getTime() + 10 * 60 * 1000)
      }
    });

    const authorizeUrl = new URL("https://api-sg.aliexpress.com/oauth/authorize");
    authorizeUrl.search = new URLSearchParams({
      response_type: "code",
      force_auth: "true",
      redirect_uri: redirectUri,
      client_id: appKey,
      state
    }).toString();
    return authorizeUrl.toString();
  }

  async completeAuthorization(code: string, state: string): Promise<void> {
    if (code.length > 4096 || state.length > 256) {
      throw new BadRequestException("AliExpress authorization callback parameters are invalid");
    }
    const now = new Date();
    const consumed = await this.prisma.aliexpressOAuthState.updateMany({
      where: {
        stateHash: createHash("sha256").update(state).digest("hex"),
        expiresAt: { gt: now },
        consumedAt: null
      },
      data: { consumedAt: now }
    });
    if (consumed.count !== 1) {
      throw new BadRequestException("AliExpress authorization state is invalid, expired, or already used");
    }

    const tokens = await this.requestTokens("/auth/token/create", { code });
    await this.saveTokens(tokens);
  }

  private signAuthRequest(path: string, params: Record<string, string>): string {
    const secret = this.requiredConfig("ALIEXPRESS_APP_SECRET");
    const payload = Object.entries(params)
      .filter(([, value]) => value !== "")
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, value]) => `${key}${value}`)
      .join("");
    return createHmac("sha256", secret).update(path + payload).digest("hex").toUpperCase();
  }

  private async requestTokens(path: "/auth/token/create" | "/auth/token/refresh", params: Record<string, string>) {
    const body = {
      app_key: this.requiredConfig("ALIEXPRESS_APP_KEY"),
      timestamp: String(Date.now()),
      sign_method: "sha256",
      ...params
    };
    const url = `https://api-sg.aliexpress.com/rest${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: new URLSearchParams({ ...body, sign: this.signAuthRequest(path, body) }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch {
      throw new ServiceUnavailableException("AliExpress token endpoint could not be reached");
    }

    let data: Record<string, unknown>;
    try {
      data = await response.json() as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException("AliExpress token endpoint returned an invalid response");
    }
    const result = this.findTokenResponse(data);
    const providerError = this.findProviderError(data);
    if (!response.ok || providerError) {
      const code = providerError?.code ?? providerError?.error_code;
      const message = providerError?.msg ?? providerError?.message ?? providerError?.error_message;
      throw new ServiceUnavailableException({
        provider: "aliexpress",
        code: code ? String(code) : undefined,
        message: message ? String(message) : "AliExpress token exchange failed"
      });
    }
    if (!result?.access_token) {
      throw new ServiceUnavailableException("AliExpress token response did not contain an access token");
    }
    return result;
  }

  private findTokenResponse(value: unknown, depth = 0): AliExpressTokenResponse | undefined {
    if (!value || typeof value !== "object" || depth > 3) return undefined;
    const record = value as Record<string, unknown>;
    if (typeof record.access_token === "string") return record as AliExpressTokenResponse;
    for (const nested of Object.values(record)) {
      const result = this.findTokenResponse(nested, depth + 1);
      if (result) return result;
    }
    return undefined;
  }

  private findProviderError(value: unknown, depth = 0): Record<string, unknown> | undefined {
    if (!value || typeof value !== "object" || depth > 3) return undefined;
    const record = value as Record<string, unknown>;
    const error = record.error_response ?? record.error;
    if (error && typeof error === "object") return error as Record<string, unknown>;
    if (record.error_code) return record;
    for (const nested of Object.values(record)) {
      const result = this.findProviderError(nested, depth + 1);
      if (result) return result;
    }
    return undefined;
  }

  private expiryDate(tokens: AliExpressTokenResponse, key: "expires_in" | "refresh_expires_in", absoluteKey?: "expire_time" | "refresh_token_valid_time"): Date | null {
    const absolute = absoluteKey ? Number(tokens[absoluteKey]) : NaN;
    if (Number.isFinite(absolute) && absolute > Date.now()) return new Date(absolute);
    const seconds = Number(tokens[key]);
    if (Number.isFinite(seconds) && seconds > 0) return new Date(Date.now() + seconds * 1000);
    return null;
  }

  private async saveTokens(tokens: AliExpressTokenResponse, retainedRefreshToken?: string): Promise<void> {
    const accessTokenExpiresAt = this.expiryDate(tokens, "expires_in", "expire_time");
    const refreshToken = tokens.refresh_token ?? retainedRefreshToken;
    if (!accessTokenExpiresAt || !tokens.access_token || !refreshToken) {
      throw new ServiceUnavailableException("AliExpress token response is missing access token, refresh token, or expiry");
    }
    const refreshTokenExpiresAt = this.expiryDate(tokens, "refresh_expires_in", "refresh_token_valid_time");
    const data = {
      accessTokenCiphertext: this.encrypt(tokens.access_token),
      refreshTokenCiphertext: this.encrypt(refreshToken),
      accessTokenExpiresAt,
      refreshTokenExpiresAt
    };
    await this.prisma.aliexpressCredential.upsert({
      where: { id: "primary" },
      create: { id: "primary", ...data },
      update: data
    });
  }

  private async getAccessToken(): Promise<string | undefined> {
    const stored = await this.prisma.aliexpressCredential.findUnique({ where: { id: "primary" } });
    if (!stored) return this.config.get<string>("ALIEXPRESS_ACCESS_TOKEN");
    if (stored.accessTokenExpiresAt.getTime() > Date.now() + 60_000) {
      return this.decrypt(stored.accessTokenCiphertext);
    }
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshAccessToken().finally(() => {
        this.refreshPromise = undefined;
      });
    }
    return this.refreshPromise;
  }

  private async refreshAccessToken(): Promise<string> {
    const stored = await this.prisma.aliexpressCredential.findUnique({ where: { id: "primary" } });
    if (!stored) throw new ServiceUnavailableException("AliExpress authorization is not configured");
    if (stored.refreshTokenExpiresAt && stored.refreshTokenExpiresAt.getTime() <= Date.now()) {
      throw new ServiceUnavailableException("AliExpress refresh token expired; authorize the app again");
    }
    const previousRefreshToken = this.decrypt(stored.refreshTokenCiphertext);
    const tokens = await this.requestTokens("/auth/token/refresh", { refresh_token: previousRefreshToken });
    await this.saveTokens(tokens, previousRefreshToken);
    const updated = await this.prisma.aliexpressCredential.findUnique({ where: { id: "primary" } });
    if (!updated) throw new ServiceUnavailableException("AliExpress token storage is unavailable");
    return this.decrypt(updated.accessTokenCiphertext);
  }

  private sign(params: Record<string, string>): string {
    const secret = this.config.get<string>("ALIEXPRESS_APP_SECRET");
    if (!secret) throw new ServiceUnavailableException("AliExpress credentials are not configured");
    const path = params.method?.includes("/") ? params.method : "";
    const signedParams = { ...params };
    if (path) delete signedParams.method;
    const payload = Object.entries(signedParams)
      .filter(([key, value]) => key !== "sign" && value !== undefined && value !== null && value !== "")
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, value]) => `${key}${value}`)
      .join("");
    return createHmac("sha256", secret).update(path + payload).digest("hex").toUpperCase();
  }

  async call(method: string, params: Record<string, unknown> = {}, requireAccessToken = false) {
    const appKey = this.config.get<string>("ALIEXPRESS_APP_KEY");
    if (!appKey) throw new ServiceUnavailableException("AliExpress credentials are not configured");
    const token = await this.getAccessToken();
    if (requireAccessToken && !token) {
      throw new ServiceUnavailableException("AliExpress DS API requires OAuth authorization and a valid access token");
    }

    const reserved = new Set(["app_key", "method", "timestamp", "sign_method", "format", "v", "access_token", "sign"]);
    const body: Record<string, string> = {
      app_key: appKey,
      method,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      sign_method: "sha256",
      format: "json",
      v: "2.0",
      ...Object.entries(params).reduce<Record<string, string>>((result, [key, value]) => {
        if (reserved.has(key) || value === undefined || value === null || value === "") return result;
        result[key] = typeof value === "object" ? JSON.stringify(value) : String(value);
        return result;
      }, {})
    };
    if (token) body.access_token = token;
    body.sign = this.sign(body);

    let response: Response;
    try {
      response = await fetch(this.gateway, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: new URLSearchParams(body),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch {
      throw new ServiceUnavailableException("AliExpress API could not be reached");
    }

    let data: Record<string, unknown>;
    try {
      data = await response.json() as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException("AliExpress API returned an invalid response");
    }
    const methodResponse = Object.entries(data).find(([key, value]) =>
      key !== "error_response" && key.endsWith("_response") && value && typeof value === "object"
    )?.[1] as Record<string, unknown> | undefined;
    const nestedError = methodResponse?.error_response;
    const responseCode = methodResponse?.code;
    const hasError = Boolean(
      data.error_response
      || data.error_code
      || nestedError
      || methodResponse?.error_code
      || (responseCode !== undefined && !/^0+$/.test(String(responseCode)) && String(responseCode) !== "200")
    );
    if (!response.ok || hasError) {
      const error = data.error_response && typeof data.error_response === "object"
        ? data.error_response as Record<string, unknown>
        : nestedError && typeof nestedError === "object"
          ? nestedError as Record<string, unknown>
          : methodResponse?.error_code || (responseCode !== undefined && !["0", "200"].includes(String(responseCode)))
            ? methodResponse
            : data;
      const code = error.code ?? error.error_code ?? error.sub_code;
      const message = error.sub_msg ?? error.msg ?? error.message ?? error.error_message ?? methodResponse?.msg ?? data.msg;
      throw new ServiceUnavailableException({
        provider: "aliexpress",
        code: code ? String(code) : undefined,
        message: message ? String(message) : "AliExpress request failed"
      });
    }
    return data;
  }

  async marketplaceSkuForOrder(productId: string, selectedSkuId: string, quantity: number) {
    if (!/^\d+$/.test(productId) || !/^\d+$/.test(selectedSkuId)) {
      throw new BadRequestException("Marketplace product and SKU IDs must be numeric");
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new BadRequestException("quantity must be an integer between 1 and 999");
    }

    const payload = await this.call("aliexpress.ds.product.get", {
      product_id: productId,
      ship_to_country: "UZ",
      target_currency: "UZS",
      target_language: "ru_RU",
      remove_personal_benefit: "true"
    }, true);
    const root = this.asRecord(payload);
    const response = this.asRecord(root.aliexpress_ds_product_get_response ?? root);
    const result = this.asRecord(response.result ?? response);
    const base = this.asRecord(result.ae_item_base_info_dto);
    const skus = this.asRecords(result.ae_item_sku_info_dtos);
    const sku = skus.find((item) => this.readString(item, "sku_id", "id") === selectedSkuId);
    if (!sku) throw new BadRequestException("The selected marketplace variant is no longer available");

    const price = this.parseAmount(this.readString(sku, "offer_sale_price", "sku_price"));
    const stockText = this.readString(sku, "sku_available_stock");
    const stock = stockText ? Number(stockText) : Number.NaN;
    if (!Number.isFinite(price) || price <= 0 || (stockText && (!Number.isFinite(stock) || stock < quantity))) {
      throw new BadRequestException("The selected marketplace variant is out of stock or has no valid price");
    }
    return {
      title: this.readString(base, "subject"),
      unitPriceMinor: Math.round(price * 100)
    };
  }

  async freightOptions(params: {
    productId: string;
    selectedSkuId: string;
    quantity: string;
    shipToCountry?: string;
    currency?: string;
    language?: string;
    locale?: string;
    provinceCode?: string;
    cityCode?: string;
  }): Promise<AliExpressFreightOption[]> {
    if (!/^\d+$/.test(params.productId) || !/^\d+$/.test(params.selectedSkuId)) {
      throw new BadRequestException("productId and selectedSkuId must be numeric AliExpress IDs");
    }
    const quantity = Number(params.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new BadRequestException("quantity must be an integer between 1 and 999");
    }
    const shipToCountry = params.shipToCountry ?? "UZ";
    const currency = params.currency ?? "USD";
    const language = params.language ?? "ru_RU";
    const locale = params.locale ?? "ru_RU";
    if (!/^[A-Z]{2}$/.test(shipToCountry)) {
      throw new BadRequestException("shipToCountry must be a two-letter uppercase country code");
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException("currency must be a three-letter uppercase currency code");
    }
    if (!/^[a-z]{2}_[A-Z]{2}$/.test(language) || !/^[a-z]{2}_[A-Z]{2}$/.test(locale)) {
      throw new BadRequestException("language and locale must use the language_COUNTRY format");
    }

    const payload = await this.call("aliexpress.ds.freight.query", {
      queryDeliveryReq: {
        productId: params.productId,
        selectedSkuId: params.selectedSkuId,
        quantity: String(quantity),
        shipToCountry,
        currency,
        language,
        locale,
        ...(params.provinceCode ? { provinceCode: params.provinceCode } : {}),
        ...(params.cityCode ? { cityCode: params.cityCode } : {})
      }
    }, true);
    const rawOptions = this.findFreightOptions(payload);
    const options = await Promise.all(rawOptions.map(async (option) => {
      const code = this.readString(option, "code", "deliveryOptionCode", "delivery_option_code");
      if (!code) return null;
      const feeFormat = this.readString(option, "shipping_fee_format", "shippingFeeFormat", "shipping_fee", "shippingFee");
      const rawAmount = this.readString(option, "shipping_fee", "shippingFee", "shipping_fee_amount", "fee");
      const amount = this.parseAmount(rawAmount || feeFormat);
      const optionCurrency = this.readString(option, "currency", "currency_code")
        || this.inferCurrency(feeFormat, currency);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new ServiceUnavailableException(`AliExpress returned an invalid shipping fee for ${code}`);
      }
      const feeUzsMinor = await this.convertToUzsMinor(amount, optionCurrency);
      const trackingValue = option.tracking ?? option.is_tracking;
      return {
        code,
        company: this.readString(option, "company", "companyName", "company_name", "logistics_service_name") || code,
        feeFormat,
        currency: optionCurrency,
        feeUzsMinor,
        minDeliveryDays: this.readString(option, "min_delivery_days", "minDeliveryDays"),
        maxDeliveryDays: this.readString(option, "max_delivery_days", "maxDeliveryDays"),
        tracking: typeof trackingValue === "boolean"
          ? trackingValue
          : typeof trackingValue === "string" ? /^(true|yes|1)$/i.test(trackingValue) : null
      } satisfies AliExpressFreightOption;
    }));
    return options.filter((option): option is AliExpressFreightOption => option !== null);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private asRecords(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) return value.map((item) => this.asRecord(item));
    const record = this.asRecord(value);
    const nested = Object.values(record).find(Array.isArray);
    return Array.isArray(nested) ? nested.map((item) => this.asRecord(item)) : [];
  }

  private readString(record: Record<string, unknown>, ...keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if ((typeof value === "string" || typeof value === "number") && String(value).trim()) {
        return String(value).trim();
      }
    }
    return "";
  }

  private parseAmount(value: string): number {
    if (/\bfree\b/i.test(value)) return 0;
    const cleaned = value.replace(/[^\d.,-]/g, "");
    if (!cleaned) return Number.NaN;
    const decimalSeparator = cleaned.lastIndexOf(".") > cleaned.lastIndexOf(",")
      ? "."
      : cleaned.lastIndexOf(",") > -1 ? "," : "";
    const normalized = decimalSeparator
      ? cleaned.replace(/[.,]/g, (separator, index) =>
        separator === decimalSeparator && index === cleaned.lastIndexOf(decimalSeparator) ? "." : "")
      : cleaned;
    return Number(normalized);
  }

  private inferCurrency(value: string, fallback: string): string {
    if (/\bUSD\b|US\s*\$|\$/.test(value)) return "USD";
    if (/\bCNY\b|\bRMB\b|CN¥|¥/.test(value)) return "CNY";
    if (/\bEUR\b|€/.test(value)) return "EUR";
    if (/\bRUB\b|₽/.test(value)) return "RUB";
    return fallback;
  }

  private findFreightOptions(payload: unknown): Record<string, unknown>[] {
    const keys = new Set(["delivery_options", "deliveryOptions", "delivery_option_list", "deliveryOptionList", "options"]);
    const visited = new Set<object>();
    const find = (value: unknown, depth: number): Record<string, unknown>[] => {
      if (!value || typeof value !== "object" || depth > 6 || visited.has(value)) return [];
      visited.add(value);
      if (Array.isArray(value)) return value.map((item) => this.asRecord(item));
      const record = this.asRecord(value);
      for (const [key, nested] of Object.entries(record)) {
        if (keys.has(key) && Array.isArray(nested)) return nested.map((item) => this.asRecord(item));
      }
      for (const nested of Object.values(record)) {
        const found = find(nested, depth + 1);
        if (found.length) return found;
      }
      return [];
    };
    return find(payload, 0);
  }

  private async convertToUzsMinor(amount: number, currency: string): Promise<number> {
    const normalizedCurrency = currency.toUpperCase();
    let rate = 1;
    if (normalizedCurrency !== "UZS") {
      const cached = this.currencyRateCache.get(normalizedCurrency);
      if (cached && cached.expiresAt > Date.now()) {
        rate = cached.rate;
      } else {
        let response: Response;
        try {
          response = await fetch(`https://cbu.uz/uz/arkhiv-kursov-valyut/json/${encodeURIComponent(normalizedCurrency)}/`, {
            signal: AbortSignal.timeout(8000),
            headers: { Accept: "application/json" }
          });
        } catch {
          throw new ServiceUnavailableException(`Unable to load the official ${normalizedCurrency}/UZS exchange rate`);
        }
        if (!response.ok) {
          throw new ServiceUnavailableException(`The Central Bank did not provide a ${normalizedCurrency}/UZS exchange rate`);
        }
        const rows = await response.json() as Array<{ Rate?: string; Nominal?: string }>;
        const row = Array.isArray(rows) ? rows[0] : undefined;
        const officialRate = row?.Rate ? Number(row.Rate.replace(",", ".")) : Number.NaN;
        const nominal = row?.Nominal ? Number(row.Nominal) : 1;
        if (!Number.isFinite(officialRate) || officialRate <= 0 || !Number.isFinite(nominal) || nominal <= 0) {
          throw new ServiceUnavailableException(`The Central Bank returned an invalid ${normalizedCurrency}/UZS exchange rate`);
        }
        rate = officialRate / nominal;
        this.currencyRateCache.set(normalizedCurrency, { rate, expiresAt: Date.now() + 6 * 60 * 60 * 1000 });
      }
    }
    const feeMinor = Math.round(amount * rate * 100);
    if (!Number.isSafeInteger(feeMinor) || feeMinor < 0) {
      throw new ServiceUnavailableException("The converted shipping fee exceeds the supported amount");
    }
    return feeMinor;
  }

  productDetails(productId: string, params: Record<string, string> = {}) {
    if (!/^\d+$/.test(productId)) {
      throw new BadRequestException("productId must be a numeric AliExpress item ID");
    }
    if (params.ship_to_country && !/^[A-Z]{2}$/.test(params.ship_to_country)) {
      throw new BadRequestException("ship_to_country must be a two-letter uppercase country code");
    }
    if (params.target_currency && !/^[A-Z]{3}$/.test(params.target_currency)) {
      throw new BadRequestException("target_currency must be a three-letter uppercase currency code");
    }
    if (params.target_language && !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(params.target_language)) {
      throw new BadRequestException("target_language must be a supported language code");
    }
    return this.call("aliexpress.ds.product.get", {
      product_id: productId,
      ship_to_country: params.ship_to_country ?? "UZ",
      target_currency: params.target_currency ?? "USD",
      target_language: params.target_language ?? "ru_RU",
      remove_personal_benefit: "true"
    }, true);
  }

  dropshippingRecommendations() {
    return this.call("aliexpress.ds.recommend.feed.get", {
      country: "UZ",
      target_currency: "USD",
      target_language: "RU",
      feed_name: "DS bestseller",
      page_size: 5,
      page_no: 1
    }, true);
  }

  dropshippingCategories(categoryId?: string, language = "ru") {
    if (categoryId && !/^\d+$/.test(categoryId)) {
      throw new BadRequestException("categoryId must be a numeric AliExpress category ID");
    }
    if (!/^(hi|de|ru|pt|ko|in|en|it|fr|zh|es|iw|ar|vi|th|uk|ja|id|pl|he|nl|tr)$/.test(language)) {
      throw new BadRequestException("language is not supported by the AliExpress Dropshipping category API");
    }
    return this.call("aliexpress.ds.category.get", {
      ...(categoryId ? { categoryId } : {}),
      language
    }, true);
  }

  dropshippingProducts(params: {
    keyWord?: string;
    categoryId?: string;
    pageIndex?: string;
    pageSize?: string;
    sortBy?: string;
    currency?: string;
    countryCode?: string;
  }) {
    const keyWord = params.keyWord?.trim();
    if (!keyWord) {
      throw new BadRequestException("keyWord is required for AliExpress Dropshipping product search");
    }
    if (keyWord && keyWord.length > 100) {
      throw new BadRequestException("keyWord must be 100 characters or fewer");
    }
    if (params.categoryId && !/^\d+$/.test(params.categoryId)) {
      throw new BadRequestException("categoryId must be a numeric AliExpress category ID");
    }
    const pageIndex = params.pageIndex === undefined ? 1 : Number(params.pageIndex);
    if (!Number.isInteger(pageIndex) || pageIndex < 1) {
      throw new BadRequestException("pageIndex must be a positive integer");
    }
    const pageSize = params.pageSize === undefined ? 20 : Number(params.pageSize);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 20) {
      throw new BadRequestException("pageSize must be an integer between 1 and 20");
    }
    const sortBy = params.sortBy ?? "orders,desc";
    if (!["min_price,asc", "min_price,desc", "orders,asc", "orders,desc", "comments,asc", "comments,desc"].includes(sortBy)) {
      throw new BadRequestException("sortBy is not supported by the AliExpress Dropshipping search API");
    }
    const currency = params.currency ?? "USD";
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException("currency must be a three-letter uppercase currency code");
    }
    const countryCode = params.countryCode ?? "UZ";
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      throw new BadRequestException("countryCode must be a two-letter uppercase country code");
    }

    return this.call("aliexpress.ds.text.search", {
      ...(keyWord ? { keyWord } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      local: "en_US",
      countryCode,
      pageSize,
      pageIndex,
      sortBy,
      currency
    }, true);
  }

  hotProducts(params: Record<string, unknown> = {}) {
    return this.call("aliexpress.affiliate.hotproduct.query", params);
  }

  affiliateCategories(params: Record<string, unknown> = {}) {
    return this.call("aliexpress.affiliate.category.get", params);
  }

  generateAffiliateLinks(params: Record<string, unknown>) {
    return this.call("aliexpress.affiliate.link.generate", params);
  }

  affiliateOrders(params: Record<string, unknown> = {}) {
    return this.call("aliexpress.affiliate.order.list", params);
  }

  affiliateOrderDetail(params: Record<string, unknown>) {
    return this.call("aliexpress.affiliate.order.get", params);
  }
}
