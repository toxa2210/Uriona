import { Injectable } from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { PaymentsService } from "./payments.service";

type RpcRequest = { id?: string|number|null; method?: string; params?: any };

@Injectable()
export class PaymeService {
  constructor(private readonly config: ConfigService, private readonly payments: PaymentsService) {}

  authorize(header?: string) {
    const key = this.config.get<string>("PAYME_MERCHANT_KEY") ?? "";
    if (!header?.startsWith("Basic ") || !key) return false;
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const [, password] = decoded.split(":");
    const expectedHash = createHash("sha256").update(key).digest();
    const providedHash = createHash("sha256").update(password ?? "").digest();
    return timingSafeEqual(expectedHash, providedHash);
  }

  private rpc(id: RpcRequest["id"], result: unknown) {
    return { jsonrpc: "2.0", id: id ?? null, result };
  }

  private error(id: RpcRequest["id"], code: number, message: string) {
    return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
  }

  private orderId(params: any) {
    return String(params?.account?.order_id ?? "");
  }

  async handle(req: RpcRequest) {
    switch (req.method) {
      case "CheckPerformTransaction": return this.checkPerform(req);
      case "CreateTransaction": return this.create(req);
      case "CheckTransaction": return this.check(req);
      case "PerformTransaction": return this.perform(req);
      case "CancelTransaction": return this.cancel(req);
      case "GetStatement": return this.statement(req);
      default: return this.error(req.id, -32601, "Method not found");
    }
  }

  private async checkPerform(req: RpcRequest) {
    const id = this.orderId(req.params);
    const amount = Number(req.params?.amount ?? 0);
    let order;
    try { order = await this.payments.getOrderForProvider(id); }
    catch { return this.error(req.id, -31050, "Account not found"); }
    if (amount !== order.totalMinor * 100) return this.error(req.id, -31001, "Incorrect amount");
    return this.rpc(req.id, { allow: true });
  }

  private async create(req: RpcRequest) {
    const id = this.orderId(req.params);
    const paymeId = String(req.params?.id ?? "");
    const amount = Number(req.params?.amount ?? 0);
    let order;
    try { order = await this.payments.getOrderForProvider(id); }
    catch { return this.error(req.id, -31050, "Account not found"); }
    if (amount !== order.totalMinor * 100) return this.error(req.id, -31001, "Incorrect amount");

    const existing = order.payments.find((p) => p.provider === "payme" && p.externalRef === paymeId);
    if (existing) {
      return this.rpc(req.id, {
        create_time: existing.createdAt.getTime(),
        perform_time: existing.status === "PAID" ? existing.updatedAt.getTime() : 0,
        cancel_time: existing.status === "REFUNDED" ? existing.updatedAt.getTime() : 0,
        transaction: existing.id,
        state: existing.status === "PAID" ? 2 : existing.status === "REFUNDED" ? -1 : 1
      });
    }

    const payment = await this.payments.createProviderPayment({
      orderId: order.id,
      provider: "payme",
      externalRef: paymeId,
      amountMinor: order.totalMinor,
      currency: "UZS",
      status: "PROCESSING"
    });

    return this.rpc(req.id, {
      create_time: payment.createdAt.getTime(), perform_time: 0, cancel_time: 0, transaction: payment.id, state: 1
    });
  }

  private async check(req: RpcRequest) {
    const payment = await this.payments.findByProviderRef("payme", String(req.params?.id ?? ""));
    if (!payment) return this.error(req.id, -31003, "Transaction not found");
    return this.rpc(req.id, {
      create_time: payment.createdAt.getTime(),
      perform_time: payment.status === "PAID" ? payment.updatedAt.getTime() : 0,
      cancel_time: payment.status === "REFUNDED" ? payment.updatedAt.getTime() : 0,
      transaction: payment.id,
      state: payment.status === "PAID" ? 2 : payment.status === "REFUNDED" ? -1 : 1
    });
  }

  private async perform(req: RpcRequest) {
    const payment = await this.payments.findByProviderRef("payme", String(req.params?.id ?? ""));
    if (!payment) return this.error(req.id, -31003, "Transaction not found");
    const updated = await this.payments.markPaid(payment.id);
    return this.rpc(req.id, { transaction: updated.id, perform_time: updated.updatedAt.getTime() });
  }

  private async cancel(req: RpcRequest) {
    const payment = await this.payments.findByProviderRef("payme", String(req.params?.id ?? ""));
    if (!payment) return this.error(req.id, -31003, "Transaction not found");
    const updated = await this.payments.markRefunded(payment.id);
    return this.rpc(req.id, { transaction: updated.id, cancel_time: updated.updatedAt.getTime() });
  }

  private async statement(req: RpcRequest) {
    const from = Number(req.params?.from ?? 0);
    const to = Number(req.params?.to ?? Date.now());
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < from) {
      return this.error(req.id, -31000, "Invalid period");
    }
    const payments = await this.payments.listProviderPayments("payme", new Date(from), new Date(to));
    return this.rpc(req.id, {
      transactions: payments.map((payment) => ({
        id: payment.externalRef,
        time: payment.createdAt.getTime(),
        amount: payment.amountMinor * 100,
        account: { order_id: payment.orderId },
        create_time: payment.createdAt.getTime(),
        perform_time: payment.status === "PAID" ? payment.updatedAt.getTime() : 0,
        cancel_time: payment.status === "REFUNDED" ? payment.updatedAt.getTime() : 0,
        transaction: payment.id,
        state: payment.status === "PAID" ? 2 : payment.status === "REFUNDED" ? -1 : 1,
        reason: null
      }))
    });
  }
}
