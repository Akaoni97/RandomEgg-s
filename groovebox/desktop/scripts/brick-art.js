// Draws the Mat.Tone brick (an isometric terracotta brick that is the groovebox) as SVG.
// node scripts/brick-art.js icon > icon.svg   the app icon with its brick wall, rendered to build/icon.png at 1024 px
// node scripts/brick-art.js bare > brick.svg  the brick alone, pasted into the intro of ../mattone.html
const mode = process.argv[2] || "icon";
const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const W = 6, D = 4, H = 1.75, s = 92;
const cx = 512 - (W - D) * C30 * s / 2, cy = 352;
const P = (x, y, z) => [cx + (x - y) * C30 * s, cy + (x + y) * S30 * s - z * s];
const pt = (...a) => a.map(p => P(...p).map(v => v.toFixed(1)).join(",")).join(" ");
const poly = (pts, attrs) => `<polygon points="${pt(...pts)}" ${attrs}/>`;
// affine matrix for drawing in a face's own (u, v) coordinates
const face = (o, u, v) => { const O = P(...o), U = P(o[0] + u[0], o[1] + u[1], o[2] + u[2]), V = P(o[0] + v[0], o[1] + v[1], o[2] + v[2]);
  return `matrix(${(U[0] - O[0]).toFixed(3)} ${(U[1] - O[1]).toFixed(3)} ${(V[0] - O[0]).toFixed(3)} ${(V[1] - O[1]).toFixed(3)} ${O[0].toFixed(1)} ${O[1].toFixed(1)})`; };

let out = [];
const defs = `<style>.bxPad .bxG{display:none}.bxPad .bxL{fill:#24211d}.bxPad .bxS{fill:#1a1815}.bxPad .bxT{fill:url(#gPadOff);stroke:#6a645b}.bxPad.on .bxG{display:inline;fill:#ff9a2e}.bxPad.on .bxL{fill:#b8641c}.bxPad.on .bxS{fill:#8e4a12}.bxPad.on .bxT{fill:url(#gPadOn);stroke:#ffe2a8}</style><defs>
  <linearGradient id="gTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9774a"/><stop offset="1" stop-color="#b8532d"/></linearGradient>
  <linearGradient id="gFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a4472a"/><stop offset="1" stop-color="#7c3019"/></linearGradient>
  <linearGradient id="gSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#83351d"/><stop offset="1" stop-color="#5a2210"/></linearGradient>
  <linearGradient id="gPanel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2622"/><stop offset="1" stop-color="#15130f"/></linearGradient>
  <radialGradient id="gVinyl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#2b2b2b"/><stop offset=".3" stop-color="#0d0d0d"/><stop offset=".55" stop-color="#1c1c1c"/><stop offset=".8" stop-color="#0a0a0a"/><stop offset="1" stop-color="#202020"/></radialGradient>
  <radialGradient id="gHalo" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#ff9a3c" stop-opacity=".55"/><stop offset=".55" stop-color="#ff7a1e" stop-opacity=".12"/><stop offset="1" stop-color="#ff7a1e" stop-opacity="0"/></radialGradient>
  <radialGradient id="gLamp" cx=".5" cy="0" r=".9"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".35"/><stop offset=".6" stop-color="#ffb060" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <radialGradient id="gVig" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
  <linearGradient id="gPadOn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd27a"/><stop offset=".5" stop-color="#ffab3d"/><stop offset="1" stop-color="#f08a1c"/></linearGradient>
  <linearGradient id="gPadOff" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#57514a"/><stop offset="1" stop-color="#3b3732"/></linearGradient>
  <linearGradient id="gFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d1612"/><stop offset="1" stop-color="#080605"/></linearGradient>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 -.18"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  <pattern id="bricks" width="128" height="64" patternUnits="userSpaceOnUse">
    <rect width="128" height="64" fill="#1a1411"/>
    <rect x="3" y="3" width="122" height="26" rx="3" fill="#2e1a14"/><rect x="-61" y="35" width="122" height="26" rx="3" fill="#291914"/><rect x="67" y="35" width="122" height="26" rx="3" fill="#311c15"/>
  </pattern>
  <clipPath id="round"><rect width="1024" height="1024" rx="210"/></clipPath>
</defs>`;

