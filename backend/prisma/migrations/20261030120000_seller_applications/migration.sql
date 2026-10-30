CREATE TYPE "SellerApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "SellerApplication" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "storeName" TEXT NOT NULL,
  "logoUrl" TEXT,
  "description" TEXT NOT NULL,
  "categoryIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "region" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "address" TEXT,
  "status" "SellerApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerApplication_userId_key" ON "SellerApplication"("userId");
CREATE INDEX "SellerApplication_status_createdAt_idx" ON "SellerApplication"("status", "createdAt");
ALTER TABLE "SellerApplication" ADD CONSTRAINT "SellerApplication_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
