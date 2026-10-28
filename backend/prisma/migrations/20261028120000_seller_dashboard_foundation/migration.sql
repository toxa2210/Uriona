ALTER TYPE "UserRole" ADD VALUE 'SELLER';
ALTER TYPE "ProductStatus" ADD VALUE 'PENDING_REVIEW';
CREATE TYPE "ProductCondition" AS ENUM ('NEW');
CREATE TYPE "ShippingCarrier" AS ENUM ('EMU_EXPRESS', 'UZPOST');
CREATE TYPE "ShippingPayer" AS ENUM ('SENDER', 'RECIPIENT');
CREATE TYPE "FinancialActionType" AS ENUM ('PAYOUT', 'REFUND', 'EXPENSE');
CREATE TYPE "FinancialActionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Category"
  ADD COLUMN "parentId" TEXT,
  ADD COLUMN "attributes" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "Product"
  ADD COLUMN "sellerId" TEXT,
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "imageUrls" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "attributes" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "variants" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "stock" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "discountPercent" INTEGER,
  ADD COLUMN "condition" "ProductCondition" NOT NULL DEFAULT 'NEW',
  ADD COLUMN "sellerCity" TEXT,
  ADD COLUMN "sellerDistrict" TEXT,
  ADD COLUMN "pickupMethod" TEXT NOT NULL DEFAULT 'SELLER_DELIVERY',
  ADD COLUMN "shippingCarrier" "ShippingCarrier" NOT NULL DEFAULT 'EMU_EXPRESS',
  ADD COLUMN "shippingPayer" "ShippingPayer" NOT NULL DEFAULT 'RECIPIENT',
  ADD COLUMN "dispatchBranchId" TEXT,
  ADD COLUMN "dispatchPointName" TEXT,
  ADD COLUMN "dispatchPointAddress" TEXT,
  ADD COLUMN "publicationRulesAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "restrictedGoodsConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "moderationNote" TEXT;

CREATE TABLE "ShippingBranch" (
  "id" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "carrier" "ShippingCarrier" NOT NULL DEFAULT 'EMU_EXPRESS',
  "name" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "locality" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "phone" TEXT,
  "workingHours" TEXT,
  "acceptsCash" BOOLEAN NOT NULL DEFAULT FALSE,
  "acceptsCard" BOOLEAN NOT NULL DEFAULT FALSE,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "mapUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShippingBranch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductImageAsset" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductImageAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialActionRequest" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "type" "FinancialActionType" NOT NULL,
  "status" "FinancialActionStatus" NOT NULL DEFAULT 'PENDING',
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'UZS',
  "description" TEXT NOT NULL,
  "reference" TEXT,
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialActionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShippingBranch_externalId_key" ON "ShippingBranch"("externalId");
CREATE INDEX "ShippingBranch_carrier_region_locality_idx" ON "ShippingBranch"("carrier", "region", "locality");
CREATE INDEX "ShippingBranch_isActive_idx" ON "ShippingBranch"("isActive");
CREATE UNIQUE INDEX "ProductImageAsset_imageUrl_key" ON "ProductImageAsset"("imageUrl");
CREATE UNIQUE INDEX "ProductImageAsset_objectKey_key" ON "ProductImageAsset"("objectKey");
CREATE INDEX "ProductImageAsset_sellerId_idx" ON "ProductImageAsset"("sellerId");
CREATE INDEX "FinancialActionRequest_sellerId_createdAt_idx" ON "FinancialActionRequest"("sellerId", "createdAt");
CREATE INDEX "FinancialActionRequest_status_createdAt_idx" ON "FinancialActionRequest"("status", "createdAt");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Product_sellerId_idx" ON "Product"("sellerId");
CREATE INDEX "Product_dispatchBranchId_idx" ON "Product"("dispatchBranchId");

ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_dispatchBranchId_fkey"
  FOREIGN KEY ("dispatchBranchId") REFERENCES "ShippingBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductImageAsset" ADD CONSTRAINT "ProductImageAsset_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialActionRequest" ADD CONSTRAINT "FinancialActionRequest_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Category" ("id", "nameUz", "nameRu")
SELECT categories."id", categories."nameUz", categories."nameRu"
FROM (VALUES
  ('seller-category-electronics', 'Elektronika', 'Электроника'),
  ('seller-category-home', 'Uy uchun', 'Для дома'),
  ('seller-category-clothing', 'Kiyim', 'Одежда'),
  ('seller-category-beauty', 'Go''zallik', 'Красота'),
  ('seller-category-accessories', 'Aksessuarlar', 'Аксессуары'),
  ('seller-category-sport', 'Sport', 'Спорт')
) AS categories("id", "nameUz", "nameRu")
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" existing WHERE existing."nameRu" = categories."nameRu"
);