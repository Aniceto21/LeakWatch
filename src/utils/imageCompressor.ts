export interface CompressionResult {
  dataUrl: string;
  sizeBytes: number;
  sizeKB: number;
  width: number;
  height: number;
}

/**
 * Compresses an image file in the browser to a JPEG base64 data URI limited to approximately 200KB.
 */
export async function compressImageToJPEG(
  file: File,
  maxSizeBytes: number = 195 * 1024 // approx 200 KB limit
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const maxDimension = 1000;

        // Resize if larger than maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas 2D rendering context'));
          return;
        }

        // Fill white background (in case of PNG transparency)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Approximate byte size: base64 string length * 0.75
        let calculatedSize = Math.round((dataUrl.length * 3) / 4);

        // Iteratively lower quality if still above maxSizeBytes
        while (calculatedSize > maxSizeBytes && quality > 0.25) {
          quality -= 0.12;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          calculatedSize = Math.round((dataUrl.length * 3) / 4);
        }

        resolve({
          dataUrl,
          sizeBytes: calculatedSize,
          sizeKB: Math.round(calculatedSize / 1024),
          width,
          height,
        });
      };

      img.onerror = () => {
        reject(new Error('Failed to decode image file. Please choose a valid image.'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read selected file.'));
    };

    reader.readAsDataURL(file);
  });
}
