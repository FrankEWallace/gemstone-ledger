// Generates the static brand assets in /public from the same gem geometry
// as src/components/shared/BrandMark.tsx. Re-run after changing the mark:
//   node scripts/generate-brand-assets.mjs
// Requires Google Chrome (used headless to rasterize the SVG/HTML).
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, copyFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PUBLIC = resolve(import.meta.dirname, "../public");
const BG = "#0f172a"; // slate-900 — matches PWA theme_color
const TEAL = "#2dd4be"; // brand accent (bright variant for dark surfaces)

// Same paths as BrandMark.tsx (32x32 grid)
const GEM = `
  <path d="M9.5 6.5h13L28 13 16 26.5 4 13l5.5-6.5Z" stroke="${TEAL}" stroke-width="2" stroke-linejoin="round" fill="none"/>
  <path d="M4.5 13h23M9.5 6.5 12 13l4 13M22.5 6.5 20 13l-4 13" stroke="${TEAL}" stroke-width="2" stroke-linejoin="round" fill="none"/>
`;

// glyphScale: fraction of the canvas the 32-unit glyph grid occupies
function iconSvg(size, { radius, glyphScale }) {
  const s = (size * glyphScale) / 32;
  const offset = (size - 32 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
    <g transform="translate(${offset} ${offset}) scale(${s})">${GEM}</g>
  </svg>`;
}

const ogHtml = `<!doctype html><html><head><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: ${BG}; color: #f1f5f9;
         font-family: 'Helvetica Neue', Arial, sans-serif; display: flex;
         flex-direction: column; justify-content: center; padding: 0 96px; }
  .mark { display: flex; align-items: center; gap: 20px; margin-bottom: 40px; }
  .tile { width: 76px; height: 76px; border-radius: 18px; background: #1e293b;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid #334155; }
  h1 { font-size: 76px; font-weight: 700; letter-spacing: -0.02em; }
  p  { font-size: 30px; color: #94a3b8; margin-top: 20px; max-width: 820px; line-height: 1.4; }
  .bar { position: absolute; left: 0; top: 0; bottom: 0; width: 12px; background: ${TEAL}; }
</style></head><body>
  <div class="bar"></div>
  <div class="mark">
    <div class="tile"><svg width="44" height="44" viewBox="0 0 32 32">${GEM}</svg></div>
    <span style="font-size:34px;font-weight:600;color:#cbd5e1">FW Mining OS</span>
  </div>
  <h1>Run your mining operation<br/>from one place.</h1>
  <p>Production, inventory, safety, team and reporting — the operations platform for modern mining.</p>
</body></html>`;

// Wrap PNGs into a .ico container (PNG-in-ICO, supported by all modern browsers)
function writeIco(pngPaths, out) {
  const pngs = pngPaths.map((p) => readFileSync(p.file).length ? { ...p, data: readFileSync(p.file) } : p);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = [], blobs = [];
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size === 256 ? 0 : size, 0);
    e.writeUInt8(size === 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);  // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
    blobs.push(data);
  }
  writeFileSync(out, Buffer.concat([header, ...entries, ...blobs]));
}

const work = mkdtempSync(join(tmpdir(), "brand-"));
function render(name, content, w, h) {
  const src = join(work, name + (content.startsWith("<!doctype") ? ".html" : ".svg"));
  writeFileSync(src, content);
  const shot = join(work, name + ".png");
  execFileSync(CHROME, [
    "--headless", "--disable-gpu", `--screenshot=${shot}`,
    `--window-size=${w},${h}`, "--default-background-color=00000000",
    "--hide-scrollbars", `file://${src}`,
  ], { stdio: "pipe" });
  return shot;
}

const p512 = render("pwa-512", iconSvg(512, { radius: 96, glyphScale: 0.78 }), 512, 512);
const mask512 = render("maskable-512", iconSvg(512, { radius: 0, glyphScale: 0.56 }), 512, 512);
const p192 = render("pwa-192", iconSvg(192, { radius: 36, glyphScale: 0.78 }), 192, 192);
const apple = render("apple-touch", iconSvg(180, { radius: 0, glyphScale: 0.72 }), 180, 180);
const f32 = render("fav-32", iconSvg(32, { radius: 7, glyphScale: 0.9 }), 32, 32);
const f16 = render("fav-16", iconSvg(16, { radius: 4, glyphScale: 0.95 }), 16, 16);
const og = render("og-image", ogHtml, 1200, 630);

copyFileSync(p512, join(PUBLIC, "pwa-512x512.png"));
copyFileSync(mask512, join(PUBLIC, "pwa-maskable-512x512.png"));
copyFileSync(p192, join(PUBLIC, "pwa-192x192.png"));
copyFileSync(apple, join(PUBLIC, "apple-touch-icon.png"));
copyFileSync(og, join(PUBLIC, "og-image.png"));
writeIco([{ size: 16, file: f16 }, { size: 32, file: f32 }], join(PUBLIC, "favicon.ico"));
rmSync(work, { recursive: true, force: true });
console.log("Brand assets written to /public");
