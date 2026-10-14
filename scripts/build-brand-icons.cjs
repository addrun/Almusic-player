// Render every application-brand asset from the authored vector with existing Sharp.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const resources = path.join(root, 'resources');
const svg = fs.readFileSync(path.join(root, 'src/renderer/assets/brand-logo.svg'));
// Keep a simplified enlarged shape legible in the smallest native icon sizes.
const smallSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="12" fill="#F5F3EC"/><rect x=".75" y=".75" width="62.5" height="62.5" rx="11.25" stroke="#737D61" stroke-opacity=".24" stroke-width="1.5"/><circle cx="35" cy="28" r="18" stroke="#737D61" stroke-width="2.4" stroke-opacity=".7"/><circle cx="35" cy="28" r="12" stroke="#737D61" stroke-width="1.8" stroke-opacity=".35"/><circle cx="35" cy="28" r="2.5" fill="#626E51"/><path d="M7 34H22C29 34 32 30 36 25C39 21 42 20 48 20H58" stroke="#626E51" stroke-width="3.4" stroke-linecap="round"/><path d="M12 45H25C33 45 38 39 42 34C44 32 47 31 54 31" stroke="#626E51" stroke-width="2" stroke-linecap="round" stroke-opacity=".65"/></svg>`
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
  fs.writeFileSync(path.join(resources, 'icon_24x24.png'), pngs[2]);
  fs.writeFileSync(path.join(resources, 'icon_32x32.png'), pngs[3]);
  fs.writeFileSync(path.join(resources, 'app-icon-light-v2.ico'), ico);
  fs.writeFileSync(path.join(resources, 'brand-logo.svg'), svg);
  const large = await sharp(svg).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(resources, 'icon.png'), large);
  fs.writeFileSync(path.join(root, 'src/renderer/assets/icon.png'), large);
  fs.writeFileSync(path.join(root, 'src/renderer/assets/logo.png'), large);
  fs.writeFileSync(
    path.join(resources, 'icon_192x192.png'),
    await sharp(svg).resize(192, 192).png().toBuffer()
  );
  // Modern macOS ICNS supports PNG chunks; keep standard @1x and @2x representations.
  const icnsSizes = [
    ['icp4', 16],
    ['icp5', 32],
    ['icp6', 64],
    ['ic07', 128],
    ['ic08', 256],
    ['ic09', 512],
    ['ic10', 1024],
    ['ic11', 32],
    ['ic12', 64],
    ['ic13', 256],
    ['ic14', 512]
  ];
  const icnsChunks = await Promise.all(
    icnsSizes.map(async ([type, size]) => {
      const png = await sharp(size <= 24 ? smallSvg : svg)
        .resize(size, size)
        .png()
        .toBuffer();
      const header = Buffer.alloc(8);
      header.write(type, 0, 4, 'ascii');
      header.writeUInt32BE(8 + png.length, 4);
      return Buffer.concat([header, png]);
    })
  );
  const icnsHeader = Buffer.alloc(8);
  icnsHeader.write('icns', 0, 4, 'ascii');
  icnsHeader.writeUInt32BE(8 + icnsChunks.reduce((total, chunk) => total + chunk.length, 0), 4);
  fs.writeFileSync(path.join(resources, 'icon.icns'), Buffer.concat([icnsHeader, ...icnsChunks]));
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
  console.log(
    'Brand PNG, SVG, nine-size ICO and eleven-representation ICNS generated with existing Sharp.'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
