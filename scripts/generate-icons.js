import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Helper to write a PNG chunk
function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);

  // Compute CRC32 over type + data
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }

  let crc = 0xffffffff;
  for (let i = 4; i < 8 + len; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function generatePng(width, height, drawFn) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw image data with filter byte 0 per scanline
  const stride = width * 4;
  const rawData = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (stride + 1);
    rawData[rowOffset] = 0; // Filter type None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Function to draw ProwlLog Cat Paw Icon
function drawProwlLogIcon(x, y, width, height, isMaskable = false) {
  // Normalize coords to [-1, 1]
  const scaleFactor = isMaskable ? 0.75 : 0.88;
  const nx = ((x / width) * 2 - 1) / scaleFactor;
  const ny = ((y / height) * 2 - 1) / scaleFactor;

  // Background: Deep Teal (#226F80 -> [34, 111, 128])
  const bg = [34, 111, 128, 255];
  // Warm Cream (#FAFAF7 -> [250, 250, 247])
  const cream = [250, 250, 247, 255];
  // Soft Teal Accent (#3B9797 -> [59, 151, 151])
  const softTeal = [59, 151, 151, 255];

  // Rounded background rectangle for non-maskable icons
  if (!isMaskable) {
    // Check rounded corner distance
    const rCorner = 0.22;
    const ax = Math.abs((x / width) * 2 - 1);
    const ay = Math.abs((y / height) * 2 - 1);
    const dx = Math.max(0, ax - (1 - rCorner));
    const dy = Math.max(0, ay - (1 - rCorner));
    if (Math.hypot(dx, dy) > rCorner) {
      return [0, 0, 0, 0]; // Transparent outside rounded squircle
    }
  }

  // Paw geometry
  // Main pad: heart-like ellipse cluster at bottom center (ny ~ 0.15)
  // Distance from main pad center (0, 0.18)
  const padDist = Math.hypot(nx, (ny - 0.18) * 1.25);
  // Two small lobes at bottom of main pad
  const lobe1 = Math.hypot(nx + 0.18, (ny - 0.28) * 1.1);
  const lobe2 = Math.hypot(nx - 0.18, (ny - 0.28) * 1.1);

  if (padDist < 0.38 || lobe1 < 0.22 || lobe2 < 0.22) {
    return cream;
  }

  // Inner pad accent
  if (padDist < 0.24) {
    return softTeal;
  }

  // 4 Toes:
  // Toe 1 (left outer): center (-0.42, -0.15), radius ~ 0.13
  const toe1 = Math.hypot((nx + 0.42) * 1.1, (ny + 0.12) * 0.9);
  // Toe 2 (left inner): center (-0.16, -0.38), radius ~ 0.15
  const toe2 = Math.hypot((nx + 0.16) * 1.05, (ny + 0.36) * 0.85);
  // Toe 3 (right inner): center (0.16, -0.38), radius ~ 0.15
  const toe3 = Math.hypot((nx - 0.16) * 1.05, (ny + 0.36) * 0.85);
  // Toe 4 (right outer): center (0.42, -0.15), radius ~ 0.13
  const toe4 = Math.hypot((nx - 0.42) * 1.1, (ny + 0.12) * 0.9);

  if (toe1 < 0.14 || toe2 < 0.16 || toe3 < 0.16 || toe4 < 0.14) {
    return cream;
  }

  return bg;
}

// Generate files
const outDir = path.resolve('public', 'icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('Generating PWA icons...');
const png192 = generatePng(192, 192, (x, y, w, h) => drawProwlLogIcon(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'icon-192x192.png'), png192);

const png512 = generatePng(512, 512, (x, y, w, h) => drawProwlLogIcon(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'icon-512x512.png'), png512);

const png512Maskable = generatePng(512, 512, (x, y, w, h) => drawProwlLogIcon(x, y, w, h, true));
fs.writeFileSync(path.join(outDir, 'icon-512x512-maskable.png'), png512Maskable);

// SVG Favicon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <rect width="512" height="512" rx="128" fill="#226F80" />
  <!-- Main Pad -->
  <path d="M 256 260 C 200 260 170 300 170 340 C 170 380 200 410 230 405 C 245 402 256 392 256 392 C 256 392 267 402 282 405 C 312 410 342 380 342 340 C 342 300 312 260 256 260 Z" fill="#FAFAF7" />
  <circle cx="256" cy="335" r="42" fill="#3B9797" opacity="0.8" />
  <!-- Toe 1 -->
  <ellipse cx="155" cy="225" rx="35" ry="46" transform="rotate(-20 155 225)" fill="#FAFAF7" />
  <!-- Toe 2 -->
  <ellipse cx="218" cy="165" rx="36" ry="48" transform="rotate(-6 218 165)" fill="#FAFAF7" />
  <!-- Toe 3 -->
  <ellipse cx="294" cy="165" rx="36" ry="48" transform="rotate(6 294 165)" fill="#FAFAF7" />
  <!-- Toe 4 -->
  <ellipse cx="357" cy="225" rx="35" ry="46" transform="rotate(20 357 225)" fill="#FAFAF7" />
</svg>`;

fs.writeFileSync(path.resolve('public', 'favicon.svg'), svgContent);
fs.writeFileSync(path.join(outDir, 'icon.svg'), svgContent);

console.log('Icons successfully created in public/icons/ and public/favicon.svg');
