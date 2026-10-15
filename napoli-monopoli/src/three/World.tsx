import { useFrame } from '@react-three/fiber';
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useStore } from '../store';
import { Box, Cone, Cyl, G, Sph, Torus, mat } from './prims';
import { checkerTexture, cigarettesTexture, maiolicaTexture } from './textures';

const TABLE = 11;
const FLOOR_Y = -7;
const SEA_Y = -40;
export const VESUVIO_POS: [number, number, number] = [55, SEA_Y, -170];

function Table() {
  const cloth = useMemo(() => checkerTexture(), []);
  return (
    <group>
      <mesh position={[0, -0.25, 0]} receiveShadow castShadow>
        <boxGeometry args={[TABLE * 2, 0.5, TABLE * 2]} />
        <meshStandardMaterial map={cloth} roughness={0.85} />
      </mesh>
      {/* tablecloth drop */}
      {[0, 1, 2, 3].map((k) => (
        <group key={k} rotation={[0, (k * Math.PI) / 2, 0]}>
          <mesh position={[0, -1.1, TABLE + 0.02]} receiveShadow>
            <planeGeometry args={[TABLE * 2 + 0.04, 1.8]} />
            <meshStandardMaterial map={cloth} roughness={0.85} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([x, z]) => (
        <Cyl key={`${x}${z}`} p={[x * (TABLE - 1.2), (FLOOR_Y - 0.5) / 2, z * (TABLE - 1.2)]} a={[0.45, 0.35, -FLOOR_Y - 0.5, 8]} c="#6b3a1e" />
      ))}
    </group>
  );
}

function Moka({ p }: { p: [number, number, number] }) {
  const steam = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    steam.current?.children.forEach((c, k) => {
      const t = (clock.elapsedTime * 0.5 + k / 6) % 1;
      c.position.set(Math.sin(t * 6 + k) * 0.15, 2.4 + t * 2, 0.5 + Math.cos(t * 5) * 0.1);
      c.scale.setScalar(0.15 + t * 0.4);
      ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.35 * (1 - t);
    });
  });
  const alu = mat('#c9ccd1', { metal: 0.75, rough: 0.28 });
  return (
    <G p={p} s={1.2}>
      <Cyl p={[0, 0.45, 0]} a={[0.55, 0.7, 0.9, 8]} c="#ccc" m={alu} />
      <Cyl p={[0, 0.95, 0]} a={[0.45, 0.5, 0.12, 8]} c="#ccc" m={alu} />
      <Cyl p={[0, 1.5, 0]} a={[0.6, 0.48, 1.0, 8]} c="#ccc" m={alu} />
      <Cone p={[0, 2.15, 0]} rad={0.6} h={0.3} seg={8} c="#ccc" m={alu} />
      <Sph p={[0, 2.35, 0]} rad={0.12} c="#111" seg={8} />
      <Box p={[0, 1.95, 0.58]} r={[-0.5, 0, 0]} s={[0.2, 0.06, 0.4]} c="#ccc" m={alu} />
      <Box p={[0, 1.5, -0.85]} s={[0.15, 0.9, 0.3]} c="#1b1b1b" />
      <Box p={[0, 1.05, -0.65]} s={[0.15, 0.12, 0.3]} c="#1b1b1b" />
      <Box p={[0, 1.95, -0.65]} s={[0.15, 0.12, 0.3]} c="#1b1b1b" />
      <group ref={steam}>
        {[...Array(6)].map((_, k) => (
          <mesh key={k}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </G>
  );
}

function Corno({ p, r }: { p: [number, number, number]; r?: [number, number, number] }) {
  const red = mat('#d10f26', { rough: 0.12, emissive: '#5a0010', ei: 0.4, flat: false });
  return (
    <G p={p} r={r}>
      {[...Array(14)].map((_, k) => {
        const t = k / 13;
        const ang = t * 1.6;
        return <Sph key={k} p={[Math.sin(ang) * 1.6, 0.6 + t * 0.2, 1.6 - Math.cos(ang) * 1.6]} rad={0.55 * (1 - t) + 0.05} c="#d10f26" m={red} seg={14} />;
      })}
      <Cyl p={[0, 0.6, -0.15]} r={[Math.PI / 2, 0, 0]} a={[0.58, 0.58, 0.4, 12]} c="#d6a73a" m={mat('#d6a73a', { metal: 0.8, rough: 0.2 })} />
      <Torus p={[0, 0.6, -0.42]} a={[0.25, 0.07, 6, 14]} c="#d6a73a" m={mat('#d6a73a', { metal: 0.8, rough: 0.2 })} />
    </G>
  );
}

function Cigarettes({ p, r }: { p: [number, number, number]; r?: [number, number, number] }) {
  const tex = useMemo(() => cigarettesTexture(), []);
  return (
    <G p={p} r={r}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[1.6, 0.6, 2.4]} />
        <meshStandardMaterial color="#fafafa" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.601, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.58, 2.38]} />
        <meshStandardMaterial map={tex} roughness={0.5} />
      </mesh>
      {[-0.3, 0, 0.3].map((x, k) => (
        <G key={k} p={[x + 0.2, 0.25 + k * 0.02, 1.6 + k * 0.15]} r={[0, 0.2 * k, 0]}>
          <Cyl r={[Math.PI / 2, 0, 0]} a={[0.08, 0.08, 1.0, 8]} c="#ffffff" />
          <Cyl p={[0, 0, -0.38]} r={[Math.PI / 2, 0, 0]} a={[0.082, 0.082, 0.25, 8]} c="#d9883a" />
        </G>
      ))}
    </G>
  );
}

