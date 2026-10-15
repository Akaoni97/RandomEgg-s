import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import * as THREE from 'three';
import { PAWNS } from '../engine/pawns';
import type { PawnId } from '../engine/types';
import { useStore } from '../store';
import { BOARD_TOP, outward, pawnSpot, sideRotation, tileCenter } from './layout';
import { Box, Cone, Cyl, G, Person, Sph, Torus, mat } from './prims';

const SKIN = '#f1c7a0';

function Base({ color }: { color: string }) {
  return (
    <>
      <Cyl p={[0, 0.025, 0]} a={[0.2, 0.22, 0.05, 20]} c={color} m={mat(color, { rough: 0.25, metal: 0.2 })} />
      <Torus p={[0, 0.05, 0]} r={[Math.PI / 2, 0, 0]} a={[0.2, 0.012, 6, 24]} c="#fff6dc" />
    </>
  );
}

/** Ciro Esposito: SH in three, no helmet */
function Ciro() {
  return (
    <G p={[0, 0.05, 0]}>
      <G r={[0, 0, 0]}>
        <Box p={[0, 0.13, 0]} s={[0.16, 0.1, 0.42]} c="#ffffff" m={mat('#ffffff', { rough: 0.2 })} />
        <Box p={[0, 0.2, -0.02]} s={[0.13, 0.05, 0.28]} c="#1b1b1b" />
        <Box p={[0, 0.25, 0.19]} r={[0.25, 0, 0]} s={[0.16, 0.24, 0.05]} c="#2a9df4" />
        <Box p={[0, 0.39, 0.21]} s={[0.26, 0.02, 0.02]} c="#333" />
        <Sph p={[0, 0.33, 0.235]} rad={0.03} c="#fff8c0" m={mat('#fff8c0', { emissive: '#fff2a0', ei: 1.5 })} shadow={false} />
        <Cyl p={[0, 0.07, 0.17]} r={[0, 0, Math.PI / 2]} a={[0.07, 0.07, 0.05, 12]} c="#111" />
        <Cyl p={[0, 0.07, -0.17]} r={[0, 0, Math.PI / 2]} a={[0.07, 0.07, 0.05, 12]} c="#111" />
      </G>
      {/* tre cristiani senza casco */}
      <Person p={[0, 0.17, 0.08]} body="#2a9df4" hair="#111" s={1.05} />
      <Person p={[0, 0.17, -0.03]} body="#e0262f" hair="#5b3a1e" s={0.95} />
      <Person p={[0, 0.17, -0.13]} body="#f6d22e" hair="#111" s={0.85} />
      {/* occhiali da sole del pilota */}
      <Box p={[0, 0.445, 0.14]} s={[0.1, 0.02, 0.01]} c="#111" />
    </G>
  );
}

