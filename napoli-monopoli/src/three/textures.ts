import * as THREE from 'three';
import { BOARD, GROUP_COLORS } from '../engine/board';
import type { TileDef } from '../engine/types';
import { BOARD_HALF, CORNER, isCorner, sideOf, tileCenter } from './layout';

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function toTexture(c: HTMLCanvasElement, repeat?: number) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  return t;
}

function memo(key: string, make: () => THREE.Texture) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key)!;
}

export const TITLE_FONT = "'Pacifico', 'Brush Script MT', cursive";
export const BODY_FONT = "'Baloo 2', 'Trebuchet MS', 'Arial Rounded MT Bold', sans-serif";

const EMOJI: Record<string, string> = {
  vele: '🏢',
  palazzone: '🏬',
  bancarella: '⌚',
  chiesa: '⛪',
  vicolo: '🛵',
  pescheria: '🐟',
  presepe: '🎎',
  pizzeria: '🍕',
  piazza: '🚉',
  negozi: '🛍️',
  villa: '🏡',
  baretto: '🍹',
  lungomare: '🌊',
  chalet: '🍦',
  stadio: '🏟️',
  funicolare: '🚡',
  enel: '⚡',
  acqua: '🚰',
};

function tileEmoji(t: TileDef) {
  if (t.diorama) return EMOJI[t.diorama] ?? '🏠';
  if (t.kind === 'smorfia') return '🎫';
  if (t.kind === 'malocchio') return '🧿';
  if (t.kind === 'tax') return t.index === 4 ? '💰' : '🅿️';
  return '';
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function fitFont(ctx: CanvasRenderingContext2D, lines: string[], maxW: number, size: number, weight = 800) {
  let s = size;
  for (; s > 10; s--) {
    ctx.font = `${weight} ${s}px ${BODY_FONT}`;
    if (lines.every((l) => ctx.measureText(l).width <= maxW)) break;
  }
  return s;
}

const PX = 2048 / (BOARD_HALF * 2);

function drawTile(ctx: CanvasRenderingContext2D, t: TileDef) {
  const w = (isCorner(t.index) ? CORNER : 1) * PX;
  const d = 1.6 * PX;
  const pad = 8;
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2b1d12';
  ctx.strokeRect(-w / 2, -d / 2, w, d);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (t.kind === 'property' && t.group) {
    const band = 0.34 * PX;
    ctx.fillStyle = GROUP_COLORS[t.group];
    ctx.fillRect(-w / 2, -d / 2, w, band);
    ctx.strokeRect(-w / 2, -d / 2, w, band);
    // gloss
    const g = ctx.createLinearGradient(0, -d / 2, 0, -d / 2 + band);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -d / 2, w, band / 2);
  }

  const top = t.kind === 'property' ? -d / 2 + 0.34 * PX + 6 : -d / 2 + 10;
  ctx.fillStyle = '#2b1d12';
  ctx.font = `800 26px ${BODY_FONT}`;
  const lines = wrapText(ctx, t.short.toUpperCase(), w - pad * 2);
  const size = fitFont(ctx, lines, w - pad * 2, 26);
  ctx.font = `800 ${size}px ${BODY_FONT}`;
  lines.forEach((l, k) => ctx.fillText(l, 0, top + size * 0.62 + k * size * 0.98));

  ctx.font = `64px serif`;
  ctx.fillText(tileEmoji(t), 0, d * 0.08);

  if (t.price) {
    ctx.font = `700 24px ${BODY_FONT}`;
    ctx.fillStyle = '#7a1414';
    ctx.fillText(`${t.price} ₵`, 0, d / 2 - 22);
  }
  if (t.tax) {
    ctx.font = `700 24px ${BODY_FONT}`;
    ctx.fillStyle = '#7a1414';
    ctx.fillText(`Paga ${t.tax} ₵`, 0, d / 2 - 22);
  }
  if (t.kind === 'smorfia' || t.kind === 'malocchio') {
    ctx.font = `italic 600 18px ${BODY_FONT}`;
    ctx.fillStyle = t.kind === 'smorfia' ? '#8a5a00' : '#5b2a86';
    ctx.fillText(t.kind === 'smorfia' ? 'pesca un biglietto' : 'pesca e trema', 0, d / 2 - 24);
  }
  ctx.restore();
}

