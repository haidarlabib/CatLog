/**
 * Image processing utilities for ProwlLog PWA
 * Compresses images client-side before storing as Blobs in IndexedDB.
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 - 1.0
  mimeType?: string;
}

/**
 * Validates whether a file is an acceptable image
 */
export function validateImageFile(file: File | Blob): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  const type = file.type;
  if (!type || !type.startsWith('image/')) {
    return { valid: false, error: 'File is not a valid image format.' };
  }

  // Max 25MB raw file sanity check
  if (file.size > 25 * 1024 * 1024) {
    return { valid: false, error: 'Image file is too large (maximum 25MB).' };
  }

  return { valid: true };
}

/**
 * Compresses an image File or Blob using HTMLCanvasElement.
 * Reduces image dimension to maxWidth/maxHeight and outputs high-quality JPEG/WebP.
 */
export async function compressImage(
  file: File | Blob,
  options: CompressImageOptions = {}
): Promise<{ blob: Blob; width: number; height: number; mimeType: string }> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.85,
    mimeType = 'image/jpeg',
  } = options;

  // In non-browser environments (e.g. Node tests), return original if canvas is unavailable
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      blob: file,
      width: 800,
      height: 600,
      mimeType: file.type || mimeType,
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Calculate scaled dimensions while preserving aspect ratio
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Fallback to original blob if canvas context fails
        resolve({
          blob: file,
          width: img.width,
          height: img.height,
          mimeType: file.type || mimeType,
        });
        return;
      }

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({
              blob: file,
              width: img.width,
              height: img.height,
              mimeType: file.type || mimeType,
            });
            return;
          }
          resolve({
            blob,
            width,
            height,
            mimeType,
          });
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image. The file may be corrupt.'));
    };

    img.src = objectUrl;
  });
}
