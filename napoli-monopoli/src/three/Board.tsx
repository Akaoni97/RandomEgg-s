import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { memo, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { BOARD } from '../engine/board';
import { PAWNS } from '../engine/pawns';
import type { TileState } from '../engine/types';
import { useStore } from '../store';
import { Dioramas, RIM_Y } from './Dioramas';
import { BOARD_HALF, BOARD_TOP, CORNER, TRAY_RIM, bandCenter, isCorner, outward, sideRotation, tileAt, tileCenter } from './layout';
import { Box, Cyl, G, Torus, mat } from './prims';
import { boardTexture, deckTexture, woodTexture } from './textures';

function Tray() {
  const wood = useMemo(() => {
    const t = woodTexture().clone();
    t.repeat.set(3, 1);
    t.needsUpdate = true;
    return t;
  }, []);
  const woodMat = useMemo(() => new THREE.MeshStandardMaterial({ map: wood, color: '#c98a4e', roughness: 0.55 }), [wood]);
  const outer = BOARD_HALF + TRAY_RIM;
  const rim = (k: number) => {
    const long = outer * 2;
    const pos: [number, number, number][] = [
      [0, RIM_Y / 2, BOARD_HALF + TRAY_RIM / 2],
      [0, RIM_Y / 2, -(BOARD_HALF + TRAY_RIM / 2)],
      [BOARD_HALF + TRAY_RIM / 2, RIM_Y / 2, 0],
      [-(BOARD_HALF + TRAY_RIM / 2), RIM_Y / 2, 0],
    ];
    const size: [number, number, number] = k < 2 ? [long, RIM_Y, TRAY_RIM] : [TRAY_RIM, RIM_Y, BOARD_HALF * 2];
    return (
      <mesh key={k} position={pos[k]} material={woodMat} castShadow receiveShadow>
        <boxGeometry args={size} />
      </mesh>
    );
  };
  return (
    <group>
      <mesh position={[0, 0.1, 0]} material={woodMat} receiveShadow castShadow>
        <boxGeometry args={[outer * 2, 0.2, outer * 2]} />
      </mesh>
      {[0, 1, 2, 3].map(rim)}
    </group>
  );
}

function BoardTop() {
  const tex = useMemo(() => boardTexture(), []);
  const selectTile = useStore((s) => s.selectTile);
  const [hover, setHover] = useState<number | null>(null);
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const t = tileAt(e.point.x, e.point.z);
    if (t !== hover) setHover(t);
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    const t = tileAt(e.point.x, e.point.z);
    if (t !== null) {
      e.stopPropagation();
      selectTile(t);
    }
  };
  return (
    <group>
      <mesh position={[0, BOARD_TOP - 0.11, 0]} receiveShadow material={mat('#efe3c6')}>
        <boxGeometry args={[BOARD_HALF * 2, 0.2, BOARD_HALF * 2]} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, BOARD_TOP, 0]}
        receiveShadow
        onPointerMove={onMove}
        onPointerOut={() => setHover(null)}
        onClick={onClick}
      >
        <planeGeometry args={[BOARD_HALF * 2, BOARD_HALF * 2]} />
        <meshStandardMaterial map={tex} roughness={0.55} metalness={0} />
      </mesh>
      {hover !== null && <TileHighlight tile={hover} />}
    </group>
  );
}

