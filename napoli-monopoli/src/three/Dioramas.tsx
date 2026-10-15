import { memo } from 'react';
import { BOARD } from '../engine/board';
import { BOARD_HALF, RING, TRAY_RIM, isCorner, outward, sideRotation, tileCenter } from './layout';
import { Box, Cone, Cyl, G, Person, Sph, Torus, mat } from './prims';

const RIM_Y = 0.55;
const PASTEL = ['#f3c98b', '#e9a3a0', '#f6e3a1', '#d9b38c', '#f2d0c4', '#c9d8a8', '#e8b07a'];

function Laundry({ w = 0.7, y = 0.45 }: { w?: number; y?: number }) {
  const cloths = ['#e0262f', '#f6d22e', '#2a9df4', '#ffffff', '#e85a9c', '#2f9e4f'];
  return (
    <G p={[0, y, 0]}>
      <Box s={[w, 0.006, 0.006]} c="#ddd" shadow={false} />
      {cloths.slice(0, Math.round(w * 7)).map((c, k) => (
        <Box key={k} p={[-w / 2 + 0.07 + k * 0.1, -0.05, 0]} s={[0.07, 0.09, 0.005]} c={c} shadow={false} />
      ))}
    </G>
  );
}

function Windows({ w, h, d, c = '#3b2a20' }: { w: number; h: number; d: number; c?: string }) {
  const rows = Math.max(1, Math.floor(h / 0.12));
  const cols = Math.max(1, Math.floor(w / 0.1));
  const items = [];
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++)
      items.push(
        <Box key={`${r}-${k}`} p={[-w / 2 + (k + 0.5) * (w / cols), 0.08 + r * (h / rows), d / 2 + 0.003]} s={[0.04, 0.06, 0.006]} c={c} shadow={false} />,
      );
  return <>{items}</>;
}

function Building({ p, w, h, d, c, laundry }: { p: [number, number, number]; w: number; h: number; d: number; c: string; laundry?: boolean }) {
  return (
    <G p={p}>
      <Box p={[0, h / 2, 0]} s={[w, h, d]} c={c} />
      <Box p={[0, h + 0.015, 0]} s={[w + 0.03, 0.03, d + 0.03]} c="#9c8c78" />
      <Windows w={w} h={h - 0.05} d={d} />
      {laundry && <G p={[0, 0, d / 2 + 0.04]}><Laundry w={w * 0.9} y={h * 0.6} /></G>}
    </G>
  );
}

function Scooter({ p, r, c = '#2a9df4' }: { p?: [number, number, number]; r?: [number, number, number]; c?: string }) {
  return (
    <G p={p} r={r} s={0.5}>
      <Box p={[0, 0.1, 0]} s={[0.12, 0.08, 0.3]} c={c} />
      <Box p={[0, 0.16, 0.08]} s={[0.1, 0.05, 0.12]} c="#222" />
      <Box p={[0, 0.2, -0.13]} s={[0.12, 0.2, 0.04]} c={c} />
      <Cyl p={[0, 0.05, 0.13]} r={[0, 0, Math.PI / 2]} a={[0.05, 0.05, 0.04]} c="#111" />
      <Cyl p={[0, 0.05, -0.13]} r={[0, 0, Math.PI / 2]} a={[0.05, 0.05, 0.04]} c="#111" />
    </G>
  );
}

function Palm({ p }: { p: [number, number, number] }) {
  return (
    <G p={p}>
      <Cyl p={[0, 0.2, 0]} a={[0.02, 0.03, 0.4, 6]} c="#8a5a2b" />
      {[0, 1, 2, 3, 4].map((k) => (
        <Box key={k} p={[Math.cos(k * 1.26) * 0.08, 0.4, Math.sin(k * 1.26) * 0.08]} r={[Math.sin(k * 1.26) * 0.6, k * 1.26, Math.cos(k * 1.26) * -0.6]} s={[0.04, 0.01, 0.2]} c="#2f9e4f" />
      ))}
    </G>
  );
}

