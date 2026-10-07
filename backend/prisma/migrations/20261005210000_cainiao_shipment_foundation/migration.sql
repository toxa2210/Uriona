CREATE TYPE "CainiaoShipmentStatus" AS ENUM (
  'PREPARED',
  'SUBMITTING',
  'ACCEPTED',
  'LABEL_READY',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCEL_REQUESTED',
  'CANCELLED',
  'FAILED'
);

CREATE TABLE "CainiaoShipment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "status" "CainiaoShipmentStatus" NOT NULL DEFAULT 'PREPARED',
  "providerOrderReference" TEXT,
  "waybillNumber" TEXT,
  "carrierCode" TEXT,
  "labelStorageKey" TEXT,
  "providerErrorCode" TEXT,
  "providerErrorMessage" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CainiaoShipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CainiaoTrackingEvent" (
  "id" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "providerEventId" TEXT,
  "status" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "location" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CainiaoTrackingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CainiaoShipment_idempotencyKey_key"
  ON "CainiaoShipment"("idempotencyKey");
CREATE INDEX "CainiaoShipment_orderId_status_idx"
  ON "CainiaoShipment"("orderId", "status");
CREATE INDEX "CainiaoShipment_waybillNumber_idx"
  ON "CainiaoShipment"("waybillNumber");
CREATE INDEX "CainiaoShipment_providerOrderReference_idx"
  ON "CainiaoShipment"("providerOrderReference");
CREATE UNIQUE INDEX "CainiaoTrackingEvent_shipmentId_providerEventId_key"
  ON "CainiaoTrackingEvent"("shipmentId", "providerEventId");
CREATE INDEX "CainiaoTrackingEvent_shipmentId_occurredAt_idx"
  ON "CainiaoTrackingEvent"("shipmentId", "occurredAt");

ALTER TABLE "CainiaoShipment"
  ADD CONSTRAINT "CainiaoShipment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CainiaoTrackingEvent"
  ADD CONSTRAINT "CainiaoTrackingEvent_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "CainiaoShipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