function Espresso({ p }: { p: [number, number, number] }) {
  return (
    <G p={p}>
      <Cyl p={[0, 0.03, 0]} a={[0.7, 0.7, 0.06, 18]} c="#ffffff" />
      <mesh position={[0, 0.4, 0]} castShadow material={mat('#ffffff', { rough: 0.2, flat: false })}>
        <cylinderGeometry args={[0.45, 0.32, 0.7, 18]} />
      </mesh>
      <Cyl p={[0, 0.72, 0]} a={[0.42, 0.42, 0.02, 18]} c="#4a2a10" m={mat('#4a2a10', { rough: 0.1 })} />
      <Torus p={[0.5, 0.4, 0]} r={[0, 0, Math.PI / 2]} a={[0.16, 0.05, 6, 12]} c="#ffffff" />
    </G>
  );
}

function LemonTree({ p }: { p: [number, number, number] }) {
  return (
    <G p={p}>
      <Cyl p={[0, 1.2, 0]} a={[1.6, 1.2, 2.4, 10]} c="#b5532d" />
      <Cyl p={[0, 3.4, 0]} a={[0.2, 0.3, 2.4, 6]} c="#6b3a1e" />
      <Sph p={[0, 5.6, 0]} rad={2.6} c="#2f8a3f" seg={7} />
      {[...Array(12)].map((_, k) => (
        <Sph key={k} p={[Math.cos(k * 2.4) * 2.3, 5.2 + Math.sin(k * 1.3) * 1.5, Math.sin(k * 2.4) * 2.3]} rad={0.32} scale={[1, 1.3, 1]} c="#f6e32e" seg={6} />
      ))}
    </G>
  );
}

