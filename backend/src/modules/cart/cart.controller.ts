import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, UnauthorizedException } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from "class-validator";
import { AuthService } from "../auth/auth.service";
import { CartService } from "./cart.service";

class AddItemDto {
  @IsString() @IsNotEmpty() @MaxLength(190)
  productId!: string;

  @IsInt() @Min(1) @Max(999)
  quantity!: number;
}

class UpdateItemDto {
  @IsInt() @Min(1) @Max(999)
  @Type(() => Number)
  quantity!: number;
}

@Controller("cart")
export class CartController {
  constructor(private readonly cart: CartService, private readonly auth: AuthService) {}

  @Get()
  async getCart(@Headers("authorization") authorization?: string) {
    return this.cart.getCart(await this.userId(authorization));
  }

  @Post("items")
  async addItem(@Headers("authorization") authorization: string | undefined, @Body() body: AddItemDto) {
    return this.cart.addItem(await this.userId(authorization), body.productId, body.quantity);
  }

  @Patch("items/:id")
  async updateItem(@Headers("authorization") authorization: string | undefined, @Param("id") id: string, @Body() body: UpdateItemDto) {
    return this.cart.updateItem(await this.userId(authorization), id, body.quantity);
  }

  @Delete("items/:id")
  async removeItem(@Headers("authorization") authorization: string | undefined, @Param("id") id: string) {
    return this.cart.removeItem(await this.userId(authorization), id);
  }

  @Delete()
  async clear(@Headers("authorization") authorization?: string) {
    return this.cart.clear(await this.userId(authorization));
  }

  private userId(authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new UnauthorizedException({ code: "AUTH_REQUIRED", message: "Требуется авторизация" });
    return this.auth.validateSession(token).then((user) => user.id);
  }
}
