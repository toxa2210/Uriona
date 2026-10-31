-- Stable, human-readable URIONA article numbers.
-- Existing products are backfilled once; future products receive the next
-- sequence value directly from PostgreSQL, safely under concurrent inserts.
CREATE SEQUENCE IF NOT EXISTS "uriona_article_number_seq" START WITH 1 INCREMENT BY 1;

ALTER TABLE "Product" ADD COLUMN "articleNumber" TEXT;

WITH numbered_products AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS number
  FROM "Product"
)
UPDATE "Product" AS product
SET "articleNumber" = 'UR-' || LPAD(numbered_products.number::TEXT, 6, '0')
FROM numbered_products
WHERE product."id" = numbered_products."id";

SELECT setval(
  '"uriona_article_number_seq"',
  GREATEST((SELECT COUNT(*) FROM "Product"), 1),
  (SELECT COUNT(*) > 0 FROM "Product")
);

ALTER TABLE "Product"
  ALTER COLUMN "articleNumber"
  SET DEFAULT ('UR-'::TEXT || LPAD(NEXTVAL('"uriona_article_number_seq"'::REGCLASS)::TEXT, 6, '0'::TEXT));

ALTER TABLE "Product" ALTER COLUMN "articleNumber" SET NOT NULL;

CREATE UNIQUE INDEX "Product_articleNumber_key" ON "Product"("articleNumber");