/** Totò Tredita: bowler hat, waistcoat, three-fingered hand holding a moka */
function Toto() {
  return (
    <G p={[0, 0.05, 0]}>
      <Cyl p={[-0.05, 0.08, 0]} a={[0.035, 0.03, 0.16, 6]} c="#2b2b2b" />
      <Cyl p={[0.05, 0.08, 0]} a={[0.035, 0.03, 0.16, 6]} c="#2b2b2b" />
      <Box p={[-0.05, 0.01, 0.03]} s={[0.06, 0.03, 0.1]} c="#111" />
      <Box p={[0.05, 0.01, 0.03]} s={[0.06, 0.03, 0.1]} c="#111" />
      <mesh position={[0, 0.3, 0]} material={mat('#2b2b2b')} castShadow>
        <capsuleGeometry args={[0.1, 0.14, 4, 8]} />
      </mesh>
      {/* gilet */}
      <Box p={[0, 0.3, 0.075]} s={[0.15, 0.18, 0.04]} c="#f6d22e" />
      <Box p={[0, 0.36, 0.1]} r={[0, 0, Math.PI / 4]} s={[0.04, 0.04, 0.01]} c="#7b4bd1" />
      {[0.27, 0.31, 0.25].map((y, k) => (
        <Sph key={k} p={[0, y, 0.097]} rad={0.008} c="#111" seg={6} shadow={false} />
      ))}
      {/* testa: faccia lunga, naso importante */}
      <Sph p={[0, 0.52, 0]} rad={0.085} scale={[0.9, 1.15, 0.95]} c={SKIN} />
      <Cone p={[0, 0.5, 0.09]} r={[Math.PI / 2, 0, 0]} rad={0.025} h={0.07} c={SKIN} seg={6} />
      <Sph p={[-0.03, 0.55, 0.075]} rad={0.012} c="#111" seg={6} shadow={false} />
      <Sph p={[0.03, 0.55, 0.075]} rad={0.012} c="#111" seg={6} shadow={false} />
      {/* bombetta */}
      <Cyl p={[0, 0.6, 0]} a={[0.12, 0.12, 0.015, 14]} c="#1b1b1b" />
      <Sph p={[0, 0.62, 0]} rad={0.075} scale={[1, 0.85, 1]} c="#1b1b1b" />
      <Cyl p={[0, 0.615, 0]} a={[0.077, 0.077, 0.02, 14]} c="#7b4bd1" />
      {/* braccio destro con mano a tre dita e moka */}
      <G p={[0.12, 0.34, 0.02]} r={[0, 0, -0.5]}>
        <Cyl p={[0, -0.06, 0]} a={[0.022, 0.022, 0.13, 6]} c="#2b2b2b" />
        <Sph p={[0, -0.13, 0]} rad={0.03} c={SKIN} seg={8} />
        {[-0.015, 0, 0.015].map((x) => (
          <Cyl key={x} p={[x, -0.165, 0.01]} a={[0.007, 0.007, 0.04, 4]} c={SKIN} shadow={false} />
        ))}
      </G>
      <G p={[0.2, 0.12, 0.05]}>
        <Cyl p={[0, 0.03, 0]} a={[0.035, 0.04, 0.06, 8]} c="#c0c0c0" m={mat('#c0c0c0', { metal: 0.7, rough: 0.3 })} />
        <Cyl p={[0, 0.085, 0]} a={[0.04, 0.03, 0.05, 8]} c="#c0c0c0" m={mat('#c0c0c0', { metal: 0.7, rough: 0.3 })} />
        <Cone p={[0, 0.12, 0]} rad={0.02} h={0.02} c="#111" seg={8} />
      </G>
      {/* borsello */}
      <Box p={[-0.13, 0.22, 0.02]} s={[0.04, 0.09, 0.08]} c="#6b3a1e" />
      <Box p={[-0.04, 0.33, 0.06]} r={[0, 0, 0.9]} s={[0.22, 0.012, 0.012]} c="#6b3a1e" shadow={false} />
    </G>
  );
}