const DIORAMAS: Record<string, () => React.JSX.Element> = {
  vele: () => (
    <>
      {[-0.18, 0.18].map((x, k) => (
        <G key={k} p={[x, 0, 0]}>
          {[0, 1, 2, 3].map((l) => (
            <Box key={l} p={[0, 0.07 + l * 0.12, -l * 0.04]} s={[0.26 - l * 0.04, 0.12, 0.3 - l * 0.08]} c={l % 2 ? '#9aa0a6' : '#b8bcc0'} />
          ))}
        </G>
      ))}
      <G p={[0, 0, 0.18]}><Laundry w={0.6} y={0.3} /></G>
    </>
  ),
  palazzone: () => (
    <>
      <Building p={[-0.15, 0, 0]} w={0.3} h={0.6} d={0.3} c="#d9b38c" laundry />
      <Building p={[0.2, 0, 0.02]} w={0.26} h={0.42} d={0.28} c="#e9a3a0" />
      <Cyl p={[-0.15, 0.68, 0]} a={[0.005, 0.005, 0.14, 4]} c="#666" />
      <Box p={[-0.15, 0.74, 0]} s={[0.1, 0.005, 0.005]} c="#666" />
    </>
  ),
  bancarella: () => (
    <>
      <Box p={[0, 0.12, 0]} s={[0.5, 0.03, 0.26]} c="#8a5a2b" />
      {[-0.22, 0.22].map((x) => (
        <Cyl key={x} p={[x, 0.06, 0]} a={[0.01, 0.01, 0.12, 4]} c="#5b3a1e" />
      ))}
      {[...Array(6)].map((_, k) => (
        <Box key={k} p={[-0.2 + k * 0.08, 0.16, 0]} s={[0.05, 0.04, 0.05]} c={['#f6d22e', '#c0c0c0', '#e0262f', '#111', '#2a9df4', '#e85a9c'][k]} />
      ))}
      <Cyl p={[0, 0.3, 0]} a={[0.01, 0.01, 0.35, 4]} c="#ddd" />
      <Cone p={[0, 0.48, 0]} rad={0.35} h={0.12} c="#e0262f" seg={8} />
      <Person p={[0.12, 0, -0.18]} body="#2f9e4f" />
    </>
  ),
  chiesa: () => (
    <>
      <Box p={[0, 0.18, 0]} s={[0.36, 0.36, 0.42]} c="#f2e6cf" />
      <Cone p={[0, 0.44, 0]} r={[0, Math.PI / 4, 0]} rad={0.28} h={0.18} seg={4} c="#c46b3c" />
      <Box p={[0.26, 0.3, -0.1]} s={[0.12, 0.6, 0.12]} c="#e9dcc0" />
      <Cone p={[0.26, 0.66, -0.1]} r={[0, Math.PI / 4, 0]} rad={0.1} h={0.14} seg={4} c="#c46b3c" />
      <Sph p={[-0.05, 0.42, -0.08]} rad={0.12} c="#7fb7c9" seg={10} />
      <Box p={[0, 0.1, 0.212]} s={[0.1, 0.18, 0.01]} c="#5b3a1e" />
      <Torus p={[0.26, 0.48, -0.03]} a={[0.03, 0.008]} c="#f6d22e" />
    </>
  ),
  vicolo: () => (
    <>
      <Building p={[-0.22, 0, 0]} w={0.22} h={0.7} d={0.4} c="#f3c98b" />
      <Building p={[0.22, 0, 0]} w={0.22} h={0.62} d={0.4} c="#e9a3a0" />
      <G p={[0, 0, 0.1]}><Laundry w={0.24} y={0.5} /></G>
      <G p={[0, 0, -0.08]}><Laundry w={0.24} y={0.36} /></G>
      <Scooter p={[0, 0, 0.12]} r={[0, 0.4, 0]} />
      <Box p={[-0.11, 0.22, 0.12]} s={[0.04, 0.07, 0.03]} c="#f6e3a1" />
      <Sph p={[-0.11, 0.17, 0.14]} rad={0.012} c="#ffcc66" m={mat('#ffcc66', { emissive: '#ffaa33', ei: 2 })} shadow={false} />
    </>
  ),
  pescheria: () => (
    <>
      <Box p={[0, 0.1, 0]} s={[0.55, 0.2, 0.25]} c="#e9e9e9" />
      <Box p={[0, 0.21, 0]} s={[0.55, 0.02, 0.25]} c="#bfe7f7" />
      {[...Array(5)].map((_, k) => (
        <Sph key={k} p={[-0.2 + k * 0.1, 0.24, 0]} rad={0.04} scale={[1.6, 0.5, 0.7]} c="#b8c4cc" m={mat('#b8c4cc', { metal: 0.6, rough: 0.25 })} />
      ))}
      {[...Array(6)].map((_, k) => (
        <Box key={k} p={[-0.23 + k * 0.092, 0.42, 0.06]} r={[-0.5, 0, 0]} s={[0.092, 0.01, 0.3]} c={k % 2 ? '#ffffff' : '#2a9df4'} />
      ))}
      <Person p={[0, 0, -0.22]} body="#ffffff" />
    </>
  ),
  presepe: () => (
    <>
      <Box p={[0, 0.02, 0]} s={[0.6, 0.04, 0.4]} c="#7a5a3a" />
      <Box p={[0, 0.3, -0.14]} r={[0.2, 0, 0]} s={[0.46, 0.03, 0.22]} c="#8a5a2b" />
      {[-0.2, 0.2].map((x) => (
        <Cyl key={x} p={[x, 0.15, -0.1]} a={[0.015, 0.015, 0.28, 5]} c="#5b3a1e" />
      ))}
      <Person p={[-0.1, 0.04, 0]} body="#2a5db0" s={0.7} />
      <Person p={[0.1, 0.04, 0]} body="#8a5a2b" s={0.75} />
      <Box p={[0, 0.07, 0.02]} s={[0.08, 0.03, 0.05]} c="#f6e3a1" />
      <Person p={[0.22, 0.04, 0.12]} body="#e0262f" s={0.6} />
      <Person p={[-0.24, 0.04, 0.12]} body="#7b4bd1" s={0.6} />
      <Sph p={[0, 0.55, -0.1]} rad={0.04} c="#ffe066" m={mat('#ffe066', { emissive: '#ffcc00', ei: 3 })} shadow={false} />
    </>
  ),
  pizzeria: () => (
    <>
      <Building p={[0.12, 0, -0.05]} w={0.36} h={0.4} d={0.3} c="#f6e3a1" />
      <Sph p={[-0.2, 0.05, 0.08]} rad={0.16} scale={[1, 0.85, 1]} c="#c46b3c" />
      <Box p={[-0.2, 0.06, 0.22]} s={[0.1, 0.07, 0.03]} c="#ff6a00" m={mat('#ff6a00', { emissive: '#ff5500', ei: 3 })} shadow={false} />
      <Cyl p={[-0.2, 0.25, 0.08]} a={[0.025, 0.03, 0.15, 6]} c="#8a5a2b" />
      <Box p={[0.12, 0.45, 0.11]} s={[0.3, 0.07, 0.02]} c="#e0262f" m={mat('#ff3b3b', { emissive: '#ff1e1e', ei: 1.6 })} shadow={false} />
      <Person p={[0.05, 0, 0.2]} body="#ffffff" />
    </>
  ),
  piazza: () => (
    <>
      <Box p={[0, 0.01, 0]} s={[0.65, 0.02, 0.5]} c="#c9bfae" />
      <Cyl p={[0, 0.14, 0]} a={[0.05, 0.07, 0.26, 8]} c="#e9e3d4" />
      <Person p={[0, 0.27, 0]} body="#cfd6dc" skin="#cfd6dc" hair="#cfd6dc" s={1.1} />
      <Box p={[0, 0.33, -0.2]} s={[0.6, 0.02, 0.14]} c="#4a6d8c" />
      {[-0.27, 0.27].map((x) => (
        <Cyl key={x} p={[x, 0.16, -0.2]} a={[0.01, 0.01, 0.32, 4]} c="#666" />
      ))}
      <Person p={[0.2, 0, 0.15]} body="#333" />
      <Person p={[0.27, 0, 0.12]} body="#e0262f" s={0.9} />
    </>
  ),
  negozi: () => (
    <>
      {[-0.2, 0, 0.2].map((x, k) => (
        <G key={k} p={[x, 0, 0]}>
          <Box p={[0, 0.2, 0]} s={[0.19, 0.4, 0.3]} c={PASTEL[k + 2]} />
          <Box p={[0, 0.17, 0.16]} r={[-0.5, 0, 0]} s={[0.19, 0.01, 0.1]} c={['#e0262f', '#2f9e4f', '#2a9df4'][k]} />
          <Box p={[0, 0.07, 0.151]} s={[0.12, 0.12, 0.005]} c="#bfe7f7" />
        </G>
      ))}
      <Person p={[0.1, 0, 0.28]} body="#f6d22e" />
    </>
  ),
  villa: () => (
    <>
      <Box p={[-0.12, 0.13, -0.08]} s={[0.36, 0.26, 0.26]} c="#ffffff" />
      <Box p={[-0.12, 0.27, -0.08]} s={[0.4, 0.03, 0.3]} c="#e0d6c2" />
      <Box p={[-0.05, 0.36, -0.12]} s={[0.2, 0.16, 0.18]} c="#fbfbfb" />
      <Box p={[0.15, 0.02, 0.15]} s={[0.3, 0.04, 0.2]} c="#e8e8e8" />
      <Box p={[0.15, 0.043, 0.15]} s={[0.26, 0.005, 0.16]} c="#3ec7f0" m={mat('#3ec7f0', { emissive: '#1aa7d6', ei: 0.6, rough: 0.1 })} shadow={false} />
      <Palm p={[0.3, 0, -0.18]} />
    </>
  ),
  baretto: () => (
    <>
      {[[-0.18, 0], [0.18, 0.05], [0, -0.17]].map(([x, z], k) => (
        <G key={k} p={[x, 0, z]}>
          <Cyl p={[0, 0.08, 0]} a={[0.06, 0.06, 0.012, 10]} c="#fbfbfb" />
          <Cyl p={[0, 0.04, 0]} a={[0.008, 0.008, 0.08, 4]} c="#444" />
          <Cyl p={[0, 0.2, 0]} a={[0.006, 0.006, 0.24, 4]} c="#ddd" />
          <Cone p={[0, 0.32, 0]} rad={0.13} h={0.06} c={['#f6d22e', '#e85a9c', '#2f9e4f'][k]} />
          <Cyl p={[0.02, 0.1, 0]} a={[0.01, 0.006, 0.03, 6]} c="#ff7a00" m={mat('#ff7a00', { opacity: 0.85 })} />
        </G>
      ))}
      <Box p={[0.25, 0.1, -0.2]} s={[0.22, 0.12, 0.1]} c="#111" m={mat('#111', { metal: 0.6, rough: 0.2 })} />
    </>
  ),
  lungomare: () => (
    <>
      <Box p={[0, 0.01, 0]} s={[0.7, 0.02, 0.5]} c="#9c8f7c" />
      <Box p={[0, 0.06, 0.2]} s={[0.7, 0.06, 0.03]} c="#e9e3d4" />
      {[-0.25, 0.25].map((x) => (
        <G key={x} p={[x, 0, 0.12]}>
          <Cyl p={[0, 0.2, 0]} a={[0.008, 0.01, 0.4, 5]} c="#2b2b2b" />
          <Sph p={[0, 0.41, 0]} rad={0.03} c="#fff2b0" m={mat('#fff2b0', { emissive: '#ffd966', ei: 2 })} shadow={false} />
        </G>
      ))}
      {/* Castel dell'Ovo */}
      <G p={[0, 0, -0.12]}>
        <Box p={[0, 0.1, 0]} s={[0.4, 0.2, 0.18]} c="#c8b28c" />
        {[-0.16, -0.08, 0, 0.08, 0.16].map((x) => (
          <Box key={x} p={[x, 0.22, 0.08]} s={[0.04, 0.04, 0.02]} c="#c8b28c" />
        ))}
      </G>
    </>
  ),
  chalet: () => (
    <>
      <Box p={[0, 0.12, 0]} s={[0.32, 0.24, 0.24]} c="#ffffff" />
      <Box p={[0, 0.26, 0]} s={[0.4, 0.03, 0.32]} c="#e85a9c" />
      <G p={[0.25, 0, 0.12]}>
        <Cone p={[0, 0.12, 0]} r={[Math.PI, 0, 0]} rad={0.06} h={0.2} c="#d9a35a" />
        <Sph p={[0, 0.25, 0]} rad={0.065} c="#ffd1e0" />
        <Sph p={[0, 0.33, 0]} rad={0.055} c="#6b3b1e" />
      </G>
      <Person p={[-0.22, 0, 0.18]} body="#2a9df4" />
    </>
  ),
  stadio: () => (
    <>
      <mesh position={[0, 0.08, 0]} scale={[1.25, 1, 1]} material={mat('#1f6fd1')} castShadow>
        <cylinderGeometry args={[0.32, 0.28, 0.16, 16, 1, true]} />
      </mesh>
      <Cyl p={[0, 0.02, 0]} scale={[1.25, 1, 1]} a={[0.27, 0.27, 0.02, 16]} c="#3aa84f" />
      <Box p={[0, 0.035, 0]} s={[0.4, 0.002, 0.004]} c="#ffffff" shadow={false} />
      {[...Array(6)].map((_, k) => (
        <Sph key={k} p={[Math.cos(k) * 0.38, 0.2, Math.sin(k) * 0.3]} rad={0.025} c="#ff3030" m={mat('#ff3030', { emissive: '#ff2200', ei: 3 })} shadow={false} />
      ))}
      <G p={[0, 0.03, 0]}>
        <Person body="#2a9df4" hair="#111" />
        <Sph p={[0, 0.3, 0]} rad={0.07} c="#111" seg={6} />
      </G>
    </>
  ),
  funicolare: () => (
    <>
      <Box p={[0, 0.2, 0]} r={[0, 0, 0.5]} s={[0.75, 0.04, 0.12]} c="#6b6b6b" />
      <G p={[0.05, 0.27, 0]} r={[0, 0, 0.5]}>
        <Box p={[0, 0.08, 0]} s={[0.22, 0.14, 0.12]} c="#e0262f" />
        <Box p={[0, 0.1, 0.061]} s={[0.16, 0.05, 0.004]} c="#bfe7f7" />
      </G>
      <Box p={[0.3, 0.2, -0.05]} s={[0.12, 0.4, 0.2]} c="#f3c98b" />
    </>
  ),
  enel: () => (
    <>
      <Cyl p={[0, 0.3, 0]} a={[0.015, 0.04, 0.6, 4]} c="#8b8b8b" />
      <Box p={[0, 0.52, 0]} s={[0.4, 0.02, 0.02]} c="#8b8b8b" />
      {[-0.4, -0.2, 0, 0.2, 0.4].map((x, k) => (
        <Box key={k} p={[x * 0.5, 0.36 - Math.abs(x) * 0.2, 0.05 + k * 0.01]} r={[0, 0, x]} s={[0.4, 0.006, 0.006]} c="#111" shadow={false} />
      ))}
      <Sph p={[0.18, 0.5, 0.02]} rad={0.03} c="#9fe8ff" m={mat('#9fe8ff', { emissive: '#66ddff', ei: 4 })} shadow={false} />
      <Building p={[-0.22, 0, 0.1]} w={0.2} h={0.3} d={0.2} c="#e9a3a0" />
    </>
  ),
  acqua: () => (
    <>
      <Cyl p={[0, 0.05, 0]} a={[0.25, 0.28, 0.1, 10]} c="#e9e3d4" />
      <Cyl p={[0, 0.101, 0]} a={[0.22, 0.22, 0.004, 10]} c="#5cc8f5" m={mat('#5cc8f5', { emissive: '#2aa8e0', ei: 0.4, rough: 0.1 })} shadow={false} />
      <Cyl p={[0, 0.22, 0]} a={[0.03, 0.04, 0.24, 6]} c="#e9e3d4" />
      <Sph p={[0, 0.38, 0]} rad={0.08} c="#7fdcff" m={mat('#7fdcff', { opacity: 0.6, rough: 0.05 })} shadow={false} />
    </>
  ),
  smorfia: () => (
    <>
      <Box p={[0, 0.25, 0]} r={[0, 0, 0.08]} s={[0.36, 0.48, 0.02]} c="#f6d22e" />
      <Box p={[0, 0.25, 0.012]} r={[0, 0, 0.08]} s={[0.3, 0.42, 0.005]} c="#fff6dc" />
      <Sph p={[0.2, 0.08, 0.1]} rad={0.06} c="#e0262f" />
      <Sph p={[-0.18, 0.06, 0.12]} rad={0.05} c="#2a9df4" />
    </>
  ),
  malocchio: () => (
    <>
      <Sph p={[0, 0.25, 0]} rad={0.2} c="#1d3fa5" seg={14} />
      <Sph p={[0, 0.25, 0.12]} rad={0.13} c="#ffffff" seg={12} />
      <Sph p={[0, 0.25, 0.2]} rad={0.07} c="#6fc8f0" seg={10} />
      <Sph p={[0, 0.25, 0.25]} rad={0.035} c="#111" seg={8} />
    </>
  ),
  pizzo: () => (
    <>
      <Sph p={[0, 0.14, 0]} rad={0.15} scale={[1, 0.9, 1]} c="#c8a165" />
      <Cyl p={[0, 0.28, 0]} a={[0.04, 0.07, 0.06, 8]} c="#c8a165" />
      <Box p={[0, 0.15, 0.15]} s={[0.12, 0.12, 0.004]} c="#2f9e4f" />
      <Person p={[0.25, 0, 0]} body="#111" hair="#111" />
      <Box p={[0.25, 0.29, 0.06]} s={[0.1, 0.02, 0.02]} c="#111" />
    </>
  ),
  parcheggiatore: () => (
    <>
      <G p={[-0.08, 0, 0]}>
        <Box p={[0, 0.08, 0]} s={[0.4, 0.1, 0.2]} c="#c4161c" />
        <Box p={[-0.02, 0.17, 0]} s={[0.22, 0.08, 0.18]} c="#bfe7f7" />
        {[-0.13, 0.13].map((x) => [-0.1, 0.1].map((z) => <Cyl key={`${x}${z}`} p={[x, 0.04, z]} r={[Math.PI / 2, 0, 0]} a={[0.04, 0.04, 0.03, 8]} c="#111" />))}
      </G>
      <Person p={[0.24, 0, 0.12]} body="#f6d22e" />
      <Cyl p={[0.24, 0.33, 0.12]} a={[0.06, 0.07, 0.03, 8]} c="#1d3fa5" />
    </>
  ),
};

