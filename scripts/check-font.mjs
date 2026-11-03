// Read the original font's cmap without modifying or redistributing it.
import { readFileSync } from 'node:fs';
const buffer = readFileSync('public/fonts/MullerDemo-ExtraBold.otf');
const count = buffer.readUInt16BE(4);
let cmap = 0;
for (let i = 0; i < count; i++) {
  const pos = 12 + i * 16;
  if (buffer.toString('ascii', pos, pos + 4) === 'cmap') cmap = buffer.readUInt32BE(pos + 8);
}
if (!cmap) throw Error('No cmap table');
const supported = new Set();
const tables = buffer.readUInt16BE(cmap + 2);
for (let i = 0; i < tables; i++) {
  const base = cmap + buffer.readUInt32BE(cmap + 4 + i * 8 + 4);
  const fmt = buffer.readUInt16BE(base);
  if (fmt === 4) {
    const n = buffer.readUInt16BE(base + 6) / 2;
    const ends = base + 14;
    const starts = ends + 2 * n + 2;
    const deltas = starts + 2 * n;
    const offsets = deltas + 2 * n;
    for (const ch of 'ăâîșțĂÂÎȘȚ') {
      const code = ch.codePointAt(0);
      for (let j = 0; j < n; j++) {
        const end = buffer.readUInt16BE(ends + j * 2),
          start = buffer.readUInt16BE(starts + j * 2);
        if (code >= start && code <= end) {
          const delta = buffer.readInt16BE(deltas + j * 2),
            off = buffer.readUInt16BE(offsets + j * 2);
          let glyph = off ? buffer.readUInt16BE(offsets + j * 2 + off + 2 * (code - start)) : code;
          glyph = glyph ? (glyph + delta) & 65535 : 0;
          if (glyph) supported.add(ch);
        }
      }
    }
  }
}
console.log(
  'Muller ExtraBold Romanian glyph coverage:',
  [...'ăâîșțĂÂÎȘȚ'].map((c) => `${c}:${supported.has(c) ? 'yes' : 'fallback'}`).join(' '),
);
