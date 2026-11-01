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
    this.makeEnv();
    this.buildCar();

    this.state = { pitch: 0, pitchV: 0, roll: 0, spin: 0, flame: 0, t: 0 };
    this.visible = true;
    this.resize();
  }

  setPaint(hex) {
    this.paintHex = hex;
    if (hex !== 'model') this.paint.color.set(hex);
    (this.customPaint || []).forEach((m) => m.color.set(hex === 'model' ? m.userData.orig : hex));
  }

  // profilo dell'asfalto (metri): ondulazioni lievi + giunti di dilatazione ogni 47 m
  static roadH(x, side) {
    const ph = side > 0 ? 0.9 : 0;
    let h = 0.006 * Math.sin(x * 0.61 + ph) + 0.004 * Math.sin(x * 1.73 + 2 * ph) + 0.0025 * Math.sin(x * 4.9 + ph * 3);
    const j = ((x % 47) + 47) % 47;
    if (j < 0.45) h += 0.02 * Math.sin(j / 0.45 * Math.PI);
    return h;
  }

  // ---------------------------------------------------------------- strumenti di modellazione
  // superficie da sezioni: fx(x) → { hw (semilarghezza), top, bot, ex (esponente superellisse), tumble }
  loftGeo(fx, x0, x1, n = 64, m = 40, caps = true) {
    const T = this.T, pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, p = fx(x);
      for (let j = 0; j <= m; j++) {
        const a = j / m * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), e = 2 / (p.ex || 3.2);
        const cz = Math.sign(c) * Math.pow(Math.abs(c), e), cy = Math.sign(s) * Math.pow(Math.abs(s), e);
        pos.push(x, p.bot + (cy + 1) / 2 * (p.top - p.bot), cz * p.hw * (1 - (p.tumble || 0) * Math.max(0, cy)));
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const a = i * (m + 1) + j, b = a + m + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    if (caps) for (const [i, flip] of [[0, true], [n, false]]) {
      const p = fx(x0 + (x1 - x0) * i / n), c = pos.length / 3;
      pos.push(x0 + (x1 - x0) * i / n, (p.top + p.bot) / 2, 0);
      for (let j = 0; j < m; j++) { const a = i * (m + 1) + j; if (flip) idx.push(c, a + 1, a); else idx.push(c, a, a + 1); }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  rod(a, b, r, mat) {
    const T = this.T, A = new T.Vector3(...a), B = new T.Vector3(...b), len = A.distanceTo(B);
    const m = new T.Mesh(new T.CylinderGeometry(r, r, len, 8), mat);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    m.castShadow = true;
    return m;
  }
  static ss(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  // ambiente per i riflessi: cielo notturno, strisce calde dei lampioni, neon ciano e rosa
  makeEnv() {
    const T = this.T, es = new T.Scene();
    es.add(new T.Mesh(new T.BoxGeometry(60, 30, 60), new T.MeshBasicMaterial({ color: 0x070a16, side: T.BackSide })));
    const panel = (col, w, h, x, y, z, ry = 0) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: col, side: T.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry; es.add(m); };
    for (let k = -3; k <= 3; k++) { panel(0xffc58a, 1.2, 0.4, k * 7, 12, 8, 0); panel(0xffc58a, 1.2, 0.4, k * 7, 12, -8, 0); }
    panel(0x2ee6ff, 10, 2.5, 0, 6, -29); panel(0xff2e88, 8, 2, 14, 7, 29); panel(0x9ab0ff, 30, 6, 0, 14.9, 0);
    panel(0x3a4a80, 60, 8, 0, -6, 29.9); panel(0x3a4a80, 60, 8, 0, -6, -29.9);
    const top = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshBasicMaterial({ color: 0x141a34 })); top.rotation.x = Math.PI / 2; top.position.y = 14.8; es.add(top);
    const pm = new T.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(es, 0.03).texture;
    pm.dispose();
  }

  // ---------------------------------------------------------------- ruota completa (gruppo fisso + parte che gira)
  makeWheel(side, rimMat) {
    const T = this.T, w = new T.Group(), spin = new T.Group();
    if (!this.wGeo) {
      const prof = [[0.215, -0.125], [0.29, -0.126], [0.316, -0.118], [0.329, -0.095], [0.333, -0.06], [0.333, 0.06], [0.329, 0.095], [0.316, 0.118], [0.29, 0.126], [0.215, 0.125]];
      const tire = new T.LatheGeometry(prof.map(([r, y]) => new T.Vector2(r, y)), 40); tire.rotateX(Math.PI / 2);
      const barrel = new T.CylinderGeometry(0.212, 0.212, 0.2, 32, 1, true); barrel.rotateX(Math.PI / 2);
      const lip = new T.TorusGeometry(0.212, 0.014, 8, 40);
      const spoke = new T.BoxGeometry(0.05, 0.19, 0.035);
      const disc = new T.CylinderGeometry(0.17, 0.17, 0.022, 32); disc.rotateX(Math.PI / 2);
      const hub = new T.CylinderGeometry(0.06, 0.07, 0.06, 20); hub.rotateX(Math.PI / 2);
      const nut = new T.CylinderGeometry(0.011, 0.011, 0.02, 6); nut.rotateX(Math.PI / 2);
      const cal = new T.BoxGeometry(0.1, 0.17, 0.07);
      this.wGeo = { tire, barrel, lip, spoke, disc, hub, nut, cal };
      this.wMat = {
        tire: new T.MeshStandardMaterial({ color: 0x0f1012, roughness: 0.92 }),
        disc: new T.MeshStandardMaterial({ color: 0x5a5e66, roughness: 0.35, metalness: 0.9 }),
        cal: new T.MeshStandardMaterial({ color: 0xc8261a, roughness: 0.35, metalness: 0.3 }),
        dark: new T.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5, metalness: 0.6 }),
      };
    }
    const G = this.wGeo, M = this.wMat, rim = rimMat || new T.MeshPhysicalMaterial({ color: 0xb8bec8, metalness: 1, roughness: 0.22, clearcoat: 0.5 });
    const add = (geo, mat, parent = spin) => { const m = new T.Mesh(geo, mat); m.castShadow = true; parent.add(m); return m; };
    add(G.tire, M.tire); add(G.barrel, M.dark);
    const lip = add(G.lip, rim); lip.position.z = 0.1;
    for (let k = 0; k < 5; k++) {
      const a = k * Math.PI * 2 / 5;
      for (const off of [-0.09, 0.09]) {
        const sp = add(G.spoke, rim); sp.position.set(Math.cos(a + off) * 0.11, Math.sin(a + off) * 0.11, 0.075); sp.rotation.z = a + off - Math.PI / 2;
      }
      const n = add(G.nut, rim); n.position.set(Math.cos(a + 0.6) * 0.045, Math.sin(a + 0.6) * 0.045, 0.1);
    }
    const hub = add(G.hub, rim); hub.position.z = 0.075;
    add(G.disc, M.disc).position.z = -0.02;
    w.add(spin);
    const cal = add(G.cal, M.cal, w); cal.position.set(-0.12, 0.09, -0.01); cal.rotation.z = 0.6;
    if (side < 0) w.rotation.y = Math.PI;                 // la faccia del cerchio guarda sempre fuori
    w.userData = { spin, dir: side < 0 ? -1 : 1 };
    return w;
  }

  // ---------------------------------------------------------------- Toyota Supra JZA80
  buildCar() {
    const T = this.T, b = this.body, ss = Garage3D.ss;
    this.paint = new T.MeshPhysicalMaterial({ color: 0xc81d11, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.2 });
    const glass = new T.MeshPhysicalMaterial({ color: 0x05080e, metalness: 0.3, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.88, envMapIntensity: 1.6 });
    const black = new T.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.65, metalness: 0.2 });
    const trimM = new T.MeshStandardMaterial({ color: 0x15171c, roughness: 0.4, metalness: 0.5 });
    const chrome = new T.MeshPhysicalMaterial({ color: 0xdfe4ea, metalness: 1, roughness: 0.12, clearcoat: 1 });
    const WB = 1.28, R = 0.4, WY = 0.33;
    const arch = (x) => { let h = 0; for (const wx of [-WB, WB]) { const d = x - wx; if (Math.abs(d) < R) h = Math.max(h, WY + Math.sqrt(R * R - d * d) * 0.98); } return h; };
    // fiancate e cofano: sezioni arrotondate, coda tonda, muso basso, passaruota ricavati dalla forma
    const body = (x) => {
      let hw = 0.9;
      if (x > 1.65) hw -= (x - 1.65) ** 2 * 0.62;
      if (x < -1.85) hw -= (-1.85 - x) ** 2 * 1.5;
      hw += 0.025 * Math.exp(-((x + WB) ** 2) / 0.18);                       // fianchi posteriori larghi
      const top = x < -1.95 ? 0.6 + 0.33 * ss(-2.28, -1.98, x)
        : x < 0.95 ? 0.93 - 0.03 * ss(-1.0, 0.95, x)
          : 0.9 - 0.2 * ss(0.95, 1.95, x) - 0.2 * ss(1.95, 2.3, x);
      let bot = 0.25 + 0.16 * ss(-1.95, -2.28, x) + 0.12 * ss(2.0, 2.3, x);
      bot = Math.max(bot, arch(x));
      return { hw, top, bot, ex: x > 2.15 || x < -2.18 ? 2.4 : 3.3, tumble: 0.07 };
    };
    this.bodyGeo = this.loftGeo(body, -2.28, 2.3, 96, 44);
    this.bodyPos0 = this.bodyGeo.attributes.position.array.slice();
    const shell = new T.Mesh(this.bodyGeo, this.paint); shell.castShadow = true; shell.receiveShadow = true; b.add(shell);
    // abitacolo: lunotto molto inclinato, tetto corto, parabrezza
    const roofY = (x) => (x < -0.25 ? 0.9 + 0.36 * Math.pow(ss(-1.0, -0.25, x), 0.75) : x < 0.28 ? 1.26 : 1.26 - 0.38 * ss(0.28, 1.0, x));
    const cabin = (x) => ({ hw: 0.75 - 0.05 * ss(0.6, 1.0, x) - 0.05 * ss(-0.7, -1.0, x), top: roofY(x), bot: 0.86, ex: 4.2, tumble: 0.3 });
    const gh = new T.Mesh(this.loftGeo(cabin, -1.0, 1.0, 48, 36), glass); gh.castShadow = true; b.add(gh);
    const roof = (x) => ({ hw: 0.56 - 0.04 * Math.abs(x) * 2, top: roofY(x) + 0.008, bot: roofY(x) - 0.04, ex: 6, tumble: 0 });
    const rp = new T.Mesh(this.loftGeo(roof, -0.42, 0.4, 20, 24), this.paint); rp.castShadow = true; b.add(rp);
    for (const z of [1, -1]) {
      b.add(this.rod([0.98, 0.89, z * 0.69], [0.36, 1.25, z * 0.54], 0.035, this.paint));          // montante A
      b.add(this.rod([-0.98, 0.91, z * 0.7], [-0.44, 1.25, z * 0.55], 0.045, this.paint));         // montante C
      b.add(this.rod([-0.05, 0.92, z * 0.71], [-0.05, 1.24, z * 0.55], 0.025, black));             // montante B
      b.add(this.rod([0.95, 0.905, z * 0.74], [-0.95, 0.925, z * 0.74], 0.012, chrome));          // filetto del finestrino
      for (const sx of [0.42, -0.62]) b.add(this.rod([sx, 0.33, z * 0.905], [sx, 0.88, z * 0.875], 0.005, black)); // fughe della portiera
      const intake = new T.Mesh(new T.BoxGeometry(0.42, 0.09, 0.02), black); intake.position.set(-0.78, 0.56, z * 0.915); intake.rotation.z = 0.12; b.add(intake);
      const mir = new T.Mesh(new T.SphereGeometry(0.1, 16, 10), this.paint); mir.scale.set(1.1, 0.6, 0.55); mir.position.set(0.74, 0.98, z * 0.98); mir.castShadow = true; b.add(mir);
      b.add(this.rod([0.78, 0.93, z * 0.8], [0.76, 0.97, z * 0.92], 0.015, black));
      const skirt = new T.Mesh(new T.BoxGeometry(1.7, 0.06, 0.04), black); skirt.position.set(0, 0.28, z * 0.9); b.add(skirt);
      const marker = new T.Mesh(new T.BoxGeometry(0.1, 0.035, 0.01), new T.MeshBasicMaterial({ color: 0xff9a20 })); marker.position.set(1.95, 0.52, z * 0.74); b.add(marker);
    }
    // alettone ad arco della JZA80
    const hoop = new T.CatmullRomCurve3([[-1.9, 0.92, 0.78], [-2.0, 1.1, 0.77], [-2.06, 1.18, 0.6], [-2.07, 1.19, 0], [-2.06, 1.18, -0.6], [-2.0, 1.1, -0.77], [-1.9, 0.92, -0.78]].map((p) => new T.Vector3(...p)));
    const hm = new T.Mesh(new T.TubeGeometry(hoop, 48, 0.035, 10, false), this.paint); hm.castShadow = true; b.add(hm);
    const blade = new T.Mesh(new T.BoxGeometry(0.3, 0.03, 1.36), this.paint); blade.position.set(-2.06, 1.19, 0); blade.rotation.z = 0.12; blade.castShadow = true; b.add(blade);
    // fanali tondi posteriori (quattro), pannello centrale, targa, diffusore
    this.lightR = new T.MeshStandardMaterial({ color: 0x2a0303, emissive: 0xff1a0a, emissiveIntensity: 0.4, roughness: 0.2 });
    const lensG = new T.CylinderGeometry(0.075, 0.075, 0.035, 24); lensG.rotateZ(Math.PI / 2);
    const ringG = new T.TorusGeometry(0.078, 0.01, 8, 24); ringG.rotateY(Math.PI / 2);
    for (const z of [0.43, 0.62, -0.43, -0.62]) {
      const l = new T.Mesh(lensG, this.lightR); l.position.set(-2.245, 0.66, z); b.add(l);
      const r = new T.Mesh(ringG, chrome); r.position.set(-2.248, 0.66, z); b.add(r);
    }
    const garn = new T.Mesh(new T.BoxGeometry(0.02, 0.12, 0.62), black); garn.position.set(-2.25, 0.66, 0); b.add(garn);
    const plateTex = this.carTex(256, 64, (g, w, h) => { g.fillStyle = '#f4f2ea'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1b1d24'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = '#1a1c24'; g.font = '700 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('2JZ·GTE', w / 2, h / 2 + 2); });
    const plate = new T.Mesh(new T.PlaneGeometry(0.5, 0.12), new T.MeshStandardMaterial({ map: plateTex, roughness: 0.6 })); plate.rotation.y = -Math.PI / 2; plate.position.set(-2.262, 0.47, 0); b.add(plate);
    const diff = new T.Mesh(new T.BoxGeometry(0.25, 0.08, 1.4), black); diff.position.set(-2.12, 0.29, 0); b.add(diff);
    // fari, prese del paraurti, fendinebbia, labbro
    this.lightF = new T.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff3dd, emissiveIntensity: 0.2 });
    const lensF = new T.MeshPhysicalMaterial({ color: 0xcfe6ff, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.35, clearcoat: 1 });
    for (const z of [0.6, -0.6]) {
      const bulb = new T.Mesh(new T.SphereGeometry(0.06, 16, 10), this.lightF); bulb.position.set(1.98, 0.66, z); b.add(bulb);
      const cover = new T.Mesh(new T.SphereGeometry(0.13, 20, 12), lensF); cover.scale.set(1.6, 0.42, 1.05); cover.position.set(1.96, 0.67, z * 0.98); b.add(cover);
      const fog = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.02, 16), this.lightF); fog.rotation.z = Math.PI / 2; fog.position.set(2.24, 0.4, z * 0.95); b.add(fog);
    }
    const mouth = new T.Mesh(new T.BoxGeometry(0.06, 0.13, 0.85), black); mouth.position.set(2.28, 0.4, 0); b.add(mouth);
    const lipF = new T.Mesh(new T.BoxGeometry(0.22, 0.03, 1.5), black); lipF.position.set(2.18, 0.29, 0); b.add(lipF);
    // terminali di scarico e fiammate
    this.tips = [];
    this.flameMat = new T.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false });
    for (const z of [0.55, -0.55]) {
      const tip = new T.Mesh(new T.CylinderGeometry(0.055, 0.06, 0.2, 20, 1, true), chrome);
      tip.rotation.z = Math.PI / 2; tip.position.set(-2.24, 0.33, z); b.add(tip);
      const fl = new T.Mesh(new T.ConeGeometry(0.07, 0.5, 16, 1, true), this.flameMat);
      fl.rotation.z = Math.PI / 2; fl.position.set(-2.55, 0.33, z); b.add(fl);
      this.tips.push({ tip, fl });
    }
    // graffi della carrozzeria (visibili quando ci sono danni)
    const scratch = this.carTex(256, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(210,214,220,.9)'; g.lineCap = 'round';
      for (let k = 0; k < 26; k++) { g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.lineTo(x + 30 + Math.random() * 90, y + (Math.random() - 0.5) * 30); g.stroke(); }
      g.fillStyle = 'rgba(40,30,30,.6)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 18, 5 + Math.random() * 8, 0, 0, Math.PI * 2); g.fill(); }
    });
    this.scratchMat = new T.MeshBasicMaterial({ map: scratch, transparent: true, opacity: 0, depthWrite: false });
    for (const z of [1, -1]) { const sc = new T.Mesh(new T.PlaneGeometry(1.0, 0.36), this.scratchMat); sc.position.set(1.55, 0.58, z * 0.875); if (z < 0) sc.rotation.y = Math.PI; b.add(sc); }
    // ruote: anteriori sterzanti; pinze ferme, il resto gira
    for (const [x, z] of [[WB, 0.8], [WB, -0.8], [-WB, 0.8], [-WB, -0.8]]) {
      const w = this.makeWheel(z > 0 ? 1 : -1); w.position.set(x, WY, z);
      this.root.add(w); this.wheels.push(w);
    }
    this.baseParts = [...b.children, ...this.wheels];
    this.damage = 0;
  }

  carTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new this.T.CanvasTexture(c); t.encoding = this.T.sRGBEncoding; return t;
  }

  // ammaccature: il muso si accartoccia, compaiono graffi
  setDamage(d) {
    if (!this.bodyGeo || Math.abs(d - this.damage) < 0.01) return;
    this.damage = d;
    const p = this.bodyGeo.attributes.position, o = this.bodyPos0;
    for (let i = 0; i < p.count; i++) {
      const x = o[i * 3], y = o[i * 3 + 1], z = o[i * 3 + 2];
      const k = Garage3D.ss(1.55, 2.3, x) * d, n = Math.sin(i * 12.9898) * 0.5 + 0.5;
      p.array[i * 3] = x - k * (0.12 + 0.1 * n);
      p.array[i * 3 + 1] = y - k * 0.05 * n * (y > 0.5 ? 1 : 0);
      p.array[i * 3 + 2] = z * (1 - k * 0.04 * n);
    }
    p.needsUpdate = true; this.bodyGeo.computeVertexNormals();
    this.scratchMat.opacity = Math.min(1, d * 1.6);
  }

  setTips(n) { if (this.tips[1]) this.tips[1].tip.visible = n > 1; this.dual = n > 1; }

  // modello dell'utente (.glb / .gltf incorporato)
  loadModel(file) {
    const T = this.T;
    return file.arrayBuffer().then((buf) => new Promise((res, rej) => {
      new T.GLTFLoader().parse(buf, '', (gltf) => {
        if (this.custom) { this.body.remove(this.custom); (this.customWheels || []).forEach((w) => this.root.remove(w.pivot)); }
        const m = gltf.scene;
        m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        this.custom = this.fitModel(m);
        this.body.add(this.custom);
        this.refloor();
        if (this.paintHex && this.paintHex !== 'model') this.setPaint(this.paintHex);
        this.baseParts.forEach((p) => { p.visible = p === this.tips[0]?.fl || p === this.tips[1]?.fl; });
        this.wheels.forEach((w) => { w.visible = false; });
        res({ name: file.name, wheels: this.customWheels.length, upFixed: this.upFixed, paint: this.customPaint.length > 0 });
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
    // vernice: il materiale della mesh più grande che non sia vetro, gomma, luci o cromature
    let best = null, bestV = 0;
    const skip = /glass|vetro|tire|tyre|rubber|gomma|light|lamp|\bled\b|faro|chrome|crom|rim|alloy|trim|graphite|satin|dark|carbon|black|nero|interior|bolt|hub/i;
    const prefer = /paint|vernic|carrozz|body|shell|scocca|metallic|perlat/i;
    custom.traverse((o) => {
      if (!o.isMesh || !o.material || Array.isArray(o.material) || skip.test(o.material.name || '') || skip.test(o.name || '')) return;
      const sz = new T.Box3().setFromObject(o).getSize(new T.Vector3());
      const v = sz.x * sz.y * sz.z * (prefer.test(o.material.name || '') || prefer.test(o.name || '') ? 10 : 1);
      if (v > bestV) { bestV = v; best = o.material; }
    });
    this.customPaint = best && best.color ? [best] : [];
    this.customPaint.forEach((m) => { m.userData.orig = m.color.getHex(); });
    this.customInner = holder;
    return custom;
  }

  // appoggia il modello a terra e lo centra
  refloor() {
    const T = this.T, c = this.custom; if (!c) return;
    // le ruote tornano nel modello per misurarlo, poi passano al telaio: la scocca si muove sulle sospensioni
    const saved = { p: this.body.position.clone(), r: this.body.rotation.clone() };
    this.body.position.set(0, 0, 0); this.body.rotation.set(0, 0, 0);
    this.root.updateMatrixWorld(true);
    (this.customWheels || []).forEach((w) => { w.pivot.position.y = w.y0 ?? w.pivot.position.y; c.attach(w.pivot); });
    this.body.remove(c);
    c.position.set(0, 0, 0); c.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(c), ctr = box.getCenter(new T.Vector3());
    c.position.set(-ctr.x, -box.min.y, -ctr.z);
    this.body.add(c);
    this.root.updateMatrixWorld(true);
    (this.customWheels || []).forEach((w) => { this.root.attach(w.pivot); w.y0 = w.pivot.position.y; w.x0 = w.pivot.position.x; w.z0 = w.pivot.position.z; });
    this.body.position.copy(saved.p); this.body.rotation.copy(saved.r);
  }
  rotateModel() { if (this.custom) { this.custom.rotation.y += Math.PI / 2; this.refloor(); } }
  uprightModel() { if (this.custom) { this.custom.rotation.x += Math.PI / 2; this.refloor(); } }
  resetModel() {
    if (this.custom) { this.body.remove(this.custom); this.custom = null; }
    (this.customWheels || []).forEach((w) => this.root.remove(w.pivot));
    this.customWheels = []; this.customPaint = [];
    this.baseParts.forEach((p) => { p.visible = true; });
    this.setTips(this.dual ? 2 : 1);
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  draw() { this.renderer.render(this.scene, this.camera); }

  // s: stato dalla simulazione
  update(dt, s) {
    const st = this.state; st.t += dt;
    st.spin += s.ww * dt;                 // posteriori: motrici, possono pattinare
    st.front = (st.front || 0) + s.v / 0.322 * dt;
    this.wheels.forEach((w, i) => { w.userData.spin.rotation.z = -(i < 2 ? st.front : st.spin) * w.userData.dir; });
    const steer = Math.max(-0.35, Math.min(0.35, (s.steer || 0)));
    this.wheels[0].rotation.y = steer; this.wheels[1].rotation.y = Math.PI + steer;      // ruote anteriori che sterzano
    if (s.damage !== undefined) this.setDamage(s.damage);
    (this.customWheels || []).forEach((w) => { w.pivot.rotation.z = -(w.front ? st.front : st.spin); });
    // ---- sospensioni: quattro ruote seguono l'asfalto, la scocca le segue su molle smorzate (~2 Hz)
    const d = s.dist || 0, wb = 1.28, H = Garage3D.roadH;
    const hFL = H(d + wb, 1), hFR = H(d + wb, -1), hRL = H(d - wb, 1), hRR = H(d - wb, -1);
    const sp = Math.min(1, Math.abs(s.v) / 3);          // da fermi l'asfalto non spinge
    const wh = [hFL, hFR, hRL, hRR].map((h) => h * sp);
    this.wheels.forEach((w, i) => { w.position.y = 0.33 + wh[i]; });
    (this.customWheels || []).forEach((w) => {
      const front = w.x0 > 0, left = w.z0 > 0;
      w.pivot.position.y = w.y0 + (front ? (left ? wh[0] : wh[1]) : (left ? wh[2] : wh[3]));
    });
    const tgtHeave = (wh[0] + wh[1] + wh[2] + wh[3]) / 4;
    const tgtPitch = ((wh[0] + wh[1]) - (wh[2] + wh[3])) / 2 / (2 * wb) + Math.max(-0.05, Math.min(0.05, s.acc * 0.0042));
    const tgtRoll = -((wh[0] + wh[2]) - (wh[1] + wh[3])) / 2 / 1.58 - Math.max(-0.05, Math.min(0.05, (s.latAcc || 0) * 0.006))
      + Math.max(-0.02, Math.min(0.02, s.torque * 0.00003));
    const K = 160, C = 11;                                // ω ≈ 12,6 rad/s, smorzamento ~0,45
    for (const [k, tgt] of [['heave', tgtHeave], ['pitch', tgtPitch], ['roll', tgtRoll]]) {
      const v = k + 'V';
      st[v] = (st[v] || 0) + ((tgt - (st[k] || 0)) * K - (st[v] || 0) * C) * dt;
      st[k] = (st[k] || 0) + st[v] * dt;
    }
    // vibrazione del motore: più forte al minimo e con camme lunghe
    const idle = s.running ? Math.max(0, 1 - s.rpm / 2200) : 0;
    const amp = s.running ? (0.0012 + 0.0025 * idle * (1 + 2 * s.lope)) : s.rpm > 30 ? 0.002 : 0;
    const f = Math.max(s.rpm, 120) / 60 * 3 * Math.PI * 2;
    const shake = Math.sin(st.t * f) * amp + Math.sin(st.t * f * 0.5 + 1.3) * amp * 0.6 * s.lope;
    this.body.rotation.z = st.pitch;
    this.body.rotation.x = st.roll + shake * 2;
    this.body.position.y = st.heave + shake;
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
    if (this.visible) this.draw();
  }
}
