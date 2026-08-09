import sharp from "sharp";
import potrace from "potrace";
import pngToIco from "png-to-ico";
import fs from "fs/promises";
import path from "path";

const OUT = "public/branding";
await fs.mkdir(OUT, { recursive: true });

const PURPLE_SRC = "public/favicon-purple.png";
const EMERALD_SRC = "public/favicon-emerald.png";

function toHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

async function samplePixel(file, x, y) {
  const { data, info } = await sharp(file).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const idx = (y * info.width + x) * info.channels;
  return [data[idx], data[idx + 1], data[idx + 2]];
}

// --- 1. Sample brand colors directly from the source art ---
const purpleRGB = await samplePixel(PURPLE_SRC, 1500, 500);
const emeraldRGB = await samplePixel(EMERALD_SRC, 1500, 500);
const PURPLE_HEX = toHex(purpleRGB);
const EMERALD_HEX = toHex(emeraldRGB);
console.log("Sampled purple:", PURPLE_HEX, "emerald:", EMERALD_HEX);

// --- 2. Trace the glyph silhouette once (purple source: cleanest flat fill).
//     Both source files share identical geometry, so one trace covers all
//     four colorways below. blackOnWhite:false because the glyph is LIGHT
//     on a DARK background (inverse of potrace's light-bg default).
const svgPath = await new Promise((resolve, reject) => {
  potrace.trace(
    PURPLE_SRC,
    { blackOnWhite: false, threshold: 60, turdSize: 50, optTolerance: 0.3 },
    (err, svg) => {
      if (err) return reject(err);
      const match = svg.match(/<path[^>]*d="([^"]+)"/);
      if (!match) return reject(new Error("no path found in traced SVG"));
      resolve(match[1]);
    },
  );
});

function buildSvg(fill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048">
  <path fill="${fill}" d="${svgPath}"/>
</svg>
`;
}

const colorways = {
  "logo-purple.svg": PURPLE_HEX,
  "logo-green.svg": EMERALD_HEX,
  "logo-white.svg": "#ffffff",
  "logo-black.svg": "#000000",
};
for (const [file, color] of Object.entries(colorways)) {
  await fs.writeFile(path.join(OUT, file), buildSvg(color));
  console.log("wrote", file);
}

// --- 3. Raster favicon exports. Resized straight from the 2048px masters
//     (full gradient/facet detail preserved — only the SVG glyphs above
//     are flattened to solid color) using Lanczos3 for crisp downsampling.
async function resizeTo(src, size, outFile) {
  await sharp(src)
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 95 })
    .toFile(path.join(OUT, outFile));
  const { size: bytes } = await fs.stat(path.join(OUT, outFile));
  console.log("wrote", outFile, `${size}x${size}`, `(${(bytes / 1024).toFixed(1)} KB)`);
}

await resizeTo(PURPLE_SRC, 512, "favicon-purple.png");
await resizeTo(EMERALD_SRC, 512, "favicon-green.png");

// Platform-level icons (apple-touch-icon, android-chrome, favicon.ico) are
// read once by the OS/browser chrome and can't react to in-page theme
// state, so they use a single fixed default — purple, matching the app's
// default accent (see themeStore's "violet" default).
await resizeTo(PURPLE_SRC, 180, "apple-touch-icon.png");
await resizeTo(PURPLE_SRC, 192, "android-chrome-192.png");
await resizeTo(PURPLE_SRC, 512, "android-chrome-512.png");

const icoSizes = [16, 32, 48];
const icoBuffers = await Promise.all(
  icoSizes.map((size) =>
    sharp(PURPLE_SRC)
      .resize(size, size, { kernel: sharp.kernel.lanczos3 })
      .png({ palette: true, quality: 95 })
      .toBuffer(),
  ),
);
const icoBuffer = await pngToIco(icoBuffers);
await fs.writeFile(path.join(OUT, "favicon.ico"), icoBuffer);
console.log("wrote favicon.ico (16/32/48)");

// --- 4. site.webmanifest ---
const manifest = {
  name: "LiftRyt AI",
  short_name: "LiftRyt",
  description: "An AI gym coach that knows your actual training.",
  icons: [
    { src: "/branding/android-chrome-192.png", sizes: "192x192", type: "image/png" },
    { src: "/branding/android-chrome-512.png", sizes: "512x512", type: "image/png" },
  ],
  theme_color: PURPLE_HEX,
  background_color: "#0a0a0a",
  display: "standalone",
  start_url: "/",
};
await fs.writeFile(path.join(OUT, "site.webmanifest"), JSON.stringify(manifest, null, 2) + "\n");
console.log("wrote site.webmanifest");

console.log("\nDone. Sampled colors -> purple:", PURPLE_HEX, "emerald:", EMERALD_HEX);
