const MAX_UPLOAD_BYTES = 9 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1920;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateProductImage(file: Pick<File, "name" | "size" | "type">): string | null {
  if (file.size <= 0) return "Файл пустой. Выберите другую фотографию.";
  if (SUPPORTED_IMAGE_TYPES.has(file.type)) return null;
  if (/\.(jpe?g|png|webp)$/i.test(file.name) && !file.type) return null;
  if (file.type === "image/heic" || file.type === "image/heif" || /\.(heic|heif)$/i.test(file.name)) {
    return "Формат HEIC/HEIF не поддерживается. Сохраните фото как JPG, PNG или WebP.";
  }
  return "Поддерживаются только фотографии JPG, PNG или WebP.";
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Не удалось сжать фотографию."));
    }, "image/webp", quality);
  });
}

export async function prepareProductImage(file: File): Promise<File> {
  const validationError = validateProductImage(file);
  if (validationError) throw new Error(validationError);

  const normalizedFile = file.type ? file : new File([file], file.name, {
    type: /\.png$/i.test(file.name) ? "image/png" : /\.webp$/i.test(file.name) ? "image/webp" : "image/jpeg",
    lastModified: file.lastModified,
  });
  if (normalizedFile.size <= MAX_UPLOAD_BYTES) return normalizedFile;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(normalizedFile);
  } catch {
    throw new Error("Не удалось открыть фотографию. Выберите JPG, PNG или WebP.");
  }

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Браузер не поддерживает обработку фотографий.");
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    let quality = 0.82;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      context.drawImage(bitmap, 0, 0, width, height);
      const blob = await canvasToBlob(canvas, quality);
      if (blob.size <= MAX_UPLOAD_BYTES) {
        const extension = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
        const baseName = normalizedFile.name.replace(/\.[^.]+$/, "") || "product-image";
        return new File([blob], `${baseName}.${extension}`, { type: blob.type, lastModified: normalizedFile.lastModified });
      }
      const reduction = Math.min(0.8, Math.sqrt(MAX_UPLOAD_BYTES / blob.size) * 0.9);
      width = Math.max(1, Math.floor(width * reduction));
      height = Math.max(1, Math.floor(height * reduction));
      quality = Math.max(0.65, quality - 0.04);
    }
    throw new Error("Фотография слишком большая даже после сжатия. Выберите изображение меньшего размера.");
  } finally {
    bitmap.close();
  }
}
