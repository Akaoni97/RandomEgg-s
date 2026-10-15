import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SMORFIA } from '../engine/board';
import { censor } from '../engine/phrases';
import { useStore } from '../store';
import { BOARD_TOP } from './layout';
import { dieFaceTexture } from './textures';

const SIZE = 0.46;
const DURATION = 1.35;

/** box material order: +x, -x, +y, -y, +z, -z */
const FACES = [3, 4, 1, 6, 2, 5];

function faceUp(v: number): THREE.Quaternion {
  const q = new THREE.Quaternion();
  const X = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  switch (v) {
    case 1:
      return q;
    case 6:
      return q.setFromAxisAngle(X, Math.PI);
    case 2:
      return q.setFromAxisAngle(X, -Math.PI / 2);
    case 5:
      return q.setFromAxisAngle(X, Math.PI / 2);
    case 3:
      return q.setFromAxisAngle(Z, Math.PI / 2);
    default:
      return q.setFromAxisAngle(Z, -Math.PI / 2);
  }
}

function rng(seed: number) {
  let s = Math.floor(seed * 2 ** 31) || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

function Die({ index, value, seed, t0, ghost, from }: { index: number; value: number; seed: number; t0: number; ghost?: boolean; from: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null);
  const materials = useMemo(
    () => FACES.map((n) => new THREE.MeshStandardMaterial({ map: dieFaceTexture(n, ghost), roughness: 0.3, metalness: 0 })),
    [ghost],
  );
  const plan = useMemo(() => {
    const r = rng(seed + index * 0.137);
    const rest = new THREE.Vector3(-0.45 + index * 0.75 + (r() - 0.5) * 0.3, BOARD_TOP + SIZE / 2, 0.45 + (r() - 0.5) * 0.5 - index * 0.2);
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
    const final = yaw.multiply(faceUp(value));
    const axis = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    const spins = 5 + r() * 4;
    const start = from.clone().add(new THREE.Vector3((r() - 0.5) * 0.6, 2.2 + r(), (r() - 0.5) * 0.6));
    return { rest, final, axis, spins, start };
  }, [seed, index, value, from]);

  const spin = useMemo(() => new THREE.Quaternion(), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = Math.min(1, (performance.now() - t0) / 1000 / DURATION);
    const e = easeOut(t);
    m.position.lerpVectors(plan.start, plan.rest, e);
    // free fall, then three decaying bounces
    const h = plan.start.y - plan.rest.y;
    m.position.y =
      plan.rest.y +
      (t < 0.25 ? h * (1 - (t / 0.25) ** 2) : Math.abs(Math.sin(((t - 0.25) / 0.75) * Math.PI * 3)) * (1 - t) ** 2 * 1.4);
    spin.setFromAxisAngle(plan.axis, (1 - e) ** 2 * plan.spins * Math.PI * 2);
    m.quaternion.copy(plan.final).multiply(spin);
  });

  return (
    <mesh ref={ref} material={materials} castShadow position={plan.start}>
      <boxGeometry args={[SIZE, SIZE, SIZE]} />
    </mesh>
  );
}

export function Dice() {
  const dice = useStore((s) => s.dice);
  const nonna = useStore((s) => s.settings.nonna);
  const pos = useStore((s) => (s.dice ? s.displayPos[s.dice.player] : 0));
  const from = useMemo(() => {
    // thrown from the roller's side of the table
    const side = Math.floor(((pos ?? 0) % 40) / 10);
    const d = 4;
    return new THREE.Vector3(...([
      [0, 0, d],
      [-d, 0, 0],
      [0, 0, -d],
      [d, 0, 0],
    ][side] as [number, number, number]));
  }, [pos]);
  if (!dice) return null;
  const label = `${dice.smorfia} — ${SMORFIA[dice.smorfia]}`;
  return (
    <group key={dice.t0}>
      {dice.values.map((v, i) => (
        <Die key={i} index={i} value={v} seed={dice.seed} t0={dice.t0} from={from} />
      ))}
      {dice.extra !== undefined && <Die index={2} value={dice.extra} seed={dice.seed} t0={dice.t0} from={from} ghost />}
      <SmorfiaLabel t0={dice.t0} text={censor(label, nonna)} />
    </group>
  );
}

function SmorfiaLabel({ t0, text }: { t0: number; text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const el = ref.current;
    if (!el) return;
    const t = (performance.now() - t0) / 1000;
    const vis = t > DURATION && t < DURATION + 3.2;
    el.style.opacity = vis ? '1' : '0';
    el.style.transform = `scale(${vis ? 1 : 0.6})`;
  });
  return (
    <Html position={[0.1, BOARD_TOP + 1.2, 0.3]} center distanceFactor={10} zIndexRange={[15, 10]} style={{ pointerEvents: 'none' }}>
      <div ref={ref} className="smorfia-tag" style={{ opacity: 0 }}>
        {text}
      </div>
    </Html>
  );
}