function Corners() {
  const d = BOARD_HALF + TRAY_RIM / 2;
  return (
    <>
      {/* VIA: Stazione Centrale */}
      <G p={[d, RIM_Y, d]} r={[0, Math.PI / 4, 0]}>
        <Box p={[0, 0.15, 0]} s={[0.8, 0.3, 0.3]} c="#d9d4c7" />
        <Box p={[0, 0.32, 0]} s={[0.9, 0.04, 0.4]} c="#7a8a99" />
        <Cyl p={[0, 0.45, 0]} r={[Math.PI / 2, 0, 0]} a={[0.09, 0.09, 0.03, 12]} c="#ffffff" />
        <Box p={[0, 0.45, 0.02]} s={[0.01, 0.07, 0.01]} c="#111" />
      </G>
      {/* Poggioreale */}
      <G p={[-d, RIM_Y, d]} r={[0, -Math.PI / 4, 0]}>
        <Box p={[0, 0.15, 0]} s={[0.9, 0.3, 0.1]} c="#b3a998" />
        <Box p={[-0.4, 0.3, 0]} s={[0.15, 0.6, 0.15]} c="#a39a8a" />
        <Cone p={[-0.4, 0.66, 0]} rad={0.12} h={0.14} seg={4} c="#6b6b6b" />
        <Box p={[0, 0.32, 0]} s={[0.9, 0.02, 0.02]} c="#555" />
      </G>
      {/* Caffè sospeso: tazzina gigante */}
      <G p={[-d, RIM_Y, -d]}>
        <Cyl p={[0, 0.03, 0]} a={[0.32, 0.32, 0.03, 16]} c="#ffffff" />
        <mesh position={[0, 0.22, 0]} material={mat('#ffffff', { rough: 0.2, flat: false })} castShadow>
          <cylinderGeometry args={[0.24, 0.17, 0.34, 18, 1, true]} />
        </mesh>
        <Cyl p={[0, 0.06, 0]} a={[0.17, 0.17, 0.02, 18]} c="#ffffff" />
        <Cyl p={[0, 0.36, 0]} a={[0.225, 0.225, 0.01, 18]} c="#5b3416" m={mat('#5b3416', { rough: 0.15 })} />
        <Torus p={[0.25, 0.24, 0]} r={[0, 0, Math.PI / 2]} a={[0.07, 0.02, 6, 12]} c="#ffffff" />
      </G>
      {/* T'hanno pigliato: volante */}
      <G p={[d, RIM_Y, -d]} r={[0, -Math.PI / 4 + Math.PI, 0]}>
        <Box p={[0, 0.1, 0]} s={[0.6, 0.12, 0.28]} c="#1d3fa5" />
        <Box p={[0, 0.06, 0]} s={[0.61, 0.04, 0.29]} c="#ffffff" />
        <Box p={[-0.02, 0.2, 0]} s={[0.3, 0.09, 0.24]} c="#bfe7f7" />
        <Box p={[-0.02, 0.26, 0]} s={[0.12, 0.04, 0.1]} c="#2a6bff" m={mat('#2a6bff', { emissive: '#2244ff', ei: 4 })} />
        {[-0.2, 0.2].map((x) => [-0.14, 0.14].map((z) => <Cyl key={`${x}${z}`} p={[x, 0.05, z]} r={[Math.PI / 2, 0, 0]} a={[0.05, 0.05, 0.04, 8]} c="#111" />))}
      </G>
    </>
  );
}

