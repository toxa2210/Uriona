import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../../database/prisma.service";

const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

@Injectable()
export class SupplierPurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async createForPaidOrder(orderId: string, idempotencyKey: string) {
    const existingByKey = await this.prisma.supplierPurchase.findUnique({
      where: { idempotencyKey },
    });
    if (existingByKey) {
      if (existingByKey.orderId !== orderId) {
        throw new ConflictException("Idempotency key is already used for another order");
      }
      return existingByKey;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status !== "PAID") {
      throw new ConflictException("Supplier purchase can only be created for a paid order");
    }
    if (!order.items.length || !order.items.some((item) => item.supplierProductId)) {
      throw new BadRequestException("Order has no supported marketplace items");
    }

    const requestFingerprint = fingerprint({
      orderId: order.id,
      currency: order.currency,
      items: order.items.map((item) => ({
        productId: item.productId,
        supplierProductId: item.supplierProductId,
        supplierSkuId: item.supplierSkuId,
        quantity: item.quantity,
        shippingOptionCode: item.shippingOptionCode,
        shippingFeeMinor: item.shippingFeeMinor,
      })),
    });

    const existingForOrder = await this.prisma.supplierPurchase.findUnique({
      where: { orderId_provider: { orderId, provider: "aliexpress" } },
    });
    if (existingForOrder) return existingForOrder;