function drawCorner(ctx: CanvasRenderingContext2D, t: TileDef) {
  const w = CORNER * PX;
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2b1d12';
  ctx.strokeRect(-w / 2, -w / 2, w, w);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (t.kind === 'jail') {
    ctx.restore();
    return;
  }
  const rot = { 0: -Math.PI / 4, 20: (3 * Math.PI) / 4, 30: (-3 * Math.PI) / 4 }[t.index] ?? 0;
  ctx.rotate(rot);
  ctx.fillStyle = '#2b1d12';
  if (t.kind === 'via') {
    ctx.font = `900 70px ${BODY_FONT}`;
    ctx.fillStyle = '#c4161c';
    ctx.fillText('VIA', 0, -10);
    ctx.font = `700 19px ${BODY_FONT}`;
    ctx.fillStyle = '#2b1d12';
    ctx.fillText('Stazione Centrale', 0, -70);
    ctx.fillText('ritira 200 ₵', 0, 46);
    ctx.font = `60px serif`;
    ctx.fillText('⬅️', 0, 96);
  } else if (t.kind === 'caffe') {
    ctx.font = `800 26px ${BODY_FONT}`;
    ctx.fillText('IL CAFFÈ', 0, -84);
    ctx.fillText('SOSPESO', 0, -56);
    ctx.font = `90px serif`;
    ctx.fillText('☕', 0, 14);
    ctx.font = `600 17px ${BODY_FONT}`;
    ctx.fillText('prendi tutto il piatto', 0, 82);
  } else if (t.kind === 'gotojail') {
    ctx.font = `800 24px ${BODY_FONT}`;
    ctx.fillText("T'HANNO", 0, -84);
    ctx.fillText('PIGLIATO!', 0, -58);
    ctx.font = `90px serif`;
    ctx.fillText('🚔', 0, 14);
    ctx.font = `600 17px ${BODY_FONT}`;
    ctx.fillText('dritto a Poggioreale', 0, 82);
  }
  ctx.restore();
}

