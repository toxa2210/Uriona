import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrderPayment(orderId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { payments: { orderBy: { createdAt: "desc" } } }
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async getOrderForProvider(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: { orderBy: { createdAt: "desc" } } }
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async createProviderPayment(input: {
    orderId: string;
    provider: string;
    externalRef: string;
    amountMinor: number;
    currency?: string;
    status?: "PENDING" | "PROCESSING" | "PAID";
  }) {
    return this.prisma.payment.create({
      data: {
        orderId: input.orderId,
        provider: input.provider,
        externalRef: input.externalRef,
        amountMinor: input.amountMinor,
        currency: input.currency ?? "UZS",
        status: input.status ?? "PROCESSING"
      }
    });
  }

  async findByProviderRef(provider: string, externalRef: string) {
    return this.prisma.payment.findUnique({
      where: { provider_externalRef: { provider, externalRef } }
    });
  }

  async markPaid(paymentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException("Payment not found");
      if (payment.status === "PAID") return payment;
      if (payment.status === "REFUNDED" || payment.status === "FAILED") {
        throw new BadRequestException("Payment cannot be marked as paid");
      }

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: { status: "PAID" }
      });

      await tx.order.updateMany({
        where: { id: payment.orderId, status: "AWAITING_PAYMENT" },
        data: { status: "PAID" }
      });

      await tx.financeEntry.createMany({
        data: [{
          type: "INCOME",
          source: "PAYMENT",
          category: "Оплата заказа",
          description: `Оплата заказа ${payment.orderId}`,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          occurredAt: new Date(),
          referenceId: payment.id,
          paymentId: payment.id,
          orderId: payment.orderId
        }],
        skipDuplicates: true
      });

      return updated;
    });
  }

  async markRefunded(paymentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException("Payment not found");

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: { status: "REFUNDED" }
      });

      if (payment.status === "PAID") {
        await tx.financeEntry.createMany({
          data: [{
            type: "EXPENSE",
            source: "REFUND",
            category: "Возврат оплаты",
            description: `Возврат оплаты по заказу ${payment.orderId}`,
            amountMinor: payment.amountMinor,
            currency: payment.currency,
            occurredAt: new Date(),
            referenceId: payment.id,
            paymentId: payment.id,
            orderId: payment.orderId
          }],
          skipDuplicates: true
        });
      }

      await tx.order.updateMany({
        where: { id: payment.orderId, status: { in: ["AWAITING_PAYMENT", "PAID"] } },
        data: { status: "CANCELLED" }
      });

      return updated;
    });
  }
}
