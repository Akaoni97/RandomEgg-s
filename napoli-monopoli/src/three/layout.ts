/** Board geometry: 11×11 ring, corners 1.6, tiles 1.0 × 1.6 */
export const CORNER = 1.6;
export const TILE_W = 1.0;
export const BOARD_HALF = CORNER + (9 * TILE_W) / 2; // 6.1
export const RING = BOARD_HALF - CORNER / 2; // 5.3
export const BOARD_TOP = 0.42;
export const TRAY_RIM = 1.25;

export type Side = 0 | 1 | 2 | 3; // bottom, left, top, right

export function sideOf(i: number): Side {
  if (i <= 10) return 0;
  if (i <= 20) return 1;
  if (i <= 30) return 2;
  return 3;
}

export const isCorner = (i: number) => i % 10 === 0;

/** Tile centre in world XZ */
export function tileCenter(i: number): [number, number] {
  if (i === 0) return [RING, RING];
  if (i === 10) return [-RING, RING];
  if (i === 20) return [-RING, -RING];
  if (i === 30) return [RING, -RING];
  if (i < 10) return [5 - i, RING];
  if (i < 20) return [-RING, 5 - (i - 10)];
  if (i < 30) return [-5 + (i - 20), -RING];
  return [RING, -5 + (i - 30)];
}

/** Unit vector pointing from the tile towards the outside of the board */
export function outward(i: number): [number, number] {
  const s = sideOf(i);
  if (isCorner(i)) {
    const [x, z] = tileCenter(i);
    return [Math.sign(x) * Math.SQRT1_2, Math.sign(z) * Math.SQRT1_2];
  }
  return ([
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 0],
  ] as [number, number][])[s];
}

/** Y rotation so that a model's +Z faces outwards (towards the reader of that side) */
export function sideRotation(i: number): number {
  const [x, z] = outward(i);
  return Math.atan2(x, z);
}

const SLOT = [
  [-0.22, -0.2],
  [0.22, -0.2],
  [-0.22, 0.25],
  [0.22, 0.25],
];

/** Pawn spot on a tile, so that 4 pawns don't overlap */
export function pawnSpot(i: number, slot: number, jailed = false): [number, number, number] {
  const [cx, cz] = tileCenter(i);
  const rot = sideRotation(i);
  let [ox, oz] = SLOT[slot % 4];
  if (isCorner(i)) {
    ox *= 1.4;
    oz *= 1.4;
  }
  if (i === 10) {
    // Poggioreale: prisoners in the cell (inner part), visitors along the edge
    if (jailed) {
      ox = ox * 0.9 + 0.25;
      oz = oz * 0.9 - 0.25;
    } else {
      const edge = [
        [-0.55, 0.62],
        [-0.15, 0.62],
        [-0.62, 0.15],
        [-0.62, -0.3],
      ][slot % 4];
      ox = edge[0];
      oz = edge[1];
    }
    return [cx + ox, BOARD_TOP, cz + oz];
  }
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return [cx + ox * cos + oz * sin, BOARD_TOP, cz - ox * sin + oz * cos];
}

/** Where the colour band / buildings sit (inner part of the tile) */
export function bandCenter(i: number): [number, number] {
  const [cx, cz] = tileCenter(i);
  const [ox, oz] = outward(i);
  return [cx - ox * 0.62, cz - oz * 0.62];
}

/** Which tile is under a world XZ point (null = centre / outside) */
export function tileAt(x: number, z: number): number | null {
  const h = BOARD_HALF;
  if (Math.abs(x) > h || Math.abs(z) > h) return null;
  const inner = h - CORNER;
  if (Math.abs(x) < inner && Math.abs(z) < inner) return null;
  const col = x > inner ? 10 : x < -inner ? 0 : Math.min(9, Math.floor(x + inner) + 1); // 1..9 from left
  const row = z > inner ? 10 : z < -inner ? 0 : Math.min(9, Math.floor(z + inner) + 1);
  if (row === 10) return 10 - col; // bottom: x right→left
  if (col === 0) return 10 + (10 - row); // left: bottom→top
  if (row === 0) return 20 + col; // top: left→right
  if (col === 10) return 30 + row; // right: top→bottom
  return null;
}

