-- Move existing Uriona image URLs from the S3 API endpoint to the bucket's public r2.dev hostname.
-- The objects themselves remain in the same bucket and key; only their public URL host changes.
UPDATE "Product"
SET "imageUrl" = REPLACE("imageUrl", '891feba5d847d16bc3f966bf572299cd.r2.cloudflarestorage.com', 'pub-a9863de899434c0eb02c4f476587671b.r2.dev')
WHERE "imageUrl" LIKE '%891feba5d847d16bc3f966bf572299cd.r2.cloudflarestorage.com%';

UPDATE "Product"
SET "imageUrls" = REPLACE("imageUrls"::text, '891feba5d847d16bc3f966bf572299cd.r2.cloudflarestorage.com', 'pub-a9863de899434c0eb02c4f476587671b.r2.dev')::jsonb
WHERE "imageUrls"::text LIKE '%891feba5d847d16bc3f966bf572299cd.r2.cloudflarestorage.com%';

UPDATE "ProductImageAsset"
SET "imageUrl" = REPLACE("imageUrl", '891feba5d847d16bc3f966bf572299cd.r2.cloudflarestorage.com', 'pub-a9863de899434c0eb02c4f476587671b.r2.dev')
WHERE "imageUrl" LIKE '%891feba5d847d16bc3f966bf572299cd.r2.cloudflarestorage.com%';

UPDATE "OrderItem"
SET "imageUrl" = REPLACE("imageUrl", '891feba5d847d16bc3f966bf572299cd.r2.cloudflarestorage.com', 'pub-a9863de899434c0eb02c4f476587671b.r2.dev')
WHERE "imageUrl" LIKE '%891feba5d847d16bc3f966bf572299cd.r2.cloudflarestorage.com%';
