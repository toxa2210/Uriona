import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { AuthService } from "../auth/auth.service";
import { OrdersService } from "./orders.service";

class ItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(190)
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(999)
  quantity!: number;

  @IsOptional() @IsString() @MaxLength(32)
  supplierProductId?: string;

  @IsOptional() @IsString() @MaxLength(32)
  supplierSkuId?: string;

  @IsOptional() @IsString() @MaxLength(500)
  productTitle?: string;

  @IsOptional() @IsString() @MaxLength(500)
  variantLabel?: string;

  @IsOptional() @IsString() @MaxLength(2048)
  imageUrl?: string;

  @IsOptional() @IsInt() @Min(1) @Max(2_147_483_647)
  unitPriceMinor?: number;

  @IsOptional() @IsString() @MaxLength(128)
  shippingOptionCode?: string;

  @IsOptional() @IsInt() @Min(0) @Max(2_147_483_647)
  shippingFeeMinor?: number;

  @IsOptional() @IsString() @MaxLength(128)
  shippingCompany?: string;

  @IsOptional() @IsString() @MaxLength(128)
  shippingFeeFormat?: string;

  @IsOptional() @IsString() @MaxLength(3)
  shippingCurrency?: string;

  @IsOptional() @IsString() @MaxLength(32)
  shippingMinDays?: string;

  @IsOptional() @IsString() @MaxLength(32)
  shippingMaxDays?: string;

  @IsOptional() @IsBoolean()
  shippingTracking?: boolean;

  @IsOptional() @IsInt() @Min(1) @Max(999)
  shippingQuoteQuantity?: number;
}

class CreateOrderDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  recipientName!: string;

  @IsString() @IsNotEmpty() @MaxLength(40) @Matches(/^\+?[0-9()\-\s]{7,40}$/)
  recipientPhone!: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  deliveryCity!: string;

  @IsString() @IsNotEmpty() @MaxLength(1000)
  deliveryAddress!: string;

  @IsOptional() @IsString() @MaxLength(32)
  promoCode?: string;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => ItemDto)
  items!: ItemDto[];
}

class ShippingQuoteItemDto {
  @IsString() @IsNotEmpty() @MaxLength(190)
  productId!: string;

  @IsString() @IsNotEmpty() @MaxLength(32)
  supplierProductId!: string;

  @IsString() @IsNotEmpty() @MaxLength(32)
  supplierSkuId!: string;

  @IsInt() @Min(1) @Max(999)
  quantity!: number;
}

class ShippingQuotesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => ShippingQuoteItemDto)
  items!: ShippingQuoteItemDto[];
}

@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService, private readonly auth: AuthService) {}

  @Post("shipping-quotes")
  async quoteShipping(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: ShippingQuotesDto,
  ) {
    await this.auth.validateSession(authorization?.replace(/^Bearer\s+/i, "") ?? "");
    return this.orders.quoteShipping(body.items);
  }

  @Post()
  async create(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: CreateOrderDto,
  ) {
    const user = await this.auth.validateSession(authorization?.replace(/^Bearer\s+/i, "") ?? "");
    return this.orders.create({
      userId: user.id,
      recipientName: body.recipientName,
      recipientPhone: body.recipientPhone,
      deliveryCity: body.deliveryCity,
      deliveryAddress: body.deliveryAddress,
      promoCode: body.promoCode,
      items: body.items,
    });
  }

  @Get()
  async list(@Headers("authorization") authorization: string | undefined) {
    const user = await this.auth.validateSession(authorization?.replace(/^Bearer\s+/i, "") ?? "");
    return this.orders.listForUser(user.id);
  }
}
