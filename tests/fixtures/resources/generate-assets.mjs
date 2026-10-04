// Original, deliberately tiny test font: space and a rectangular A. No third-party font data.
// Run with Node to reproduce the committed WOFF and one-pixel image exactly.
import { mkdir, writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';
const tables = new Map();
const table = (name, length) => {
  const value = Buffer.alloc(length);
  tables.set(name, value);
  return value;
};
const head = table('head', 54);
head.writeUInt32BE(0x10000);
head.writeUInt32BE(0x10000, 4);
head.writeUInt32BE(0x5f0f3cf5, 12);
head.writeUInt16BE(3, 16);
head.writeUInt16BE(1000, 18);
head.writeInt16BE(600, 40);
head.writeInt16BE(700, 42);
head.writeUInt16BE(8, 46);
head.writeInt16BE(2, 48);
const hhea = table('hhea', 36);
hhea.writeUInt32BE(0x10000);
hhea.writeInt16BE(800, 4);
hhea.writeInt16BE(-200, 6);
hhea.writeUInt16BE(600, 10);
hhea.writeInt16BE(600, 16);
hhea.writeInt16BE(1, 18);
hhea.writeUInt16BE(3, 34);
const maxp = table('maxp', 32);
maxp.writeUInt32BE(0x10000);
maxp.writeUInt16BE(3, 4);
maxp.writeUInt16BE(4, 6);
maxp.writeUInt16BE(1, 8);
maxp.writeUInt16BE(2, 14);
const hmtx = table('hmtx', 12);
for (let i = 0; i < 3; i++) hmtx.writeUInt16BE(600, i * 4);
const glyf = table('glyf', 54);
glyf.writeInt16BE(1, 20);
glyf.writeInt16BE(600, 26);
glyf.writeInt16BE(700, 28);
glyf.writeUInt16BE(3, 30);
glyf.fill(1, 34, 38);
[0, 600, 0, -600, 0, 0, 700, 0].forEach((n, i) => glyf.writeInt16BE(n, 38 + i * 2));
const loca = table('loca', 8);
[0, 5, 10, 27].forEach((n, i) => loca.writeUInt16BE(n, i * 2));
const cmap = table('cmap', 52);
cmap.writeUInt16BE(1, 2);
cmap.writeUInt16BE(3, 4);
cmap.writeUInt16BE(1, 6);
cmap.writeUInt32BE(12, 8);
cmap.writeUInt16BE(4, 12);
cmap.writeUInt16BE(40, 14);
cmap.writeUInt16BE(6, 18);
cmap.writeUInt16BE(4, 20);
cmap.writeUInt16BE(1, 22);
cmap.writeUInt16BE(2, 24);
[32, 65, 65535].forEach((n, i) => {
  cmap.writeUInt16BE(n, 26 + i * 2);
  cmap.writeUInt16BE(n, 34 + i * 2);
});
[-31, -63, 1].forEach((n, i) => cmap.writeInt16BE(n, 40 + i * 2));
const names = [
  [1, 'OSAI Fixture'],
  [2, 'Regular'],
  [4, 'OSAI Fixture Regular'],
  [6, 'OSAIFixture-Regular'],
];
const strings = names.map(([, value]) => {
  const bytes = Buffer.from(value, 'utf16le');
  bytes.swap16();
  return bytes;
});
const name = table('name', 6 + names.length * 12 + strings.reduce((n, b) => n + b.length, 0));
name.writeUInt16BE(names.length, 2);
name.writeUInt16BE(6 + names.length * 12, 4);
let stringOffset = 0;
names.forEach(([id], i) => {
  const offset = 6 + i * 12;
  name.writeUInt16BE(3, offset);
  name.writeUInt16BE(1, offset + 2);
  name.writeUInt16BE(0x409, offset + 4);
  name.writeUInt16BE(id, offset + 6);
  name.writeUInt16BE(strings[i].length, offset + 8);
  name.writeUInt16BE(stringOffset, offset + 10);
  strings[i].copy(name, 6 + names.length * 12 + stringOffset);
  stringOffset += strings[i].length;
});
const post = table('post', 32);
post.writeUInt32BE(0x30000);
post.writeInt16BE(-100, 8);
post.writeInt16BE(50, 10);
const os2 = table('OS/2', 78);
os2.writeInt16BE(600, 2);
os2.writeUInt16BE(400, 4);
os2.writeUInt16BE(5, 6);
os2.writeUInt32BE(1, 42);
os2.write('OSAI', 58);
os2.writeUInt16BE(64, 62);
os2.writeUInt16BE(32, 64);
os2.writeUInt16BE(65, 66);
os2.writeInt16BE(800, 68);
os2.writeInt16BE(-200, 70);
os2.writeUInt16BE(800, 74);
os2.writeUInt16BE(200, 76);
const entries = [...tables].sort(([a], [b]) => a.localeCompare(b, 'en'));
const pad = (n) => (n + 3) & ~3;
const checksum = (buffer) => {
  const bytes = Buffer.alloc(pad(buffer.length));
  buffer.copy(bytes);
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 4) sum = (sum + bytes.readUInt32BE(i)) >>> 0;
  return sum;
};
const sfnt = Buffer.alloc(
  12 + entries.length * 16 + entries.reduce((n, [, b]) => n + pad(b.length), 0),
);
sfnt.writeUInt32BE(0x10000);
sfnt.writeUInt16BE(entries.length, 4);
sfnt.writeUInt16BE(128, 6);
sfnt.writeUInt16BE(3, 8);
sfnt.writeUInt16BE(entries.length * 16 - 128, 10);
let offset = 12 + entries.length * 16;
entries.forEach(([tag, bytes], i) => {
  const at = 12 + i * 16;
  sfnt.write(tag, at);
  sfnt.writeUInt32BE(checksum(bytes), at + 4);
  sfnt.writeUInt32BE(offset, at + 8);
  sfnt.writeUInt32BE(bytes.length, at + 12);
  bytes.copy(sfnt, offset);
  offset += pad(bytes.length);
});
head.writeUInt32BE((0xb1b0afba - checksum(sfnt)) >>> 0, 8);
const woff = Buffer.alloc(
  44 + entries.length * 20 + entries.reduce((n, [, b]) => n + pad(b.length), 0),
);
woff.write('wOFF');
woff.writeUInt32BE(0x10000, 4);
woff.writeUInt32BE(woff.length, 8);
woff.writeUInt16BE(entries.length, 12);
woff.writeUInt32BE(sfnt.length, 16);
woff.writeUInt16BE(1, 20);
offset = 44 + entries.length * 20;
entries.forEach(([tag, bytes], i) => {
  const at = 44 + i * 20;
  woff.write(tag, at);
  woff.writeUInt32BE(offset, at + 4);
  woff.writeUInt32BE(bytes.length, at + 8);
  woff.writeUInt32BE(bytes.length, at + 12);
  const original = Buffer.from(bytes);
  if (tag === 'head') original.writeUInt32BE(0, 8);
  woff.writeUInt32BE(checksum(original), at + 16);
  bytes.copy(woff, offset);
  offset += pad(bytes.length);
});
await mkdir(new URL('./assets/fonts/', import.meta.url), { recursive: true });
await mkdir(new URL('./assets/images/', import.meta.url), { recursive: true });
await writeFile(new URL('./assets/fonts/fixture.woff', import.meta.url), woff);
const chunk = (type, data) => {
  const bytes = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const end = Buffer.alloc(4);
  end.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, bytes, end]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(1, 0);
ihdr.writeUInt32BE(1, 4);
ihdr[8] = 8;
ihdr[9] = 6;
await writeFile(
  new URL('./assets/images/pixel.png', import.meta.url),
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.from([0, 255, 255, 255, 255]))),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
