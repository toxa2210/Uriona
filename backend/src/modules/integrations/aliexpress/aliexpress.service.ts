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
  feeUzsMinor: number;
  feeFormat: string;
  currency: string;
  minDeliveryDays?: string;
  maxDeliveryDays?: string;
  tracking?: boolean;
};

export type MarketplaceSkuQuote = {
  title: string;
  unitPriceMinor: number;
};

@Injectable()
export class AliexpressService {
  private readonly gateway: string;
  private readonly timeoutMs = 15_000;
  private refreshPromise?: Promise<string>;

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

  /**
   * Exchange rate used to convert marketplace prices into UZS tiyin.
   * Configured via env; never hardcoded in code or frontend (TZ 16-18).
   */
  private uzsPerUsd(): number {
    const raw = this.config.get<string>("USD_TO_UZS_RATE");
    const rate = raw ? Number(raw) : NaN;
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new ServiceUnavailableException({
        code: "CURRENCY_RATE_NOT_CONFIGURED",
        message: "USD_TO_UZS_RATE is not configured on the backend"
      });
    }
    return rate;
  }

  private usdToUzsMinor(amount: number): number {
    return Math.round(amount * this.uzsPerUsd() * 100);
  }

  private static dig(value: unknown, path: string[]): unknown {
    let current: unknown = value;
    for (const key of path) {
      if (!current || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  private static asArray(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) return value as Record<string, unknown>[];
    if (value && typeof value === "object") {
      // AliExpress often wraps lists as { item: [...] }
      for (const nested of Object.values(value as Record<string, unknown>)) {
        if (Array.isArray(nested)) return nested as Record<string, unknown>[];
      }
    }
    return [];
  }

  /**
   * Resolves the current price of a specific SKU of a marketplace product.
   * Prices are always re-fetched at order time so a stale cart price is rejected (TZ 23).
   */
  async marketplaceSkuForOrder(productId: string, skuId: string, quantity: number): Promise<MarketplaceSkuQuote> {
    const data = await this.productDetails(productId, {
      ship_to_country: "UZ",
      target_currency: "USD",
      target_language: "ru_RU"
    });
    const result = AliexpressService.dig(data, ["aliexpress_ds_product_get_response", "result"]) as Record<string, unknown> | undefined;
    if (!result) {
      throw new ServiceUnavailableException({ code: "MARKETPLACE_PRODUCT_UNAVAILABLE", message: "Marketplace product details are unavailable" });
    }

    const skus = AliexpressService.asArray(
      AliexpressService.dig(result, ["ae_item_sku_info_dtos", "ae_item_sku_info_d_t_o"])
        ?? AliexpressService.dig(result, ["ae_item_sku_info_dtos"])
    );
    const sku = skus.find((entry) => String(entry.sku_id ?? entry.id ?? "") === skuId);
    if (!sku) {
      throw new BadRequestException({ code: "MARKETPLACE_SKU_NOT_FOUND", message: "Selected variant is no longer available" });
    }

    const rawPrice = Number(sku.sku_price ?? sku.offer_sale_price ?? sku.price ?? NaN);
    if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
      throw new ServiceUnavailableException({ code: "MARKETPLACE_PRICE_UNAVAILABLE", message: "Marketplace price is unavailable" });
    }

    // SKU price is per unit; the order stores the unit price, quantity is applied by OrdersService.
    void quantity;
    const title = String(
      AliexpressService.dig(result, ["ae_item_base_info_dto", "subject"])
        ?? result.subject
        ?? ""
    );
    return { title, unitPriceMinor: this.usdToUzsMinor(rawPrice) };
  }

  /**
   * Returns the currently available freight options for a marketplace item,
   * with fees converted to UZS tiyin by the backend.
   */
  async freightOptions(params: {
    productId: string;
    selectedSkuId: string;
    quantity: string;
    shipToCountry: string;
    currency: string;
    language: string;
    locale: string;
  }): Promise<AliExpressFreightOption[]> {
    if (!/^\d+$/.test(params.productId)) throw new BadRequestException("productId must be numeric");
    if (!/^\d+$/.test(params.selectedSkuId)) throw new BadRequestException("selectedSkuId must be numeric");

    // Freight query is priced in USD and converted to UZS server-side.
    const data = await this.call("aliexpress.ds.freight.query", {
      product_id: params.productId,
      selected_sku_id: params.selectedSkuId,
      quantity: params.quantity,
      ship_to_country: params.shipToCountry,
      target_currency: "USD",
      target_language: params.language,
      locale: params.locale
    }, true);

    const result = AliexpressService.dig(data, ["aliexpress_ds_freight_query_response", "result"]) as Record<string, unknown> | undefined;
    if (!result) {
      throw new ServiceUnavailableException({ code: "FREIGHT_UNAVAILABLE", message: "Delivery options are unavailable" });
    }

    const options = AliexpressService.asArray(
      AliexpressService.dig(result, ["delivery_options", "delivery_option_d_t_o"])
        ?? AliexpressService.dig(result, ["delivery_options"])
        ?? AliexpressService.dig(result, ["aeop_freight_result_list"])
    );

    return options
      .map((option): AliExpressFreightOption | undefined => {
        const code = String(option.code ?? option.service_name ?? "");
        const feeRaw = Number(option.freight_amount ?? option.shipping_fee_amount ?? option.price ?? NaN);
        if (!code || !Number.isFinite(feeRaw) || feeRaw < 0) return undefined;
        const feeUzsMinor = this.usdToUzsMinor(feeRaw);
        return {
          code,
          company: String(option.company ?? option.logistics_company ?? option.service_name ?? code),
          feeUzsMinor,
          feeFormat: `${(feeUzsMinor / 100).toLocaleString("ru-RU")} сум`,
          currency: "UZS",
          minDeliveryDays: option.min_delivery_days !== undefined ? String(option.min_delivery_days) : undefined,
          maxDeliveryDays: option.max_delivery_days !== undefined ? String(option.max_delivery_days) : undefined,
          tracking: option.tracking === undefined ? undefined : Boolean(option.tracking)
        };
      })
      .filter((option): option is AliExpressFreightOption => Boolean(option));
  }
}