function SideLaundry({ side }: { side: number }) {
  const d = BOARD_HALF + TRAY_RIM - 0.08;
  const rot = [0, -Math.PI / 2, Math.PI, Math.PI / 2][side];
  const cloths = ['#e0262f', '#ffffff', '#f6d22e', '#2a9df4', '#e85a9c', '#ffffff', '#2f9e4f', '#f39321'];
  return (
    <group rotation={[0, rot, 0]}>
      <G p={[0, RIM_Y + 1.05, d]}>
        <Box s={[10.5, 0.01, 0.01]} c="#eee" shadow={false} />
        {[...Array(26)].map((_, k) => {
          const x = -5 + k * 0.4;
          const h = 0.18 + ((k * 37) % 5) * 0.03;
          return <Box key={k} p={[x, -h / 2 - 0.01 - Math.sin((k / 25) * Math.PI) * 0.05, 0]} s={[0.22, h, 0.008]} c={cloths[(k * 3 + side) % cloths.length]} />;
        })}
      </G>
      {[-5.6, 5.6].map((x) => (
        <Cyl key={x} p={[x, RIM_Y + 0.5, d]} a={[0.03, 0.04, 1.1, 6]} c="#8a5a2b" />
      ))}
    </group>
  );
}

export const Dioramas = memo(function Dioramas() {
  const off = BOARD_HALF + TRAY_RIM / 2 - RING;
  return (
    <group>
      {BOARD.filter((t) => !isCorner(t.index)).map((t) => {
        const [cx, cz] = tileCenter(t.index);
        const [ox, oz] = outward(t.index);
        const kind =
          t.diorama ?? (t.kind === 'tax' ? (t.index === 4 ? 'pizzo' : 'parcheggiatore') : t.kind === 'smorfia' ? 'smorfia' : 'malocchio');
        const Make = DIORAMAS[kind];
        return (
          <group key={t.index} position={[cx + ox * off, RIM_Y, cz + oz * off]} rotation={[0, sideRotation(t.index), 0]} scale={1.15}>
            {Make ? <Make /> : null}
          </group>
        );
      })}
      <Corners />
      {[1, 3].map((s) => (
        <SideLaundry key={s} side={s} />
      ))}
    </group>
  );
});

export { RIM_Y };
