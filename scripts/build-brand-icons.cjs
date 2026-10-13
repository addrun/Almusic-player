// Render the authored splash-inspired vector with existing Sharp; no new dependencies.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const resources = path.join(root, 'resources');
const svg = fs.readFileSync(path.join(root, 'src/renderer/assets/brand-logo.svg'));
const smallSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect x="1" y="1" width="62" height="62" rx="15" fill="#F5F3EC"/><circle cx="35" cy="30" r="18" stroke="#737D61" stroke-width="3" opacity=".65"/><circle cx="35" cy="30" r="3" fill="#626E51"/><path d="M9 35H22C29 35 31 32 34 27C37 22 40 21 46 21H55" stroke="#626E51" stroke-width="4.5" stroke-linecap="round"/><path d="M14 46H25C33 46 37 41 40 36C42 33 45 32 50 32" stroke="#626E51" stroke-width="3" stroke-linecap="round" opacity=".7"/></svg>`
);
async function main() {
  const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
  const pngs = await Promise.all(
    sizes.map((size) =>
      sharp(size <= 24 ? smallSvg : svg)
        .resize(size, size)
        .png()
        .toBuffer()
    )
  );
  const icoHeader = Buffer.alloc(6 + sizes.length * 16);
  icoHeader.writeUInt16LE(1, 2);
  icoHeader.writeUInt16LE(sizes.length, 4);
  let offset = icoHeader.length;
  sizes.forEach((size, i) => {
    const entry = 6 + i * 16;
    icoHeader[entry] = size === 256 ? 0 : size;
    icoHeader[entry + 1] = size === 256 ? 0 : size;
    icoHeader.writeUInt16LE(1, entry + 4);
    icoHeader.writeUInt16LE(32, entry + 6);
    icoHeader.writeUInt32LE(pngs[i].length, entry + 8);
    icoHeader.writeUInt32LE(offset, entry + 12);
    offset += pngs[i].length;
  });
  const ico = Buffer.concat([icoHeader, ...pngs]);
  fs.writeFileSync(path.join(resources, 'icon.ico'), ico);
  fs.writeFileSync(path.join(resources, 'favicon.ico'), ico);
  fs.writeFileSync(path.join(resources, 'icon_16x16.png'), pngs[0]);
  fs.writeFileSync(path.join(resources, 'brand-logo.svg'), svg);
  const large = await sharp(svg).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(resources, 'icon.png'), large);
  fs.writeFileSync(path.join(root, 'src/renderer/assets/icon.png'), large);
  // A contact sheet at native small sizes and a large detail for visual inspection.
  const iconLarge = await sharp(svg).resize(192, 192).png().toBuffer();
  const composite = [{ input: iconLarge, left: 44, top: 44 }];
  let x = 292;
  for (const size of [16, 24, 32, 48, 64]) {
    composite.push({ input: pngs[sizes.indexOf(size)], left: x, top: 112 - Math.floor(size / 2) });
    x += size + 28;
  }
  await sharp({ create: { width: 660, height: 280, channels: 4, background: '#e7e8e3' } })
    .composite(composite)
    .png()
    .toFile(path.join(root, '../brand-icons-preview.png'));
  console.log('Brand PNG, SVG and nine-size ICO generated with existing Sharp.');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
