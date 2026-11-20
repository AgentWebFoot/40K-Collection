export const unitImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
export const maxUnitImageFileBytes = 20 * 1024 * 1024;
const maxSavedImageBytes = 150 * 1024;
const imageData = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export function validUnitImage(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(maxSavedImageBytes / 3) * 4 + 32) return false;
  const [, type, encoded] = imageData.exec(value) ?? [];
  if (!encoded || encoded.length % 4 !== 0) return false;
  try {
    const bytes = atob(encoded);
    if (bytes.length > maxSavedImageBytes) return false;
    if (type === 'image/png') return bytes.startsWith('\x89PNG\r\n\x1a\n');
    if (type === 'image/jpeg') return bytes.startsWith('\xff\xd8\xff');
    return bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP';
  } catch {
    return false;
  }
}

export async function prepareUnitImage(file) {
  if (!unitImageTypes.includes(file?.type) || !file.size) throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (file.size > maxUnitImageFileBytes) throw new Error('Choose an image no larger than 20 MB.');

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Unable to read this image. Choose another PNG, JPEG, or WebP file.');
  }
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable in this browser.');
    const longestSide = Math.max(bitmap.width, bitmap.height);
    for (const target of [1024, 768, 512, 384, 256]) {
      const scale = Math.min(1, target / longestSide);
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL('image/webp', 0.8);
      if (validUnitImage(image)) return image;
    }
    throw new Error('Unable to resize the image for preview storage. Try a smaller file.');
  } finally {
    bitmap.close();
  }
}
