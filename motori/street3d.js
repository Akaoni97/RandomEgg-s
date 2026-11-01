// ============================================================================
//  Street3D · strada notturna a scorrimento attorno alla Supra
//  L'auto resta all'origine: asfalto, lampioni, palazzi e traffico scorrono.
// ============================================================================
class Street3D extends Garage3D {
  constructor(canvas) {
    super(canvas);
    const T = this.T, sc = this.scene;
    sc.remove(this.floor); sc.remove(this.grid); sc.remove(this.warm);
    sc.background = new T.Color(0x04060b);
    sc.fog = new T.Fog(0x04060b, 45, 175);
    this.hemi.intensity = 0.28; this.hemi.color.set(0x5d7cff); this.hemi.groundColor.set(0x120a06);
    this.key.intensity = 0.55; this.key.color.set(0x9fb6ff); this.key.position.set(-6, 12, 8);
    this.rim.intensity = 0.7; this.rim.color.set(0x22d3ff);
    Object.assign(this.key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    this.key.target = this.root;
    this.renderer.toneMappingExposure = 1.25;
    this.camera.far = 400; this.camera.fov = 40;
    this.camera.position.set(-9.5, 3.4, 8.8);
    const c = this.controls;
    c.autoRotate = false; c.minDistance = 5; c.maxDistance = 26; c.maxPolarAngle = Math.PI * 0.46;
    c.target.set(1.8, 0.8, 3.5);
    this.camHome = { p: this.camera.position.clone(), t: c.target.clone() };
    this.lastZ = 0; this.dist = 0; this.t = 0;
    this.meshes = new Map();
    // fari della Supra
    const hl = this.headlight = new T.SpotLight(0xf3f6ff, 2.6, 70, 0.42, 0.55, 1.4);
    hl.position.set(2.1, 0.7, 0); this.root.add(hl);
    const tgt = new T.Object3D(); tgt.position.set(30, 0, 0); this.root.add(tgt); hl.target = tgt;
    this.buildRoad();
    this.buildLamps();
    this.buildCity();
    this.buildProps();
    this.buildFx();
    this.root.position.z = 3.5; this.lastZ = 3.5;
    this.brakeGlow = [0.55, -0.55].map((z) => { const sp = new T.Sprite(this.glowMat('#ff2a1a', 0)); sp.scale.set(1.6, 1.0, 1); sp.position.set(-2.45, 0.74, z); this.root.add(sp); return sp; });
    this.headGlow = [0.58, -0.58].map((z) => { const sp = new T.Sprite(this.glowMat('#fff3dd', 0.5)); sp.scale.set(1.1, 0.8, 1); sp.position.set(2.3, 0.6, z); this.root.add(sp); return sp; });
    this.shakeT = 0;
  }

  resize() {
    super.resize();
    if (this.composer) { const w = this.canvas.clientWidth, h = this.canvas.clientHeight; if (w && h) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); } }
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!this.view || this.view === 'chase') this.baseFov = w && h && w / h < 1.3 ? 62 : 40;      // schermi verticali: più campo per vedere l'auto
  }

  // telecamera da gara: bassa, di lato e un po' dietro, inquadra le due auto
  raceCam(on) {
    if (on === this.racing) return;
    this.racing = on;
    const c = this.controls;
    if (on) {
      this.savedCam = { p: this.camera.position.clone(), t: c.target.clone() };
      this.camera.position.set(-6.8, 1.3, this.lastZ + 3.6); c.target.set(4, 0.7, this.lastZ - 1.9);
    } else if (this.savedCam) { this.camera.position.copy(this.savedCam.p); c.target.copy(this.savedCam.t); }
  }

  // ---------------------------------------------------------------- telecamere: libera, lato, cofano, abitacolo
  setView(mode) {
    if (mode === this.view) return;
    const c = this.controls;
    if (this.view === 'chase' || !this.view) this.chaseCam = { p: this.camera.position.clone(), t: c.target.clone() };
    this.view = mode;
    c.enabled = mode === 'chase';
    this.cockpitOn = mode === 'cockpit';
    if (this.shell) { this.shell.visible = !this.cockpitOn; this.hoodOnly.visible = this.cockpitOn; }
    if (mode === 'chase' && this.chaseCam) { this.camera.position.copy(this.chaseCam.p); c.target.copy(this.chaseCam.t); }
    this.baseFov = mode === 'cockpit' ? 70 : mode === 'hood' ? 58 : mode === 'side' ? 30 : (this.canvas.clientWidth / this.canvas.clientHeight < 1.3 ? 62 : 40);
  }
  beforeRender(dt, s) {
    const v = this.view || 'chase';
    if (v === 'chase') return;
    const T = this.T, st = this.state;
    this.body.updateMatrixWorld(true); this.root.updateMatrixWorld(true);
    // testa che va indietro in accelerazione e avanti in frenata, vibrazione a velocità
    this.headX = (this.headX || 0) + ((-Math.max(-8, Math.min(8, s.acc || 0)) * 0.012) - (this.headX || 0)) * Math.min(1, dt * 6);
    const vib = (Math.random() - 0.5) * Math.min(0.006, Math.abs(s.v) * 0.0001) + (st.heaveV || 0) * 0.002;
    let eye, at, ref = this.body;
    if (v === 'cockpit') { eye = [-0.28 + this.headX, 1.12 + vib, 0.37]; at = [12, 1.0, 0.28 + (s.steer || 0) * 3]; }
    else if (v === 'hood') { eye = [0.95, 1.02 + vib, 0]; at = [14, 0.8, (s.steer || 0) * 4]; }
    else { ref = this.root; eye = [0.6, 1.05, 6.8]; at = [0.6, 0.7, 0]; }
    this.camera.position.copy(ref.localToWorld(new T.Vector3(...eye)));
    this.camera.lookAt(ref.localToWorld(new T.Vector3(...at)));
  }

  // ---------------------------------------------------------------- qualità: bloom (luci che si irradiano), ombre, risoluzione
  setQuality(q) {
    const T = this.T, r = this.renderer;
    this.quality = q;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'alta' ? 1.5 : q === 'media' ? 1.25 : 1));
    r.shadowMap.enabled = q !== 'bassa'; this.key.castShadow = q !== 'bassa';
    this.scene.traverse((o) => { if (o.material && o.material.needsUpdate !== undefined && o.isMesh) o.material.needsUpdate = true; });
    if (q === 'alta' && !this.composer && T.EffectComposer && T.UnrealBloomPass) {
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      const rt = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType });
      const comp = new T.EffectComposer(r, rt);
      comp.addPass(new T.RenderPass(this.scene, this.camera));
      this.bloom = new T.UnrealBloomPass(new T.Vector2(w, h), 0.85, 0.55, 0.92);
      comp.addPass(this.bloom);
      const fin = new T.ShaderPass({
        uniforms: { tDiffuse: { value: null }, expo: { value: r.toneMappingExposure } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform sampler2D tDiffuse; uniform float expo; varying vec2 vUv;
          vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
          void main(){ vec3 c = aces(texture2D(tDiffuse, vUv).rgb * expo); c = pow(c, vec3(1.0 / 2.2));
            float v = smoothstep(0.92, 0.3, length((vUv - 0.5) * vec2(1.25, 1.0))); c *= mix(0.68, 1.0, v);
            gl_FragColor = vec4(c, 1.0); }`,
      });
      fin.renderToScreen = true; comp.addPass(fin);
      this.composer = comp;
    }
    this.resize();
  }
  draw() {
    if (this.composer && this.quality === 'alta') this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  resetCamera() {
    this.camera.position.copy(this.camHome.p); this.controls.target.copy(this.camHome.t);
    this.camera.position.z += this.lastZ - 3.5; this.controls.target.z += this.lastZ - 3.5;
  }

  tex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new this.T.CanvasTexture(c);
    t.encoding = this.T.sRGBEncoding;
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  buildRoad() {
    const T = this.T;
    // un tratto di 24 m: asfalto, pozzanghere, strisce tratteggiate 4,5 m / 7,5 m, bordi continui
    const map = this.tex(1024, 512, (g, w, h) => {
      g.fillStyle = '#17191d'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 26000; i++) { const v = 20 + Math.random() * 30; g.fillStyle = `rgba(${v},${v},${v + 4},${Math.random() * 0.5})`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
      for (let i = 0; i < 7; i++) {
        const x = Math.random() * w, y = Math.random() * h, r = 40 + Math.random() * 110;
        const gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(60,70,90,.45)'); gr.addColorStop(1, 'rgba(60,70,90,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      const pm = h / 10.5, px = w / 24;
      const lineZ = (z) => (5.25 - z) * pm;
      g.fillStyle = '#d9d6cc';
      for (const z of [5.0, -5.0]) g.fillRect(0, lineZ(z) - 0.07 * pm, w, 0.14 * pm);
      for (const z of [1.75, -1.75]) for (const x0 of [0, 12]) g.fillRect(x0 * px, lineZ(z) - 0.06 * pm, 4.5 * px, 0.12 * pm);
    });
    map.wrapS = T.RepeatWrapping; map.repeat.set(480 / 24, 1);
    this.roadMap = map;
    const road = new T.Mesh(new T.PlaneGeometry(480, 10.5), new T.MeshStandardMaterial({ map, roughness: 0.38, metalness: 0.25, color: 0xb0b4bc }));
    road.rotation.x = -Math.PI / 2; road.position.set(100, 0, 0); road.receiveShadow = true;
    this.scene.add(road);
    const ground = new T.Mesh(new T.PlaneGeometry(480, 140), new T.MeshStandardMaterial({ color: 0x07080b, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(100, -0.02, 0); this.scene.add(ground);
    const curbMat = new T.MeshStandardMaterial({ color: 0x101217, roughness: 0.92 });
    for (const z of [6.0, -6.0]) {
      const walk = new T.Mesh(new T.BoxGeometry(480, 0.16, 2.2), curbMat);
      walk.position.set(100, 0.08, z + Math.sign(z) * 0.85); walk.receiveShadow = true; this.scene.add(walk);
    }
  }

  // alone morbido per luci (sprite additivo) e riflesso allungato sull'asfalto bagnato
  glowMat(hex, op) {
    const T = this.T;
    const tex = this.tex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    return new T.SpriteMaterial({ map: tex, color: hex, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false });
  }

  buildLamps() {
    const T = this.T;
    const rtex = this.tex(32, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,180,90,0)'); gr.addColorStop(0.4, 'rgba(255,180,90,.55)'); gr.addColorStop(0.55, 'rgba(255,200,120,.8)'); gr.addColorStop(1, 'rgba(255,180,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, w, h); });
    this.reflMat = new T.MeshBasicMaterial({ map: rtex, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false });
    const pool = this.tex(128, 128, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 1, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,170,80,.9)'); gr.addColorStop(0.45, 'rgba(255,140,50,.28)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    });
    const poolMat = new T.MeshBasicMaterial({ map: pool, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.55 });
    this.poolMat = poolMat;
    const poleMat = new T.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6, metalness: 0.6 });
    const bulbMat = new T.MeshBasicMaterial({ color: 0xffb35c });
    this.lamps = [];
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1, g = new T.Group();
      const pole = new T.Mesh(new T.CylinderGeometry(0.09, 0.12, 8, 8), poleMat); pole.position.set(0, 4, 0); g.add(pole);
      const arm = new T.Mesh(new T.BoxGeometry(0.12, 0.12, 2.4), poleMat); arm.position.set(0, 7.9, -side * 1.1); g.add(arm);
      const bulb = new T.Mesh(new T.BoxGeometry(0.7, 0.12, 0.35), bulbMat); bulb.position.set(0, 7.8, -side * 2.2); g.add(bulb);
      const p = new T.Mesh(new T.PlaneGeometry(15, 15), poolMat); p.rotation.x = -Math.PI / 2; p.position.set(0, 0.03, -side * 3.2); g.add(p);
      const halo = new T.Sprite(this.glowMat('#ffb35c', 0.55)); halo.scale.set(3.2, 3.2, 1); halo.position.set(0, 7.75, -side * 2.2); g.add(halo);
      const refl = new T.Mesh(new T.PlaneGeometry(1.2, 9), this.reflMat); refl.rotation.x = -Math.PI / 2; refl.position.set(0, 0.035, -side * 2.2 + side * 0.5 - side * 3.2); g.add(refl);
      g.position.z = side * 7.3;
      this.scene.add(g); this.lamps.push({ g, x0: i * 24 });
    }
  }

  // finestre: cornici, tende, sagome, TV, condizionatori
  winTex(warm, dense) {
    return this.tex(128, 256, (g) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, 128, 256);
      for (let r = 0; r < 16; r++) for (let c = 0; c < 8; c++) {
        const x = c * 16 + 3, y = r * 16 + 4;
        g.fillStyle = '#1b2333'; g.fillRect(x - 1, y - 1, 12, 11);
        if (Math.random() < (dense ? 0.25 : 0.42)) { g.fillStyle = '#05070c'; g.fillRect(x, y, 10, 9); continue; }
        const k = Math.random();
        g.fillStyle = k < 0.06 ? 'rgba(90,140,255,.9)' : warm ? `rgba(255,${175 + Math.random() * 60},${100 + Math.random() * 40},${0.45 + Math.random() * 0.55})` : `rgba(${150 + Math.random() * 60},${205 + Math.random() * 40},255,${0.4 + Math.random() * 0.5})`;
        g.fillRect(x, y, 10, 9);
        if (k > 0.75) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x, y, 10, 4); }
        else if (k > 0.65) { g.fillStyle = 'rgba(10,8,20,.85)'; g.fillRect(x + 3, y + 3, 3, 6); g.fillRect(x + 3.5, y + 1, 2, 2); }
        g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x + 4.5, y, 1, 9);
        if (Math.random() < 0.08) { g.fillStyle = '#5a6070'; g.fillRect(x + 1, y + 10, 8, 3); }
      }
    });
  }

  buildCity() {
    const T = this.T;
    const words = ['HOTEL', 'GARAGE', 'BAR', '24H', 'SUSHI', 'MOTEL', 'GOMME', 'RAMEN', 'DISCO', 'AUTO', 'PIZZA', 'CAFE'];
    const neon = ['#2ee6ff', '#ff2e88', '#b8ff3a', '#ffb000', '#9b5cff'];
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const dark = (c) => new T.MeshStandardMaterial({ color: c, roughness: 0.85 });
    const trim = dark(0x1a1f2a), roofMat = dark(0x2a1a18), metal = new T.MeshStandardMaterial({ color: 0x5a6070, roughness: 0.5, metalness: 0.6 });
    this.blinkers = [];
    const facade = (w, h, d, warm, dense, tint) => {
      const win = this.winTex(warm, dense);
      win.wrapS = win.wrapT = T.RepeatWrapping; win.repeat.set(Math.max(1, Math.round(w / 9)), Math.max(1, Math.round(h / 16)));
      const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ color: tint, roughness: 0.85, emissive: 0xffffff, emissiveMap: win, emissiveIntensity: 0.85 }));
      m.position.y = h / 2; return m;
    };
    const signMesh = (w, side) => {
      const word = pick(words), col = pick(neon);
      const tex = this.tex(512, 128, (cx, cw, chh) => {
        cx.clearRect(0, 0, cw, chh);
        cx.fillStyle = 'rgba(8,10,18,.9)'; cx.fillRect(6, 10, cw - 12, chh - 20);
        cx.strokeStyle = col; cx.lineWidth = 5; cx.shadowColor = col; cx.shadowBlur = 18; cx.strokeRect(10, 14, cw - 20, chh - 28);
        cx.font = '700 78px "Russo One", Impact, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.shadowBlur = 26; cx.fillStyle = col; cx.fillText(word, cw / 2, chh / 2 + 4);
        cx.shadowBlur = 0; cx.globalAlpha = 0.7; cx.fillStyle = '#fff'; cx.fillText(word, cw / 2, chh / 2 + 4);
      });
      const sm = new T.Mesh(new T.PlaneGeometry(Math.min(w * 0.8, 8), 2), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      if (side > 0) sm.rotation.y = Math.PI;
      return sm;
    };
    const faceZ = (d, side) => -side * (d / 2 + 0.06);
    const roofStuff = (g, w, h, d) => {
      const k = Math.random();
      if (k < 0.35) {
        const tank = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 2.2, 12), dark(0x5a3c26)); tank.position.set(w * 0.2, h + 2.4, 0); g.add(tank);
        const cap = new T.Mesh(new T.ConeGeometry(1.2, 0.8, 12), dark(0x3b2718)); cap.position.set(w * 0.2, h + 3.9, 0); g.add(cap);
        for (const [a, b] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) { const l = new T.Mesh(new T.BoxGeometry(0.12, 1.3, 0.12), trim); l.position.set(w * 0.2 + a, h + 0.65, b); g.add(l); }
      } else if (k < 0.7) {
        const ant = new T.Mesh(new T.CylinderGeometry(0.06, 0.1, 5, 6), metal); ant.position.set(-w * 0.25, h + 2.5, 0); g.add(ant);
        const bm = new T.MeshBasicMaterial({ color: 0xff2020 }); const b = new T.Mesh(new T.SphereGeometry(0.18, 8, 6), bm);
        b.position.set(-w * 0.25, h + 5.1, 0); g.add(b); this.blinkers.push({ m: bm, ph: Math.random() * 6 });
      }
      for (let n = 0; n < 2; n++) if (Math.random() < 0.6) { const ac = new T.Mesh(new T.BoxGeometry(1.4, 0.8, 1.2), metal); ac.position.set((Math.random() - 0.5) * w * 0.6, h + 0.4, (Math.random() - 0.5) * d * 0.5); g.add(ac); }
      const cornice = new T.Mesh(new T.BoxGeometry(w + 0.4, 0.4, d + 0.4), trim); cornice.position.y = h; g.add(cornice);
    };
    this.blocks = [];
    let x = -150;
    for (let i = 0; i < 56; i++) {
      const side = i % 2 ? 1 : -1, g = new T.Group(), type = Math.random();
      let w, d, h;
      if (type < 0.4) {                                                     // grattacielo
        w = 12 + Math.random() * 14; d = 12 + Math.random() * 10; h = 18 + Math.random() * 32;
        g.add(facade(w, h, d, Math.random() < 0.6, false, 0x0a0d12)); roofStuff(g, w, h, d);
        if (Math.random() < 0.6) { const sg = signMesh(w, side); sg.position.set(0, 5 + Math.random() * 8, faceZ(d, side)); g.add(sg); }
      } else if (type < 0.6) {                                              // torre a gradoni
        w = 14 + Math.random() * 10; d = 14; h = 12 + Math.random() * 10;
        const h2 = 10 + Math.random() * 18;
        g.add(facade(w, h, d, true, true, 0x0c0f16));
        const up = facade(w * 0.6, h2, d * 0.6, false, false, 0x0a0d12); up.position.y = h + h2 / 2; g.add(up);
        const ledge = new T.Mesh(new T.BoxGeometry(w + 0.3, 0.35, d + 0.3), trim); ledge.position.y = h; g.add(ledge);
        roofStuff(g, w * 0.6, h + h2, d * 0.6);
      } else if (type < 0.8) {                                              // negozio basso con tenda
        w = 9 + Math.random() * 8; d = 9; h = 4.5 + Math.random() * 3;
        g.add(facade(w, h, d, true, true, 0x12151d));
        const glow = pick(['#c9a46a', '#7fa9c0', '#c48aa4']);
        const shopTex = this.tex(128, 48, (c, cw, ch) => {
          c.fillStyle = glow; c.fillRect(0, 0, cw, ch);
          c.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 0; k < 3; k++) c.fillRect(0, 12 + k * 12, cw, 3);
          for (let k = 0; k < 14; k++) { c.fillStyle = `hsl(${Math.random() * 360},45%,40%)`; c.fillRect(Math.random() * cw, 4 + Math.floor(Math.random() * 3) * 12, 5, 7); }
          c.fillStyle = 'rgba(10,8,20,.8)'; c.fillRect(cw * 0.6, 18, 6, 30); c.beginPath(); c.arc(cw * 0.6 + 3, 15, 4, 0, Math.PI * 2); c.fill();
          c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, cw, 2); c.fillRect(cw / 2 - 1, 0, 2, ch);
        });
        const shop = new T.Mesh(new T.PlaneGeometry(w * 0.8, 2.4), new T.MeshBasicMaterial({ map: shopTex, color: 0xb0b0b0 }));
        shop.position.set(0, 1.5, faceZ(d, side)); if (side > 0) shop.rotation.y = Math.PI; g.add(shop);
        const stripes = this.tex(128, 32, (c, cw, ch) => { const a = pick(neon); for (let k = 0; k < 16; k++) { c.fillStyle = k % 2 ? a : '#f2ead6'; c.fillRect(k * 8, 0, 8, ch); } });
        const aw = new T.Mesh(new T.BoxGeometry(w * 0.9, 0.12, 1.4), new T.MeshStandardMaterial({ map: stripes, roughness: 0.7, emissive: 0x222222 }));
        aw.position.set(0, 3, -side * (d / 2 + 0.7)); aw.rotation.x = side * 0.25; g.add(aw);
        const sg = signMesh(w, side); sg.scale.setScalar(0.7); sg.position.set(0, h - 0.8, faceZ(d, side) - side * 0.02); g.add(sg);
        roofStuff(g, w, h, d);
      } else {                                                              // casa con tetto spiovente
        w = 8 + Math.random() * 5; d = 8; h = 4 + Math.random() * 2.5;
        g.add(facade(w, h, d, true, true, pick([0x1a1410, 0x10141a, 0x18121a])));
        const tri = new T.Shape(); tri.moveTo(-w / 2 - 0.4, 0); tri.lineTo(0, 2.6); tri.lineTo(w / 2 + 0.4, 0); tri.lineTo(-w / 2 - 0.4, 0);
        const rg = new T.ExtrudeGeometry(tri, { depth: d + 0.6, bevelEnabled: false }); rg.translate(0, 0, -(d + 0.6) / 2);
        const roof = new T.Mesh(rg, roofMat); roof.position.y = h; g.add(roof);
        const chim = new T.Mesh(new T.BoxGeometry(0.7, 1.6, 0.7), dark(0x2a2522)); chim.position.set(w * 0.25, h + 2, 1); g.add(chim);
        const door = new T.Mesh(new T.PlaneGeometry(1, 2), new T.MeshBasicMaterial({ color: 0x3a2516 })); door.position.set(-w * 0.25, 1, faceZ(d, side)); if (side > 0) door.rotation.y = Math.PI; g.add(door);
        const lamp = new T.Mesh(new T.PlaneGeometry(0.3, 0.3), new T.MeshBasicMaterial({ color: 0xffd27a })); lamp.position.set(-w * 0.25 + 0.8, 2.3, faceZ(d, side) - side * 0.01); if (side > 0) lamp.rotation.y = Math.PI; g.add(lamp);
      }
      g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
      g.position.z = side * (13 + d / 2);
      this.scene.add(g);
      this.blocks.push({ g, x0: x });
      if (side > 0) x += w + 1.5 + Math.random() * 5;
    }
    this.citySpan = x + 150;
  }

  // arredo urbano, auto parcheggiate e segnaletica: oggetti riciclati lungo un tratto di 480 m
  buildProps() {
    const T = this.T, add = (o, x0, z) => { o.position.z = z; this.scene.add(o); this.props.push({ o, x0 }); return o; };
    const mat = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7 }, o));
    this.props = []; this.signals = [];
    const trunkM = mat(0x2a1d14), leafM = new T.MeshBasicMaterial({ color: 0x010603 }), leafM2 = new T.MeshBasicMaterial({ color: 0x020a05 }), planterM = new T.MeshBasicMaterial({ color: 0x020203 });
    const redM = mat(0xb3261a, { metalness: 0.3 }), greenM = mat(0x1f5a3c), woodM = mat(0x5a3b22), poleM = mat(0x22262e, { metalness: 0.6 });
    const white = new T.MeshBasicMaterial({ color: 0xd8d4c8 }), manM = mat(0x0e1015, { metalness: 0.7, roughness: 0.4 });
    for (let k = 0; k < 22; k++) {                                          // alberi in aiuola
      const side = k % 2 ? 1 : -1, g = new T.Group();
      const trunk = new T.Mesh(new T.CylinderGeometry(0.12, 0.18, 2.6, 6), trunkM); trunk.position.y = 1.3; g.add(trunk);
      const c1 = new T.Mesh(new T.IcosahedronGeometry(1.4, 0), k % 3 ? leafM : leafM2); c1.position.y = 3.2; c1.rotation.set(k, k * 2, 0); g.add(c1);
      const c2 = new T.Mesh(new T.IcosahedronGeometry(0.9, 0), leafM2); c2.position.set(0.6, 3.9, 0.3); g.add(c2);
      const pl = new T.Mesh(new T.BoxGeometry(1.4, 0.4, 1.4), planterM); pl.position.y = 0.36; g.add(pl);
      add(g, 12 + k * 22, side * 7.9);
    }
    for (let k = 0; k < 16; k++) {                                          // panchine, idranti, cestini
      const side = k % 2 ? -1 : 1, kind = k % 3, g = new T.Group();
      if (kind === 0) {
        const seat = new T.Mesh(new T.BoxGeometry(1.8, 0.08, 0.5), woodM); seat.position.y = 0.55; g.add(seat);
        const back = new T.Mesh(new T.BoxGeometry(1.8, 0.45, 0.06), woodM); back.position.set(0, 0.85, side * 0.25); g.add(back);
        for (const xx of [-0.8, 0.8]) { const l = new T.Mesh(new T.BoxGeometry(0.06, 0.55, 0.45), poleM); l.position.set(xx, 0.28, 0); g.add(l); }
        add(g, 30 + k * 29, side * 8.4);
      } else if (kind === 1) {
        const b = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 0.7, 10), redM); b.position.y = 0.5; g.add(b);
        const c = new T.Mesh(new T.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), redM); c.position.y = 0.85; g.add(c);
        const n = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.5, 6), redM); n.rotation.x = Math.PI / 2; n.position.y = 0.6; g.add(n);
        add(g, 30 + k * 29, side * 6.7);
      } else {
        const b = new T.Mesh(new T.CylinderGeometry(0.3, 0.26, 0.9, 10), greenM); b.position.y = 0.6; g.add(b);
        add(g, 30 + k * 29, side * 7.0);
      }
    }
    for (let k = 0; k < 3; k++) {                                           // fermata dell'autobus
      const g = new T.Group();
      const roof = new T.Mesh(new T.BoxGeometry(4, 0.12, 1.6), poleM); roof.position.y = 2.5; g.add(roof);
      const glass = new T.Mesh(new T.BoxGeometry(4, 2.2, 0.05), new T.MeshStandardMaterial({ color: 0x9fd6ff, transparent: true, opacity: 0.18, roughness: 0.1 })); glass.position.set(0, 1.35, 0.75); g.add(glass);
      const adTex = this.tex(128, 256, (c, w, h) => {
        const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ff2e88'); gr.addColorStop(1, '#2ee6ff'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
        c.fillStyle = '#0b0f16'; c.font = '700 30px "Russo One", sans-serif'; c.textAlign = 'center'; c.fillText('NIGHT', w / 2, 90); c.fillText('RUN', w / 2, 125);
      });
      const ad = new T.Mesh(new T.PlaneGeometry(1.1, 2), new T.MeshBasicMaterial({ map: adTex })); ad.position.set(1.85, 1.35, 0); ad.rotation.y = -Math.PI / 2; g.add(ad);
      for (const xx of [-1.95, 1.95]) { const pp = new T.Mesh(new T.BoxGeometry(0.08, 2.5, 0.08), poleM); pp.position.set(xx, 1.25, 0.75); g.add(pp); }
      add(g, 70 + k * 160, 8.3);
    }
    for (let k = 0; k < 3; k++) {                                           // semafori agli incroci e strisce pedonali
      for (const side of [1, -1]) {
        const g = new T.Group();
        const pole = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 5.6, 8), poleM); pole.position.y = 2.8; g.add(pole);
        const arm = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 3.4), poleM); arm.position.set(0, 5.4, -side * 1.7); g.add(arm);
        const box = new T.Mesh(new T.BoxGeometry(0.4, 1.2, 0.4), mat(0x101318)); box.position.set(0, 4.8, -side * 3.3); g.add(box);
        const lights = [0xff2020, 0xffb000, 0x30ff60].map((c, n) => { const m = new T.MeshBasicMaterial({ color: 0x111111 }); const l = new T.Mesh(new T.CircleGeometry(0.13, 12), m); l.position.set(-0.21, 5.2 - n * 0.38, -side * 3.3); l.rotation.y = -Math.PI / 2; g.add(l); return { m, c }; });
        this.signals.push({ lights, ph: k * 3.1 });
        add(g, 150 + k * 160, side * 6.6);
      }
      for (let s2 = 0; s2 < 9; s2++) {
        const st = new T.Mesh(new T.PlaneGeometry(3.2, 0.55), white); st.rotation.x = -Math.PI / 2; st.position.y = 0.025;
        add(st, 142 + k * 160, -4.6 + s2 * 1.15);
      }
    }
    for (let k = 0; k < 8; k++) {                                           // tombini
      const m = new T.Mesh(new T.CircleGeometry(0.42, 18), manM); m.rotation.x = -Math.PI / 2; m.position.y = 0.02;
      add(m, 20 + k * 61, k % 2 ? 1.8 : -1.4);
    }
    const arrowShape = new T.Shape(); arrowShape.moveTo(0, -0.18); arrowShape.lineTo(2.2, -0.18); arrowShape.lineTo(2.2, -0.5); arrowShape.lineTo(3.2, 0); arrowShape.lineTo(2.2, 0.5); arrowShape.lineTo(2.2, 0.18); arrowShape.lineTo(0, 0.18);
    for (let k = 0; k < 5; k++) for (const z of [3.5, 0]) {                 // frecce dipinte
      const a = new T.Mesh(new T.ShapeGeometry(arrowShape), white); a.rotation.x = -Math.PI / 2; a.position.y = 0.026; add(a, 45 + k * 97, z);
    }
    // cielo: luna e stelle (non toccate dalla nebbia)
    const moon = new T.Mesh(new T.SphereGeometry(9, 24, 16), new T.MeshBasicMaterial({ color: 0xfff1c9, fog: false }));
    moon.position.set(220, 95, -170); this.scene.add(moon); this.moon = moon;
    const halo = new T.Mesh(new T.CircleGeometry(20, 32), new T.MeshBasicMaterial({ color: 0x8a7ab0, transparent: true, opacity: 0.18, fog: false, depthWrite: false }));
    halo.position.copy(moon.position); halo.lookAt(0, 0, 0); this.scene.add(halo); this.halo = halo;
    const pts = []; for (let n = 0; n < 700; n++) { const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.2, r = 320; pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
    const sgeo = new T.BufferGeometry(); sgeo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    this.stars = new T.Points(sgeo, new T.PointsMaterial({ color: 0xcfd6ff, size: 1.6, sizeAttenuation: false, fog: false }));
    this.scene.add(this.stars);
  }

  // auto del traffico, polizia, rivale: carrozzerie curve (berlina tre volumi o coupé)
  carShape(kind) {
    if (!this.shapes) this.shapes = {};
    if (this.shapes[kind]) return this.shapes[kind];
    const ss = Garage3D.ss, coupe = kind === 'rival', WB = coupe ? 1.28 : 1.35, R = 0.4, WY = 0.33;
    const arch = (x) => { let h = 0; for (const wx of [-WB, WB]) { const d = x - wx; if (Math.abs(d) < R) h = Math.max(h, WY + Math.sqrt(R * R - d * d) * 0.98); } return h; };
    const body = (x) => {
      let hw = coupe ? 0.88 : 0.86;
      if (x > 1.7) hw -= (x - 1.7) ** 2 * 0.6; if (x < -1.9) hw -= (-1.9 - x) ** 2 * 1.4;
      const top = coupe
        ? (x < -1.95 ? 0.62 + 0.3 * ss(-2.25, -1.98, x) : x < 0.9 ? 0.92 : 0.9 - 0.2 * ss(0.9, 1.95, x) - 0.18 * ss(1.95, 2.27, x))
        : (x < -1.95 ? 0.66 + 0.28 * ss(-2.25, -1.98, x) : x < 0.95 ? 0.94 : 0.94 - 0.12 * ss(0.95, 1.9, x) - 0.2 * ss(1.9, 2.27, x));
      return { hw, top, bot: Math.max(0.26 + 0.14 * ss(-1.95, -2.25, x) + 0.12 * ss(2.0, 2.27, x), arch(x)), ex: 3.1, tumble: 0.06 };
    };
    const roofY = coupe
      ? (x) => (x < -0.25 ? 0.9 + 0.36 * ss(-1.05, -0.25, x) : x < 0.25 ? 1.26 : 1.26 - 0.38 * ss(0.25, 0.95, x))
      : (x) => (x < -0.75 ? 0.92 + 0.5 * ss(-1.25, -0.75, x) : x < 0.25 ? 1.42 : 1.42 - 0.52 * ss(0.25, 1.0, x));
    const cab = (x) => ({ hw: 0.74, top: roofY(x), bot: 0.86, ex: 4.2, tumble: 0.28 });
    const sh = { body: this.loftGeo(body, -2.25, 2.27, 64, 32), cab: this.loftGeo(cab, coupe ? -1.05 : -1.25, 1.0, 32, 28), WB };
    this.shapes[kind] = sh;
    return sh;
  }
  makeCar(kind, color) {
    const T = this.T, g = new T.Group(), police = kind === 'police';
    const sh = this.carShape(kind === 'rival' ? 'rival' : 'sedan');
    const paint = new T.MeshPhysicalMaterial({ color: police ? 0x163a8c : color, metalness: 0.45, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.1 });
    if (!this.carGlass) this.carGlass = new T.MeshPhysicalMaterial({ color: 0x06090f, metalness: 0.3, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.5 });
    const body = new T.Mesh(sh.body, paint); body.castShadow = true; g.add(body);
    const cab = new T.Mesh(sh.cab, this.carGlass); cab.castShadow = true; g.add(cab);
    if (police) {
      const white = new T.MeshStandardMaterial({ color: 0xeef2fa, roughness: 0.4 });
      const tex = this.tex(512, 96, (c, w, h) => { c.fillStyle = '#eef2fa'; c.fillRect(0, 0, w, h); c.fillStyle = '#c42a1a'; c.fillRect(0, 0, w, 8); c.fillStyle = '#163a8c'; c.font = '700 62px "Russo One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('POLIZIA', w / 2, h / 2 + 6); });
      for (const z of [1, -1]) { const d = new T.Mesh(new T.PlaneGeometry(2.2, 0.34), new T.MeshStandardMaterial({ map: tex, roughness: 0.4 })); d.position.set(-0.1, 0.62, z * 0.865); if (z < 0) d.rotation.y = Math.PI; g.add(d); }
      const roof = new T.Mesh(new T.BoxGeometry(1.3, 0.04, 1.1), white); roof.position.set(-0.4, 1.43, 0); g.add(roof);
      const red = new T.MeshBasicMaterial({ color: 0x1030ff }), blue = new T.MeshBasicMaterial({ color: 0x2a6bff });
      const bar1 = new T.Mesh(new T.BoxGeometry(0.28, 0.1, 0.55), red); bar1.position.set(-0.3, 1.5, 0.3); g.add(bar1);
      const bar2 = new T.Mesh(new T.BoxGeometry(0.28, 0.1, 0.55), blue); bar2.position.set(-0.3, 1.5, -0.3); g.add(bar2);
      const pl = new T.PointLight(0x2a5cff, 0, 22); pl.position.set(-0.3, 2.2, 0); g.add(pl);
      g.userData.flash = { a: red, b: blue, pl };
    }
    const tlM = new T.MeshBasicMaterial({ color: 0xff2414 });
    for (const z of [0.55, -0.55]) {
      const tl = new T.Mesh(new T.BoxGeometry(0.04, 0.12, 0.42), tlM); tl.position.set(-2.22, 0.74, z); g.add(tl);
      const gl = new T.Sprite(this.glowMat('#ff2414', 0.45)); gl.scale.set(1.0, 0.6, 1); gl.position.set(-2.32, 0.74, z); g.add(gl);
      const hl = new T.Mesh(new T.BoxGeometry(0.04, 0.09, 0.36), new T.MeshBasicMaterial({ color: 0xfff6e0 })); hl.position.set(2.22, 0.66, z * 0.95); g.add(hl);
    }
    if (!this.trafficRim) this.trafficRim = new T.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.3 });
    const wheels = [];
    for (const [x, z] of [[sh.WB, 0.8], [sh.WB, -0.8], [-sh.WB, 0.8], [-sh.WB, -0.8]]) {
      const w = this.makeWheel(z > 0 ? 1 : -1, this.trafficRim); w.position.set(x, 0.33, z); g.add(w); wheels.push(w);
    }
    g.userData.wheels = wheels;
    return g;
  }

  // ---------------------------------------------------------------- effetti: segni sull'asfalto, fumo, spruzzi, scintille
  buildFx() {
    const T = this.T;
    this.marks = []; this.markI = 0;
    const markMat = new T.MeshBasicMaterial({ color: 0x050506, transparent: true, opacity: 0.55, depthWrite: false });
    for (let k = 0; k < 140; k++) {
      const m = new T.Mesh(new T.PlaneGeometry(1, 0.2), markMat.clone()); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.visible = false;
      this.scene.add(m); this.marks.push({ m, x: 0, a: 0 });
    }
    const puff = this.tex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.6, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    this.parts = [];
    for (let k = 0; k < 90; k++) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: puff, color: 0xcfd4dc, transparent: true, opacity: 0, depthWrite: false }));
      sp.visible = false; this.scene.add(sp); this.parts.push({ sp, life: 0 });
    }
    this.partI = 0;
  }
  emit(kind, x, y, z, vx, vy, vz) {
    const p = this.parts[this.partI = (this.partI + 1) % this.parts.length];
    Object.assign(p, { kind, x, y, z, vx, vy, vz, life: 1, size: kind === 'smoke' ? 0.6 : kind === 'spray' ? 0.25 : 0.06 });
    p.sp.material.color.set(kind === 'smoke' ? 0xd0d4dc : kind === 'spray' ? 0xa8c8ff : 0xffb040);
    p.sp.material.blending = kind === 'spark' ? this.T.AdditiveBlending : this.T.NormalBlending;
    p.sp.visible = true;
  }
  updateFx(dt, s, dist) {
    const z0 = this.root.position.z, ry = this.root.rotation.y;
    // segni di pattinamento o frenata: restano sull'asfalto, legati alla strada
    if ((s.skid || 0) > 0.18 && Math.abs(s.v) > 0.3 || (s.brake > 0.9 && Math.abs(s.v) > 8)) {
      for (const zz of [0.8, -0.8]) {
        const mk = this.marks[this.markI = (this.markI + 1) % this.marks.length];
        mk.x = dist - 1.28; mk.z = z0 + zz; mk.len = Math.max(0.15, Math.abs(s.v) * dt * 1.05 + 0.05); mk.a = Math.min(0.75, 0.25 + (s.skid || 0.5));
        mk.m.visible = true; mk.m.scale.set(mk.len, 1, 1); mk.m.material.opacity = mk.a;
      }
    }
    for (const mk of this.marks) if (mk.m.visible) { mk.m.position.set(mk.x - dist - mk.len / 2, 0.03, mk.z); if (mk.x - dist < -150) mk.m.visible = false; }
    // fumo delle gomme
    if ((s.spin || 0) > 0.25) for (const zz of [0.85, -0.85]) if (Math.random() < s.spin) this.emit('smoke', dist - 1.4, 0.25, z0 + zz, -1 - Math.random(), 0.8 + Math.random() * 0.8, zz * (0.6 + Math.random()));
    // spruzzi d'acqua sull'asfalto bagnato
    if (Math.abs(s.v) > 12) for (const zz of [0.8, -0.8]) if (Math.random() < Math.min(1, (Math.abs(s.v) - 12) / 25)) this.emit('spray', dist - 1.6, 0.15, z0 + zz, s.v * 0.65 - 3, 0.6 + Math.random() * 0.6, zz * 0.8);
    // scintille nei tamponamenti
    if (this.sparkT > 0) { this.sparkT -= dt; for (let k = 0; k < 4; k++) this.emit('spark', dist + 2.3, 0.5, z0 + (Math.random() - 0.5) * 1.4, 4 + Math.random() * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6); }
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      p.life -= dt * (p.kind === 'smoke' ? 0.45 : p.kind === 'spray' ? 2.2 : 1.6);
      if (p.life <= 0) { p.sp.visible = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.kind === 'spark') p.vy -= 12 * dt; else if (p.kind === 'spray') p.vy -= 4 * dt;
      if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.3; }
      p.size += dt * (p.kind === 'smoke' ? 2.2 : p.kind === 'spray' ? 0.6 : 0);
      p.sp.position.set(p.x - dist, p.y, p.z); p.sp.scale.set(p.size, p.size, 1);
      p.sp.material.opacity = p.kind === 'smoke' ? p.life * 0.55 : p.kind === 'spray' ? p.life * 0.35 : p.life;
    }
  }

  makeStation() {
    const T = this.T, g = new T.Group();
    const roof = new T.Mesh(new T.BoxGeometry(16, 0.7, 8), new T.MeshStandardMaterial({ color: 0xdedfe3, roughness: 0.5, emissive: 0x99a4b5, emissiveIntensity: 0.25 }));
    roof.position.set(0, 5.4, 6); g.add(roof);
    const edge = new T.Mesh(new T.BoxGeometry(16.1, 0.18, 8.1), new T.MeshBasicMaterial({ color: 0x2ee6ff })); edge.position.set(0, 5.0, 6); g.add(edge);
    const pil = new T.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.6, roughness: 0.4 });
    for (const [x, z] of [[-6, 3.5], [6, 3.5], [-6, 8.5], [6, 8.5]]) { const p = new T.Mesh(new T.BoxGeometry(0.4, 5, 0.4), pil); p.position.set(x, 2.5, z); g.add(p); }
    for (const x of [-3, 3]) { const pump = new T.Mesh(new T.BoxGeometry(0.8, 1.6, 0.6), new T.MeshStandardMaterial({ color: 0x1a1d22, emissive: 0xb8ff3a, emissiveIntensity: 0.25 })); pump.position.set(x, 0.8, 6); g.add(pump); }
    const under = new T.PointLight(0xe8f0ff, 1.4, 22); under.position.set(0, 4.6, 5); g.add(under);
    const board = this.tex(256, 384, (c, w, h) => {
      c.fillStyle = '#0b0f16'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#2ee6ff'; c.lineWidth = 8; c.strokeRect(6, 6, w - 12, h - 12);
      c.fillStyle = '#2ee6ff'; c.font = '700 44px "Russo One", Impact, sans-serif'; c.textAlign = 'center'; c.fillText('BENZINA', w / 2, 80);
      c.fillStyle = '#b8ff3a'; c.font = '700 92px "Share Tech Mono", monospace'; c.fillText('1,95', w / 2, 210);
      c.fillStyle = '#ffffff'; c.font = '600 34px sans-serif'; c.fillText('€ / litro', w / 2, 270);
      c.fillStyle = '#ffb000'; c.font = '700 38px "Russo One", sans-serif'; c.fillText('APERTO 24H', w / 2, 340);
    });
    const sign = new T.Mesh(new T.PlaneGeometry(2.4, 3.6), new T.MeshBasicMaterial({ map: board })); sign.position.set(-9, 4.2, 2.2); sign.rotation.y = -Math.PI / 2 + 0.5; g.add(sign);
    const post = new T.Mesh(new T.BoxGeometry(0.25, 2.4, 0.25), pil); post.position.set(-9, 1.2, 2.2); g.add(post);
    return g;
  }

  makeGate(kind, finish) {
    const T = this.T, g = new T.Group();
    if (kind === 'line') {
      const chk = this.tex(256, 32, (c, w, h) => { for (let i = 0; i < 32; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#111' : '#eee'; c.fillRect(i * 8, j * 8, 8, 8); } });
      const line = new T.Mesh(new T.PlaneGeometry(0.8, 7), new T.MeshBasicMaterial({ map: chk })); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.03, -1.75); g.add(line);
      if (finish) {
        const glow = new T.Mesh(new T.BoxGeometry(0.2, 0.2, 9), new T.MeshBasicMaterial({ color: 0xb8ff3a })); glow.position.set(0, 4.6, -1.75); g.add(glow);
        for (const z of [2.9, -6.4]) { const p = new T.Mesh(new T.BoxGeometry(0.2, 4.6, 0.2), new T.MeshBasicMaterial({ color: 0xb8ff3a })); p.position.set(0, 2.3, z); g.add(p); }
      }
    } else {
      const mat = new T.MeshBasicMaterial({ color: 0xb8ff3a });
      for (const z of [2.2, -2.2]) { const p = new T.Mesh(new T.BoxGeometry(0.25, 4.2, 0.25), mat); p.position.set(0, 2.1, z); g.add(p); }
      const top = new T.Mesh(new T.BoxGeometry(0.25, 0.25, 4.6), mat); top.position.set(0, 4.2, 0); g.add(top);
      const pl = new T.PointLight(0xb8ff3a, 1.2, 16); pl.position.set(0, 3, 0); g.add(pl);
    }
    return g;
  }

  sync(ents, dist) {
    const seen = new Set();
    for (const e of ents) {
      seen.add(e.id);
      let m = this.meshes.get(e.id);
      if (!m) {
        m = e.kind === 'station' ? this.makeStation() : e.kind === 'drop' || e.kind === 'line' ? this.makeGate(e.kind, e.finish) : this.makeCar(e.kind, e.color || 0x777777);
        this.scene.add(m); this.meshes.set(e.id, m);
        m.userData.z = GAME_LANE_Z[e.lane];
      }
      const zT = e.kind === 'station' ? 5.4 : e.kind === 'line' ? 1.75 : GAME_LANE_Z[e.lane];
      m.userData.z += (zT - m.userData.z) * 0.06;
      m.position.set(e.x - dist, 0, e.kind === 'station' ? 5.4 : m.userData.z);
      const f = m.userData.flash;
      if (f) {
        const on = e.chase || e.v > 0 || Math.abs(e.x - dist) < 120;
        const ph = Math.floor(this.t * 8) % 2;
        f.a.color.setHex(on && ph ? 0x4f7bff : 0x0a1440); f.b.color.setHex(on && !ph ? 0x4f7bff : 0x0a1440);
        f.pl.intensity = on ? (ph ? 2.2 : 0.6) : 0;
      }
    }
    for (const [id, m] of this.meshes) if (!seen.has(id)) { this.scene.remove(m); this.meshes.delete(id); }
  }

  update(dt, s, game) {
    this.t += dt;
    const dist = game ? game.s.dist : this.dist + s.v * dt;
    this.dist = dist;
    // cambio corsia morbido: la scocca sterza verso la nuova corsia e si inclina in fuori
    const zT = game ? game.laneZ : 3.5;
    this.lz = this.lz ?? zT; this.lzV = this.lzV || 0;
    const acc = (zT - this.lz) * 9 - this.lzV * 6;       // inseguitore critico, ~0,7 s
    this.lzV += acc * dt; this.lz += this.lzV * dt;
    const z = this.lz;
    this.root.position.z = z;
    this.root.rotation.y = -Math.atan2(this.lzV, Math.max(3, Math.abs(s.v)));
    s.latAcc = acc;
    s.dist = dist;
    const dz = z - this.lastZ; this.lastZ = z;
    this.camera.position.z += dz; this.controls.target.z += dz;
    this.roadMap.offset.x = (dist / 24) % 1;
    const span = 16 * 24;
    for (const l of this.lamps) l.g.position.x = ((l.x0 - dist) % span + span) % span - 80;
    for (const b of this.blocks) b.g.position.x = ((b.x0 - dist) % this.citySpan + this.citySpan) % this.citySpan - 150;
    for (const p of this.props) p.o.position.x = ((p.x0 - dist) % 480 + 480) % 480 - 120;
    for (const b of this.blinkers) b.m.color.setHex(Math.floor(this.t * 1.2 + b.ph) % 2 ? 0xff2020 : 0x300606);
    for (const sg of this.signals) {                                     // ciclo semaforico: verde 6 s, giallo 2 s, rosso 6 s
      const k = (this.t + sg.ph) % 14, on = k < 6 ? 2 : k < 8 ? 1 : 0;
      sg.lights.forEach((l, n) => l.m.color.setHex(n === on ? l.c : 0x141414));
    }
    if (game) this.sync(game.ents, dist);
    if (game) for (const e of game.ents) { const m = this.meshes.get(e.id); if (m && m.userData.wheels) m.userData.wheels.forEach((w) => { w.userData.spin.rotation.z = -(e.x / 0.33) * w.userData.dir; }); }
    s.steer = Math.atan2(this.lzV || 0, Math.max(3, Math.abs(s.v))) * 2.2;
    if (game) for (const f of game.fx) if (f.k === 'crash') this.sparkT = 0.35;
    this.updateFx(dt, s, dist);
    // un po' di "velocità": campo visivo che si allarga
    const fov = (this.baseFov || 40) + Math.min(16, Math.max(0, s.v) * 0.2);
    if (Math.abs(fov - this.camera.fov) > 0.05) { this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3); this.camera.updateProjectionMatrix(); }
    this.headlight.intensity = s.ign ? (s.high ? 4.6 : 2.6) : 0;
    this.headlight.distance = s.high ? 130 : 70; this.headlight.angle = s.high ? 0.33 : 0.42;
    this.brakeGlow.forEach((b) => { b.material.opacity = s.ign ? 0.25 + (s.brake || 0) * 0.75 : 0; });
    this.headGlow.forEach((b) => { b.material.opacity = s.ign ? (s.high ? 0.95 : 0.55) : 0; b.scale.set(s.high ? 1.7 : 1.1, s.high ? 1.1 : 0.8, 1); });
    if (game) for (const f of game.fx) if (f.k === 'crash') this.shakeT = 0.5;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeT * 0.6;
      this.camera.position.x += (Math.random() - 0.5) * a; this.camera.position.y += (Math.random() - 0.5) * a;
    }
    super.update(dt, s);
  }
}
