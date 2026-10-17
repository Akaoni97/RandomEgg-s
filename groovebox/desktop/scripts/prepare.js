// Builds desktop/app/ from the web version: wraps groovebox/mattone.html in a full document,
// copies the samples and the MP3 encoder, and stores the fonts locally so the app works offline.
const fs = require("fs");
const path = require("path");

const DESKTOP = path.join(__dirname, "..");
const WEB = path.join(DESKTOP, "..");
const OUT = path.join(DESKTOP, "app");

async function fetchFonts(cssUrl) {
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
  const css = await (await fetch(cssUrl, { headers: { "User-Agent": ua } })).text();
  fs.mkdirSync(path.join(OUT, "fonts"), { recursive: true });
  let i = 0, local = css;
  for (const url of new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) || [])) {
    const name = "f" + (i++) + path.extname(new URL(url).pathname);
    fs.writeFileSync(path.join(OUT, "fonts", name), Buffer.from(await (await fetch(url)).arrayBuffer()));
    local = local.split(url).join(name);
  }
  fs.writeFileSync(path.join(OUT, "fonts", "fonts.css"), local);
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, "vendor"), { recursive: true });
  let page = fs.readFileSync(path.join(WEB, "mattone.html"), "utf8");

  const link = page.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com\/[^"]+)">/);
  if (link) {
    try {
      await fetchFonts(link[1].replace(/&amp;/g, "&"));
      page = page.replace(link[0], '<link rel="stylesheet" href="fonts/fonts.css">');
      console.log("Caratteri salvati in locale.");
    } catch (e) {
      console.warn("Caratteri non scaricati, l'app li userà da internet:", e.message);
    }
  }

  const csp = "default-src 'self'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:";
  const html = '<!doctype html><html lang="it"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<meta http-equiv="Content-Security-Policy" content="' + csp + '">' +
    "</head><body>\n" + page + "\n</body></html>\n";
  fs.writeFileSync(path.join(OUT, "index.html"), html);

  fs.cpSync(path.join(WEB, "suoni"), path.join(OUT, "suoni"), { recursive: true });
  fs.copyFileSync(require.resolve("lamejs/lame.min.js"), path.join(OUT, "vendor", "lame.min.js"));
  console.log("App pronta in", OUT, "-", fs.readdirSync(path.join(OUT, "suoni")).length, "suoni.");
})();
