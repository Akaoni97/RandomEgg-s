// Attrezzi di disegno in comune tra la città e gli interni: colori, rumore, forme semplici.

export function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
export function toHex([r, g, b]) {
  const f = (c) => Math.max(0, Math.min(255, Math.round(c)));
  return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
}
export function mix(a, b, t) { const x = rgb(a), y = rgb(b); return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t)); }
export function shade(hex, amt) { return toHex(rgb(hex).map((v) => v + amt * 255)); }
// Numero pseudo-casuale stabile per una casella (o qualunque terna di interi), tra 0 e 1.
export function ih(a, b, s = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = ih(xi, yi, s), b = ih(xi + 1, yi, s), c = ih(xi, yi + 1, s), d = ih(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
export const add = (p, dx, dy) => [p[0] + dx, p[1] + dy];
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export function blob(g, cx, cy, r, color, outline) {
  g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = color; g.fill();
  if (outline) { g.strokeStyle = outline; g.lineWidth = 1; g.stroke(); }
}
export function glow(g, x, y, r, a, color = '255,214,110') {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${color},${a})`); gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
