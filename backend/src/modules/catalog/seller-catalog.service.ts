import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, ShippingCarrier, ShippingPayer } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { R2StorageService, type ProductImageUpload } from "./r2-storage.service";

interface SellerProductInput {
  id?: string;
  categoryId?: string | null;
  titleUz: string;
  titleRu?: string;
  descriptionUz?: string;
  descriptionRu?: string;
  priceMinor: number;
  imageUrl?: string;
  imageUrls?: string[];
  attributes?: Record<string, string>;
  variants?: Array<{ label: string; stock: number }>;
  stock?: number;
  discountPercent?: number;
  sellerCity?: string;
  sellerDistrict?: string;
  pickupMethod?: string;
  shippingCarrier?: ShippingCarrier;
  shippingPayer?: ShippingPayer;
  dispatchBranchId?: string;
  dispatchPointName?: string;
  dispatchPointAddress?: string;
  publicationRulesAccepted?: boolean;
  restrictedGoodsConfirmed?: boolean;
  status?: "DRAFT" | "PENDING_REVIEW";
}

@Injectable()
export class SellerCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: R2StorageService,
  ) {}

  listShippingBranches(carrier?: ShippingCarrier) {
    return this.prisma.shippingBranch.findMany({
      where: { isActive: true, ...(carrier ? { carrier } : {}) },
      orderBy: [{ region: "asc" }, { locality: "asc" }, { name: "asc" }],
    });
  }

  async uploadImage(sellerId: string, file: ProductImageUpload) {
    const uploaded = await this.storage.uploadProductImage(file);
    try {
      await this.prisma.productImageAsset.create({
        data: { sellerId, imageUrl: uploaded.imageUrl, objectKey: this.storage.getObjectKey(uploaded.imageUrl) },
      });
      return uploaded;
    } catch (error) {
      await this.storage.deleteProductImage(uploaded.imageUrl);
      throw error;
    }
  }

  listProducts(sellerId: string) {
    return this.prisma.product.findMany({
      where: { sellerId }, orderBy: { updatedAt: "desc" }, include: { category: true },
    });
  }

  async getBilling(sellerId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: { product: { sellerId } },
      select: { quantity: true, unitPriceMinor: true, order: { select: { status: true, currency: true } } },
    });
    return items.reduce((summary, item) => {
      const amount = item.quantity * item.unitPriceMinor;
      summary.orderItems += 1;
      summary.grossMinor += amount;
      if (["AWAITING_PAYMENT", "CREATED"].includes(item.order.status)) summary.awaitingPaymentMinor += amount;
      if (["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(item.order.status)) summary.confirmedSalesMinor += amount;
      if (item.order.status === "DELIVERED") summary.deliveredSalesMinor += amount;
      summary.currency = item.order.currency || summary.currency;
      return summary;
    }, { orderItems: 0, grossMinor: 0, awaitingPaymentMinor: 0, confirmedSalesMinor: 0, deliveredSalesMinor: 0, currency: "UZS" });
  }

  listFinancialActions(sellerId: string) {
    return this.prisma.financialActionRequest.findMany({
      where: { sellerId }, orderBy: { createdAt: "desc" }, take: 50,
      select: { id: true, type: true, status: true, amountMinor: true, currency: true, description: true, reviewNote: true, createdAt: true },
    });
  }

  createFinancialAction(sellerId: string, input: { type: "PAYOUT" | "REFUND" | "EXPENSE"; amountMinor: number; description: string; reference?: string }) {
    return this.prisma.financialActionRequest.create({
      data: {
        sellerId, type: input.type, amountMinor: input.amountMinor, currency: "UZS",
        description: input.description.trim(), reference: input.reference?.trim() || null,
      },
      select: { id: true, type: true, status: true },
    });
  }

  async saveProduct(sellerId: string, input: SellerProductInput) {
    const imageUrls = Array.from(new Set((input.imageUrls ?? (input.imageUrl ? [input.imageUrl] : [])).map((url) => url.trim()).filter(Boolean)));
    if (imageUrls.length > 10) throw new ForbiddenException("A product can have at most 10 photos");
    const requestingPublication = input.status === "PENDING_REVIEW";
    if (requestingPublication && (!input.categoryId || !input.descriptionRu?.trim() || !imageUrls.length || !input.sellerCity?.trim() || !input.publicationRulesAccepted || !input.restrictedGoodsConfirmed)) {
      throw new ForbiddenException("Publication requires a category, description, photo, seller city, and all required confirmations");
    }

    const carrier = input.shippingCarrier ?? ShippingCarrier.EMU_EXPRESS;
    const payer = input.shippingPayer ?? ShippingPayer.RECIPIENT;
    const dispatchBranch = input.dispatchBranchId
      ? await this.prisma.shippingBranch.findFirst({ where: { id: input.dispatchBranchId, isActive: true, carrier } })
      : null;
    if (input.dispatchBranchId && !dispatchBranch) throw new NotFoundException("Selected shipping branch is not available for this carrier");
    if (requestingPublication && carrier === ShippingCarrier.EMU_EXPRESS && !dispatchBranch) throw new ForbiddenException("Select an EMU Express dispatch branch before publication");
    if (requestingPublication && carrier === ShippingCarrier.UZPOST && (!input.dispatchPointName?.trim() || !input.dispatchPointAddress?.trim())) {
      throw new ForbiddenException("Enter the UzPost dispatch office name and address before publication");
    }

    const baseUrl = this.config.get<string>("R2_PUBLIC_BASE_URL");
    const validImages = imageUrls.every((url) => {
      try {
        if (!baseUrl) return false;
        const image = new URL(url);
        const base = new URL(baseUrl);
        const key = image.pathname.slice(base.pathname.replace(/\/+$/, "").length + 1);
        return image.origin === base.origin && !image.search && !image.hash && /^products\/[0-9a-f-]+\.(jpg|png|webp)$/i.test(key);
      } catch { return false; }
    });
    if (!validImages) throw new ForbiddenException("Product photos must be uploaded to the Uriona image store");
    const ownedImages = await this.prisma.productImageAsset.count({
      where: { sellerId, imageUrl: { in: imageUrls } },
    });
    if (ownedImages !== imageUrls.length) throw new ForbiddenException("Product photos must be uploaded by your account");

    const category = input.categoryId
      ? await this.prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true, attributes: true } })
      : null;
    if (input.categoryId && !category) throw new NotFoundException("Category not found");
    const allowed = category?.attributes && typeof category.attributes === "object" && !Array.isArray(category.attributes)
      ? category.attributes as Record<string, unknown> : {};
    const attributes = Object.fromEntries(Object.entries(input.attributes ?? {}).filter(([key, value]) => key in allowed && typeof value === "string" && value.trim()));
    const variants = (input.variants ?? []).filter((variant) => typeof variant.label === "string" && Number.isInteger(variant.stock) && variant.stock >= 0)
      .map((variant) => ({ label: variant.label.trim().slice(0, 100), stock: variant.stock }));
    const data = {
      categoryId: input.categoryId || null,
      titleUz: input.titleUz.trim(), titleRu: input.titleRu?.trim() || null,
      descriptionUz: input.descriptionUz?.trim() || null, descriptionRu: input.descriptionRu?.trim() || null,
      currency: "UZS", priceMinor: input.priceMinor, imageUrl: imageUrls[0] ?? null,
      imageUrls: imageUrls as Prisma.InputJsonValue, attributes: attributes as Prisma.InputJsonValue,
      variants: variants as Prisma.InputJsonValue, stock: input.stock ?? 1,
      discountPercent: input.discountPercent ?? null, condition: "NEW" as const,
      sellerCity: input.sellerCity?.trim() || null, sellerDistrict: input.sellerDistrict?.trim() || null,
      pickupMethod: input.pickupMethod ?? "SELLER_DELIVERY", shippingCarrier: carrier, shippingPayer: payer,
      dispatchBranchId: dispatchBranch?.id ?? null,
      dispatchPointName: carrier === ShippingCarrier.UZPOST ? input.dispatchPointName?.trim() || null : dispatchBranch?.name ?? null,
      dispatchPointAddress: carrier === ShippingCarrier.UZPOST ? input.dispatchPointAddress?.trim() || null : dispatchBranch?.address ?? null,
      publicationRulesAcceptedAt: input.publicationRulesAccepted ? new Date() : null,
      restrictedGoodsConfirmedAt: input.restrictedGoodsConfirmed ? new Date() : null,
      status: requestingPublication ? "PENDING_REVIEW" as const : input.status ?? "DRAFT" as const,
    };

    if (input.id) {
      const existing = await this.prisma.product.findUnique({ where: { id: input.id }, select: { sellerId: true, status: true } });
      if (!existing) throw new NotFoundException("Product not found");
      if (existing.sellerId !== sellerId) throw new ForbiddenException("You can only edit your own products");
      if (existing.status === "ACTIVE" && !requestingPublication) data.status = "PENDING_REVIEW";
      const updated = await this.prisma.product.update({
        where: { id: input.id },
        data,
        include: {
          category: true,
          seller: { select: { name: true, email: true, phone: true } }
        }
      });
      if (updated.status === "PENDING_REVIEW" && existing.status !== "PENDING_REVIEW") {
        await this.notifyTelegramModeration(updated);
      }
      return updated;
    }
    const created = await this.prisma.product.create({
      data: { ...data, sellerId },
      include: {
        category: true,
        seller: { select: { name: true, email: true, phone: true } }
      }
    });
    if (created.status === "PENDING_REVIEW") await this.notifyTelegramModeration(created);
    return created;
  }

  private async notifyTelegramModeration(product: {
    id: string;
    titleRu: string | null;
    titleUz: string;
    priceMinor: number;
    sellerCity: string | null;
    seller?: { name: string | null; email: string | null; phone: string | null } | null;
  }) {
    const botToken = this.config.get<string>("TELEGRAM_BOT_TOKEN");
    const chatId = this.config.get<string>("TELEGRAM_CHAT_ID");
    if (!botToken || !chatId) {
      console.warn("Telegram moderation alert skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured");
      return;
    }
    const text = [
      "🔔 URIONA — новый товар на модерации",
      `Товар: ${product.titleRu || product.titleUz}`,
      `Цена: ${new Intl.NumberFormat("ru-RU").format(Math.round(product.priceMinor / 100))} сум`,
      `Продавец: ${product.seller?.name || "Не указано"}`,
      `Email: ${product.seller?.email || "не указан"}`,
      `Телефон: ${product.seller?.phone || "не указан"}`,
      `Город: ${product.sellerCity || "не указан"}`,
      `ID товара: ${product.id}`,
      "Откройте CRM → Модерация, чтобы одобрить товар или вернуть продавцу."
    ].join("\n");
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
      if (!response.ok || !result?.ok) {
        console.error("Telegram moderation alert failed:", result?.description || `HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Telegram moderation alert failed:", error instanceof Error ? error.message : "Unknown error");
    }
  }

  archiveProduct(sellerId: string, id: string) {
    return this.prisma.product.findUnique({ where: { id }, select: { sellerId: true } }).then(async (product) => {
      if (!product) throw new NotFoundException("Product not found");
      if (product.sellerId !== sellerId) throw new ForbiddenException("You can only archive your own products");
      return this.prisma.product.update({ where: { id }, data: { status: "ARCHIVED" } });
    });
  }

  async deleteImage(sellerId: string, imageUrl: string) {
    const asset = await this.prisma.productImageAsset.findUnique({ where: { imageUrl } });
    if (!asset || asset.sellerId !== sellerId) throw new ForbiddenException("You can only delete images uploaded by your account");
    const used = await this.prisma.product.count({ where: { OR: [{ imageUrl }, { imageUrls: { array_contains: imageUrl } }] } });
    if (used) throw new ConflictException("This image is still attached to a product");
    await this.storage.deleteProductImage(imageUrl);
    await this.prisma.productImageAsset.delete({ where: { id: asset.id } });
    return { deleted: true as const };
  }
}