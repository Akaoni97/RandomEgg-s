import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { VESUVIO_SIDE } from '../engine/board';
import { useStore } from '../store';
import { BOARD_TOP, bandCenter, sideRotation, tileCenter } from './layout';
import { Box, Cyl, G, Person, Sph, mat } from './prims';

const PALETTE = ['#ff3b3b', '#ffd23f', '#3ec7f0', '#7dff7a', '#ff6ad5', '#ffffff', '#2a9df4'];

/** Fireworks: bursts of additive points above the board */
function Fireworks() {
  const COUNT = 6;
  const PER = 90;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * PER * 3), 3));
    const col = new Float32Array(COUNT * PER * 3);
    for (let b = 0; b < COUNT; b++) {
      const c = new THREE.Color(PALETTE[b % PALETTE.length]);
      for (let k = 0; k < PER; k++) col.set([c.r, c.g, c.b], (b * PER + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  const dirs = useMemo(
    () =>
      [...Array(COUNT * PER)].map(() => {
        const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        return v.multiplyScalar(2 + Math.random() * 1.5);
      }),
    [],
  );
  const centers = useMemo(
    () => [...Array(COUNT)].map(() => new THREE.Vector3((Math.random() - 0.5) * 12, 5 + Math.random() * 4, (Math.random() - 0.5) * 10)),
    [],
  );
  const ref = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  useFrame(() => {
    const st = useStore.getState();
    const won = st.game?.winner !== null && st.game?.winner !== undefined;
    const t0 = st.effects.fireworks;
    const el = (performance.now() - t0) / 1000;
    const active = t0 > 0 && (el < 4.5 || won);
    if (!ref.current || !matRef.current) return;
    ref.current.visible = active;
    if (!active) return;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let b = 0; b < COUNT; b++) {
      const local = (el + b * 0.37) % 1.6;
      if (local < 0.05) centers[b].set((Math.random() - 0.5) * 12, 5 + Math.random() * 4, (Math.random() - 0.5) * 10);
      for (let k = 0; k < PER; k++) {
        const d = dirs[b * PER + k];
        const i = b * PER + k;
        pos.setXYZ(i, centers[b].x + d.x * local, centers[b].y + d.y * local - local * local * 1.5, centers[b].z + d.z * local);
      }
    }
    pos.needsUpdate = true;
    matRef.current.opacity = 1;
  });
  return (
    <points ref={ref} geometry={geo} visible={false}>
      <pointsMaterial ref={matRef} size={0.22} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  );
}

/** lapilli falling on the side of the board that faces the volcano */
function BoardLapilli() {
  const ref = useRef<THREE.Group>(null);
  const targets = useMemo(() => [...Array(36)].map((_, k) => tileCenter(VESUVIO_SIDE[k % VESUVIO_SIDE.length])), []);
  useFrame(() => {
    const t0 = useStore.getState().effects.lapilli;
    const el = (performance.now() - t0) / 1000;
    const g = ref.current;
    if (!g) return;
    g.visible = t0 > 0 && el > 0.8 && el < 4.5;
    if (!g.visible) return;
    g.children.forEach((c, k) => {
      const f = ((el - 0.8) * 0.9 + (k % 9) / 9) % 1;
      const [x, z] = targets[k];
      c.position.set(x + Math.sin(k) * 0.4, BOARD_TOP + 9 * (1 - f), z + Math.cos(k * 1.7) * 0.5 - (1 - f) * 6);
      c.scale.setScalar(f > 0.95 ? 2.2 : 1);
    });
  });
  return (
    <group ref={ref} visible={false}>
      {targets.map((_, k) => (
        <mesh key={k} material={mat('#ff6a1a', { emissive: '#ff3a00', ei: 4 })}>
          <icosahedronGeometry args={[0.09, 0]} />
        </mesh>
      ))}
    </group>
  );
}

/** the town hall bulldozer demolishing an illegal building */
function Ruspa() {
  const ruspa = useStore((s) => s.effects.ruspa);
  const ref = useRef<THREE.Group>(null);
  const dust = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ruspa || !ref.current) return;
    const t = (performance.now() - ruspa.t0) / 1000;
    const [bx, bz] = bandCenter(ruspa.tile);
    const rot = sideRotation(ruspa.tile);
    const lat: [number, number] = [Math.cos(rot), -Math.sin(rot)];
    const x = t < 1.4 ? (1 - t / 1.4) * 3 : t < 2 ? Math.sin(t * 30) * 0.05 : (t - 2) * -3;
    ref.current.position.set(bx + lat[0] * (x + 0.4), BOARD_TOP, bz + lat[1] * (x + 0.4));
    ref.current.rotation.y = rot - Math.PI / 2;
    if (dust.current) {
      dust.current.visible = t > 1.2 && t < 3;
      dust.current.position.set(bx, BOARD_TOP, bz);
      dust.current.children.forEach((c, k) => {
        const f = Math.min(1, (t - 1.2) / 1.5);
        c.position.set(Math.cos(k * 1.3) * f * 0.6, 0.1 + f * 0.5 + (k % 3) * 0.1, Math.sin(k * 1.3) * f * 0.6);
        c.scale.setScalar(0.15 + f * 0.25);
      });
    }
  });
  if (!ruspa) return null;
  return (
    <>
      <group ref={ref} scale={0.9}>
        <Box p={[0, 0.14, 0]} s={[0.5, 0.16, 0.32]} c="#f6b81b" />
        <Box p={[-0.08, 0.32, 0]} s={[0.22, 0.2, 0.28]} c="#f6b81b" />
        <Box p={[-0.08, 0.34, 0]} s={[0.18, 0.12, 0.29]} c="#bfe7f7" />
        <Box p={[0.34, 0.12, 0]} r={[0, 0, 0.3]} s={[0.06, 0.24, 0.42]} c="#8a8a8a" />
        {[-0.15, 0.15].map((z) => (
          <Box key={z} p={[0, 0.05, z]} s={[0.52, 0.1, 0.07]} c="#222" />
        ))}
        <Cyl p={[-0.1, 0.48, 0]} a={[0.03, 0.03, 0.04, 8]} c="#ff8a00" m={mat('#ff8a00', { emissive: '#ff6a00', ei: 3 })} />
      </group>
      <group ref={dust} visible={false}>
        {[...Array(10)].map((_, k) => (
          <Sph key={k} rad={1} c="#c9b99a" m={mat('#c9b99a', { opacity: 0.6 })} shadow={false} seg={6} />
        ))}
      </group>
    </>
  );
}

