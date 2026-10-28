import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface ProductImageUpload {
  buffer: Buffer;
  size: number;
  mimetype: string;
}

const imageTypes = {
  "image/jpeg": { extension: "jpg", signature: [0xff, 0xd8, 0xff] },
  "image/png": { extension: "png", signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  "image/webp": { extension: "webp", signature: [0x52, 0x49, 0x46, 0x46] },
} as const;

@Injectable()
export class R2StorageService {
  constructor(private readonly config: ConfigService) {}

  async uploadProductImage(file: ProductImageUpload): Promise<{ imageUrl: string }> {
    if (!file?.buffer?.length || file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException("Image must be smaller than 5 MB");
    }
    const type = imageTypes[file.mimetype as keyof typeof imageTypes];
    if (!type || !type.signature.every((byte, index) => file.buffer[index] === byte)
      || (file.mimetype === "image/webp" && file.buffer.toString("ascii", 8, 12) !== "WEBP")) {
      throw new BadRequestException("Only valid JPEG, PNG, and WebP images are supported");
    }

    const { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl } = this.storageConfig();
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    const key = `products/${randomUUID()}.${type.extension}`;
    try {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentLength: file.size,
        ContentType: file.mimetype,
        CacheControl: "public, max-age=31536000, immutable",
      }));
    } finally {
      client.destroy();
    }
    return { imageUrl: `${publicBaseUrl}/${key}` };
  }

  async deleteProductImage(imageUrlValue: string): Promise<void> {
    const { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl } = this.storageConfig();
    let imageUrl: URL;
    let baseUrl: URL;
    try {
      imageUrl = new URL(imageUrlValue);
      baseUrl = new URL(publicBaseUrl);
    } catch {
      throw new BadRequestException("Invalid product image URL");
    }
    const basePath = baseUrl.pathname.replace(/\/+$/, "");
    const key = imageUrl.pathname.slice(basePath.length + 1);
    if (imageUrl.origin !== baseUrl.origin || imageUrl.search || imageUrl.hash || !/^products\/[0-9a-f-]+\.(jpg|png|webp)$/i.test(key)) {
      throw new BadRequestException("Only images uploaded to the product image folder can be deleted");
    }

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } finally {
      client.destroy();
    }
  }

  getObjectKey(imageUrlValue: string): string {
    const publicBaseUrl = this.config.get<string>("R2_PUBLIC_BASE_URL");
    if (!publicBaseUrl) throw new ServiceUnavailableException("Product image storage is not configured");
    const imageUrl = new URL(imageUrlValue);
    const baseUrl = new URL(publicBaseUrl);
    const basePath = baseUrl.pathname.replace(/\/+$/, "");
    const key = imageUrl.pathname.slice(basePath.length + 1);
    if (imageUrl.origin !== baseUrl.origin || imageUrl.search || imageUrl.hash || !/^products\/[0-9a-f-]+\.(jpg|png|webp)$/i.test(key)) {
      throw new BadRequestException("Only images uploaded to the product image folder are supported");
    }
    return key;
  }

  private storageConfig() {
    const accountId = this.config.get<string>("R2_ACCOUNT_ID");
    const accessKeyId = this.config.get<string>("R2_ACCESS_KEY_ID");
    const secretAccessKey = this.config.get<string>("R2_SECRET_ACCESS_KEY");
    const bucket = this.config.get<string>("R2_BUCKET_NAME");
    const publicBaseUrl = this.config.get<string>("R2_PUBLIC_BASE_URL")?.replace(/\/+$/, "");
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
      throw new ServiceUnavailableException("Product image storage is not configured");
    }
    return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
  }
}