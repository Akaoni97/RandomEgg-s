// Versione da browser in UN SOLO FILE (dist-artifact/lucatekno-machine.html): JavaScript, stili,
// font e i 199 campioni della cassa incorporati. Si apre con un doppio clic o si pubblica come pagina.
// Uso: npm run build:artifact

import { build } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-artifact');

await build({
  root,
  base: './',
  logLevel: 'warn',
  plugins: [react()],
  build: {
    outDir: path.join(out, 'tmp'),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

const tmp = path.join(out, 'tmp');
const html = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
const read = (rel) => fs.readFileSync(path.join(tmp, rel.replace(/^\.\//, '')), 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map((m) => read(m[1])).join('\n');
const js = [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)].map((m) => read(m[1])).join('\n');
const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? 'LucaTekno_Machine';
const icon = /<link rel="icon"[^>]*>/.exec(html)?.[0] ?? '';

// niente <html>/<head>/<body>: la pagina può essere avvolta da un contenitore che li aggiunge da sé
const page = `<title>${title}</title>
<meta charset="utf-8">
${icon}
<style>${css}</style>
<div id="root"></div>
<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>
`;
fs.writeFileSync(path.join(out, 'lucatekno-machine.html'), page);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`dist-artifact/lucatekno-machine.html · ${(page.length / 1e6).toFixed(1)} MB`);