/** 'O Pacco: the wrapped box floating over the board while a pacco trade is pending */
function PaccoBox() {
  const pending = useStore((s) => s.game?.pending?.kind === 'trade' && s.game.trade?.pacco);
  const reveal = useStore((s) => s.effects.paccoReveal);
  const ref = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.8;
    ref.current.position.y = BOARD_TOP + 1.2 + Math.sin(clock.elapsedTime * 2) * 0.12;
    if (lid.current) {
      const t = reveal ? (performance.now() - reveal.t0) / 1000 : 0;
      lid.current.position.y = 0.52 + Math.min(3, t * 3);
      lid.current.rotation.x = Math.min(2, t * 4);
    }
  });
  if (!pending && !reveal) return null;
  return (
    <group ref={ref} position={[0, BOARD_TOP + 1.2, 0]}>
      <Box p={[0, 0.25, 0]} s={[0.9, 0.5, 0.9]} c="#e0262f" />
      <Box p={[0, 0.25, 0]} s={[0.92, 0.51, 0.16]} c="#f6d22e" />
      <Box p={[0, 0.25, 0]} s={[0.16, 0.51, 0.92]} c="#f6d22e" />
      <group ref={lid} position={[0, 0.52, 0]}>
        <Box s={[0.98, 0.1, 0.98]} c="#e0262f" />
        <Sph p={[-0.12, 0.12, 0]} rad={0.13} scale={[1.3, 0.7, 0.6]} c="#f6d22e" />
        <Sph p={[0.12, 0.12, 0]} rad={0.13} scale={[1.3, 0.7, 0.6]} c="#f6d22e" />
      </group>
      {reveal &&
        (reveal.brick ? (
          <Box p={[0, 0.6, 0]} s={[0.6, 0.22, 0.3]} c="#b5532d" />
        ) : (
          <Sph p={[0, 0.7, 0]} rad={0.25} c="#ffd700" m={mat('#ffd700', { emissive: '#ffb800', ei: 2, metal: 0.6 })} />
        ))}
    </group>
  );
}

