import { Body, Controller, Delete, ForbiddenException, Get, Headers, Param, Patch, Post, Query, UnauthorizedException, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { AuthService } from "../auth/auth.service";
import { ProductImageUpload } from "./r2-storage.service";
import { SellerCatalogService } from "./seller-catalog.service";

class SellerProductDto {
  @IsOptional() @IsString() @MaxLength(190) id?: string;
  @IsOptional() @IsString() @MaxLength(190) categoryId?: string | null;
  @IsString() @IsNotEmpty() @MaxLength(200) titleUz!: string;
  @IsOptional() @IsString() @MaxLength(200) titleRu?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionUz?: string;
  @IsOptional() @IsString() @MaxLength(5000) descriptionRu?: string;
  @IsOptional() @IsString() @IsIn(["UZS"]) currency?: string;
  @IsInt() @Min(1) @Max(2_147_483_647) priceMinor!: number;
  @IsOptional() @IsString() @MaxLength(2048) imageUrl?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) imageUrls?: string[];
  @IsOptional() attributes?: Record<string, string>;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => SellerProductVariantDto) variants?: SellerProductVariantDto[];
  @IsOptional() @IsInt() @Min(1) @Max(999999) stock?: number;
  @IsOptional() @IsInt() @Min(1) @Max(90) discountPercent?: number;
  @IsOptional() @IsString() @MaxLength(120) sellerCity?: string;
  @IsOptional() @IsString() @MaxLength(120) sellerDistrict?: string;
  @IsOptional() @IsIn(["PICKUP", "SELLER_DELIVERY", "URIONA_PARTNER", "OTHER"]) pickupMethod?: string;
  @IsOptional() @IsIn(["EMU_EXPRESS", "UZPOST"]) shippingCarrier?: "EMU_EXPRESS" | "UZPOST";
  @IsOptional() @IsIn(["SENDER", "RECIPIENT"]) shippingPayer?: "SENDER" | "RECIPIENT";
  @IsOptional() @IsString() @MaxLength(190) dispatchBranchId?: string;
  @IsOptional() @IsString() @MaxLength(200) dispatchPointName?: string;
  @IsOptional() @IsString() @MaxLength(500) dispatchPointAddress?: string;
  @IsOptional() @IsIn(["DRAFT", "PENDING_REVIEW"]) status?: "DRAFT" | "PENDING_REVIEW";
  @IsOptional() @IsBoolean() publicationRulesAccepted?: boolean;
  @IsOptional() @IsBoolean() restrictedGoodsConfirmed?: boolean;
}

class FinancialActionDto {
  @IsIn(["PAYOUT", "REFUND", "EXPENSE"]) type!: "PAYOUT" | "REFUND" | "EXPENSE";
  @IsInt() @Min(1) @Max(2_147_483_647) amountMinor!: number;
  @IsString() @IsNotEmpty() @MaxLength(1000) description!: string;
  @IsOptional() @IsString() @MaxLength(190) reference?: string;
}

class DeleteImageDto {
  @IsString() @IsNotEmpty() @MaxLength(2048) imageUrl!: string;
}

@Controller()
export class SellerCatalogController {
  constructor(private readonly catalog: SellerCatalogService, private readonly auth: AuthService) {}

  private async sellerId(authorization?: string): Promise<string> {
    const token = authorization?.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new UnauthorizedException("Bearer token is required");
    const user = await this.auth.validateSession(token);
    if (user.role !== "SELLER" && user.role !== "ADMIN") throw new ForbiddenException("Seller access is required");
    return user.id;
  }

  @Get("shipping-branches")
  shippingBranches(@Query("carrier") carrier?: "EMU_EXPRESS" | "UZPOST") {
    return this.catalog.listShippingBranches(carrier);
  }

  @Get("seller/products")
  sellerProducts(@Headers("authorization") authorization?: string) {
    return this.sellerId(authorization).then((sellerId) => this.catalog.listProducts(sellerId));
  }

  @Get("seller/billing")
  sellerBilling(@Headers("authorization") authorization?: string) {
    return this.sellerId(authorization).then((sellerId) => this.catalog.getBilling(sellerId));
  }

  @Get("seller/financial-actions")
  sellerFinancialActions(@Headers("authorization") authorization?: string) {
    return this.sellerId(authorization).then((sellerId) => this.catalog.listFinancialActions(sellerId));
  }

  @Post("seller/financial-actions")
  createSellerFinancialAction(@Headers("authorization") authorization: string | undefined, @Body() body: FinancialActionDto) {
    return this.sellerId(authorization).then((sellerId) => this.catalog.createFinancialAction(sellerId, body));
  }

  @Post("seller/products")
  saveSellerProduct(@Headers("authorization") authorization: string | undefined, @Body() body: SellerProductDto) {
    return this.sellerId(authorization).then((sellerId) => this.catalog.saveProduct(sellerId, body));
  }

  @Patch("seller/products/:id/archive")
  archiveSellerProduct(@Headers("authorization") authorization: string | undefined, @Param("id") id: string) {
    return this.sellerId(authorization).then((sellerId) => this.catalog.archiveProduct(sellerId, id));
  }

  @Post("seller/images")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async uploadSellerImage(@Headers("authorization") authorization: string | undefined, @UploadedFile() file: ProductImageUpload) {
    const sellerId = await this.sellerId(authorization);
    const uploaded = await this.catalog.uploadImage(sellerId, file);
    return uploaded;
  }

  @Delete("seller/images")
  deleteSellerImage(@Headers("authorization") authorization: string | undefined, @Body() body: DeleteImageDto) {
    return this.sellerId(authorization).then((sellerId) => this.catalog.deleteImage(sellerId, body.imageUrl));
  }
}

class SellerProductVariantDto {
  @IsString() @IsNotEmpty() @MaxLength(100) label!: string;
  @IsInt() @Min(0) @Max(2_147_483_647) stock!: number;
}