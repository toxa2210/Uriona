import { describe, expect, it } from "vitest";
import { validateProductImage } from "./imageUpload";

describe("validateProductImage", () => {
  it("accepts JPEG, PNG, and WebP files", () => {
    expect(validateProductImage({ name: "product.jpg", size: 1024, type: "image/jpeg" })).toBeNull();
    expect(validateProductImage({ name: "product.png", size: 1024, type: "image/png" })).toBeNull();
    expect(validateProductImage({ name: "product.webp", size: 1024, type: "image/webp" })).toBeNull();
  });

  it("explains that HEIC photos must be converted", () => {
    expect(validateProductImage({ name: "photo.heic", size: 1024, type: "image/heic" })).toContain("HEIC/HEIF");
  });

  it("rejects empty or unsupported files", () => {
    expect(validateProductImage({ name: "empty.jpg", size: 0, type: "image/jpeg" })).toContain("пустой");
    expect(validateProductImage({ name: "document.pdf", size: 1024, type: "application/pdf" })).toContain("JPG, PNG или WebP");
  });
});