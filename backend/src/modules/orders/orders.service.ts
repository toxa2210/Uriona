import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { AliexpressService, type AliExpressFreightOption } from "../integrations/aliexpress/aliexpress.service";

const SAVE10_MIN_SUBTOTAL_MINOR = 50_000_000;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aliexpress: AliexpressService,
  ) {}

  async quoteShipping(items: Array<{
    productId: string;
    supplierProductId: string;
    supplierSkuId: string;
    quantity: number;
  }>) {
    if (!items.length) {
      throw new BadRequestException("Shipping quote must contain at least one item");
    }
    if (new Set(items.map((item) => item.productId)).size !== items.length) {
      throw new BadRequestException("Duplicate quote items must be combined");
    }

    return Promise.all(items.map(async (item) => {
      const currentSku = await this.aliexpress.marketplaceSkuForOrder(
        item.supplierProductId,
        item.supplierSkuId,
        item.quantity,
      );
      const shippingOptions = await this.aliexpress.freightOptions({
        productId: item.supplierProductId,
        selectedSkuId: item.supplierSkuId,
        quantity: String(item.quantity),
        shipToCountry: "UZ",
        currency: "UZS",
        language: "ru_RU",
        locale: "ru_RU",
      });
      return {
        productId: item.productId,
        supplierProductId: item.supplierProductId,
        supplierSkuId: item.supplierSkuId,
        quantity: item.quantity,
        title: currentSku.title,
        unitPriceMinor: currentSku.unitPriceMinor,
        shippingOptions,
      };
    }));
  }

  async create(input: {
    userId: string;
    deliveryAddress: string;
    recipientName: string;
    recipientPhone: string;
    deliveryCity: string;
    promoCode?: string;
    items: Array<{
      productId: string;
      quantity: number;
      supplierProductId?: string;
      supplierSkuId?: string;
      productTitle?: string;
      variantLabel?: string;
      imageUrl?: string;
      unitPriceMinor?: number;
      shippingOptionCode?: string;
      shippingFeeMinor?: number;
      shippingCompany?: string;
      shippingFeeFormat?: string;
      shippingCurrency?: string;
      shippingMinDays?: string;
      shippingMaxDays?: string;
      shippingTracking?: boolean;
      shippingQuoteQuantity?: number;
    }>;
  }) {
    const items = input.items;
    if (!items.length) {
      throw new BadRequestException("Order must contain at least one item");
    }

    const ids = items.map((item) => item.productId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException("Duplicate order items must be combined");
    }

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) {
        throw new BadRequestException("Invalid product quantity");
      }
      if (item.productId.length > 190) {
        throw new BadRequestException("Product identifier is too long");
      }
      if (item.supplierProductId) {
        if (!/^\d+$/.test(item.supplierProductId) || !item.productTitle?.trim()) {
          throw new BadRequestException("Marketplace order items require a valid product ID and title");
        }
        if (!Number.isSafeInteger(item.unitPriceMinor) || (item.unitPriceMinor ?? 0) < 1) {
          throw new BadRequestException("Marketplace item price is invalid");
        }
        if (!item.shippingOptionCode || item.shippingQuoteQuantity !== item.quantity) {
          throw new BadRequestException("A current shipping quote is required for every marketplace item");
        }
        if (!Number.isSafeInteger(item.shippingFeeMinor) || (item.shippingFeeMinor ?? -1) < 0) {
          throw new BadRequestException("A converted UZS shipping quote is required");
        }
        if (!/^\d+$/.test(item.supplierSkuId ?? "")) {
          throw new BadRequestException("A valid marketplace SKU is required");
        }
      }
    }

    const marketplaceItems = new Map<string, {
      title: string;
      unitPriceMinor: number;
      freight: AliExpressFreightOption;
    }>();
    for (const item of items.filter((line) => line.supplierProductId)) {
      const supplierProductId = item.supplierProductId!;
      const supplierSkuId = item.supplierSkuId!;
      const currentSku = await this.aliexpress.marketplaceSkuForOrder(
        supplierProductId,
        supplierSkuId,
        item.quantity,
      );
      if (!item.unitPriceMinor || item.unitPriceMinor !== currentSku.unitPriceMinor) {
        throw new ConflictException("A marketplace price changed. Refresh the cart before placing the order.");
      }
      const freightOptions = await this.aliexpress.freightOptions({
        productId: supplierProductId,
        selectedSkuId: supplierSkuId,
        quantity: String(item.quantity),
        shipToCountry: "UZ",
        currency: "UZS",
        language: "ru_RU",
        locale: "ru_RU",
      });
      const freight = freightOptions.find((option) => option.code === item.shippingOptionCode);
      if (!freight) {
        throw new ConflictException("The selected delivery option is no longer available. Recalculate delivery.");
      }
      if (item.shippingFeeMinor !== freight.feeUzsMinor) {
        throw new ConflictException("The delivery price changed. Refresh the shipping quote before placing the order.");
      }
      marketplaceItems.set(item.productId, {
        title: currentSku.title || item.productTitle!.trim(),
        unitPriceMinor: currentSku.unitPriceMinor,
        freight,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const orderItems: Array<{
        productId: string;
        quantity: number;
        unitPriceMinor: number;
        supplierProductId?: string;
        supplierSkuId?: string;
        productTitle?: string;
        variantLabel?: string;
        imageUrl?: string;
        shippingOptionCode?: string;
        shippingFeeMinor?: number;
        shippingCompany?: string;
        shippingFeeFormat?: string;
        shippingCurrency?: string;
        shippingMinDays?: string;
        shippingMaxDays?: string;
        shippingTracking?: boolean;
        shippingQuoteQuantity?: number;
      }> = [];
      let subtotalMinor = 0;
      let deliveryMinor = 0;

      for (const item of items) {
        if (item.supplierProductId) {
          const marketplaceItem = marketplaceItems.get(item.productId);
          if (!marketplaceItem) throw new BadRequestException("Marketplace item verification failed");
          const { freight } = marketplaceItem;
          const priceMinor = marketplaceItem.unitPriceMinor;
          await tx.product.upsert({
            where: { id: item.productId },
            create: {
              id: item.productId,
              titleUz: marketplaceItem.title,
              titleRu: marketplaceItem.title,
              currency: "UZS",
              priceMinor,
              status: "ACTIVE",
              supplierProductRef: item.supplierProductId,
            },
            update: {
              titleUz: marketplaceItem.title,
              titleRu: marketplaceItem.title,
              currency: "UZS",
              priceMinor,
              status: "ACTIVE",
              supplierProductRef: item.supplierProductId,
            },
          });
          orderItems.push({
            productId: item.productId,
            quantity: item.quantity,
            unitPriceMinor: priceMinor,
            supplierProductId: item.supplierProductId,
            supplierSkuId: item.supplierSkuId,
            productTitle: marketplaceItem.title,
            variantLabel: item.variantLabel,
            imageUrl: item.imageUrl,
            shippingOptionCode: item.shippingOptionCode,
            shippingFeeMinor: freight.feeUzsMinor,
            shippingCompany: freight.company,
            shippingFeeFormat: freight.feeFormat,
            shippingCurrency: freight.currency,
            shippingMinDays: freight.minDeliveryDays,
            shippingMaxDays: freight.maxDeliveryDays,
            shippingTracking: freight.tracking ?? undefined,
            shippingQuoteQuantity: item.shippingQuoteQuantity,
          });
          subtotalMinor += priceMinor * item.quantity;
          deliveryMinor += freight.feeUzsMinor;
          continue;
        }

        const product = await tx.product.findFirst({
          where: { id: item.productId, status: "ACTIVE" },
        });
        if (!product) throw new BadRequestException("One or more products are unavailable");
        orderItems.push({
          productId: product.id,
          quantity: item.quantity,
          unitPriceMinor: product.priceMinor,
        });
        subtotalMinor += product.priceMinor * item.quantity;
      }

      if (!Number.isSafeInteger(subtotalMinor) || !Number.isSafeInteger(deliveryMinor)
        || subtotalMinor + deliveryMinor > 2_147_483_647) {
        throw new BadRequestException("Order total exceeds the supported limit");
      }
      const promoCode = input.promoCode?.trim().toUpperCase() || null;
      if (promoCode && promoCode !== "SAVE10") {
        throw new BadRequestException("Promo code is not valid");
      }
      const discountMinor = promoCode === "SAVE10" && subtotalMinor >= SAVE10_MIN_SUBTOTAL_MINOR
        ? Math.round(subtotalMinor * 0.1)
        : 0;
      const totalMinor = subtotalMinor - discountMinor + deliveryMinor;

      return tx.order.create({
        data: {
          userId: input.userId,
          deliveryAddress: input.deliveryAddress.trim(),
          recipientName: input.recipientName?.trim() || null,
          recipientPhone: input.recipientPhone?.trim() || null,
          deliveryCity: input.deliveryCity?.trim() || null,
          subtotalMinor,
          deliveryMinor,
          totalMinor,
          discountMinor,
          promoCode: discountMinor ? promoCode : null,
          currency: "UZS",
          status: "AWAITING_PAYMENT",
          items: { create: orderItems },
        },
        include: { items: { include: { product: true } } },
      });
    });
  }

  listForUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { items: { include: { product: true } } }
    });
  }
}