function Terrace() {
  const tiles = useMemo(() => maiolicaTexture(), []);
  const balusters = useMemo(() => {
    const out: [number, number][] = [];
    for (let x = -34; x <= 34; x += 1.6) out.push([x, -30]);
    for (let z = -30; z <= 26; z += 1.6) {
      out.push([-34, z]);
      out.push([34, z]);
    }
    return out;
  }, []);
  const balMesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = balMesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    balusters.forEach(([x, z], k) => {
      o.position.set(x, FLOOR_Y + 1.6, z);
      o.updateMatrix();
      m.setMatrixAt(k, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [balusters]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, -2]} receiveShadow>
        <planeGeometry args={[70, 58]} />
        <meshStandardMaterial map={tiles} roughness={0.35} />
      </mesh>
      <mesh position={[0, FLOOR_Y - 6, -2]}>
        <boxGeometry args={[70.5, 12, 58.5]} />
        <meshStandardMaterial color="#e9d9b8" roughness={0.9} />
      </mesh>
      <instancedMesh ref={balMesh} args={[undefined, undefined, balusters.length]} material={mat('#f5efe2')} castShadow>
        <cylinderGeometry args={[0.28, 0.4, 3.2, 6]} />
      </instancedMesh>
      <Box p={[0, FLOOR_Y + 3.3, -30]} s={[69, 0.4, 1.2]} c="#f5efe2" />
      <Box p={[-34, FLOOR_Y + 3.3, -2]} s={[1.2, 0.4, 57]} c="#f5efe2" />
      <Box p={[34, FLOOR_Y + 3.3, -2]} s={[1.2, 0.4, 57]} c="#f5efe2" />
      <LemonTree p={[-28, FLOOR_Y, -24]} />
      <LemonTree p={[28, FLOOR_Y, -24]} />
      <LemonTree p={[-28, FLOOR_Y, 20]} />
    </group>
  );
}

function Sea() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(900, 700, 70, 55);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo]);
  useFrame(({ clock }) => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      pos.setY(i, Math.sin(x * 0.05 + t * 0.9) * 0.9 + Math.cos(z * 0.07 + t * 0.7) * 0.7);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });
  return (
    <mesh geometry={geo} position={[0, SEA_Y, -250]} receiveShadow>
      <meshStandardMaterial color="#1f6fb8" roughness={0.18} metalness={0.15} flatShading />
    </mesh>
  );
}

