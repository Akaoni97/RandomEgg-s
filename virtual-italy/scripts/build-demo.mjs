// Impacchetta la città in un solo file HTML in modalità demo (città nel browser, email finte),
// adatto a essere aperto senza server o pubblicato come pagina statica.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const order = ['core.js', 'seed.js', 'art.js', 'town.js', 'town3d.js', 'avatar3d.js', 'vehicles3d.js', 'render.js', 'store.js', 'app.js'];
// three.js (licenza MIT, in public/vendor) va dentro la pagina: la demo funziona anche senza rete.
const three = fs.readFileSync(path.join(pub, 'vendor', 'three.min.js'), 'utf8');

const js = order.map((f) => {
  const src = fs.readFileSync(path.join(pub, 'js', f), 'utf8')
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
    .replace(/^export\s+(?=(async\s+)?function|const|let|class)/gm, '');
  return `// ---- ${f} ----\n${src}`;
}).join('\n');

const css = fs.readFileSync(path.join(pub, 'styles.css'), 'utf8');
const html = `<title>Virtual-Italy</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap">
<style>
${css}
</style>
<div id="app"></div>
<script>window.__VI_MODE = 'demo';</script>
<script>
${three}
</script>
<script type="module">
${js}
</script>
`;
const out = path.join(root, 'dist', 'virtual-italy-demo.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`Scritto ${path.relative(root, out)} (${(html.length / 1024).toFixed(1)} KB)`);