function drawJail(ctx: CanvasRenderingContext2D) {
  const [cx, cz] = tileCenter(10);
  const x = (cx + BOARD_HALF) * PX;
  const y = (cz + BOARD_HALF) * PX;
  const w = CORNER * PX;
  ctx.save();
  ctx.translate(x, y);
  // cell: inner square (top-right of the corner)
  const cell = w * 0.62;
  ctx.fillStyle = '#ff8a1f';
  ctx.fillRect(w / 2 - cell, -w / 2, cell, cell);
  ctx.strokeStyle = '#2b1d12';
  ctx.lineWidth = 3;
  ctx.strokeRect(w / 2 - cell, -w / 2, cell, cell);
  ctx.fillStyle = '#2b1d12';
  for (let k = 1; k < 6; k++) ctx.fillRect(w / 2 - cell + (k * cell) / 6 - 3, -w / 2, 6, cell);
  ctx.save();
  ctx.translate(w / 2 - cell / 2, -w / 2 + cell / 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-cell * 0.62, -18, cell * 1.24, 36);
  ctx.fillStyle = '#2b1d12';
  ctx.font = `800 20px ${BODY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('POGGIOREALE', 0, 1);
  ctx.restore();
  ctx.font = `800 20px ${BODY_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2b1d12';
  ctx.fillText('IN VISITA', -w / 2 + (w - cell) / 2 + 30, w / 2 - 18);
  ctx.save();
  ctx.translate(-w / 2 + 18, 0);
  ctx.rotate(Math.PI / 2);
  ctx.fillText('… PER ORA', 0, 0);
  ctx.restore();
  ctx.strokeRect(-w / 2, -w / 2, w, w);
  ctx.restore();
}

function drawCenter(ctx: CanvasRenderingContext2D) {
  const c = 1024;
  const inner = (BOARD_HALF - CORNER) * PX;
  // gulf
  const g = ctx.createRadialGradient(c, c + 120, 50, c, c, inner);
  g.addColorStop(0, '#7fd3f7');
  g.addColorStop(0.65, '#2a9df4');
  g.addColorStop(1, '#0d5aa7');
  ctx.fillStyle = g;
  ctx.fillRect(c - inner, c - inner, inner * 2, inner * 2);
  // waves
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 4;
  for (let row = 0; row < 14; row++) {
    const y = c - inner + 60 + row * 110;
    ctx.beginPath();
    for (let x = c - inner + 20; x < c + inner - 20; x += 10) {
      const yy = y + Math.sin((x + row * 37) / 28) * 7;
      if (x === c - inner + 20) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // smorfia number ring
  ctx.save();
  ctx.translate(c, c);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let n = 1; n <= 90; n++) {
    const a = (n / 90) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.rotate(a + Math.PI / 2);
    ctx.font = `700 22px ${BODY_FONT}`;
    ctx.fillStyle = n % 2 ? 'rgba(255,240,180,0.9)' : 'rgba(255,255,255,0.75)';
    ctx.fillText(String(n), 0, -inner + 44);
    ctx.restore();
  }
  ctx.restore();

  // title on a cream banner, tilted like the classic board
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = '#c4161c';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 14;
  ctx.fillRect(-560, -120, 1120, 240);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#f6d22e';
  ctx.lineWidth = 10;
  ctx.strokeRect(-545, -105, 1090, 210);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff6dc';
  ctx.font = `150px ${TITLE_FONT}`;
  ctx.fillText('Napolì', 0, -18);
  ctx.font = `700 40px ${BODY_FONT}`;
  ctx.fillStyle = '#f6d22e';
  ctx.fillText("IL MONOPOLI CHE TE FA' 'O PACCO", 0, 78);
  ctx.restore();

  // deck spots
  const spot = (x: number, y: number, label: string, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);
    ctx.setLineDash([16, 10]);
    ctx.lineWidth = 6;
    ctx.strokeStyle = color;
    ctx.strokeRect(-130, -85, 260, 170);
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = `800 30px ${BODY_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, 130);
    ctx.restore();
  };
  spot(c - 330, c - 330, "'A SMORFIA", '#f6d22e');
  spot(c + 330, c + 330, 'MALOCCHIO', '#d7b5ff');
}

export function boardTexture(): THREE.Texture {
  return memo('board', () => {
    const [cv, ctx] = canvas(2048);
    ctx.fillStyle = '#f4ead2';
    ctx.fillRect(0, 0, 2048, 2048);
    // paper grain
    for (let k = 0; k < 9000; k++) {
      ctx.fillStyle = `rgba(120,90,40,${Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * 2048, Math.random() * 2048, 2, 2);
    }
    drawCenter(ctx);
    for (const t of BOARD) {
      const [x, z] = tileCenter(t.index);
      ctx.save();
      ctx.translate((x + BOARD_HALF) * PX, (z + BOARD_HALF) * PX);
      if (isCorner(t.index)) drawCorner(ctx, t);
      else {
        ctx.rotate([0, Math.PI / 2, Math.PI, -Math.PI / 2][sideOf(t.index)]);
        drawTile(ctx, t);
      }
      ctx.restore();
    }
    drawJail(ctx);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#2b1d12';
    ctx.strokeRect(3, 3, 2042, 2042);
    const inner = (BOARD_HALF - CORNER) * PX;
    ctx.strokeRect(1024 - inner, 1024 - inner, inner * 2, inner * 2);
    return toTexture(cv);
  });
}

/** call after webfonts load to redraw the board with the right fonts */
export function refreshBoardTexture() {
  const old = cache.get('board');
  cache.delete('board');
  const fresh = boardTexture();
  if (old) {
    (old as THREE.CanvasTexture).image = fresh.image;
    old.needsUpdate = true;
    cache.set('board', old);
  }
}

export function checkerTexture(): THREE.Texture {
  return memo('checker', () => {
    const [cv, ctx] = canvas(256);
    const n = 8;
    const s = 256 / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#f8f3ea' : '#d42a2a';
        ctx.fillRect(x * s, y * s, s, s);
      }
    // weave lines
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#fff';
    for (let k = 0; k < 256; k += 4) ctx.fillRect(0, k, 256, 1);
    ctx.globalAlpha = 1;
    return toTexture(cv, 6);
  });
}

