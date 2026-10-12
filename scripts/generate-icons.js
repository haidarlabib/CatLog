import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

async function generateIcons() {
  const sourcePath = path.resolve('logokucing.png');
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source icon not found at ${sourcePath}`);
  }

  const outDir = path.resolve('public', 'icons');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`Processing source logo from: ${sourcePath}`);

  // 1. Standard PWA 192x192
  await sharp(sourcePath)
    .resize(192, 192, { fit: 'contain', background: { r: 253, g: 251, b: 248, alpha: 1 } })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(outDir, 'icon-192x192.png'));

  // 2. Standard PWA 512x512
  await sharp(sourcePath)
    .resize(512, 512, { fit: 'contain', background: { r: 253, g: 251, b: 248, alpha: 1 } })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(outDir, 'icon-512x512.png'));

  // 3. Maskable PWA 512x512 (Safe area: paw padded to ~75% within background)
  // Scale paw to 384x384 (75% of 512) and place in 512x512 canvas with matching cream background
  const innerPaw = await sharp(sourcePath)
    .resize(384, 384, { fit: 'contain' })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 253, g: 251, b: 248, alpha: 1 },
    },
  })
    .composite([{ input: innerPaw, top: 64, left: 64 }])
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(outDir, 'icon-512x512-maskable.png'));

  // 4. Apple Touch Icon 180x180
  await sharp(sourcePath)
    .resize(180, 180, { fit: 'contain', background: { r: 253, g: 251, b: 248, alpha: 1 } })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(outDir, 'apple-touch-icon.png'));

  // 5. In-app UI Logo asset (256x256)
  await sharp(sourcePath)
    .resize(256, 256, { fit: 'contain', background: { r: 253, g: 251, b: 248, alpha: 1 } })
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.resolve('public', 'logo.png'));

  // 6. Favicon PNG (48x48)
  await sharp(sourcePath)
    .resize(48, 48, { fit: 'contain', background: { r: 253, g: 251, b: 248, alpha: 1 } })
    .png()
    .toFile(path.resolve('public', 'favicon.png'));

  // 7. Vector SVG Favicon and icon.svg with high-res base64 representation of logokucing.png
  const resizedForSvgBuffer = await sharp(sourcePath)
    .resize(256, 256, { fit: 'contain' })
    .png({ quality: 90 })
    .toBuffer();

  const base64Data = resizedForSvgBuffer.toString('base64');
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <rect width="512" height="512" fill="#FDFBF8" rx="80" />
  <image href="data:image/png;base64,${base64Data}" x="32" y="32" width="448" height="448" />
</svg>`;

  fs.writeFileSync(path.resolve('public', 'favicon.svg'), svgContent);
  fs.writeFileSync(path.join(outDir, 'icon.svg'), svgContent);

  console.log('All PWA icons, favicon, and branding assets successfully generated from logokucing.png!');
}

generateIcons().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
