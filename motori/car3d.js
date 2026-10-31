// ============================================================================
//  Garage3D · vista 3D dell'auto (three.js r147, build classica con globali)
//  Modello di base procedurale; si può caricare un proprio modello .glb/.gltf.
//  L'auto reagisce alla simulazione: ruote, beccheggio, vibrazioni, fiammate.
// ============================================================================
class Garage3D {
  constructor(canvas) {
    const T = window.THREE;
    if (!T || !T.OrbitControls) throw new Error('three.js non disponibile');
    this.T = T;
    this.canvas = canvas;
    const r = this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    r.outputEncoding = T.sRGBEncoding;
    r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;

    const sc = this.scene = new T.Scene();
    sc.background = new T.Color(0x0b0c0e);
    sc.fog = new T.Fog(0x0b0c0e, 12, 30);
    this.camera = new T.PerspectiveCamera(34, 2, 0.1, 100);
    this.camera.position.set(5.4, 1.9, 5.2);
    const c = this.controls = new T.OrbitControls(this.camera, canvas);
    c.target.set(0, 0.6, 0); c.enableDamping = true; c.minDistance = 3.4; c.maxDistance = 11;
    c.maxPolarAngle = Math.PI * 0.48; c.autoRotate = true; c.autoRotateSpeed = 0.35; c.enablePan = false;
    c.addEventListener('start', () => { c.autoRotate = false; });

    this.hemi = new T.HemisphereLight(0xc9d8ff, 0x1a120c, 0.55); sc.add(this.hemi);
    const key = new T.DirectionalLight(0xfff0dc, 1.6);
    key.position.set(4, 7, 3); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
    sc.add(key); this.key = key;
    const rim = this.rim = new T.DirectionalLight(0x6fa8ff, 0.9); rim.position.set(-5, 3, -4); sc.add(rim);
    const warm = this.warm = new T.PointLight(0xff8a3d, 0.7, 12); warm.position.set(-3.5, 1.2, 2.5); sc.add(warm);

    const floor = new T.Mesh(new T.CircleGeometry(14, 64), new T.MeshStandardMaterial({ color: 0x0d0e11, roughness: 0.78, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor); this.floor = floor;
    const grid = new T.GridHelper(28, 56, 0x2a2f37, 0x1c1f24);
    grid.material.transparent = true; grid.material.opacity = 0.35; grid.position.y = 0.002; sc.add(grid); this.grid = grid;

    this.root = new T.Group(); sc.add(this.root);      // auto intera (ruote incluse)
    this.body = new T.Group(); this.root.add(this.body); // carrozzeria che beccheggia e vibra
    this.wheels = [];
    this.custom = null;
    this.paint = new T.MeshStandardMaterial({ color: 0xc81d11, roughness: 0.28, metalness: 0.55 });
    this.buildCar();

    this.state = { pitch: 0, pitchV: 0, roll: 0, spin: 0, flame: 0, t: 0 };
    this.visible = true;
    this.resize();
  }

  setPaint(hex) { this.paint.color.set(hex); }

  // carrozzeria coupé anni 90 generica, costruita con estrusioni del profilo laterale
  buildCar() {
    const T = this.T, b = this.body;
    const dark = new T.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.6, metalness: 0.2 });
    const glass = new T.MeshStandardMaterial({ color: 0x0a0f14, roughness: 0.08, metalness: 0.9, transparent: true, opacity: 0.88 });
    const chrome = new T.MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.22, metalness: 1 });
    const extrude = (pts, depth, bevel, mat) => {
      const s = new T.Shape(); s.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        if (p.length === 4) s.absarc(p[0], p[1], p[2], Math.PI, 0, true); else s.lineTo(p[0], p[1]);
      }
      const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 24 });
      g.translate(0, 0, -depth / 2);
      const m = new T.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
      return m;
    };
    const wb = 1.28, ar = 0.39;
    // fiancata: muso basso, cofano lungo, coda tronca
    b.add(extrude([
      [-2.12, 0.27], [-wb - ar, 0.27], [-wb, 0.31, ar, 1], [wb - ar, 0.27], [wb, 0.31, ar, 1], [2.12, 0.27],
      [2.24, 0.42], [2.2, 0.56], [1.9, 0.66], [0.85, 0.83], [-0.9, 0.9], [-1.75, 0.93], [-2.12, 0.92], [-2.24, 0.78], [-2.2, 0.45],
    ], 1.6, 0.11, this.paint));
    // abitacolo: parabrezza inclinato, tetto corto, lunotto a fastback
    const cab = extrude([[0.82, 0.84], [0.18, 1.2], [-0.55, 1.23], [-1.0, 1.15], [-1.7, 0.95], [-1.6, 0.9], [0.8, 0.83]], 1.18, 0.1, glass);
    b.add(cab);
    // montanti e tetto in tinta
    const roof = new T.Mesh(new T.BoxGeometry(0.62, 0.035, 1.12), this.paint);
    roof.position.set(-0.2, 1.25, 0); roof.castShadow = true; b.add(roof);
    // alettone posteriore
    for (const z of [-0.6, 0.6]) { const up = new T.Mesh(new T.BoxGeometry(0.08, 0.24, 0.05), this.paint); up.position.set(-2.0, 1.05, z); b.add(up); }
    const wing = new T.Mesh(new T.BoxGeometry(0.34, 0.045, 1.62), this.paint);
    wing.position.set(-2.03, 1.18, 0); wing.rotation.z = 0.08; wing.castShadow = true; b.add(wing);
    // fari, fanali, griglia, terminale
    this.lightF = new T.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff3dd, emissiveIntensity: 0.2 });
    for (const z of [-0.58, 0.58]) { const h = new T.Mesh(new T.BoxGeometry(0.06, 0.07, 0.42), this.lightF); h.position.set(2.17, 0.6, z); h.rotation.z = -0.35; b.add(h); }
    this.lightR = new T.MeshStandardMaterial({ color: 0x300404, emissive: 0xff1a0a, emissiveIntensity: 0.4 });
    const tail = new T.Mesh(new T.BoxGeometry(0.05, 0.11, 1.62), this.lightR); tail.position.set(-2.33, 0.74, 0); b.add(tail);
    const intake = new T.Mesh(new T.BoxGeometry(0.06, 0.12, 1.1), dark); intake.position.set(2.3, 0.38, 0); b.add(intake);
    const diff = new T.Mesh(new T.BoxGeometry(0.3, 0.06, 1.5), dark); diff.position.set(-2.2, 0.27, 0); b.add(diff);
    this.tips = [];
    this.flameMat = new T.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
    for (const z of [0.55, -0.55]) {
      const tip = new T.Mesh(new T.CylinderGeometry(0.06, 0.065, 0.2, 20, 1, true), chrome);
      tip.rotation.z = Math.PI / 2; tip.position.set(-2.33, 0.33, z); b.add(tip);
      const fl = new T.Mesh(new T.ConeGeometry(0.07, 0.5, 16, 1, true), this.flameMat);
      fl.rotation.z = Math.PI / 2; fl.position.set(-2.62, 0.33, z); b.add(fl);
      this.tips.push({ tip, fl });
    }
    // ruote
    const tire = new T.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const rim = new T.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.3, metalness: 0.9 });
    for (const [x, z] of [[wb, 0.79], [wb, -0.79], [-wb, 0.79], [-wb, -0.79]]) {
      const w = new T.Group();
      const t = new T.Mesh(new T.CylinderGeometry(0.33, 0.33, 0.26, 36), tire); t.rotation.x = Math.PI / 2; t.castShadow = true; w.add(t);
      const disc = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.27, 36), rim); disc.rotation.x = Math.PI / 2; w.add(disc);
      for (let k = 0; k < 5; k++) {
        const sp = new T.Mesh(new T.BoxGeometry(0.05, 0.4, 0.04), rim);
        sp.rotation.z = k * Math.PI * 2 / 5; sp.position.z = z > 0 ? 0.13 : -0.13; w.add(sp);
      }
      w.position.set(x, 0.33, z);
      this.root.add(w); this.wheels.push(w);
    }
    this.baseParts = [...b.children, ...this.wheels];
  }

  setTips(n) { if (this.tips[1]) this.tips[1].tip.visible = n > 1; this.dual = n > 1; }

  // modello dell'utente (.glb / .gltf incorporato)
  loadModel(file) {
    const T = this.T;
    return file.arrayBuffer().then((buf) => new Promise((res, rej) => {
      new T.GLTFLoader().parse(buf, '', (gltf) => {
        if (this.custom) this.body.remove(this.custom);
        const m = gltf.scene;
        m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        this.custom = this.fitModel(m);
        this.body.add(this.custom);
        this.refloor();
        this.baseParts.forEach((p) => { p.visible = p === this.tips[0]?.fl || p === this.tips[1]?.fl; });
        this.wheels.forEach((w) => { w.visible = false; });
        res({ name: file.name, wheels: this.customWheels.length, upFixed: this.upFixed });
      }, rej);
    }));
  }

  // orienta un modello qualsiasi: lunghezza → X (muso avanti), altezza → Y, larghezza → Z
  fitModel(m) {
    const T = this.T;
    const orient = new T.Group(); orient.add(m);
    orient.updateMatrixWorld(true);
    const size = new T.Box3().setFromObject(orient).getSize(new T.Vector3()).toArray();
    // un'auto è più lunga che larga e più larga che alta: l'asse più corto è l'alto
    const idx = [0, 1, 2].sort((a, b) => size[b] - size[a]);
    const L = idx[0], W = idx[1], U = idx[2];
    this.upFixed = U !== 1;
    const e = (k, sgn = 1) => { const v = [0, 0, 0]; v[k] = sgn; return v; };
    const rows = [e(L), e(U), e(W)];
    const det = (a) => a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
    if (det(rows) < 0) rows[2] = e(W, -1);
    const R = new T.Matrix4().set(...rows[0], 0, ...rows[1], 0, ...rows[2], 0, 0, 0, 0, 1);
    orient.quaternion.setFromRotationMatrix(R);
    orient.updateMatrixWorld(true);
    // muso avanti: i fari devono stare verso +X
    const avgX = (re) => {
      let sum = 0, n = 0;
      m.traverse((o) => { if (o.isMesh && re.test(o.name || '') && !/rest/i.test(o.name || '')) { sum += new T.Box3().setFromObject(o).getCenter(new T.Vector3()).x; n++; } });
      return n ? sum / n : null;
    };
    const head = avgX(/head|front|faro|anterior|grille|griglia|splitter/i), tail = avgX(/tail|rear|posterior|stop|diffuser|exhaust|scarico/i);
    if ((head !== null && tail !== null && head < tail) || (head !== null && tail === null && head < 0) || (head === null && tail !== null && tail > 0)) {
      orient.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI));
    }
    const holder = new T.Group(); holder.add(orient);
    holder.updateMatrixWorld(true);
    const len = new T.Box3().setFromObject(holder).getSize(new T.Vector3()).x || 1;
    holder.scale.setScalar(4.5 / len);
    const custom = new T.Group(); custom.add(holder);
    custom.updateMatrixWorld(true);
    // ruote: pezzi con nome da ruota, raggruppati per angolo dell'auto e fatti girare attorno al loro asse
    const parts = [];
    custom.traverse((o) => { if (o.isMesh && /tire|tyre|wheel|rim|spoke|hub|bolt|ruota|gomma|cerch/i.test(o.name || '')) parts.push(o); });
    const ctrAll = new T.Box3().setFromObject(custom).getCenter(new T.Vector3());
    const groups = new Map();
    for (const o of parts) {
      const c = new T.Box3().setFromObject(o).getCenter(new T.Vector3());
      const key = (c.x > ctrAll.x ? 'F' : 'R') + (c.z > ctrAll.z ? 'd' : 's');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ o, c });
    }
    this.customWheels = [];
    if (groups.size >= 2 && groups.size <= 4) {
      for (const [key, list] of groups) {
        const box = new T.Box3(); list.forEach(({ o }) => box.expandByObject(o));
        const pivot = new T.Group(); pivot.position.copy(box.getCenter(new T.Vector3()));
        custom.add(pivot); custom.updateMatrixWorld(true);
        list.forEach(({ o }) => pivot.attach(o));
        this.customWheels.push({ pivot, front: key[0] === 'F' });
      }
    }
    this.customInner = holder;
    return custom;
  }

  // appoggia il modello a terra e lo centra
  refloor() {
    const T = this.T, c = this.custom; if (!c) return;
    this.body.remove(c);
    c.position.set(0, 0, 0); c.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(c), ctr = box.getCenter(new T.Vector3());
    c.position.set(-ctr.x, -box.min.y, -ctr.z);
    this.body.add(c);
  }
  rotateModel() { if (this.custom) { this.custom.rotation.y += Math.PI / 2; this.refloor(); } }
  uprightModel() { if (this.custom) { this.custom.rotation.x += Math.PI / 2; this.refloor(); } }
  resetModel() {
    if (this.custom) { this.body.remove(this.custom); this.custom = null; }
    this.customWheels = [];
    this.baseParts.forEach((p) => { p.visible = true; });
    this.setTips(this.dual ? 2 : 1);
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // s: stato dalla simulazione
  update(dt, s) {
    const st = this.state; st.t += dt;
    st.spin += s.ww * dt;                 // posteriori: motrici, possono pattinare
    st.front = (st.front || 0) + s.v / 0.322 * dt;
    this.wheels.forEach((w, i) => { w.rotation.z = -(i < 2 ? st.front : st.spin); });
    (this.customWheels || []).forEach((w) => { w.pivot.rotation.z = -(w.front ? st.front : st.spin); });
    // beccheggio su molla smorzata: si siede in accelerazione, picchia in frenata
    const target = Math.max(-0.045, Math.min(0.045, s.acc * 0.0042));
    st.pitchV += ((target - st.pitch) * 60 - st.pitchV * 9) * dt;
    st.pitch += st.pitchV * dt;
    // vibrazione del motore: più forte al minimo e con camme lunghe, rollio da coppia di reazione
    const idle = s.running ? Math.max(0, 1 - s.rpm / 2200) : 0;
    const amp = s.running ? (0.0012 + 0.0025 * idle * (1 + 2 * s.lope)) : s.rpm > 30 ? 0.002 : 0;
    const f = Math.max(s.rpm, 120) / 60 * 3 * Math.PI * 2;
    const shake = Math.sin(st.t * f) * amp + Math.sin(st.t * f * 0.5 + 1.3) * amp * 0.6 * s.lope;
    st.roll += ((Math.max(-0.02, Math.min(0.02, s.torque * 0.00003)) + shake * 2) - st.roll) * Math.min(1, dt * 12);
    this.body.rotation.z = st.pitch;
    this.body.rotation.x = st.roll;
    this.body.position.y = shake;
    // fanali e fiammate
    this.lightF.emissiveIntensity = s.ign ? 1.6 : 0.15;
    this.lightR.emissiveIntensity = s.ign ? 0.6 + s.brake * 2.4 : 0.25;
    st.flame = Math.max(0, st.flame - dt * 9);
    if (s.flame && Math.random() < s.flame * dt * 18) st.flame = 0.6 + Math.random() * 0.6;
    this.tips.forEach((t, i) => {
      const on = (i === 0 || this.dual) ? st.flame : 0;
      t.fl.scale.set(1, 0.4 + on * 1.4 * (0.8 + Math.random() * 0.4), 1);
      t.fl.position.x = -2.48 - on * 0.18;
      this.flameMat.opacity = Math.min(1, st.flame);
      this.flameMat.color.setHSL(0.07 + Math.random() * 0.03, 1, 0.55);
    });
    this.controls.update();
    if (this.visible) this.renderer.render(this.scene, this.camera);
  }
}
