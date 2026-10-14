CREATE TYPE "SupplierPurchaseStatus" AS ENUM (
  'PENDING',
  'READY',
  'SUBMITTING',
  'PLACED',
  'FULFILLING',
  'SHIPPED',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
  'REFUND_REQUIRED'
);

CREATE TYPE "SupplierSettlementStatus" AS ENUM (
  'DRAFT',
  'APPROVED',
  'SENT',
  'SETTLED',
  'REJECTED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "SupplierPurchase" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'aliexpress',
  "status" "SupplierPurchaseStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "supplierCurrency" TEXT NOT NULL DEFAULT 'CNY',
  "supplierAmountMinor" INTEGER,
  "supplierShippingMinor" INTEGER,
  "externalOrderId" TEXT,
  "confirmationSource" TEXT,
  "confirmationReference" TEXT,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierPurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierSettlement" (
  "id" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "status" "SupplierSettlementStatus" NOT NULL DEFAULT 'DRAFT',
  "idempotencyKey" TEXT NOT NULL,
  "beneficiaryName" TEXT NOT NULL,
  "beneficiaryBank" TEXT NOT NULL,
  "beneficiaryAccountRef" TEXT NOT NULL,
  "contractReference" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "bankReference" TEXT,
  "proofStorageKey" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "initiatedAt" TIMESTAMP(3),
  "settledAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierPurchase_idempotencyKey_key" ON "SupplierPurchase"("idempotencyKey");
CREATE UNIQUE INDEX "SupplierPurchase_provider_externalOrderId_key" ON "SupplierPurchase"("provider", "externalOrderId");
CREATE UNIQUE INDEX "SupplierPurchase_orderId_provider_key" ON "SupplierPurchase"("orderId", "provider");
CREATE INDEX "SupplierPurchase_status_createdAt_idx" ON "SupplierPurchase"("status", "createdAt");

CREATE UNIQUE INDEX "SupplierSettlement_idempotencyKey_key" ON "SupplierSettlement"("idempotencyKey");
CREATE UNIQUE INDEX "SupplierSettlement_bankReference_key" ON "SupplierSettlement"("bankReference");
CREATE INDEX "SupplierSettlement_purchaseId_status_idx" ON "SupplierSettlement"("purchaseId", "status");
CREATE INDEX "SupplierSettlement_status_createdAt_idx" ON "SupplierSettlement"("status", "createdAt");

ALTER TABLE "SupplierPurchase"
  ADD CONSTRAINT "SupplierPurchase_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplierSettlement"
  ADD CONSTRAINT "SupplierSettlement_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "SupplierPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
