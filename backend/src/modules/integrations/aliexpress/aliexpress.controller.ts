import { BadRequestException, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import { AliexpressService } from "./aliexpress.service";

@Controller("integrations/aliexpress")
export class AliexpressController {
  constructor(private readonly aliexpress: AliexpressService) {}

  @Post("oauth/start")
  async startOAuth(@Headers("x-aliexpress-setup-secret") setupSecret?: string) {
    this.aliexpress.validateSetupSecret(setupSecret);
    return { authorizationUrl: await this.aliexpress.createAuthorizationUrl() };
  }

  @Get("oauth/callback")
  async oauthCallback(
    @Query("code") code?: string,
    @Query("state") state?: string,
    @Query("error") error?: string
  ) {
    if (error) throw new BadRequestException("AliExpress authorization was declined");
    if (!code || !state) throw new BadRequestException("AliExpress callback is missing code or state");
    await this.aliexpress.completeAuthorization(code, state);
    return { success: true, message: "AliExpress is connected. Tokens were saved securely on the backend." };
  }

  @Get("product/:productId")
  productDetails(
    @Param("productId") productId: string,
    @Query("ship_to_country") shipToCountry?: string,
    @Query("target_currency") targetCurrency?: string,
    @Query("target_language") targetLanguage?: string
  ) {
    return this.aliexpress.productDetails(productId, {
      ...(shipToCountry ? { ship_to_country: shipToCountry } : {}),
      ...(targetCurrency ? { target_currency: targetCurrency } : {}),
      ...(targetLanguage ? { target_language: targetLanguage } : {})
    });
  }

  @Get("dropshipping/recommendations")
  dropshippingRecommendations() {
    return this.aliexpress.dropshippingRecommendations();
  }

  @Get("dropshipping/categories")
  dropshippingCategories(
    @Query("categoryId") categoryId?: string,
    @Query("language") language?: string
  ) {
    return this.aliexpress.dropshippingCategories(categoryId, language);
  }

  @Get("dropshipping/products")
  dropshippingProducts(
    @Query("keyWord") keyWord?: string,
    @Query("categoryId") categoryId?: string,
    @Query("pageIndex") pageIndex?: string,
    @Query("pageSize") pageSize?: string,
    @Query("sortBy") sortBy?: string,
    @Query("currency") currency?: string,
    @Query("countryCode") countryCode?: string
  ) {
    return this.aliexpress.dropshippingProducts({
      keyWord,
      categoryId,
      pageIndex,
      pageSize,
      sortBy,
      currency,
      countryCode
    });
  }

  @Get("affiliate/products")
  hotProducts(@Query() params: Record<string, string>) {
    return this.aliexpress.hotProducts(params);
  }

  @Get("affiliate/categories")
  categories(@Query() params: Record<string, string>) {
    return this.aliexpress.affiliateCategories(params);
  }

  @Get("affiliate/links")
  links(@Query() params: Record<string, string>) {
    return this.aliexpress.generateAffiliateLinks(params);
  }

  @Get("affiliate/orders")
  orders(@Query() params: Record<string, string>) {
    return this.aliexpress.affiliateOrders(params);
  }

  @Get("affiliate/orders/detail")
  orderDetail(@Query() params: Record<string, string>) {
    return this.aliexpress.affiliateOrderDetail(params);
  }
}