/** Scudetto + podium in the centre at the end of the game */
function Scudetto() {
  const winner = useStore((s) => s.game?.winner);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 1.2;
      ref.current.position.y = BOARD_TOP + 3.6 + Math.sin(clock.elapsedTime * 2) * 0.15;
    }
  });
  if (winner === null || winner === undefined) return null;
  return (
    <>
      <G p={[0, BOARD_TOP, 0]}>
        <Cyl p={[0, 0.4, 0]} a={[1.1, 1.25, 0.8, 16]} c="#ffffff" />
        <Cyl p={[0, 0.82, 0]} a={[1.15, 1.15, 0.06, 16]} c="#ffd700" m={mat('#ffd700', { metal: 0.7, rough: 0.25 })} />
        <Cyl p={[0, 0.4, 0]} a={[1.26, 1.26, 0.18, 16]} c="#2a9df4" />
      </G>
      <group ref={ref}>
        {['#2f9e4f', '#ffffff', '#e0262f'].map((c, k) => (
          <Box key={k} p={[(k - 1) * 0.3, 0, 0]} s={[0.3, 0.8, 0.08]} c={c} m={mat(c, { emissive: c, ei: 0.25 })} />
        ))}
        <mesh position={[0, -0.55, 0]} rotation={[0, 0, Math.PI]} material={mat('#e0262f')}>
          <coneGeometry args={[0.45, 0.3, 3]} />
        </mesh>
        <Box p={[0, 0.44, 0]} s={[0.95, 0.08, 0.1]} c="#ffd700" m={mat('#ffd700', { metal: 0.7, rough: 0.2 })} />
      </group>
    </>
  );
}

/** the auctioneer banging his gavel while an auction is running */
function Banditore() {
  const active = useStore((s) => s.game?.pending?.kind === 'auction');
  const arm = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (arm.current) arm.current.rotation.x = -0.4 - Math.abs(Math.sin(clock.elapsedTime * 5)) * 1.1;
  });
  if (!active) return null;
  return (
    <G p={[0, BOARD_TOP, -1.3]} s={2.6}>
      <Box p={[0, 0.06, 0.12]} s={[0.36, 0.12, 0.14]} c="#6b3a1e" />
      <Person body="#1b1b1b" hair="#8a8a8a" />
      <Box p={[0, 0.2, 0.062]} s={[0.03, 0.08, 0.004]} c="#e0262f" />
      <group ref={arm} position={[0.07, 0.17, 0]}>
        <Cyl p={[0, 0, 0.07]} r={[Math.PI / 2, 0, 0]} a={[0.008, 0.008, 0.14, 4]} c="#8a5a2b" />
        <Box p={[0, 0, 0.15]} s={[0.07, 0.035, 0.035]} c="#5b3a1e" />
      </group>
    </G>
  );
}

export function Effects() {
  return (
    <>
      <Fireworks />
      <BoardLapilli />
      <Ruspa />
      <PaccoBox />
      <Scudetto />
      <Banditore />
    </>
  );
}

