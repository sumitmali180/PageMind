import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(__dirname, '../public/icons');
fs.mkdirSync(iconsDir, { recursive: true });

// Minimal pure-Node PNG encoder for crisp anti-aliased PageMind icons
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;

  const setPixel = (x, y, r, g, b, a) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    const srcA = a / 255;
    const dstA = rgba[idx + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) return;
    rgba[idx] = Math.round((r * srcA + rgba[idx] * dstA * (1 - srcA)) / outA);
    rgba[idx + 1] = Math.round((g * srcA + rgba[idx + 1] * dstA * (1 - srcA)) / outA);
    rgba[idx + 2] = Math.round((b * srcA + rgba[idx + 2] * dstA * (1 - srcA)) / outA);
    rgba[idx + 3] = Math.round(outA * 255);
  };

  // Draw rounded square background (#18181b zinc-900 with subtle inner border)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const dx = Math.max(0, Math.abs(px - size / 2) - (size / 2 - radius));
      const dy = Math.max(0, Math.abs(py - size / 2) - (size / 2 - radius));
      const dist = Math.hypot(dx, dy) - radius;
      if (dist < 0.5) {
        const alpha = Math.max(0, Math.min(1, 0.5 - dist));
        // Subtle vertical gradient from #27272a to #111113
        const t = y / size;
        const r = Math.round(39 * (1 - t) + 17 * t);
        const g = Math.round(39 * (1 - t) + 17 * t);
        const b = Math.round(42 * (1 - t) + 19 * t);
        setPixel(x, y, r, g, b, Math.round(alpha * 255));
      }
    }
  }

  // Draw minimalist page + spark glyph in crisp white (#fafafa) and accent (#60a5fa)
  const pad = size * 0.24;
  const pageLeft = pad;
  const pageRight = size - pad;
  const pageTop = size * 0.2;
  const pageBottom = size * 0.8;
  const stroke = Math.max(1.2, size * 0.085);

  // Three horizontal reading lines representing structured page understanding
  const lines = [
    { y: 0.36, x1: 0.30, x2: 0.70, accent: false },
    { y: 0.50, x1: 0.30, x2: 0.62, accent: false },
    { y: 0.64, x1: 0.30, x2: 0.52, accent: true },
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / size;
      const py = (y + 0.5) / size;

      // Subtle outer page frame for >= 32px
      if (size >= 32) {
        const inBoxX = (x + 0.5) >= pageLeft && (x + 0.5) <= pageRight;
        const inBoxY = (y + 0.5) >= pageTop && (y + 0.5) <= pageBottom;
        if (inBoxX && inBoxY) {
          const dEdge = Math.min(
            Math.abs((x + 0.5) - pageLeft),
            Math.abs((x + 0.5) - pageRight),
            Math.abs((y + 0.5) - pageTop),
            Math.abs((y + 0.5) - pageBottom),
          );
          if (dEdge < stroke * 0.45) {
            setPixel(x, y, 255, 255, 255, 45);
          }
        }
      }

      for (const line of lines) {
        const lx1 = line.x1 * size;
        const lx2 = line.x2 * size;
        const ly = line.y * size;
        const clampedX = Math.max(lx1, Math.min(lx2, x + 0.5));
        const d = Math.hypot((x + 0.5) - clampedX, (y + 0.5) - ly) - stroke * 0.5;
        if (d < 0.7) {
          const alpha = Math.max(0, Math.min(1, 0.7 - d));
          if (line.accent) {
            setPixel(x, y, 96, 165, 250, Math.round(alpha * 255));
          } else {
            setPixel(x, y, 250, 250, 250, Math.round(alpha * 255));
          }
        }
      }

      // Small accent dot in bottom-right of page
      const dotX = 0.68 * size;
      const dotY = 0.64 * size;
      const dotR = stroke * 0.62;
      const dDot = Math.hypot(px * size - dotX, py * size - dotY) - dotR;
      if (dDot < 0.7) {
        const alpha = Math.max(0, Math.min(1, 0.7 - dDot));
        setPixel(x, y, 96, 165, 250, Math.round(alpha * 255));
      }
    }
  }

  return encodePNG(size, size, rgba);
}

for (const size of [16, 32, 48, 128]) {
  const png = renderIcon(size);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), png);
  console.log(`Generated icons/icon-${size}.png (${png.length} bytes)`);
}

