import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateCart(userId: string) {
    return this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {}
    });
  }

  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: { product: true },
      orderBy: { createdAt: "asc" }
    });
    const totalMinor = items.reduce((sum, item) => sum + item.product.priceMinor * item.quantity, 0);
    return {
      id: cart.id,
      items,
      itemsCount: items.reduce((sum, item) => sum + item.quantity, 0),
      totalMinor,
      currency: items[0]?.product.currency ?? "UZS"
    };
  }

  async addItem(userId: string, productId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new BadRequestException({ code: "INVALID_QUANTITY", message: "Недопустимое количество" });
    }
    const product = await this.prisma.product.findFirst({ where: { id: productId, status: "ACTIVE" } });
    if (!product) throw new NotFoundException({ code: "PRODUCT_NOT_FOUND", message: "Товар не найден" });

    const cart = await this.getOrCreateCart(userId);
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } }
    });
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > 999) {
      throw new BadRequestException({ code: "INVALID_QUANTITY", message: "Максимум 999 единиц одного товара" });
    }
    if (existing) {
      await this.prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: nextQuantity } });
    } else {
      await this.prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity } });
    }
    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new BadRequestException({ code: "INVALID_QUANTITY", message: "Недопустимое количество" });
    }
    const cart = await this.getOrCreateCart(userId);
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException({ code: "CART_ITEM_NOT_FOUND", message: "Позиция не найдена в корзине" });
    await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId: cart.id } });
    if (!item) throw new NotFoundException({ code: "CART_ITEM_NOT_FOUND", message: "Позиция не найдена в корзине" });
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.getCart(userId);
  }

  async clear(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(userId);
  }
}