/** Luigi Gigi: a margherita with legs, chef hat and a little fan */
function Gigi() {
  const fan = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (fan.current) fan.current.rotation.z += dt * 18;
  });
  return (
    <G p={[0, 0.05, 0]}>
      {[-0.06, 0.06].map((x) => (
        <group key={x}>
          <Cyl p={[x, 0.08, 0]} a={[0.018, 0.018, 0.16, 6]} c="#f3d9a8" />
          <Box p={[x, 0.01, 0.025]} s={[0.05, 0.025, 0.08]} c="#e0262f" />
        </group>
      ))}
      <G p={[0, 0.36, 0]} r={[Math.PI / 2 - 0.15, 0, 0]}>
        <Cyl a={[0.21, 0.21, 0.04, 18]} c="#e8b56a" />
        <Torus p={[0, 0.02, 0]} r={[Math.PI / 2, 0, 0]} a={[0.19, 0.03, 6, 18]} c="#d99a48" />
        <Cyl p={[0, 0.022, 0]} a={[0.17, 0.17, 0.01, 18]} c="#d8261f" />
        {[[0.07, 0.04], [-0.08, 0.03], [0.01, -0.09], [-0.03, 0.1], [0.1, -0.05]].map(([x, z], k) => (
          <Sph key={k} p={[x, 0.03, z]} rad={0.035} scale={[1, 0.35, 1]} c="#fffaf0" seg={8} />
        ))}
        {[[0.03, 0.02], [-0.05, -0.06], [0.08, 0.1]].map(([x, z], k) => (
          <Box key={k} p={[x, 0.033, z]} r={[0, k, 0]} s={[0.035, 0.006, 0.02]} c="#2f9e4f" shadow={false} />
        ))}
        {/* faccia */}
        <Sph p={[-0.05, 0.04, -0.03]} rad={0.022} c="#ffffff" seg={8} shadow={false} />
        <Sph p={[0.05, 0.04, -0.03]} rad={0.022} c="#ffffff" seg={8} shadow={false} />
        <Sph p={[-0.05, 0.055, -0.03]} rad={0.011} c="#111" seg={6} shadow={false} />
        <Sph p={[0.05, 0.055, -0.03]} rad={0.011} c="#111" seg={6} shadow={false} />
        <Torus p={[0, 0.04, 0.05]} r={[Math.PI / 2, 0, Math.PI]} a={[0.04, 0.008, 4, 10, Math.PI]} c="#5b1010" />
      </G>
      {/* cappello da pizzaiolo */}
      <Cyl p={[0, 0.6, -0.05]} a={[0.08, 0.075, 0.08, 12]} c="#ffffff" />
      <Sph p={[0, 0.68, -0.05]} rad={0.1} scale={[1, 0.7, 1]} c="#ffffff" />
      {/* ventilatore */}
      <G p={[0.2, 0.3, 0.06]}>
        <Cyl p={[0, -0.05, 0]} a={[0.006, 0.006, 0.12, 4]} c="#555" />
        <group ref={fan} position={[0, 0.02, 0.01]}>
          {[0, 1, 2].map((k) => (
            <Box key={k} r={[0, 0, (k * Math.PI * 2) / 3]} p={[Math.cos((k * Math.PI * 2) / 3) * 0.025, Math.sin((k * Math.PI * 2) / 3) * 0.025, 0]} s={[0.05, 0.02, 0.004]} c="#2a9df4" shadow={false} />
          ))}
        </group>
      </G>
    </G>
  );
}

/** Gennaro San: presepe statuette with mitre, halo and the glowing ampolla */
function Gennaro() {
  const amp = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (amp.current) {
      const m = amp.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 1.5 + Math.sin(clock.elapsedTime * 3) * 1.2;
    }
  });
  const ampMat = useRef(
    new THREE.MeshStandardMaterial({ color: '#ff2a2a', emissive: '#ff0000', emissiveIntensity: 2, roughness: 0.2, transparent: true, opacity: 0.9 }),
  );
  return (
    <G p={[0, 0.05, 0]}>
      <Cyl p={[0, 0.03, 0]} a={[0.13, 0.15, 0.06, 8]} c="#d6a73a" m={mat('#d6a73a', { metal: 0.6, rough: 0.3 })} />
      <Cone p={[0, 0.27, 0]} rad={0.14} h={0.42} c="#b3122e" seg={10} />
      <Cone p={[0, 0.29, 0.02]} rad={0.09} h={0.36} c="#f6e3a1" seg={8} />
      <Box p={[0, 0.3, 0.075]} s={[0.04, 0.3, 0.01]} c="#d6a73a" />
      <Sph p={[0, 0.5, 0]} rad={0.07} c={SKIN} />
      <Cone p={[0, 0.455, 0.04]} r={[Math.PI, 0, 0]} rad={0.055} h={0.08} c="#eeeeee" seg={7} />
      {/* mitra */}
      <Cone p={[0, 0.63, 0]} rad={0.065} h={0.16} c="#fff6dc" seg={4} />
      <Box p={[0, 0.6, 0.038]} s={[0.02, 0.1, 0.004]} c="#d6a73a" />
      {/* aureola */}
      <Torus p={[0, 0.62, -0.06]} a={[0.1, 0.01, 6, 20]} c="#ffd700" m={mat('#ffd700', { emissive: '#ffb800', ei: 1.4, metal: 0.5 })} />
      {/* pastorale */}
      <Cyl p={[-0.14, 0.32, 0]} a={[0.007, 0.007, 0.56, 4]} c="#d6a73a" m={mat('#d6a73a', { metal: 0.6, rough: 0.3 })} />
      <Torus p={[-0.12, 0.61, 0]} r={[0, 0, 0]} a={[0.025, 0.007, 4, 10, Math.PI * 1.4]} c="#d6a73a" />
      {/* ampolla */}
      <G p={[0.13, 0.36, 0.06]}>
        <Cyl p={[0, -0.03, 0]} a={[0.01, 0.01, 0.06, 4]} c="#d6a73a" />
        <mesh ref={amp} material={ampMat.current}>
          <sphereGeometry args={[0.035, 10, 8]} />
        </mesh>
      </G>
    </G>
  );
}

