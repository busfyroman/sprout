import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/assets/icons')

const INK = [28, 25, 21]
const CREAM = [244, 228, 206]
const CLAY = [226, 91, 42]

function createCanvas(size) {
  return { size, data: new Float32Array(size * size * 4) }
}

function blend(canvas, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size || a <= 0) return
  const i = (y * canvas.size + x) * 4
  const src = Math.min(1, a)
  const dst = 1 - src
  canvas.data[i] = canvas.data[i] * dst + r * src
  canvas.data[i + 1] = canvas.data[i + 1] * dst + g * src
  canvas.data[i + 2] = canvas.data[i + 2] * dst + b * src
  canvas.data[i + 3] = canvas.data[i + 3] * dst + 255 * src
}

function smooth(t) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

function fillRoundRect(canvas, radius) {
  const s = canvas.size
  const r = radius
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const cx = Math.min(Math.max(px, r), s - r)
      const cy = Math.min(Math.max(py, r), s - r)
      const dist = Math.hypot(px - cx, py - cy)
      const alpha = smooth(r - dist + 0.8)
      blend(canvas, x, y, INK[0], INK[1], INK[2], alpha)
    }
  }
}

function worldPoint(x, y, originX, originY, angle) {
  const dx = x - originX
  const dy = y - originY
  const c = Math.cos(-angle)
  const s = Math.sin(-angle)
  return [dx * c - dy * s, dx * s + dy * c]
}

function leafAlpha(lx, ly, length, width) {
  if (lx < -0.6 || lx > length + 0.6) return 0
  const t = Math.min(1, Math.max(0, lx / length))
  const belly = Math.sin(Math.PI * t) ** 0.72
  const hw = width * belly
  const edge = hw - Math.abs(ly)
  return smooth(edge + 0.35)
}

function fillLeaf(canvas, originX, originY, angle, length, width, color) {
  const pad = Math.ceil(Math.max(length, width) + 4)
  const minX = Math.max(0, Math.floor(originX - pad))
  const maxX = Math.min(canvas.size - 1, Math.ceil(originX + pad))
  const minY = Math.max(0, Math.floor(originY - pad))
  const maxY = Math.min(canvas.size - 1, Math.ceil(originY + pad))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const [lx, ly] = worldPoint(x + 0.5, y + 0.5, originX, originY, angle)
      const alpha = leafAlpha(lx, ly, length, width)
      if (alpha > 0) blend(canvas, x, y, color[0], color[1], color[2], alpha)
    }
  }
}

function fillStem(canvas, x1, y1, x2, y2, radius, color) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - radius - 2))
  const maxX = Math.min(canvas.size - 1, Math.ceil(Math.max(x1, x2) + radius + 2))
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - radius - 2))
  const maxY = Math.min(canvas.size - 1, Math.ceil(Math.max(y1, y2) + radius + 2))
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5
      const py = y + 0.5
      let t = ((px - x1) * dx + (py - y1) * dy) / len2
      t = Math.min(1, Math.max(0, t))
      const cx = x1 + t * dx
      const cy = y1 + t * dy
      const dist = Math.hypot(px - cx, py - cy)
      const alpha = smooth(radius - dist + 0.7)
      if (alpha > 0) blend(canvas, x, y, color[0], color[1], color[2], alpha)
    }
  }
}

function fillCircle(canvas, cx, cy, radius, color) {
  const minX = Math.max(0, Math.floor(cx - radius - 2))
  const maxX = Math.min(canvas.size - 1, Math.ceil(cx + radius + 2))
  const minY = Math.max(0, Math.floor(cy - radius - 2))
  const maxY = Math.min(canvas.size - 1, Math.ceil(cy + radius + 2))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      const alpha = smooth(radius - dist + 0.7)
      if (alpha > 0) blend(canvas, x, y, color[0], color[1], color[2], alpha)
    }
  }
}

function drawIcon(size) {
  const canvas = createCanvas(size)
  const u = size / 128
  fillRoundRect(canvas, 28 * u)
  fillStem(canvas, 60 * u, 100 * u, 68 * u, 62 * u, 4.2 * u, CREAM)
  fillLeaf(canvas, 58 * u, 74 * u, (138 * Math.PI) / 180, 40 * u, 15 * u, CREAM)
  fillLeaf(canvas, 70 * u, 64 * u, (-48 * Math.PI) / 180, 46 * u, 17.5 * u, CLAY)
  fillCircle(canvas, 61 * u, 98 * u, 6.2 * u, CLAY)
  return canvas
}

function downsample(src, size) {
  const factor = src.size / size
  const out = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      const x0 = Math.floor(x * factor)
      const x1 = Math.floor((x + 1) * factor)
      const y0 = Math.floor(y * factor)
      const y1 = Math.floor((y + 1) * factor)
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * src.size + xx) * 4
          r += src.data[i]
          g += src.data[i + 1]
          b += src.data[i + 2]
          a += src.data[i + 3]
          n++
        }
      }
      const o = (y * size + x) * 4
      out[o] = Math.round(r / n)
      out[o + 1] = Math.round(g / n)
      out[o + 2] = Math.round(b / n)
      out[o + 3] = Math.round(a / n)
    }
  }
  return out
}

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), 8 + data.length)
  return out
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength).copy(
      raw,
      y * (size * 4 + 1) + 1,
      y * size * 4,
      (y + 1) * size * 4,
    )
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

fs.mkdirSync(outDir, { recursive: true })
const master = drawIcon(512)
for (const size of [16, 32, 48, 128]) {
  const png = encodePng(size, downsample(master, size))
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png)
}
fs.writeFileSync(path.join(outDir, 'icon512.png'), encodePng(512, downsample(master, 512)))
console.log('wrote icons to', outDir)