export function maiolicaTexture(): THREE.Texture {
  return memo('maiolica', () => {
    const [cv, ctx] = canvas(256);
    ctx.fillStyle = '#fbf6e8';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#1f6fbf';
    ctx.beginPath();
    ctx.arc(128, 128, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6d22e';
    for (let k = 0; k < 8; k++) {
      ctx.save();
      ctx.translate(128, 128);
      ctx.rotate((k * Math.PI) / 4);
      ctx.beginPath();
      ctx.ellipse(0, -46, 16, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#2f9e4f';
    for (const [x, y] of [
      [0, 0],
      [256, 0],
      [0, 256],
      [256, 256],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 50, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e8792b';
    ctx.beginPath();
    ctx.arc(128, 128, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c8bfa8';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 256, 256);
    return toTexture(cv, 16);
  });
}

export function woodTexture(): THREE.Texture {
  return memo('wood', () => {
    const [cv, ctx] = canvas(512, 128);
    ctx.fillStyle = '#9a5b2e';
    ctx.fillRect(0, 0, 512, 128);
    for (let k = 0; k < 60; k++) {
      ctx.strokeStyle = `rgba(${60 + Math.random() * 40},${30 + Math.random() * 20},10,${0.15 + Math.random() * 0.2})`;
      ctx.lineWidth = 1 + Math.random() * 3;
      ctx.beginPath();
      const y = Math.random() * 128;
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + Math.sin(x / 50 + k) * 4);
      ctx.stroke();
    }
    const t = toTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.27, 0.27],
    [0.73, 0.73],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.27, 0.22],
    [0.73, 0.22],
    [0.27, 0.5],
    [0.73, 0.5],
    [0.27, 0.78],
    [0.73, 0.78],
  ],
};

export function dieFaceTexture(n: number, ghost = false): THREE.Texture {
  return memo(`die${n}${ghost}`, () => {
    const [cv, ctx] = canvas(128);
    ctx.fillStyle = ghost ? '#bdb6a8' : '#fffaf0';
    ctx.fillRect(0, 0, 128, 128);
    for (const [x, y] of PIPS[n]) {
      ctx.fillStyle = n === 1 || n === 4 ? '#c4161c' : '#1b1b1b';
      ctx.beginPath();
      ctx.arc(x * 128, y * 128, n === 1 ? 17 : 12, 0, Math.PI * 2);
      ctx.fill();
    }
    return toTexture(cv);
  });
}

export function labelTexture(key: string, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 256, h = 256) {
  return memo(`label-${key}`, () => {
    const [cv, ctx] = canvas(w, h);
    draw(ctx, w, h);
    return toTexture(cv);
  });
}

export function deckTexture(kind: 'smorfia' | 'malocchio') {
  return labelTexture(kind, (ctx, w, h) => {
    const smorfia = kind === 'smorfia';
    ctx.fillStyle = smorfia ? '#f6d22e' : '#5b2a86';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = smorfia ? '#c4161c' : '#e8d7ff';
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `90px serif`;
    ctx.fillText(smorfia ? '🎫' : '🧿', w / 2, h / 2 - 30);
    ctx.font = `800 34px ${BODY_FONT}`;
    ctx.fillStyle = smorfia ? '#7a1414' : '#fff';
    ctx.fillText(smorfia ? "'A SMORFIA" : 'MALOCCHIO', w / 2, h - 60);
  }, 256, 180);
}

export function cigarettesTexture() {
  return labelTexture('cig', (ctx, w, h) => {
    ctx.fillStyle = '#fbfbfb';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c4161c';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h * 0.35);
    ctx.lineTo(w / 2, h * 0.55);
    ctx.lineTo(0, h * 0.35);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.font = `800 30px ${BODY_FONT}`;
    ctx.fillText('BIONDE', w / 2, h * 0.72);
    ctx.font = `600 20px ${BODY_FONT}`;
    ctx.fillText('di contrabbando', w / 2, h * 0.84);
    ctx.font = `600 13px ${BODY_FONT}`;
    ctx.fillText('IL FUMO FA MALE, MA NONNA FUMAVA', w / 2, h * 0.95);
  });
}