function rockyCone(radius: number, height: number, seg: number, seed: number, crater = 0) {
  const g = new THREE.CylinderGeometry(crater, radius, height, seg, 4);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  const low = new THREE.Color('#5d7a3a');
  const mid = new THREE.Color('#7a5a3e');
  const top = new THREE.Color('#4a4038');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const n = Math.sin(i * 12.9898 + seed) * 43758.5453;
    const j = (n - Math.floor(n) - 0.5) * radius * 0.12;
    if (Math.abs(y) < height / 2 - 0.01) {
      pos.setX(i, pos.getX(i) + j);
      pos.setZ(i, pos.getZ(i) + j * 0.7);
    }
    const h = (y + height / 2) / height;
    const c = h < 0.35 ? low.clone().lerp(mid, h / 0.35) : mid.clone().lerp(top, (h - 0.35) / 0.65);
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function Vesuvio() {
  const main = useMemo(() => rockyCone(70, 62, 11, 1, 12), []);
  const somma = useMemo(() => rockyCone(55, 44, 9, 7, 14), []);
  const smoke = useRef<THREE.Group>(null);
  const lava = useRef<THREE.PointLight>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const lapilli = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const st = useStore.getState();
    const heat = (st.game?.vesuvio ?? 0) / 100;
    const erupt = st.effects.lapilli ? (performance.now() - st.effects.lapilli) / 1000 : 99;
    const erupting = erupt < 5;
    const t = clock.elapsedTime;
    smoke.current?.children.forEach((c, k) => {
      const f = (t * (erupting ? 0.5 : 0.08) + k / 14) % 1;
      c.position.set(Math.sin(k * 3.1 + f * 2) * (6 + f * 30), 64 + f * (erupting ? 120 : 60), Math.cos(k * 1.7) * 6 + f * 10);
      c.scale.setScalar(5 + f * (erupting ? 28 : 16) + heat * 6);
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.opacity = (erupting ? 0.85 : 0.5) * (1 - f);
      m.color.set(erupting ? '#3b3330' : '#d9d4cf');
    });
    if (lava.current) lava.current.intensity = erupting ? 9000 + Math.random() * 6000 : heat * 3000;
    if (glow.current) glow.current.emissiveIntensity = erupting ? 6 : heat * 2.5;
    if (lapilli.current) {
      lapilli.current.visible = erupting;
      lapilli.current.children.forEach((c, k) => {
        const f = ((erupt * 0.9 + k / 30) % 1.2) / 1.2;
        c.position.set(Math.sin(k * 7.3) * 40 * f, 66 + Math.sin(f * Math.PI) * 90, Math.cos(k * 4.1) * 30 * f + f * 30);
      });
    }
  });
  return (
    <group position={VESUVIO_POS}>
      <mesh geometry={main} position={[0, 31, 0]} castShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.95} />
      </mesh>
      <mesh geometry={somma} position={[-60, 22, 20]}>
        <meshStandardMaterial vertexColors flatShading roughness={0.95} />
      </mesh>
      <mesh position={[0, 62.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[11.5, 11]} />
        <meshStandardMaterial ref={glow} color="#3a1a10" emissive="#ff4a00" emissiveIntensity={0} />
      </mesh>
      <pointLight ref={lava} position={[0, 72, 10]} color="#ff5a1f" distance={400} decay={1.6} intensity={0} />
      <group ref={smoke}>
        {[...Array(14)].map((_, k) => (
          <mesh key={k}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#d9d4cf" transparent opacity={0.5} depthWrite={false} flatShading />
          </mesh>
        ))}
      </group>
      <group ref={lapilli} visible={false}>
        {[...Array(30)].map((_, k) => (
          <mesh key={k}>
            <icosahedronGeometry args={[2.2, 0]} />
            <meshStandardMaterial color="#ff6a1a" emissive="#ff3a00" emissiveIntensity={4} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Capri() {
  const g = useMemo(() => rockyCone(40, 26, 8, 3, 6), []);
  return (
    <group position={[-170, SEA_Y, -230]} scale={[1.6, 1, 0.8]}>
      <mesh geometry={g} position={[0, 13, 0]}>
        <meshStandardMaterial vertexColors flatShading roughness={0.95} />
      </mesh>
      <mesh geometry={g} position={[45, 9, 5]} scale={[0.7, 0.7, 0.7]}>
        <meshStandardMaterial vertexColors flatShading roughness={0.95} />
      </mesh>
    </group>
  );
}

function Boats() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.children.forEach((b, k) => {
      b.position.x = ((t * (3 + k) + k * 160) % 500) - 250;
      b.position.y = SEA_Y + 0.8 + Math.sin(t * 1.5 + k) * 0.5;
      b.rotation.z = Math.sin(t * 1.2 + k) * 0.05;
    });
  });
  return (
    <group ref={ref}>
      {[-90, -140, -60].map((z, k) => (
        <G key={k} p={[0, SEA_Y, z]} s={3}>
          <Box p={[0, 0.4, 0]} s={[4, 0.8, 1.4]} c={['#ffffff', '#2a9df4', '#e0262f'][k]} />
          <Box p={[0.3, 1.1, 0]} s={[2, 0.7, 1.1]} c="#ffffff" />
          <Box p={[0.3, 1.2, 0]} s={[2.05, 0.2, 1.15]} c="#1f4fb5" />
        </G>
      ))}
    </group>
  );
}

export const World = memo(function World() {
  return (
    <group>
      <Table />
      <Moka p={[8.6, 0, 7.6]} />
      <Espresso p={[6.6, 0, 9.2]} />
      <Corno p={[-9.2, 0, 7.4]} r={[0, 0.8, 0]} />
      <Cigarettes p={[9.0, 0, -7.6]} r={[0, -0.5, 0]} />
      <Terrace />
      <Sea />
      <Vesuvio />
      <Capri />
      <Boats />
    </group>
  );
});
