// Impacchetta l'app in un solo file HTML (versione dimostrativa con archivio locale),
// adatto a essere pubblicato come pagina statica.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const order = ['core.js', 'seed.js', 'ui.js', 'art.js', 'fx.js', 'store.js', 'dialogs.js', 'views.js', 'app.js'];

const js = order.map((f) => {
  const src = fs.readFileSync(path.join(pub, 'js', f), 'utf8')
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, '')
    .replace(/^export\s+(default\s+)?(?=(async\s+)?function|const|let|class)/gm, '');
  return `// ---- ${f} ----\n${src}`;
}).join('\n');

const css = fs.readFileSync(path.join(pub, 'styles.css'), 'utf8');
const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Magazzino Ferroleghe</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Stencil+Display:wght@600..900&family=Instrument+Sans:wdth,wght@75..100,400..700&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
${css}
</style>
<div id="app"></div>
<script>window.__MAG_MODE = 'demo';</script>
<script type="module">
${js}
</script>
`;
const out = path.join(root, 'dist', 'magazzino-ferroleghe.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`Scritto ${path.relative(root, out)} (${(html.length / 1024).toFixed(1)} KB)`);