    return this.prisma.supplierPurchase.create({
      data: {
        orderId,
        provider: "aliexpress",
        idempotencyKey,
        requestFingerprint,
        status: "PENDING",
      },
    });
  }

  async markReady(
    purchaseId: string,
    input: { supplierAmountMinor: number; supplierShippingMinor: number; currency: string },
  ) {
    if (!Number.isSafeInteger(input.supplierAmountMinor) || input.supplierAmountMinor < 1) {
      throw new BadRequestException("Supplier item amount must be a positive integer in minor units");
    }
    if (!Number.isSafeInteger(input.supplierShippingMinor) || input.supplierShippingMinor < 0) {
      throw new BadRequestException("Supplier shipping amount must be a non-negative integer in minor units");
    }
    const currency = input.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new BadRequestException("Invalid ISO currency code");

    const purchase = await this.prisma.supplierPurchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) throw new NotFoundException("Supplier purchase not found");
    if (purchase.status !== "PENDING" && purchase.status !== "FAILED") {
      throw new ConflictException("Only pending or failed purchases can be prepared");
    }

    return this.prisma.supplierPurchase.update({
      where: { id: purchaseId },
      data: {
        status: "READY",
        supplierAmountMinor: input.supplierAmountMinor,
        supplierShippingMinor: input.supplierShippingMinor,
        supplierCurrency: currency,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
  }

  async createSettlement(
    purchaseId: string,
    idempotencyKey: string,
    input: {
      beneficiaryName: string;
      beneficiaryBank: string;
      beneficiaryAccountRef: string;
      contractReference: string;
      currency: string;
      amountMinor: number;
    },
  ) {
    const existing = await this.prisma.supplierSettlement.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      if (existing.purchaseId !== purchaseId) {
        throw new ConflictException("Idempotency key is already used for another purchase");
      }
      return existing;
    }

    const purchase = await this.prisma.supplierPurchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase) throw new NotFoundException("Supplier purchase not found");
    if (purchase.status !== "READY" && purchase.status !== "PLACED") {
      throw new ConflictException("Settlement requires a prepared or placed supplier purchase");
    }
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1) {
      throw new BadRequestException("Settlement amount must be a positive integer in minor units");
    }

    const required = [
      input.beneficiaryName,
      input.beneficiaryBank,
      input.beneficiaryAccountRef,
      input.contractReference,
    ];
    if (required.some((value) => !value?.trim())) {
      throw new BadRequestException("Beneficiary and contract references are required");
    }
    const currency = input.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new BadRequestException("Invalid ISO currency code");
    if (currency !== purchase.supplierCurrency) {
      throw new ConflictException("Settlement currency must match the supplier purchase currency");
    }
    if (purchase.supplierAmountMinor === null || purchase.supplierAmountMinor === undefined
      || purchase.supplierShippingMinor === null || purchase.supplierShippingMinor === undefined) {
      throw new ConflictException("Supplier amount and shipping quote must be recorded before settlement");
    }
    if (input.amountMinor !== purchase.supplierAmountMinor + purchase.supplierShippingMinor) {
      throw new ConflictException("Settlement amount must equal supplier items plus shipping");
    }

    return this.prisma.supplierSettlement.create({
      data: {
        purchaseId,
        idempotencyKey,
        beneficiaryName: input.beneficiaryName.trim(),
        beneficiaryBank: input.beneficiaryBank.trim(),
        // This must be a reference to a protected vault/record, not a raw account number.
        beneficiaryAccountRef: input.beneficiaryAccountRef.trim(),
        contractReference: input.contractReference.trim(),
        currency,
        amountMinor: input.amountMinor,
        status: "DRAFT",
      },
    });
  }

  async approveSettlement(settlementId: string, adminUserId: string) {
    const settlement = await this.prisma.supplierSettlement.findUnique({ where: { id: settlementId } });
    if (!settlement) throw new NotFoundException("Supplier settlement not found");
    if (settlement.status !== "DRAFT") {
      throw new ConflictException("Only draft settlements can be approved");
    }
    return this.prisma.supplierSettlement.update({
      where: { id: settlementId },
      data: { status: "APPROVED", approvedById: adminUserId, approvedAt: new Date() },
    });
  }

  async markSettlementSent(settlementId: string, bankReference: string) {
    if (!bankReference?.trim()) throw new BadRequestException("Bank transfer reference is required");
    const settlement = await this.prisma.supplierSettlement.findUnique({ where: { id: settlementId } });
    if (!settlement) throw new NotFoundException("Supplier settlement not found");
    if (settlement.status !== "APPROVED") {
      throw new ConflictException("Only approved settlements can be marked as sent");
    }
    return this.prisma.supplierSettlement.update({
      where: { id: settlementId },
      data: { status: "SENT", bankReference: bankReference.trim(), initiatedAt: new Date() },
    });
  }

  async markSettlementSettled(settlementId: string, proofStorageKey: string) {
    if (!proofStorageKey?.trim()) {
      throw new BadRequestException("A protected bank statement/proof reference is required");
    }
    const settlement = await this.prisma.supplierSettlement.findUnique({ where: { id: settlementId } });
    if (!settlement) throw new NotFoundException("Supplier settlement not found");
    if (settlement.status !== "SENT" || !settlement.bankReference) {
      throw new ConflictException("Only sent settlements with a bank reference can be settled");
    }
    return this.prisma.supplierSettlement.update({
      where: { id: settlementId },
      data: { status: "SETTLED", proofStorageKey: proofStorageKey.trim(), settledAt: new Date() },
    });
  }

  async markPlaced(
    purchaseId: string,
    input: { externalOrderId: string; confirmationReference: string },
  ) {
    if (!input.externalOrderId?.trim() || !input.confirmationReference?.trim()) {
      throw new BadRequestException("External supplier order ID and confirmation reference are required");
    }
    const purchase = await this.prisma.supplierPurchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) throw new NotFoundException("Supplier purchase not found");
    if (purchase.status !== "READY" && purchase.status !== "SUBMITTING") {
      throw new ConflictException("Only ready or submitting purchases can be marked as placed");
    }
    const settledCount = await this.prisma.supplierSettlement.count({
      where: { purchaseId, status: "SETTLED" },
    });
    if (settledCount < 1) {
      throw new ConflictException("A confirmed supplier settlement is required before marking the purchase as placed");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.supplierPurchase.update({
        where: { id: purchaseId },
        data: {
          status: "PLACED",
          externalOrderId: input.externalOrderId.trim(),
          confirmationSource: "MANUAL",
          confirmationReference: input.confirmationReference.trim(),
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
      await tx.order.updateMany({
        where: { id: purchase.orderId, status: "PAID" },
        data: { status: "PROCESSING" },
      });
      return updated;
    });
  }
}
