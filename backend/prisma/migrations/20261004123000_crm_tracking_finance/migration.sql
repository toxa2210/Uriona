CREATE TYPE "FinanceEntryType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "FinanceEntrySource" AS ENUM ('MANUAL', 'PAYMENT', 'REFUND');

ALTER TABLE "Order"
  ADD COLUMN "shippingCarrier" TEXT,
  ADD COLUMN "trackingNumber" TEXT,
  ADD COLUMN "trackingUpdatedAt" TIMESTAMP(3);

CREATE TABLE "OrderTrackingEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "location" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "OrderTrackingEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceEntry" (
  "id" TEXT NOT NULL,
  "type" "FinanceEntryType" NOT NULL,
  "source" "FinanceEntrySource" NOT NULL DEFAULT 'MANUAL',
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'UZS',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "referenceId" TEXT,
  "paymentId" TEXT,
  "orderId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceEntry_source_referenceId_key" ON "FinanceEntry"("source", "referenceId");
CREATE INDEX "Order_trackingNumber_idx" ON "Order"("trackingNumber");
CREATE INDEX "OrderTrackingEvent_orderId_occurredAt_idx" ON "OrderTrackingEvent"("orderId", "occurredAt");
CREATE INDEX "FinanceEntry_occurredAt_idx" ON "FinanceEntry"("occurredAt");
CREATE INDEX "FinanceEntry_type_occurredAt_idx" ON "FinanceEntry"("type", "occurredAt");
CREATE INDEX "FinanceEntry_paymentId_idx" ON "FinanceEntry"("paymentId");
CREATE INDEX "FinanceEntry_orderId_idx" ON "FinanceEntry"("orderId");

ALTER TABLE "OrderTrackingEvent"
  ADD CONSTRAINT "OrderTrackingEvent_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "OrderTrackingEvent_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinanceEntry"
  ADD CONSTRAINT "FinanceEntry_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "FinanceEntry_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "FinanceEntry_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "FinanceEntry" (
  "id", "type", "source", "category", "description", "amountMinor", "currency",
  "occurredAt", "referenceId", "paymentId", "orderId"
)
SELECT
  'payment-' || p."id", 'INCOME'::"FinanceEntryType", 'PAYMENT'::"FinanceEntrySource",
  'Оплата заказа', 'Оплата заказа ' || p."orderId", p."amountMinor", p."currency",
  p."updatedAt", p."id", p."id", p."orderId"
FROM "Payment" p
WHERE p."status" = 'PAID';
