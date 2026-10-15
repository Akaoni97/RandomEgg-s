import * as THREE from 'three';
import type { ReactNode } from 'react';

type V3 = [number, number, number];

const mats = new Map<string, THREE.MeshStandardMaterial>();

/** Shared toy-plastic materials, cached by colour/options */
export function mat(color: string, opts: { emissive?: string; ei?: number; rough?: number; metal?: number; opacity?: number; flat?: boolean } = {}) {
  const key = `${color}|${opts.emissive ?? ''}|${opts.ei ?? ''}|${opts.rough ?? ''}|${opts.metal ?? ''}|${opts.opacity ?? ''}|${opts.flat ?? true}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.42,
      metalness: opts.metal ?? 0.02,
      flatShading: opts.flat ?? true,
      emissiveIntensity: opts.ei ?? 1,
      transparent: opts.opacity !== undefined,
      opacity: opts.opacity ?? 1,
    });
    if (opts.emissive) m.emissive.set(opts.emissive);
    mats.set(key, m);
  }
  return m;
}

interface P {
  p?: V3;
  r?: V3;
  c: string;
  m?: THREE.Material;
  shadow?: boolean;
  scale?: V3 | number;
}

export const Box = ({ p, r, s, c, m, shadow = true, scale }: P & { s: V3 }) => (
  <mesh position={p} rotation={r} scale={scale} material={m ?? mat(c)} castShadow={shadow} receiveShadow>
    <boxGeometry args={s} />
  </mesh>
);

export const Cyl = ({ p, r, a, c, m, shadow = true, scale }: P & { a: [number, number, number, number?] }) => (
  <mesh position={p} rotation={r} scale={scale} material={m ?? mat(c)} castShadow={shadow} receiveShadow>
    <cylinderGeometry args={[a[0], a[1], a[2], a[3] ?? 10]} />
  </mesh>
);

export const Sph = ({ p, r, rad, c, m, seg = 10, shadow = true, scale }: P & { rad: number; seg?: number }) => (
  <mesh position={p} rotation={r} scale={scale} material={m ?? mat(c)} castShadow={shadow}>
    <sphereGeometry args={[rad, seg, Math.max(6, Math.round(seg * 0.7))]} />
  </mesh>
);

export const Cone = ({ p, r, rad, h, seg = 8, c, m, shadow = true, scale }: P & { rad: number; h: number; seg?: number }) => (
  <mesh position={p} rotation={r} scale={scale} material={m ?? mat(c)} castShadow={shadow}>
    <coneGeometry args={[rad, h, seg]} />
  </mesh>
);

export const Torus = ({ p, r, a, c, m, shadow = false, scale }: P & { a: [number, number, number?, number?, number?] }) => (
  <mesh position={p} rotation={r} scale={scale} material={m ?? mat(c)} castShadow={shadow}>
    <torusGeometry args={[a[0], a[1], a[2] ?? 6, a[3] ?? 16, a[4] ?? Math.PI * 2]} />
  </mesh>
);

export const G = ({ p, r, s, children }: { p?: V3; r?: V3; s?: number | V3; children: ReactNode }) => (
  <group position={p} rotation={r} scale={s}>
    {children}
  </group>
);

/** Little bean person: body + head + hair */
export function Person({ p, r, body = '#2a9df4', skin = '#f1c7a0', hair = '#2b1d12', s = 1 }: { p?: V3; r?: V3; body?: string; skin?: string; hair?: string; s?: number }) {
  return (
    <G p={p} r={r} s={s}>
      <mesh position={[0, 0.11, 0]} material={mat(body)} castShadow>
        <capsuleGeometry args={[0.06, 0.1, 3, 8]} />
      </mesh>
      <Sph p={[0, 0.26, 0]} rad={0.065} c={skin} seg={10} />
      <Sph p={[0, 0.29, -0.01]} rad={0.062} c={hair} seg={8} scale={[1, 0.6, 1]} />
    </G>
  );
}