if (mode === "icon") {
  out.push(`<g clip-path="url(#round)">`,
    `<rect width="1024" height="1024" fill="url(#bricks)"/>`,
    `<rect y="640" width="1024" height="384" fill="url(#gFloor)"/>`, `<rect y="638" width="1024" height="4" fill="#000" opacity=".5"/>`, `<rect width="1024" height="1024" fill="url(#gLamp)"/>`,
    `<rect width="1024" height="1024" fill="#000" opacity=".18" filter="url(#grain)"/>`,
    `<rect width="1024" height="1024" fill="url(#gVig)"/>`);
}
// floor glow and shadow
out.push(`<ellipse cx="512" cy="${(P(W, D, 0)[1] + 18).toFixed(0)}" rx="430" ry="120" fill="url(#gHalo)"/>`);
out.push(`<polygon points="${pt([0.2, 0.4, 0], [W + 0.5, 0.3, 0], [W + 0.6, D + 0.6, 0], [0.1, D + 0.5, 0])}" fill="#000" opacity=".6" filter="url(#soft)" transform="translate(0,28)"/>`);

// brick body
out.push(poly([[0, D, H], [W, D, H], [W, D, 0], [0, D, 0]], `fill="url(#gFront)"`));   // front (logo)
out.push(poly([[W, 0, H], [W, D, H], [W, D, 0], [W, 0, 0]], `fill="url(#gSide)"`));    // side (holes)
out.push(poly([[0, 0, H], [W, 0, H], [W, D, H], [0, D, H]], `fill="url(#gTop)"`));     // top
// grain on the clay
for (const f of [[[0, D, H], [W, D, H], [W, D, 0], [0, D, 0]], [[W, 0, H], [W, D, H], [W, D, 0], [W, 0, 0]], [[0, 0, H], [W, 0, H], [W, D, H], [0, D, H]]])
  out.push(poly(f, `fill="#000" opacity=".35" filter="url(#grain)"`));
// edge highlights
out.push(`<polyline points="${pt([0, D, H], [W, D, H], [W, 0, H])}" fill="none" stroke="#f0a070" stroke-width="3" stroke-linejoin="round" opacity=".8"/>`);
out.push(`<polyline points="${pt([W, D, H], [W, D, 0])}" fill="none" stroke="#c96a42" stroke-width="2" opacity=".7"/>`);

// side: the holes of a real brick
const side = face([W, D, H], [0, -1, 0], [0, 0, -1]);   // u: back along the side, v: down
out.push(`<g transform="${side}">`);
for (let k = 0; k < 3; k++) {
  const u = 0.75 + k * 1.25;
  out.push(`<ellipse cx="${u}" cy="${H / 2}" rx=".42" ry=".5" fill="#2a0f06"/>`,
    `<ellipse cx="${u + 0.07}" cy="${H / 2 + 0.05}" rx=".32" ry=".4" fill="#120502"/>`,
    `<path d="M ${u - 0.42} ${H / 2} a .42 .5 0 0 1 .84 0" fill="none" stroke="#a24a2a" stroke-width=".05" opacity=".7"/>`);
}
out.push(`</g>`);

// front: logo and stripes
const front = face([0, D, H], [1, 0, 0], [0, 0, -1]);
out.push(`<g transform="${front}">`,
  `<text x="${W / 2}" y="1.02" text-anchor="middle" font-family="Bungee" font-size=".86" fill="#2a0e05" opacity=".55" transform="translate(.04 .05)">MAT<tspan fill="#2a0e05">.</tspan>TONE</text>`,
  `<text x="${W / 2}" y="1.02" text-anchor="middle" font-family="Bungee" font-size=".86" fill="#f6e3c4">MAT<tspan class="bxDot" fill="#ff9a2e">.</tspan>TONE</text>`);
const stripes = ["#f2a43a", "#e2583e", "#5f8f6a", "#4f7fa8"];
stripes.forEach((c, i) => out.push(`<rect x="${0.62 + i * 1.22}" y="1.27" width="1.08" height=".14" rx=".05" fill="${c}"/>`));
out.push(`</g>`);

// top: dark control panel
const m = 0.26;
out.push(poly([[m, m, H], [W - m, m, H], [W - m, D - m, H], [m, D - m, H]], `fill="url(#gPanel)" stroke="#0b0a08" stroke-width="3"`));
out.push(`<polyline points="${pt([m, D - m, H], [W - m, D - m, H], [W - m, m, H])}" fill="none" stroke="#4a443c" stroke-width="2"/>`);
const top = face([0, 0, H], [1, 0, 0], [0, 1, 0]);
// pads 4 x 3: each pad is a group whose look follows the "on" class (the intro lights them to the beat)
const lit = mode === "icon" ? new Set(["0,0", "2,0", "1,1", "3,1", "0,2", "2,2"]) : new Set();
const pads = [];
for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
  const x = 0.55 + c * 0.86, y = 0.55 + r * 0.98, w = 0.7, h = 0.8, z = H + 0.2;
  pads.push(`<g class="bxPad${lit.has(c + "," + r) ? " on" : ""}">`,
    poly([[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z]], `class="bxG" filter="url(#glow)"`),
    poly([[x, y + h, z], [x + w, y + h, z], [x + w, y + h, H], [x, y + h, H]], `class="bxL"`),
    poly([[x + w, y, z], [x + w, y + h, z], [x + w, y + h, H], [x + w, y, H]], `class="bxS"`),
    poly([[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z]], `class="bxT" stroke-width="1.5"`), `</g>`);
}
out.push(...pads);

