UPDATE "Product"
SET "status" = 'ARCHIVED'::"ProductStatus"
WHERE "status" = 'ACTIVE'::"ProductStatus"
  AND "sellerId" IS NULL;