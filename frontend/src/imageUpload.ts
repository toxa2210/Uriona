const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1920;

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Не удалось сжать фотографию."));
    }, "image/webp", quality);
  });
}

export async function prepareProductImage(file: File): Promise<File> {
  if (file.size <= MAX_UPLOAD_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Не удалось обработать фотографию. Выберите другое изображение.");
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
        const baseName = file.name.replace(/\.[^.]+$/, "") || "product-image";
        return new File([blob], `${baseName}.${extension}`, { type: blob.type, lastModified: file.lastModified });
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
