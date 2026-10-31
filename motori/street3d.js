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
    this.root.position.z = 3.5; this.lastZ = 3.5;
  }

  resize() {
    super.resize();
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.baseFov = w && h && w / h < 1.3 ? 62 : 40;      // schermi verticali: più campo per vedere l'auto
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

  buildLamps() {
    const T = this.T;
    const pool = this.tex(128, 128, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 1, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,170,80,.9)'); gr.addColorStop(0.45, 'rgba(255,140,50,.28)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    });
    const poolMat = new T.MeshBasicMaterial({ map: pool, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.55 });
    const poleMat = new T.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6, metalness: 0.6 });
    const bulbMat = new T.MeshBasicMaterial({ color: 0xffb35c });
    this.lamps = [];
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1, g = new T.Group();
      const pole = new T.Mesh(new T.CylinderGeometry(0.09, 0.12, 8, 8), poleMat); pole.position.set(0, 4, 0); g.add(pole);
      const arm = new T.Mesh(new T.BoxGeometry(0.12, 0.12, 2.4), poleMat); arm.position.set(0, 7.9, -side * 1.1); g.add(arm);
      const bulb = new T.Mesh(new T.BoxGeometry(0.7, 0.12, 0.35), bulbMat); bulb.position.set(0, 7.8, -side * 2.2); g.add(bulb);
      const p = new T.Mesh(new T.PlaneGeometry(15, 15), poolMat); p.rotation.x = -Math.PI / 2; p.position.set(0, 0.03, -side * 3.2); g.add(p);
      g.position.z = side * 7.3;
      this.scene.add(g); this.lamps.push({ g, x0: i * 24 });
    }
  }

  buildCity() {
    const T = this.T;
    const words = ['HOTEL', 'GARAGE', 'BAR', '24H', 'SUSHI', 'MOTEL', 'GOMME', 'RAMEN', 'DISCO', 'AUTO'];
    const neon = ['#2ee6ff', '#ff2e88', '#b8ff3a', '#ffb000', '#9b5cff'];
    this.blocks = [];
    let x = -150;
    for (let i = 0; i < 44; i++) {
      const side = i % 2 ? 1 : -1, w = 10 + Math.random() * 18, d = 10 + Math.random() * 14, h = 7 + Math.random() * 38;
      const win = this.tex(128, 256, (g, cw, ch) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch);
        const cols = 8, rows = 16, warm = Math.random() < 0.6;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (Math.random() < 0.38) continue;
          const lit = Math.random();
          g.fillStyle = lit < 0.7 ? (warm ? `rgba(255,${180 + Math.random() * 50},110,${0.25 + Math.random() * 0.7})` : `rgba(150,${200 + Math.random() * 40},255,${0.25 + Math.random() * 0.6})`) : 'rgba(30,40,60,.6)';
          g.fillRect(c * 16 + 3, r * 16 + 4, 10, 9);
        }
      });
      win.wrapS = win.wrapT = T.RepeatWrapping; win.repeat.set(Math.max(1, Math.round(w / 9)), Math.max(1, Math.round(h / 16)));
      const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.85, emissive: 0xffffff, emissiveMap: win, emissiveIntensity: 0.85 }));
      const g = new T.Group(); m.position.y = h / 2; g.add(m);
      if (Math.random() < 0.45) {
        const word = words[Math.floor(Math.random() * words.length)], col = neon[Math.floor(Math.random() * neon.length)];
        const sign = this.tex(512, 128, (cx, cw, chh) => {
          cx.fillStyle = 'rgba(0,0,0,0)'; cx.clearRect(0, 0, cw, chh);
          cx.font = '700 86px "Russo One", Impact, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
          cx.shadowColor = col; cx.shadowBlur = 26; cx.fillStyle = col; cx.fillText(word, cw / 2, chh / 2 + 4);
          cx.shadowBlur = 0; cx.fillStyle = '#fff'; cx.globalAlpha = 0.7; cx.fillText(word, cw / 2, chh / 2 + 4);
        });
        const sm = new T.Mesh(new T.PlaneGeometry(Math.min(w * 0.85, 9), 2.2), new T.MeshBasicMaterial({ map: sign, transparent: true, depthWrite: false }));
        sm.position.set(0, Math.min(h - 2, 4 + Math.random() * 8), -side * (d / 2 + 0.05));
        if (side > 0) sm.rotation.y = Math.PI;
        g.add(sm);
      }
      g.position.z = side * (13 + d / 2);
      this.scene.add(g);
      this.blocks.push({ g, x0: x });
      if (side > 0) x += w + 2 + Math.random() * 6;
    }
    this.citySpan = x + 150;
  }

  // auto del traffico, polizia, rivale
  makeCar(kind, color) {
    const T = this.T, g = new T.Group();
    const police = kind === 'police';
    const paint = new T.MeshStandardMaterial({ color: police ? 0x13306f : color, roughness: 0.35, metalness: 0.5 });
    const body = new T.Mesh(new T.BoxGeometry(4.4, 0.62, 1.76), paint); body.position.y = 0.6; body.castShadow = true; g.add(body);
    const cab = new T.Mesh(new T.BoxGeometry(2.2, 0.52, 1.5), new T.MeshStandardMaterial({ color: 0x0a0e14, roughness: 0.1, metalness: 0.8 }));
    cab.position.set(-0.3, 1.16, 0); g.add(cab);
    if (police) {
      const stripe = new T.Mesh(new T.BoxGeometry(4.42, 0.16, 1.78), new T.MeshStandardMaterial({ color: 0xe9ecf2, roughness: 0.4 }));
      stripe.position.y = 0.66; g.add(stripe);
      const red = new T.MeshBasicMaterial({ color: 0x1030ff }), blue = new T.MeshBasicMaterial({ color: 0x2a6bff });
      const bar1 = new T.Mesh(new T.BoxGeometry(0.3, 0.12, 0.6), red); bar1.position.set(-0.2, 1.48, 0.33); g.add(bar1);
      const bar2 = new T.Mesh(new T.BoxGeometry(0.3, 0.12, 0.6), blue); bar2.position.set(-0.2, 1.48, -0.33); g.add(bar2);
      const pl = new T.PointLight(0x2a5cff, 0, 22); pl.position.set(-0.2, 2.2, 0); g.add(pl);
      g.userData.flash = { a: red, b: blue, pl };
    }
    const tl = new T.Mesh(new T.BoxGeometry(0.05, 0.12, 1.5), new T.MeshBasicMaterial({ color: 0xff2414 })); tl.position.set(-2.22, 0.72, 0); g.add(tl);
    const hl = new T.Mesh(new T.BoxGeometry(0.05, 0.1, 1.4), new T.MeshBasicMaterial({ color: 0xfff6e0 })); hl.position.set(2.22, 0.66, 0); g.add(hl);
    const tire = new T.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.9 });
    for (const [x, z] of [[1.3, 0.8], [1.3, -0.8], [-1.3, 0.8], [-1.3, -0.8]]) {
      const w = new T.Mesh(new T.CylinderGeometry(0.32, 0.32, 0.24, 18), tire); w.rotation.x = Math.PI / 2; w.position.set(x, 0.32, z); g.add(w);
    }
    return g;
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
    const z = game ? game.laneZ : 3.5;
    this.root.position.z = z;
    const dz = z - this.lastZ; this.lastZ = z;
    this.camera.position.z += dz; this.controls.target.z += dz;
    this.roadMap.offset.x = (dist / 24) % 1;
    const span = 16 * 24;
    for (const l of this.lamps) l.g.position.x = ((l.x0 - dist) % span + span) % span - 80;
    for (const b of this.blocks) b.g.position.x = ((b.x0 - dist) % this.citySpan + this.citySpan) % this.citySpan - 150;
    if (game) this.sync(game.ents, dist);
    // un po' di "velocità": campo visivo che si allarga
    const fov = (this.baseFov || 40) + Math.min(16, Math.max(0, s.v) * 0.2);
    if (Math.abs(fov - this.camera.fov) > 0.05) { this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3); this.camera.updateProjectionMatrix(); }
    this.headlight.intensity = s.ign ? 2.6 : 0;
    super.update(dt, s);
  }
}