const MODELS: Record<PawnId, () => React.JSX.Element> = { ciro: Ciro, toto: Toto, gigi: Gigi, gennaro: Gennaro };

function Bubble({ player }: { player: number }) {
  const bubble = useStore((s) => s.bubbles.filter((b) => b.player === player).at(-1));
  const floats = useStore(useShallow((s) => s.floats.filter((f) => f.player === player)));
  return (
    <>
      {bubble && (
        <Html position={[0, 1.05, 0]} center distanceFactor={9} zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div key={bubble.id} className="bubble">
            {bubble.text}
          </div>
        </Html>
      )}
      {floats.slice(-3).map((f, k) => (
        <Html key={f.id} position={[0.25 * (k - 1), 0.8, 0]} center distanceFactor={9} zIndexRange={[19, 10]} style={{ pointerEvents: 'none' }}>
          <div className="float-money" style={{ color: f.color }}>
            {f.text}
          </div>
        </Html>
      ))}
    </>
  );
}

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

/** where the Frecciarossa is, t seconds after the bankruptcy */
function trainOffset(t: number) {
  return t < 1 ? (1 - t) ** 2 * -14 : t < 1.6 ? 0 : (t - 1.6) ** 2 * 9;
}

function Train({ tile, t0 }: { tile: number; t0: number }) {
  const ref = useRef<THREE.Group>(null);
  const rot = sideRotation(tile);
  const [ox, oz] = outward(tile);
  const [cx, cz] = tileCenter(tile);
  useFrame(() => {
    if (!ref.current) return;
    const x = trainOffset((performance.now() - t0) / 1000);
    ref.current.position.set(cx + ox * 0.95 + Math.cos(rot) * x, BOARD_TOP + 0.02, cz + oz * 0.95 - Math.sin(rot) * x);
  });
  return (
    <group ref={ref}>
      <group rotation={[0, rot + Math.PI / 2, 0]}>
        {[0, 1, 2].map((k) => (
          <G key={k} p={[0, 0, -k * 0.62]}>
            <Box p={[0, 0.14, 0]} s={[0.26, 0.22, 0.58]} c="#d4141c" m={mat('#d4141c', { rough: 0.25 })} />
            <Box p={[0, 0.2, 0]} s={[0.265, 0.05, 0.5]} c="#222" />
            <Box p={[0, 0.06, 0]} s={[0.262, 0.03, 0.58]} c="#bdbdbd" />
          </G>
        ))}
        <Cone p={[0, 0.14, 0.38]} r={[Math.PI / 2, 0, 0]} rad={0.13} h={0.22} seg={8} c="#d4141c" />
      </group>
    </group>
  );
}

