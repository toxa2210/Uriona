import { BadRequestException, ConflictException } from "@nestjs/common";
import { SupplierPurchasesService } from "./supplier-purchases.service";

describe("SupplierPurchasesService", () => {
  let service: SupplierPurchasesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      supplierPurchase: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      supplierSettlement: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
    };
    service = new SupplierPurchasesService(prisma);
  });

  it("rejects supplier purchase creation until the customer order is paid", async () => {
    prisma.supplierPurchase.findUnique.mockResolvedValue(null);
    prisma.order.findUnique.mockResolvedValue({
      id: "order-1",
      status: "AWAITING_PAYMENT",
      currency: "UZS",
      items: [{ supplierProductId: "123", supplierSkuId: "456", quantity: 1 }],
    });

    await expect(service.createForPaidOrder("order-1", "purchase-key"))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.supplierPurchase.create).not.toHaveBeenCalled();
  });

  it("returns the existing purchase for a repeated idempotency key", async () => {
    const existing = { id: "purchase-1", orderId: "order-1" };
    prisma.supplierPurchase.findUnique.mockResolvedValue(existing);

    await expect(service.createForPaidOrder("order-1", "purchase-key")).resolves.toBe(existing);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(prisma.supplierPurchase.create).not.toHaveBeenCalled();
  });

  it("rejects reuse of a purchase idempotency key for another order", async () => {
    prisma.supplierPurchase.findUnique.mockResolvedValue({ id: "purchase-1", orderId: "order-other" });

    await expect(service.createForPaidOrder("order-1", "purchase-key"))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects invalid supplier amount before changing the purchase", async () => {
    prisma.supplierPurchase.findUnique.mockResolvedValue({ id: "purchase-1", status: "PENDING" });

    await expect(service.markReady("purchase-1", {
      supplierAmountMinor: 0,
      supplierShippingMinor: 0,
      currency: "CNY",
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.supplierPurchase.update).not.toHaveBeenCalled();
  });

  it("does not mark a supplier order as placed until a settlement is confirmed", async () => {
    prisma.supplierPurchase.findUnique.mockResolvedValue({
      id: "purchase-1",
      orderId: "order-1",
      status: "READY",
    });
    prisma.supplierSettlement.count.mockResolvedValue(0);

    await expect(service.markPlaced("purchase-1", {
      externalOrderId: "ali-123",
      confirmationReference: "operator-confirmation",
    })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a settlement amount that differs from supplier items plus shipping", async () => {
    prisma.supplierSettlement.findUnique.mockResolvedValue(null);
    prisma.supplierPurchase.findUnique.mockResolvedValue({
      id: "purchase-1",
      status: "READY",
      supplierCurrency: "CNY",
      supplierAmountMinor: 1000,
      supplierShippingMinor: 200,
    });

    await expect(service.createSettlement("purchase-1", "settlement-key", {
      beneficiaryName: "Supplier Ltd",
      beneficiaryBank: "Bank",
      beneficiaryAccountRef: "vault://beneficiary/1",
      contractReference: "invoice-1",
      currency: "CNY",
      amountMinor: 1500,
    })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.supplierSettlement.create).not.toHaveBeenCalled();
  });

  it("requires a bank reference to mark a settlement as sent", async () => {
    prisma.supplierSettlement.findUnique.mockResolvedValue({
      id: "settlement-1",
      status: "APPROVED",
    });

    await expect(service.markSettlementSent("settlement-1", " "))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.supplierSettlement.update).not.toHaveBeenCalled();
  });

  it("requires a sent settlement and bank reference before settlement confirmation", async () => {
    prisma.supplierSettlement.findUnique.mockResolvedValue({
      id: "settlement-1",
      status: "APPROVED",
      bankReference: null,
    });

    await expect(service.markSettlementSettled("settlement-1", "statement/line-1"))
      .rejects.toBeInstanceOf(ConflictException);
    expect(prisma.supplierSettlement.update).not.toHaveBeenCalled();
  });
});