function TileHighlight({ tile, color = '#fff27a' }: { tile: number; color?: string }) {
  const [x, z] = tileCenter(tile);
  const w = isCorner(tile) ? CORNER : 1;
  return (
    <group position={[x, BOARD_TOP + 0.012, z]} rotation={[0, sideRotation(tile), 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={mat(color, { opacity: 0.28, emissive: color, ei: 0.6 })}>
        <planeGeometry args={[w - 0.04, 1.56]} />
      </mesh>
    </group>
  );
}

function Basso({ p, r, abusivo, k }: { p: [number, number, number]; r: number; abusivo: boolean; k: number }) {
  const wall = abusivo ? '#a8a29a' : ['#f3c98b', '#f6e3a1', '#e9a3a0', '#f2d0c4'][k % 4];
  return (
    <G p={p} r={[0, r, 0]}>
      <Box p={[0, 0.1, 0]} s={[0.19, 0.2, 0.17]} c={wall} />
      <Box p={[0, 0.215, 0]} s={[0.21, 0.03, 0.19]} c={abusivo ? '#8a857d' : '#c46b3c'} />
      {/* tenda + porta */}
      <Box p={[0, 0.065, 0.086]} s={[0.07, 0.11, 0.004]} c="#5b3a1e" shadow={false} />
      <Box p={[0, 0.14, 0.11]} r={[-0.6, 0, 0]} s={[0.12, 0.004, 0.06]} c={['#e0262f', '#2a9df4', '#2f9e4f', '#f39321'][k % 4]} />
      {/* sedia di plastica */}
      <G p={[0.07, 0, 0.14]}>
        <Box p={[0, 0.035, 0]} s={[0.04, 0.005, 0.04]} c="#ffffff" />
        <Box p={[0, 0.055, -0.02]} s={[0.04, 0.04, 0.005]} c="#ffffff" />
        <Box p={[0, 0.017, 0]} s={[0.035, 0.034, 0.035]} c="#ffffff" m={mat('#ffffff', { opacity: 0.4 })} />
      </G>
      {abusivo && (
        <>
          {[-0.07, 0, 0.07].map((x) => (
            <Cyl key={x} p={[x, 0.27, 0]} a={[0.005, 0.005, 0.1, 4]} c="#6b3a1e" shadow={false} />
          ))}
        </>
      )}
    </G>
  );
}

function Palazzo({ p, r, abusivo }: { p: [number, number, number]; r: number; abusivo: boolean }) {
  const floors = 4;
  const wall = abusivo ? '#b1aba2' : '#f3c98b';
  return (
    <G p={p} r={[0, r, 0]}>
      {[...Array(floors)].map((_, f) => (
        <group key={f}>
          <Box p={[0, 0.07 + f * 0.13, 0]} s={[0.62, 0.12, 0.26]} c={f === floors - 1 && abusivo ? '#9a958c' : wall} />
          <Box p={[0, 0.135 + f * 0.13, 0]} s={[0.66, 0.012, 0.29]} c="#8d877f" />
          {[...Array(5)].map((__, k) => (
            <Box key={k} p={[-0.24 + k * 0.12, 0.07 + f * 0.13, 0.132]} s={[0.05, 0.06, 0.004]} c={abusivo && f === floors - 1 ? '#555' : '#3b2a20'} shadow={false} />
          ))}
        </group>
      ))}
      {abusivo ? (
        [-0.28, -0.14, 0, 0.14, 0.28].map((x) => <Cyl key={x} p={[x, 0.6, 0.1]} a={[0.006, 0.006, 0.16, 4]} c="#6b3a1e" shadow={false} />)
      ) : (
        <Box p={[0, 0.56, 0]} s={[0.66, 0.04, 0.29]} c="#c46b3c" />
      )}
      {abusivo && <Box p={[0.2, 0.62, -0.05]} s={[0.12, 0.08, 0.1]} c="#1d6fd1" />}
    </G>
  );
}

function TileExtras({ i, t }: { i: number; t: TileState }) {
  const players = useStore((s) => s.game?.players);
  if (t.owner === null || !players) return null;
  const def = BOARD[i];
  const [bx, bz] = bandCenter(i);
  const [ox, oz] = outward(i);
  const [cx, cz] = tileCenter(i);
  const rot = sideRotation(i);
  const color = PAWNS[players[t.owner].pawn].color;
  const flagPos: [number, number, number] = [cx + ox * 0.62 + Math.cos(rot) * 0.36, BOARD_TOP, cz + oz * 0.62 - Math.sin(rot) * 0.36];
  const items = [];
  // owner chip / flag
  items.push(
    <G key="flag" p={flagPos} r={[0, rot, t.mortgaged ? 0.6 : 0]}>
      <Cyl p={[0, 0.02, 0]} a={[0.07, 0.07, 0.04, 10]} c={t.mortgaged ? '#888' : color} />
      <Cyl p={[0, 0.17, 0]} a={[0.008, 0.008, 0.28, 4]} c="#ddd" />
      <Box p={[0.06, 0.27, 0]} s={[0.12, 0.08, 0.005]} c={t.mortgaged ? '#aaa' : color} />
    </G>,
  );
  if (def.kind === 'property' && t.houses > 0) {
    if (t.houses === 5) {
      items.push(<Palazzo key="p" p={[bx, BOARD_TOP, bz]} r={rot} abusivo={t.abusivo} />);
    } else {
      for (let k = 0; k < t.houses; k++) {
        const off = -0.33 + k * 0.22;
        items.push(
          <Basso key={k} k={k + i} p={[bx + Math.cos(rot) * off, BOARD_TOP, bz - Math.sin(rot) * off]} r={rot} abusivo={t.abusivo} />,
        );
      }
    }
  }
  return <>{items}</>;
}

function Buildings() {
  const tiles = useStore((s) => s.game?.tiles);
  if (!tiles) return null;
  return (
    <>
      {tiles.map((t, i) => (
        <TileExtras key={i} i={i} t={t} />
      ))}
    </>
  );
}

function Decks() {
  const sm = useMemo(() => deckTexture('smorfia'), []);
  const ma = useMemo(() => deckTexture('malocchio'), []);
  const deck = (tex: THREE.Texture, pos: [number, number, number], side: string) => (
    <group position={pos} rotation={[0, Math.PI / 4, 0]}>
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow material={mat(side)}>
        <boxGeometry args={[1.5, 0.24, 1.0]} />
      </mesh>
      <mesh position={[0, 0.241, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.48, 0.98]} />
        <meshStandardMaterial map={tex} roughness={0.5} />
      </mesh>
    </group>
  );
  return (
    <>
      {deck(sm, [-1.97, BOARD_TOP, -1.97], '#fff6dc')}
      {deck(ma, [1.97, BOARD_TOP, 1.97], '#e8d7ff')}
    </>
  );
}

function PotCups() {
  const pot = useStore((s) => s.game?.pot ?? 0);
  const n = Math.min(14, Math.ceil(pot / 50));
  return (
    <group position={[-3.4, BOARD_TOP, -3.4]}>
      {[...Array(n)].map((_, k) => {
        const stack = Math.floor(k / 5);
        const level = k % 5;
        const [sx, sz] = [
          [0, 0],
          [0.42, 0.05],
          [0.1, 0.42],
        ][stack];
        return (
          <group key={k} position={[sx, level * 0.17, sz]} rotation={[0, k * 0.7, 0]}>
            <Cyl p={[0, 0.01, 0]} a={[0.17, 0.17, 0.02, 12]} c="#ffffff" />
            <mesh position={[0, 0.08, 0]} material={mat('#ffffff', { rough: 0.2, flat: false })} castShadow>
              <cylinderGeometry args={[0.12, 0.09, 0.13, 14]} />
            </mesh>
            <Torus p={[0.13, 0.08, 0]} r={[0, 0, Math.PI / 2]} a={[0.035, 0.012, 5, 10]} c="#ffffff" />
          </group>
        );
      })}
    </group>
  );
}

function SelectedHighlight() {
  const sel = useStore((s) => s.selectedTile);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = Math.sin(clock.elapsedTime * 4) * 0.004;
  });
  if (sel === null) return null;
  return (
    <group ref={ref}>
      <TileHighlight tile={sel} color="#ff5fa2" />
    </group>
  );
}

export const Board = memo(function Board() {
  return (
    <group>
      <Tray />
      <BoardTop />
      <Dioramas />
      <Buildings />
      <Decks />
      <PotCups />
      <SelectedHighlight />
    </group>
  );
});