function Pawn({ id, pawn }: { id: number; pawn: PawnId }) {
  const ref = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const color = PAWNS[pawn].color;
  const Model = MODELS[pawn];
  const train = useStore((s) => (s.effects.train?.player === id ? s.effects.train : null));
  const bankrupt = useStore((s) => s.game?.players[id]?.bankrupt ?? false);
  const winner = useStore((s) => s.game?.winner === id);
  const isCurrent = useStore((s) => s.game?.current === id && s.game?.winner === null);

  useFrame(({ clock }, dt) => {
    const g = ref.current;
    const inn = inner.current;
    if (!g || !inn) return;
    const st = useStore.getState();
    const t = performance.now();
    const anim = st.pawnAnim[id];
    let yaw = sideRotation(st.displayPos[id] ?? 0);
    let lift = 0;

    if (winner) {
      g.position.lerp(tmp.set(0, BOARD_TOP + 1.1, 0), 1 - Math.exp(-dt * 3));
      inn.rotation.y += dt * 1.5;
      inn.position.y = Math.abs(Math.sin(clock.elapsedTime * 4)) * 0.2;
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, 2.4, 1 - Math.exp(-dt * 2)));
      return;
    }
    if (train) {
      const tt = (t - train.t0) / 1000;
      const [ox, oz] = outward(train.tile);
      const [cx, cz] = tileCenter(train.tile);
      const rot = sideRotation(train.tile);
      const x = tt < 1.6 ? 0 : trainOffset(tt);
      const target = tmp.set(cx + ox * 0.95 + Math.cos(rot) * x, BOARD_TOP + 0.3, cz + oz * 0.95 - Math.sin(rot) * x);
      if (tt > 1) g.position.lerp(target, tt < 1.6 ? 0.15 : 1);
      inn.rotation.z = Math.sin(tt * 10) * 0.2;
      return;
    }

    if (anim) {
      const el = t - anim.t0;
      const n = anim.path.length - 1;
      const k = Math.min(n - 1, Math.floor(el / anim.stepDur));
      const f = Math.min(1, (el - k * anim.stepDur) / anim.stepDur);
      const a = pawnSpot(anim.path[k], id);
      const b = pawnSpot(anim.path[Math.min(n, k + 1)], id, anim.teleport && st.game?.players[id].inJail);
      tmp.set(...a);
      tmp2.set(...b);
      g.position.lerpVectors(tmp, tmp2, f);
      lift = Math.sin(f * Math.PI) * (anim.teleport ? 2.5 : 0.45);
      if (tmp2.distanceTo(tmp) > 0.01) yaw = Math.atan2(tmp2.x - tmp.x, tmp2.z - tmp.z);
      inn.scale.set(1 + Math.sin(f * Math.PI) * -0.08, 1 + Math.sin(f * Math.PI) * 0.12, 1);
    } else {
      const [x, y, z] = pawnSpot(st.displayPos[id] ?? 0, id, st.displayJail[id]);
      g.position.lerp(tmp.set(x, y, z), 1 - Math.exp(-dt * 10));
      inn.scale.lerp(tmp2.set(1, 1, 1), 0.2);
    }
    g.position.y = BOARD_TOP + lift;

    // mood
    const mood = st.mood[id];
    const happy = mood && mood.until > t && mood.kind === 'happy';
    const sad = mood && mood.until > t && mood.kind === 'sad';
    const idle = Math.sin(clock.elapsedTime * 2 + id) * 0.015;
    inn.position.y = happy ? Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.18 : idle + (isCurrent ? 0.04 : 0);
    inn.rotation.x = THREE.MathUtils.lerp(inn.rotation.x, sad ? 0.45 : 0, 0.15);
    if (happy) inn.rotation.y += dt * 8;
    else inn.rotation.y = THREE.MathUtils.lerp(inn.rotation.y, 0, 0.1);
    const cur = g.rotation.y;
    let d = yaw - cur;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y = cur + d * (1 - Math.exp(-dt * 8));
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, isCurrent ? 1.12 : 1, 0.1));
  });

  if (bankrupt && !train) return null;
  const [sx, sy, sz] = pawnSpot(useStore.getState().displayPos[id] ?? 0, id);
  return (
    <>
      {train && <Train tile={train.tile} t0={train.t0} />}
      <group ref={ref} position={[sx, sy, sz]}>
        <group ref={inner}>
          <Base color={color} />
          <Model />
          {isCurrent && <Torus p={[0, 0.03, 0]} r={[Math.PI / 2, 0, 0]} a={[0.27, 0.02, 6, 28]} c={color} m={mat(color, { emissive: color, ei: 1.2 })} />}
        </group>
        <Bubble player={id} />
        <Aura id={id} />
      </group>
    </>
  );
}