// mini turntable (right): platter, record, label, tonearm
const tc = [4.85, 1.45], R = 0.92;
out.push(`<g transform="${top}">`,
  `<circle cx="${tc[0]}" cy="${tc[1]}" r="${R + 0.08}" fill="#0b0a09" stroke="#5a544c" stroke-width=".035"/>`,
  `<g id="spin">`, `<circle cx="${tc[0]}" cy="${tc[1]}" r="${R}" fill="url(#gVinyl)"/>`);
for (let k = 0; k < 6; k++) out.push(`<circle cx="${tc[0]}" cy="${tc[1]}" r="${(0.42 + k * 0.085).toFixed(3)}" fill="none" stroke="#333" stroke-width=".012" opacity=".9"/>`);
out.push(`<path d="M ${tc[0] - 0.8} ${tc[1] - 0.25} A ${R * 0.85} ${R * 0.85} 0 0 1 ${tc[0] - 0.2} ${tc[1] - 0.82}" fill="none" stroke="#9a9a9a" stroke-width=".05" opacity=".35"/>`,
  `<circle cx="${tc[0]}" cy="${tc[1]}" r=".34" fill="#f2a43a"/>`,
  `<text x="${tc[0]}" y="${tc[1] + 0.05}" text-anchor="middle" font-family="Bungee" font-size=".18" fill="#3a1d05">M.T</text>`,
  `<circle cx="${tc[0]}" cy="${tc[1]}" r=".04" fill="#1a1a1a"/>`, `</g>`,
  // tonearm
  `<circle cx="${tc[0] + 0.78}" cy="${tc[1] - 0.72}" r=".17" fill="#8d877d" stroke="#2b2925" stroke-width=".03"/>`,
  `<path d="M ${tc[0] + 0.78} ${tc[1] - 0.72} L ${tc[0] + 0.62} ${tc[1] + 0.35} L ${tc[0] + 0.38} ${tc[1] + 0.52}" fill="none" stroke="#d8d2c4" stroke-width=".07" stroke-linecap="round" stroke-linejoin="round"/>`,
  `<rect x="${tc[0] + 0.24}" y="${tc[1] + 0.44}" width=".2" height=".14" rx=".03" fill="#2b2925" transform="rotate(-30 ${tc[0] + 0.34} ${tc[1] + 0.51})"/>`,
  `</g>`);

// OLED strip with a waveform, and two knobs
out.push(`<g transform="${top}">`,
  `<rect x="4.0" y="2.72" width="1.62" height=".72" rx=".08" fill="#050806" stroke="#3b3731" stroke-width=".03"/>`);
let wave = "";
for (let i = 0; i <= 40; i++) { const x = 4.1 + i * 1.42 / 40, a = Math.sin(i * 0.9) * Math.sin(i * 0.23 + 0.4) * 0.24; wave += (i ? " L " : "M ") + x.toFixed(3) + " " + (3.08 + a).toFixed(3); }
out.push(`<path id="waveG" d="${wave}" fill="none" stroke="#ffb347" stroke-width=".05" filter="url(#glow)" opacity=".8"/>`,
  `<path id="wave" d="${wave}" fill="none" stroke="#ffd58a" stroke-width=".035"/>`, `</g>`);

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${defs}${out.join("")}${mode === "icon" ? "</g>" : ""}</svg>`;
// prefix ids so the art can sit inside the groovebox page without clashing
svg = svg.replace(/id="([a-zA-Z]+)"/g, 'id="bx$1"').replace(/url\(#([a-zA-Z]+)\)/g, "url(#bx$1)");
if (mode === "bare") svg = svg.replace(' viewBox="0 0 1024 1024" width="1024" height="1024"', ' viewBox="70 165 884 715" class="bxArt" aria-hidden="true"').replace(/ {2,}/g, " ").replace(/\n/g, "");
process.stdout.write(svg);
