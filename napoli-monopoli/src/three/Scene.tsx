import { OrbitControls, Sky } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { Suspense, useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore } from '../store';
import { Board } from './Board';
import { Dice } from './Dice';
import { Effects } from './Effects';
import { Pawns } from './Pawns';
import { refreshBoardTexture } from './textures';
import { World } from './World';

const SUN: [number, number, number] = [-60, 22, -90];

function Lights({ shadows }: { shadows: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.shadow.camera.left = -14;
    l.shadow.camera.right = 14;
    l.shadow.camera.top = 14;
    l.shadow.camera.bottom = -14;
    l.shadow.camera.near = 1;
    l.shadow.camera.far = 140;
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.02;
    l.shadow.camera.updateProjectionMatrix();
  }, []);
  return (
    <>
      <hemisphereLight args={['#ffe2c2', '#5a4a6a', 0.9]} />
      <ambientLight intensity={0.25} color="#ffd9b0" />
      <directionalLight
        ref={light}
        position={[-22, 30, 18]}
        intensity={2.6}
        color="#ffd2a0"
        castShadow={shadows}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[20, 12, -20]} intensity={0.6} color="#ff9a6a" />
    </>
  );
}

function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const screen = useStore((s) => s.screen);
  const lastUser = useRef(0);
  const dir = useRef(new THREE.Vector3());
  const want = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const st = useStore.getState();
    const t = performance.now();
    const k = 1 - Math.exp(-dt * 2.6);
    // portrait screens need the camera further away to fit the board
    const aspect = size.width / Math.max(1, size.height);
    const far = aspect < 0.8 ? 1.8 : aspect < 1.25 ? 1.3 : 1;
    if (st.screen === 'start') {
      c.autoRotate = true;
      c.autoRotateSpeed = 0.6;
      c.target.lerp(want.current.set(0, 0, 0), k);
    } else {
      c.autoRotate = false;
      const focus = st.camFocus;
      const userRecently = t - lastUser.current < 2500;
      if (st.settings.cinematic && !userRecently) {
        if (focus && focus.until > t && focus.pos) {
          c.target.lerp(want.current.set(...focus.target), k);
          camera.position.lerp(dir.current.set(...focus.pos), k);
        } else {
          let target: THREE.Vector3;
          let dist: number;
          if (focus && focus.until > t) {
            target = want.current.set(...focus.target);
            dist = focus.dist * far;
          } else {
            target = want.current.set(0, 0, 0.8);
            dist = 19 * far;
          }
          c.target.lerp(target, k);
          dir.current.copy(camera.position).sub(c.target);
          const cur = dir.current.length();
          dir.current.normalize();
          // keep a pleasant elevation
          const flat = Math.hypot(dir.current.x, dir.current.z) || 1;
          const elev = 0.78;
          dir.current.set((dir.current.x / flat) * Math.cos(elev), Math.sin(elev), (dir.current.z / flat) * Math.cos(elev));
          const d = THREE.MathUtils.lerp(cur, dist, k);
          const desired = want.current.clone().copy(c.target).addScaledVector(dir.current, d);
          camera.position.lerp(desired, k);
        }
      }
    }
    camera.position.y = Math.max(camera.position.y, 1.5);
    // earthquake
    const shake = st.effects.shake ? (t - st.effects.shake) / 1000 : 99;
    if (shake < 3.5) {
      const a = (1 - shake / 3.5) * 0.12;
      camera.position.x += (Math.random() - 0.5) * a;
      camera.position.y += (Math.random() - 0.5) * a;
    }
    c.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={90}
      maxPolarAngle={Math.PI * 0.47}
      enablePan
      screenSpacePanning={false}
      onStart={() => (lastUser.current = performance.now() + 60000)}
      onEnd={() => (lastUser.current = performance.now())}
      autoRotate={screen === 'start'}
    />
  );
}

function FontRefresher() {
  useEffect(() => {
    if (!document.fonts) return;
    const go = () => refreshBoardTexture();
    Promise.all([document.fonts.load("150px 'Pacifico'"), document.fonts.load("800 26px 'Baloo 2'")]).then(go, () => undefined);
  }, []);
  return null;
}

export function Scene() {
  const quality = useStore((s) => s.settings.quality);
  const high = quality === 'alta';
  return (
    <Canvas
      shadows={high}
      dpr={high ? [1, 2] : [0.8, 1.25]}
      camera={{ position: [0, 18, 20], fov: 42, near: 0.1, far: 1500 }}
      gl={{ antialias: !high, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
      onPointerMissed={() => useStore.getState().selectTile(null)}
    >
      <color attach="background" args={['#f4a76b']} />
      <fog attach="fog" args={['#f2b58a', 120, 520]} />
      <Sky sunPosition={SUN} turbidity={7} rayleigh={2.4} mieCoefficient={0.006} mieDirectionalG={0.86} distance={1000} />
      <Lights shadows={high} />
      <Suspense fallback={null}>
        <World />
        <Board />
        <Pawns />
        <Dice />
        <Effects />
      </Suspense>
      <CameraRig />
      <FontRefresher />
      {high && (
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.7} luminanceThreshold={0.82} luminanceSmoothing={0.2} mipmapBlur />
          <Vignette offset={0.25} darkness={0.55} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