function Aura({ id }: { id: number }) {
  const aura = useStore((s) => (s.effects.aura?.player === id ? s.effects.aura : null));
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current || !aura) return;
    const t = (performance.now() - aura.t0) / 1000;
    ref.current.visible = t < 2.2;
    ref.current.rotation.y = t * 3;
    const s = aura.kind === 'corno' ? Math.min(1, t * 3) * (t > 1.2 ? Math.max(0, 1 - (t - 1.2) * 2) : 1) : 1 + Math.sin(t * 6) * 0.1;
    ref.current.scale.setScalar(Math.max(0.001, s));
    ref.current.position.y = aura.kind === 'miracolo' ? t * 0.3 : 0;
  });
  if (!aura) return null;
  if (aura.kind === 'malocchio')
    return (
      <group ref={ref} position={[0, 0.9, 0]}>
        {[...Array(7)].map((_, k) => (
          <Sph key={k} p={[Math.cos(k) * 0.18, Math.sin(k * 2) * 0.05, Math.sin(k) * 0.18]} rad={0.12} c="#2a2440" m={mat('#2a2440', { opacity: 0.85 })} shadow={false} />
        ))}
        <Sph p={[0, -0.12, 0.2]} rad={0.05} c="#6fc8f0" m={mat('#6fc8f0', { emissive: '#3aa0ff', ei: 2 })} shadow={false} />
      </group>
    );
  if (aura.kind === 'corno')
    return (
      <group ref={ref} position={[0, 0.85, 0]}>
        {[...Array(9)].map((_, k) => (
          <Sph key={k} p={[k * 0.03, Math.sin(k * 0.35) * 0.08 + k * 0.035, 0]} rad={0.07 - k * 0.007} c="#e0102a" m={mat('#e0102a', { rough: 0.15, emissive: '#ff0022', ei: 0.6 })} shadow={false} />
        ))}
        <Cyl p={[-0.02, -0.03, 0]} a={[0.06, 0.06, 0.05, 8]} c="#ffd700" m={mat('#ffd700', { metal: 0.7, rough: 0.2 })} />
      </group>
    );
  return (
    <group ref={ref}>
      <Cyl p={[0, 1, 0]} a={[0.35, 0.35, 2, 16]} c="#ffe066" m={mat('#ffe066', { opacity: 0.25, emissive: '#ffcc33', ei: 2 })} shadow={false} />
      <Torus p={[0, 0.8, 0]} r={[Math.PI / 2, 0, 0]} a={[0.3, 0.02, 6, 24]} c="#ffd700" m={mat('#ffd700', { emissive: '#ffcc00', ei: 3 })} />
    </group>
  );
}

export function Pawns() {
  const players = useStore((s) => s.game?.players.map((p) => p.pawn).join(','));
  const game = useStore.getState().game;
  if (!players || !game) return null;
  return (
    <>
      {game.players.map((p) => (
        <Pawn key={p.id} id={p.id} pawn={p.pawn} />
      ))}
    </>
  );
}

export { Ciro, Toto, Gigi, Gennaro, Base, MODELS };
