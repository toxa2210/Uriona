import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../../../database/prisma.service";
import { PaymentsService } from "./payments.service";

@Injectable()
export class ClickService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService
  ) {}

  private md5(value: string) {
    return createHash("md5").update(value).digest("hex");
  }

  verify(body: Record<string, unknown>) {
    const secret = this.config.get<string>("CLICK_SECRET_KEY");
    const serviceId = this.config.get<string>("CLICK_SERVICE_ID");
    if (!secret || !serviceId) throw new ServiceUnavailableException("Click credentials are not configured");

    const common = `${body.click_trans_id}${serviceId}${secret}${body.merchant_trans_id}`;
    const raw = body.action === 1
      ? common + `${body.merchant_prepare_id}${body.amount}${body.action}${body.sign_time}`
      : common + `${body.amount}${body.action}${body.sign_time}`;

    const expected = Buffer.from(this.md5(raw), "utf8");
    const provided = Buffer.from(String(body.sign_string ?? ""), "utf8");
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  }

  async handle(body: Record<string, unknown>) {
    if (!this.verify(body)) return { error: -1, error_note: "SIGN CHECK FAILED!" };

    const orderId = String(body.merchant_trans_id ?? "");
    const amount = Number(body.amount ?? 0);
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });

    if (!order) return { error: -5, error_note: "User does not exist" };
    if (amount !== order.totalMinor) return { error: -2, error_note: "Incorrect parameter amount" };

    if (body.action === 0) {
      const existing = await this.prisma.payment.findFirst({
        where: { orderId, provider: "click", status: { in: ["PROCESSING", "PAID"] } }
      });
      const prepareId = existing?.id ? Number.parseInt(existing.id.slice(-8), 36) : Date.now() % 2147483647;

      if (!existing) {
        await this.prisma.payment.create({
          data: {
            orderId,
            provider: "click",
            externalRef: String(body.click_trans_id),
            amountMinor: order.totalMinor,
            currency: "UZS",
            status: "PROCESSING"
          }
        });
      }

      return {
        click_trans_id: body.click_trans_id,
        merchant_trans_id: orderId,
        merchant_prepare_id: prepareId,
        error: 0,
        error_note: "Success"
      };
    }

    const payment = await this.prisma.payment.findFirst({
      where: { provider: "click", externalRef: String(body.click_trans_id) }
    });
    if (!payment) return { error: -6, error_note: "Transaction does not exist" };
    if (payment.status === "PAID") {
      return {
        click_trans_id: body.click_trans_id,
        merchant_trans_id: orderId,
        merchant_confirm_id: payment.id,
        error: -4,
        error_note: "Already paid"
      };
    }

    const updated = await this.payments.markPaid(payment.id);

    return {
      click_trans_id: body.click_trans_id,
      merchant_trans_id: orderId,
      merchant_confirm_id: updated.id,
      error: 0,
      error_note: "Success"
    };
  }
}
