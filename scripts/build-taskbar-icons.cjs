// Larger optical shapes in the Windows-owned button slots; no runtime renderer needed.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'resources/icons');
const ink = '#364030';
const shapes = {
  prev: '<path d="M4 4v16" fill="none" stroke-width="2.6"/><path d="M19 4.5 7.5 12 19 19.5Z" stroke-width="1.5"/>',
  play: '<path d="M7 3.6 20 12 7 20.4Z" stroke-width="1.8"/>',
  pause:
    '<rect x="5" y="3.5" width="5" height="17" rx="1.6" stroke="none"/><rect x="14" y="3.5" width="5" height="17" rx="1.6" stroke="none"/>',
  next: '<path d="M20 4v16" fill="none" stroke-width="2.6"/><path d="M5 4.5 16.5 12 5 19.5Z" stroke-width="1.5"/>',
  favorite:
    '<path d="M12 20.3 3.9 12.6C-1.2 7.7 6.2.6 12 6.5 17.8.6 25.2 7.7 20.1 12.6Z" fill="none" stroke-width="2"/>',
  'favorite-active':
    '<path d="M12 20.3 3.9 12.6C-1.2 7.7 6.2.6 12 6.5 17.8.6 25.2 7.7 20.1 12.6Z" stroke-width=".6"/>'
};

async function main() {
  await fs.mkdir(directory, { recursive: true });
  const images = [];
  for (const [name, shape] of Object.entries(shapes)) {
    for (const dark of [false, true]) {
      const color =
        name === 'favorite-active' ? (dark ? '#becbaf' : '#737d61') : dark ? '#e8ece2' : ink;
      const svg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24"><g fill="${color}" stroke="${color}" stroke-linejoin="round" stroke-linecap="round">${shape}</g></svg>`
      );
      const png = await sharp(svg).resize(32, 32).png().toBuffer();
      await fs.writeFile(path.join(directory, `${name}${dark ? '-dark' : ''}.png`), png);
      images.push({
        input: png,
        left: 34 + Object.keys(shapes).indexOf(name) * 65,
        top: dark ? 120 : 30
      });
    }
  }
  const darkRow = await sharp({
    create: { width: 426, height: 90, channels: 4, background: '#282c25' }
  })
    .png()
    .toBuffer();
  await sharp({ create: { width: 426, height: 182, channels: 4, background: '#f3f4f1' } })
    .composite([{ input: darkRow, top: 92, left: 0 }, ...images])
    .png()
    .toFile(path.join(root, '../taskbar-icons-preview.png'));
  console.log('Six taskbar shapes in light/dark variants generated at 32px.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
