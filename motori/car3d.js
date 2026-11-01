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
    const glass = new T.MeshPhysicalMaterial({ color: 0x060a12, metalness: 0.5, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.93, envMapIntensity: 2.2, reflectivity: 0.9 });
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
    const shell = new T.Mesh(this.bodyGeo, this.paint); shell.castShadow = true; shell.receiveShadow = true; b.add(shell); this.shell = shell;
    // per la vista dall'abitacolo: solo il cofano, così la scocca non copre l'interno
    const hoodOnly = new T.Mesh(this.loftGeo(body, 0.9, 2.3, 48, 44), this.paint); hoodOnly.visible = false; b.add(hoodOnly); this.hoodOnly = hoodOnly;
    // abitacolo: lunotto molto inclinato, tetto corto, parabrezza
    const roofY = (x) => (x < -0.25 ? 0.9 + 0.36 * Math.pow(ss(-1.0, -0.25, x), 0.75) : x < 0.28 ? 1.26 : 1.26 - 0.38 * ss(0.28, 1.0, x));
    const cabin = (x) => ({ hw: 0.75 - 0.05 * ss(0.6, 1.0, x) - 0.05 * ss(-0.7, -1.0, x), top: roofY(x), bot: 0.86, ex: 4.2, tumble: 0.3 });
    const gh = new T.Mesh(this.loftGeo(cabin, -1.0, 1.0, 48, 36), glass); gh.castShadow = true; b.add(gh);
    const roof = (x) => ({ hw: 0.56 - 0.04 * Math.abs(x) * 2, top: roofY(x) + 0.008, bot: roofY(x) - 0.04, ex: 6, tumble: 0 });
    const rp = new T.Mesh(this.loftGeo(roof, -0.42, 0.4, 20, 24), this.paint); rp.castShadow = true; b.add(rp);
    for (const z of [1, -1]) {
      b.add(this.rod([0.98, 0.89, z * 0.69], [0.36, 1.25, z * 0.54], 0.028, black));               // montante A nero, come la serra della JZA80
      b.add(this.rod([-0.98, 0.91, z * 0.7], [-0.44, 1.25, z * 0.55], 0.045, this.paint));         // montante C
      b.add(this.rod([-0.05, 0.92, z * 0.71], [-0.05, 1.24, z * 0.55], 0.025, black));             // montante B
      b.add(this.rod([0.95, 0.9, z * 0.745], [-0.95, 0.92, z * 0.745], 0.016, black));           // guarnizione del finestrino
      b.add(this.rod([0.9, 0.915, z * 0.75], [-0.9, 0.935, z * 0.75], 0.005, chrome));          // filetto cromato sottile
      const handle = new T.Mesh(new T.BoxGeometry(0.16, 0.025, 0.02), chrome); handle.position.set(-0.2, 0.8, z * 0.9); b.add(handle);   // maniglia
      const hcup = new T.Mesh(new T.BoxGeometry(0.2, 0.05, 0.01), black); hcup.position.set(-0.2, 0.8, z * 0.895); b.add(hcup);
      for (const sx of [0.42, -0.62]) b.add(this.rod([sx, 0.33, z * 0.905], [sx, 0.88, z * 0.875], 0.005, black)); // fughe della portiera
      // presa d'aria laterale incassata davanti al passaruota posteriore, con alette
      const intake = new T.Mesh(new T.PlaneGeometry(0.3, 0.05), new T.MeshBasicMaterial({ color: 0x050506, transparent: true, opacity: 0.8 })); intake.position.set(-0.74, 0.58, z * 0.912); intake.rotation.set(0, z < 0 ? Math.PI : 0, 0.1); b.add(intake);
      const mir = new T.Mesh(new T.SphereGeometry(0.1, 16, 10), this.paint); mir.scale.set(1.1, 0.6, 0.55); mir.position.set(0.74, 0.98, z * 0.98); mir.castShadow = true; b.add(mir);
      b.add(this.rod([0.78, 0.93, z * 0.8], [0.76, 0.97, z * 0.92], 0.015, black));
      const skirt = new T.Mesh(new T.BoxGeometry(1.62, 0.05, 0.03), trimM); skirt.position.set(0, 0.27, z * 0.89); b.add(skirt);
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
    for (let k = -3; k <= 3; k++) { const fin = new T.Mesh(new T.BoxGeometry(0.3, 0.1, 0.012), trimM); fin.position.set(-2.15, 0.27, k * 0.17); b.add(fin); }
    // terzo stop sull'alettone
    const third = new T.Mesh(new T.BoxGeometry(0.02, 0.018, 0.5), this.lightR); third.position.set(-2.1, 1.215, 0); third.rotation.z = 0.12; b.add(third);
    // fari, prese del paraurti, fendinebbia, labbro
    this.lightF = new T.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff3dd, emissiveIntensity: 0.2 });
    const lensF = new T.MeshPhysicalMaterial({ color: 0xcfe6ff, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.35, clearcoat: 1 });
    // fari a tre proiettori tondi per lato (il segno della JZA80) sotto una copertura trasparente inclinata
    const cupG = new T.CylinderGeometry(0.042, 0.032, 0.05, 20, 1, true); cupG.rotateZ(Math.PI / 2);
    const coreG = new T.SphereGeometry(0.026, 14, 10), housing = new T.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.4, metalness: 0.6 });
    for (const z of [0.6, -0.6]) {
      void housing;
      [0.14, 0.0, -0.14].forEach((dz, k) => {
        const x = 1.94 + k * 0.045 * (z > 0 ? 1 : 1), zz = z + Math.sign(z) * dz * -1;
        const cup = new T.Mesh(cupG, chrome); cup.position.set(x + 0.04, 0.68 - k * 0.012, zz); cup.rotation.z = -0.32; b.add(cup);
        const core = new T.Mesh(coreG, this.lightF); core.position.set(x + 0.05, 0.68 - k * 0.012, zz); b.add(core);
      });
      const amber = new T.Mesh(new T.BoxGeometry(0.06, 0.03, 0.12), new T.MeshStandardMaterial({ color: 0x4a2a00, emissive: 0xff8a00, emissiveIntensity: 0.25 })); amber.position.set(2.16, 0.58, z * 1.1); b.add(amber);
      const cover = new T.Mesh(new T.SphereGeometry(0.13, 20, 12), lensF); cover.scale.set(1.6, 0.42, 1.05); cover.position.set(1.96, 0.67, z * 0.98); b.add(cover);
      const fog = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.02, 16), this.lightF); fog.rotation.z = Math.PI / 2; fog.position.set(2.24, 0.4, z * 0.95); b.add(fog);
    }
    const mesh = this.carTex(128, 32, (g, w, h) => { g.fillStyle = '#050506'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2a2c32'; g.lineWidth = 1.2; for (let y = 0; y < h + 6; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < w + 6; x += 6) { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3); } g.closePath(); g.stroke(); } });
    mesh.wrapS = mesh.wrapT = T.RepeatWrapping; mesh.repeat.set(3, 1);
    const mouth = new T.Mesh(new T.BoxGeometry(0.06, 0.13, 0.85), new T.MeshStandardMaterial({ map: mesh, roughness: 0.7, metalness: 0.3 })); mouth.position.set(2.28, 0.4, 0); b.add(mouth);
    for (const z of [0.62, -0.62]) { const duct = new T.Mesh(new T.BoxGeometry(0.05, 0.09, 0.2), new T.MeshStandardMaterial({ map: mesh, roughness: 0.7 })); duct.position.set(2.24, 0.36, z); b.add(duct); }
    // sportello del carburante
    const fuel = new T.Mesh(new T.CircleGeometry(0.075, 24), new T.MeshBasicMaterial({ color: 0x0a0405, transparent: true, opacity: 0.35 })); fuel.position.set(-1.62, 0.72, -0.915); fuel.rotation.y = Math.PI; b.add(fuel);
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
    this.buildInterior();
    // abitacolo visto da fuori (dietro i vetri): vasca scura, sedili, plancia, volante e pilota con cappellino
    const co = this.cabinOut = new T.Group(); b.add(co);
    const om = (c, r = 0.8) => new T.MeshStandardMaterial({ color: c, roughness: r });
    const ob = (w, h, d, m, x, y, z, rz = 0) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.z = rz; co.add(o); return o; };
    const tub = om(0x0a0a0d), seatM = om(0x1c1a1d), skinM = om(0x8a5a40, 0.6), jacket = om(0x1b2230, 0.9), capM = om(0x101015, 0.7);
    ob(1.9, 0.08, 1.4, tub, -0.05, 0.5, 0);
    ob(0.5, 0.18, 1.4, tub, 0.68, 0.84, 0);                                           // plancia
    for (const z of [0.37, -0.37]) {
      ob(0.12, 0.55, 0.46, seatM, -0.56, 0.8, z, -0.22); ob(0.1, 0.16, 0.26, seatM, -0.66, 1.13, z, -0.22);
    }
    const sw = new T.Mesh(new T.TorusGeometry(0.17, 0.02, 8, 28), om(0x111114, 0.5)); sw.rotation.y = Math.PI / 2; sw.rotation.x = 0; sw.position.set(0.32, 0.86, 0.37); sw.rotation.z = 0.45; co.add(sw);
    ob(0.26, 0.42, 0.4, jacket, -0.42, 0.86, 0.37, -0.25);                              // busto del pilota
    const head = new T.Mesh(new T.SphereGeometry(0.095, 16, 12), skinM); head.position.set(-0.36, 1.13, 0.37); co.add(head);
    const cap = new T.Mesh(new T.SphereGeometry(0.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), capM); cap.position.set(-0.37, 1.15, 0.37); co.add(cap);
    const visor = new T.Mesh(new T.BoxGeometry(0.1, 0.012, 0.15), capM); visor.position.set(-0.26, 1.16, 0.37); co.add(visor);
    for (const dz of [0.17, -0.17]) { const arm = this.rod([-0.38, 0.98, 0.37 + dz * 1.2], [0.28, 0.86, 0.37 + dz], 0.035, jacket); co.add(arm); }
    // frecce: quattro angoli, lampeggiano prima dei cambi di corsia
    this.turnLights = [];
    for (const [x, z] of [[2.12, 0.74], [2.12, -0.74], [-2.18, 0.72], [-2.18, -0.72]]) {
      if (!this.blinkTex) this.blinkTex = this.carTex(32, 32, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
      const sp = new T.Sprite(new T.SpriteMaterial({ map: this.blinkTex, color: 0xffa020, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
      sp.scale.set(0.45, 0.3, 1); sp.position.set(x, 0.62, z); sp.visible = false; b.add(sp); this.turnLights.push({ sp, left: z < 0 });
    }
    this.baseParts = [...b.children, ...this.wheels];
    this.damage = 0;
  }

  // ---------------------------------------------------------------- abitacolo (guida a destra, come le JZA80 giapponesi)
  buildInterior() {
    const T = this.T, I = new T.Group(); I.visible = false; this.body.add(I); this.interior = I;
    // l'abitacolo è in ombra: colori smorzati e riflessi d'ambiente quasi spenti (niente cruscotto azzurrino)
    const mat = (c, o = {}) => { const m = new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, envMapIntensity: 0.15 }, o)); m.color.multiplyScalar(0.45); return m; };
    // plancia in materiale morbido goffrato (grana fine) invece di un colore piatto
    const grain = this.carTex(128, 128, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); for (let i = 0; i < 5000; i++) { const v = 100 + Math.random() * 60; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); } });
    grain.wrapS = grain.wrapT = T.RepeatWrapping; grain.repeat.set(6, 6);
    const dash = mat(0x121318, { bumpMap: grain, bumpScale: 0.004, roughness: 0.85 }), soft = mat(0x1a1717, { bumpMap: grain, bumpScale: 0.003 }), alu = mat(0x8a9099, { metalness: 0.9, roughness: 0.3 });
    const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0, parent = I) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o; };
    const twoSided = (c) => mat(c, { side: T.DoubleSide });
    add(new T.PlaneGeometry(2.0, 1.5), twoSided(0x0c0c0f), -0.1, 0.34, 0, -Math.PI / 2);                      // pavimento
    // pannelli porta: pelle con cuciture, tasca, altoparlante a rete; bracciolo imbottito, maniglia ad arco,
    // pulsantiera dei finestrini sul lato del pilota
    const doorTex = this.carTex(512, 160, (g, w, h) => {
      g.fillStyle = '#2a282c'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#353238'; g.fillRect(0, 18, w, 54);                                       // fascia imbottita
      g.strokeStyle = '#141316'; g.lineWidth = 2; for (const y of [18, 72]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.strokeStyle = '#7a2a22'; g.setLineDash([4, 3]); g.lineWidth = 1.2; for (const y of [22, 68]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.setLineDash([]); g.fillStyle = '#18171a'; g.fillRect(40, 112, 240, 34);                    // tasca
      const cx = 400, cy = 118; g.fillStyle = '#121114'; g.beginPath(); g.arc(cx, cy, 34, 0, 7); g.fill();
      g.fillStyle = '#26242a'; for (let yy = -30; yy <= 30; yy += 5) for (let xx = -30; xx <= 30; xx += 5) if (xx * xx + yy * yy < 900) g.fillRect(cx + xx, cy + yy, 2, 2);
      for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
    });
    for (const z of [0.83, -0.83]) {
      add(new T.PlaneGeometry(1.9, 0.56), mat(0xffffff, { map: doorTex, side: T.DoubleSide, roughness: 0.75 }), -0.05, 0.62, z, 0, z > 0 ? Math.PI : 0);
      const arm = new T.CapsuleGeometry(0.03, 0.9, 4, 10); arm.rotateZ(Math.PI / 2);
      add(arm, soft, -0.2, 0.74, z * 0.965);                                                          // bracciolo
      add(new T.BoxGeometry(0.14, 0.014, 0.02), mat(0x8a9099, { metalness: 0.9, roughness: 0.3 }), -0.02, 0.765, z * 0.945);   // maniglia di chiusura
      add(new T.BoxGeometry(0.06, 0.03, 0.02), alu, 0.35, 0.86, z * 0.95);                              // apriporta
      add(new T.CylinderGeometry(0.006, 0.006, 0.03, 8), alu, 0.45, 0.93, z * 0.93);                    // pomello della sicura
      if (z > 0) for (const dx of [-0.05, 0.0]) add(new T.BoxGeometry(0.035, 0.012, 0.02), mat(0x0c0c0e, { roughness: 0.4 }), -0.25 + dx, 0.825, z * 0.93);   // alzacristalli
    }
    // plancia: profilo curvo estruso (parabrezza → piano → bordo arrotondato → faccia inclinata verso le gambe)
    const prof = new T.Shape();
    prof.moveTo(0.98, 0.5); prof.lineTo(0.98, 0.885); prof.quadraticCurveTo(0.75, 0.925, 0.52, 0.918);
    prof.quadraticCurveTo(0.4, 0.915, 0.405, 0.86); prof.quadraticCurveTo(0.41, 0.76, 0.46, 0.62); prof.lineTo(0.62, 0.5); prof.lineTo(0.98, 0.5);
    const dg = new T.ExtrudeGeometry(prof, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.012, bevelSegments: 3, curveSegments: 14 });
    dg.translate(0, 0, -0.75);
    add(dg, dash, 0, 0, 0);
    // lato passeggero: cassetto portaoggetti, maniglia d'appiglio, bocchetta
    const gb = add(new T.PlaneGeometry(0.42, 0.13), mat(0x0a0a0c), 0.425, 0.74, -0.4, 0, -Math.PI / 2, 0); gb.rotation.order = 'YXZ'; gb.rotation.x = -0.25;
    const gb2 = add(new T.PlaneGeometry(0.4, 0.11), dash, 0.423, 0.74, -0.4, 0, -Math.PI / 2, 0); gb2.rotation.order = 'YXZ'; gb2.rotation.x = -0.25;
    add(new T.BoxGeometry(0.01, 0.012, 0.06), alu, 0.418, 0.79, -0.4);
    const grab = new T.TorusGeometry(0.07, 0.012, 8, 16, Math.PI); add(grab, soft, 0.41, 0.85, -0.55, 0, -Math.PI / 2, Math.PI);
    const hood = new T.CylinderGeometry(0.095, 0.095, 0.4, 20, 1, true, 0, Math.PI); hood.rotateX(Math.PI / 2);
    add(hood, dash, 0.47, 0.93, 0.37, 0, 0, 0).material.side = T.DoubleSide;
    this.clusterMat = new T.MeshBasicMaterial({ color: 0xffffff });
    this.clusterScreen = add(new T.PlaneGeometry(0.3, 0.11), this.clusterMat, 0.425, 0.935, 0.37, 0, -Math.PI / 2, 0);
    this.clusterScreen.rotation.order = 'YXZ'; this.clusterScreen.rotation.x = -0.25;
    add(new T.BoxGeometry(0.28, 0.36, 0.34), dash, 0.52, 0.66, 0);
    // autoradio: frontalino nero con display ciano e tasti
    const radioTex = this.carTex(256, 72, (g, w, h) => {
      g.fillStyle = '#0b0b0d'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#04161a'; g.fillRect(56, 10, 144, 30);
      g.fillStyle = '#3ff0ff'; g.font = '700 18px monospace'; g.textAlign = 'left'; g.fillText('FM 89.7', 64, 31);
      g.font = '12px monospace'; g.fillStyle = '#ff4fa0'; g.fillText('00:00', 152, 31);
      g.fillStyle = '#1e1f24'; for (let k = 0; k < 6; k++) g.fillRect(56 + k * 24, 48, 20, 12);
      g.fillStyle = '#9aa2ad'; g.font = '9px monospace'; for (let k = 0; k < 6; k++) g.fillText(String(k + 1), 63 + k * 24, 57);
      for (const x of [26, 230]) { g.fillStyle = '#26272c'; g.beginPath(); g.arc(x, 36, 18, 0, 7); g.fill(); g.fillStyle = '#4a4c54'; g.beginPath(); g.arc(x, 36, 12, 0, 7); g.fill(); }
    });
    add(new T.PlaneGeometry(0.22, 0.062), new T.MeshBasicMaterial({ map: radioTex, toneMapped: false, color: 0xb8b8b8 }), 0.362, 0.62, 0.02, 0, -Math.PI / 2 - 0.18, 0);
    for (const z of [-0.08, 0.08, -0.55, 0.62]) add(new T.BoxGeometry(0.02, 0.05, 0.1), alu, 0.43, 0.85, z);
    add(new T.BoxGeometry(0.95, 0.16, 0.24), dash, 0.02, 0.5, 0);
    // paratia e vano piedi: chiudono la vista sotto la plancia
    add(new T.BoxGeometry(0.42, 0.44, 1.6), dash, 0.68, 0.53, 0);
    add(new T.BoxGeometry(0.3, 0.2, 0.5), soft, 0.38, 0.66, 0.4, 0, 0, -0.5);
    // gambe del pilota
    const jeans = mat(0x1d2433, { roughness: 0.95 });
    for (const dz of [0.1, -0.1]) {
      add(new T.BoxGeometry(0.46, 0.13, 0.13), jeans, -0.1, 0.58, 0.37 + dz, 0, 0, 0.12);
      add(new T.BoxGeometry(0.12, 0.38, 0.12), jeans, 0.18, 0.46, 0.37 + dz, 0, 0, 0.55);
    }
    // leva del cambio (si sposta con la marcia)
    const sh = new T.Group(); sh.position.set(0.12, 0.58, 0); I.add(sh); this.shifter = sh;
    add(new T.CylinderGeometry(0.012, 0.014, 0.22, 8), alu, 0, 0.11, 0, 0, 0, 0, sh);
    add(new T.SphereGeometry(0.038, 14, 10), mat(0x0e0e10, { roughness: 0.35 }), 0, 0.23, 0, 0, 0, 0, sh);
    add(new T.CylinderGeometry(0.06, 0.08, 0.05, 12), soft, 0, 0.0, 0, 0, 0, 0, sh);
    // volante sportivo a tre razze: corona in pelle spessa, razze forate, fascia rossa a ore 12
    const tilt = new T.Group(); tilt.position.set(0.3, 0.795, 0.37); tilt.rotation.z = 0.42; I.add(tilt); this.wheelTilt = tilt;
    const wheel = new T.Group(); tilt.add(wheel); this.steerWheel = wheel;
    const leather = mat(0x1a1716, { roughness: 0.62 });
    const rim = new T.TorusGeometry(0.172, 0.023, 14, 64); rim.rotateY(Math.PI / 2);
    add(rim, leather, 0, 0, 0, 0, 0, 0, wheel);
    const stripe = new T.TorusGeometry(0.172, 0.0236, 12, 6, 0.16); stripe.rotateZ(Math.PI / 2 - 0.08); stripe.rotateY(Math.PI / 2);
    add(stripe, mat(0xd8261a, { roughness: 0.5 }), 0, 0, 0, 0, 0, 0, wheel);
    for (const a of [Math.PI, Math.PI / 2, -Math.PI / 2]) {
      const sp = add(new T.BoxGeometry(0.012, 0.15, 0.04), alu, -0.012, 0, 0, 0, 0, 0, wheel);
      sp.position.set(-0.012, Math.cos(a) * 0.09, Math.sin(a) * 0.09); sp.rotation.x = -a;
      for (const r of [0.06, 0.1]) add(new T.CylinderGeometry(0.007, 0.007, 0.014, 8), mat(0x050506), -0.012, Math.cos(a) * r, Math.sin(a) * r, 0, 0, Math.PI / 2, wheel);
    }
    const hubG = new T.CylinderGeometry(0.055, 0.06, 0.05, 20); hubG.rotateZ(Math.PI / 2);
    add(hubG, mat(0x141417, { roughness: 0.4 }), -0.025, 0, 0, 0, 0, 0, wheel);
    const horn = new T.CircleGeometry(0.036, 20); horn.rotateY(-Math.PI / 2);
    add(horn, mat(0x2a2a30, { metalness: 0.6, roughness: 0.3 }), -0.051, 0, 0, 0, 0, 0, wheel);
    const hornRing = new T.RingGeometry(0.036, 0.042, 24); hornRing.rotateY(-Math.PI / 2);
    add(hornRing, mat(0xd8261a), -0.051, 0, 0, 0, 0, 0, wheel);
    add(new T.CylinderGeometry(0.03, 0.035, 0.3, 10), dash, 0.45, 0.78, 0.37, 0, 0, Math.PI / 2 + 0.75);   // piantone
    // leve dietro al volante (frecce e tergicristalli)
    for (const dz of [0.1, -0.1]) add(new T.BoxGeometry(0.02, 0.016, 0.12), dash, 0.36, 0.84, 0.37 + dz * 1.4, 0, 0, 0);

    // mani umane: dorso arrotondato, quattro dita a tre falangi che si avvolgono sulla corona,
    // pollice a due falangi sul lato interno, nocche, polso; orologio al polso sinistro
    const skin = mat(0x6e4230, { roughness: 0.6, envMapIntensity: 0.02, emissive: 0x1c0a05 }), nail = mat(0x9a6e60, { roughness: 0.35 });
    const cap = (A, B, r, m, parent) => {
      const v = B.clone().sub(A), len = v.length();
      const g = new T.CapsuleGeometry(r, Math.max(0.001, len), 4, 10);
      const o = new T.Mesh(g, m); o.position.copy(A).add(B).multiplyScalar(0.5);
      o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize()); parent.add(o); return o;
    };
    const V = (x, y, z) => new T.Vector3(x, y, z);
    const makeHand = (mirror) => {
      const h = new T.Group();
      // dorso e palmo: ellissoide schiacciato dietro e fuori dalla corona
      // metacarpo fra nocche e polso: dorso (verso fuori) e palmo (verso la corona)
      const back = add(new T.SphereGeometry(1, 20, 14), skin, -0.079, -0.004, 0.041, 0, -0.25, 0, h);
      back.scale.set(0.038, 0.041, 0.014);
      const palm = add(new T.SphereGeometry(1, 16, 12), skin, -0.072, -0.006, 0.024, 0, -0.25, 0, h);
      palm.scale.set(0.034, 0.038, 0.014);
      const pad = add(new T.SphereGeometry(1, 12, 10), skin, -0.07, 0.022, 0.012, 0, 0, 0, h);   // eminenza del pollice
      pad.scale.set(0.024, 0.016, 0.014);
      // dita: articolazioni su un arco attorno al tubo della corona (raggio 0,024)
      const lens = [0.95, 1, 0.97, 0.8], rads = [0.0088, 0.0092, 0.009, 0.0078];
      h.userData.fingers = [];
      for (let i = 0; i < 4; i++) {
        const y = 0.031 - i * 0.0205, rr = 0.024 + rads[i] + 0.001, k = lens[i];
        const ph = [2.3, 1.35, 0.55 - 0.2 * (1 - k), -0.15 * k];
        const pts = ph.map((a, j) => V(Math.cos(a) * (rr + (j === 0 ? 0.008 : 0)), y - j * 0.0015, Math.sin(a) * (rr + (j === 0 ? 0.008 : 0))));
        pts[0].x -= 0.012;
        const f = new T.Group(); h.add(f); h.userData.fingers.push(f);
        for (let j = 0; j < 3; j++) cap(pts[j], pts[j + 1], rads[i] * (1 - j * 0.1), skin, f);
        const kn = add(new T.SphereGeometry(rads[i] * 1.15, 10, 8), skin, pts[0].x, pts[0].y, pts[0].z, 0, 0, 0, f);
        void kn;
        add(new T.SphereGeometry(rads[i] * 0.75, 8, 6), nail, pts[3].x, pts[3].y, pts[3].z, 0, 0, 0, f);
      }
      // pollice: dalla base del palmo gira sul lato interno della corona
      const t0 = V(-0.062, 0.028, 0.006), t1 = V(-0.038, 0.04, -0.022), t2 = V(-0.012, 0.042, -0.026);
      cap(t0, t1, 0.0098, skin, h); cap(t1, t2, 0.0088, skin, h);
      add(new T.SphereGeometry(0.0075, 8, 6), nail, t2.x, t2.y, t2.z, 0, 0, 0, h);
      // polso, polsino della giacca
      cap(V(-0.06, -0.004, 0.03), V(-0.115, -0.018, 0.05), 0.022, skin, h);
      const cf = cap(V(-0.112, -0.017, 0.05), V(-0.135, -0.022, 0.058), 0.033, mat(0x22252c, { roughness: 0.95 }), h);
      void cf;
      if (mirror) {   // orologio sulla sinistra
        cap(V(-0.098, -0.014, 0.046), V(-0.1, -0.014, 0.047), 0.025, mat(0x0b0b0c, { roughness: 0.6 }), h);
        add(new T.CylinderGeometry(0.014, 0.014, 0.006, 16), mat(0xc8ccd2, { metalness: 0.9, roughness: 0.25 }), -0.1, -0.014, 0.072, Math.PI / 2, 0, 0, h);
      }
      const wrist = new T.Object3D(); wrist.position.set(-0.13, -0.021, 0.056); h.add(wrist); h.userData.wrist = wrist;
      if (mirror) h.scale.z = -1;
      I.add(h); return h;
    };
    // le mani seguono il volante fino a ±45°, oltre scivolano sulla corona (come si fa davvero)
    const gripRot = new T.Group(); tilt.add(gripRot); this.gripRot = gripRot;
    // presa alle 10 e 10: le mani stanno 30° sopra l'orizzontale, più alte nell'inquadratura
    const grip = (z, parent, up = 0.52) => { const o = new T.Object3D(); const th = z > 0 ? -up : up; o.rotation.x = th; o.position.set(0, -z * Math.sin(th), z * Math.cos(th)); parent.add(o); return o; };
    this.hands = [
      { h: makeHand(false), rim: grip(0.172, gripRot), shoulder: new T.Vector3(-0.55, 0.9, 0.6) },          // destra (lato porta)
      { h: makeHand(true), rim: grip(-0.172, gripRot), shoulder: new T.Vector3(-0.55, 0.9, 0.14) },          // sinistra: cambia marcia
    ];
    const knobGrip = new T.Object3D(); knobGrip.position.set(-0.02, 0.27, 0.035); knobGrip.rotation.set(Math.PI / 2, 0.2, -1.2); sh.add(knobGrip);
    this.hands[1].knob = knobGrip;
    const sleeve = mat(0x22252c, { roughness: 0.95 });
    for (const hd of this.hands) {
      const cyl = (r0, r1) => { const g = new T.CylinderGeometry(r1, r0, 1, 12, 1, true); g.translate(0, 0.5, 0); const m = new T.Mesh(g, sleeve); m.material.side = T.DoubleSide; I.add(m); return m; };
      hd.upper = cyl(0.046, 0.042); hd.fore = cyl(0.041, 0.034);
      hd.elbow = add(new T.SphereGeometry(0.043, 12, 8), sleeve, 0, 0, 0);
    }
    this.shiftK = 0; this.shiftT = 1; this.lastGear = null;

    // sedili a guscio con fianchetti, poggiatesta e cuciture rosse
    for (const z of [0.37, -0.37]) {
      add(new T.BoxGeometry(0.5, 0.12, 0.48), soft, -0.28, 0.46, z);
      add(new T.BoxGeometry(0.12, 0.62, 0.48), soft, -0.56, 0.78, z, 0, 0, -0.22);
      for (const s of [1, -1]) add(new T.BoxGeometry(0.16, 0.5, 0.06), soft, -0.52, 0.76, z + s * 0.22, 0, 0, -0.22);   // fianchetti
      add(new T.BoxGeometry(0.1, 0.18, 0.28), soft, -0.66, 1.14, z, 0, 0, -0.22);
      add(new T.BoxGeometry(0.09, 0.5, 0.06), mat(0xc42a1a), -0.55, 0.8, z + 0.14, 0, 0, -0.22);            // cucitura rossa
    }
    // consolle centrale rivolta verso il pilota (cockpit avvolgente della JZA80): tre strumenti supplementari
    const stack = add(new T.BoxGeometry(0.06, 0.3, 0.36), dash, 0.395, 0.74, 0.03, 0, -0.18, 0);
    void stack;
    this.auxCanvas = document.createElement('canvas'); this.auxCanvas.width = 288; this.auxCanvas.height = 96;
    this.auxTex = new T.CanvasTexture(this.auxCanvas); this.auxTex.encoding = T.sRGBEncoding;
    const aux = add(new T.PlaneGeometry(0.27, 0.09), new T.MeshBasicMaterial({ map: this.auxTex, toneMapped: false }), 0.36, 0.84, 0.035, 0, -Math.PI / 2 - 0.18, 0);
    void aux;
    // clima: tre manopole, display e pulsante d'emergenza
    for (const dz of [-0.09, 0, 0.09]) {
      const k = new T.CylinderGeometry(0.02, 0.022, 0.025, 16); k.rotateZ(Math.PI / 2);
      add(k, alu, 0.358, 0.735, 0.03 + dz, 0, -0.18, 0);
    }
    add(new T.BoxGeometry(0.01, 0.022, 0.03), new T.MeshBasicMaterial({ color: 0xff3a22 }), 0.362, 0.775, 0.03, 0, -0.18, 0);
    this.auxGlow = add(new T.PlaneGeometry(0.1, 0.02), new T.MeshBasicMaterial({ color: 0xffa24a, toneMapped: false }), 0.362, 0.70, 0.03, 0, -Math.PI / 2 - 0.18, 0);
    // tessuto dei sedili: trama a coste con cuciture rosse; moquette; cuffia del cambio, freno a mano, bracciolo
    const fab = this.carTex(128, 128, (g, w, h) => {
      g.fillStyle = '#2a272b'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) { g.fillStyle = y % 16 ? '#232125' : '#2f2c31'; g.fillRect(0, y, w, 6); }
      for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
      g.strokeStyle = '#a3241b'; g.setLineDash([3, 2]); g.lineWidth = 1.5; for (const x of [18, w - 18]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    });
    fab.wrapS = fab.wrapT = T.RepeatWrapping;
    const fabM = mat(0xffffff, { map: fab, roughness: 0.95 });
    for (const z of [0.37, -0.37]) {
      add(new T.BoxGeometry(0.46, 0.02, 0.36), fabM, -0.28, 0.525, z);                                          // seduta
      add(new T.BoxGeometry(0.02, 0.5, 0.36), fabM, -0.495, 0.79, z, 0, 0, -0.22);                               // schienale
    }
    const carpet = this.carTex(64, 64, (g, w, h) => { g.fillStyle = '#121214'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); } });
    carpet.wrapS = carpet.wrapT = T.RepeatWrapping; carpet.repeat.set(6, 4);
    add(new T.PlaneGeometry(1.9, 1.4), mat(0xffffff, { map: carpet, roughness: 1 }), -0.1, 0.345, 0, -Math.PI / 2);
    add(new T.ConeGeometry(0.07, 0.12, 12, 1, true), mat(0x141214, { roughness: 0.55, side: T.DoubleSide }), 0.12, 0.64, 0);   // cuffia del cambio
    const hb = new T.Group(); hb.position.set(-0.15, 0.6, 0); hb.rotation.z = 0.35; I.add(hb);                // freno a mano
    add(new T.BoxGeometry(0.28, 0.03, 0.04), mat(0x18181b, { roughness: 0.5 }), 0.1, 0, 0, 0, 0, 0, hb);
    add(new T.BoxGeometry(0.08, 0.035, 0.045), mat(0x8a9099, { metalness: 0.9, roughness: 0.3 }), 0.24, 0.002, 0, 0, 0, 0, hb);
    add(new T.BoxGeometry(0.34, 0.08, 0.18), fabM, -0.42, 0.68, 0);                                            // bracciolo centrale
    // bocchette della plancia con alette
    for (const z of [-0.08, 0.08, -0.55, 0.62]) for (let k = 0; k < 4; k++) add(new T.BoxGeometry(0.004, 0.006, 0.09), mat(0x050506), 0.42, 0.835 + k * 0.011, z);
    // pedaliera, alette parasole, maniglie, altoparlanti e pulsantiere nelle porte
    for (const [dz, w] of [[0.48, 0.07], [0.37, 0.09], [0.26, 0.05]]) add(new T.BoxGeometry(0.02, 0.1, w), alu, 0.5, 0.45, dz, 0, 0, -0.4);
    for (const z of [0.36, -0.36]) add(new T.BoxGeometry(0.16, 0.008, 0.32), mat(0x34323a, { roughness: 1 }), 0.02, 1.238, z, 0, 0, 0);
    for (const z of [0.81, -0.81]) {
      const sp = new T.CircleGeometry(0.06, 20); add(sp, mat(0x070708, { roughness: 0.9 }), 0.25, 0.48, z, 0, z > 0 ? Math.PI : 0, 0);
      add(new T.BoxGeometry(0.12, 0.02, 0.05), dash, 0.05, 0.82, z * 0.95);
      add(new T.BoxGeometry(0.04, 0.01, 0.02), mat(0x8899aa), 0.04, 0.835, z * 0.94);
    }
    add(new T.PlaneGeometry(1.14, 1.5), twoSided(0x34323a), -0.33, 1.245, 0, Math.PI / 2);                    // cielo in tessuto: finisce dove inizia il parabrezza
    // parabrezza visto da dentro: vetro appena riflettente con fascia scura antiriflesso in alto
    const tint = this.carTex(16, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(10,30,60,.75)'); gr.addColorStop(0.22, 'rgba(10,30,60,.35)'); gr.addColorStop(0.3, 'rgba(10,30,60,0)'); gr.addColorStop(1, 'rgba(10,30,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const wsLen = Math.hypot(0.98 - 0.26, 1.24 - 0.89), ws = new T.PlaneGeometry(1.42, wsLen);
    const wsM = new T.MeshPhysicalMaterial({ map: tint, transparent: true, opacity: 1, roughness: 0.02, metalness: 0, envMapIntensity: 0.35, depthWrite: false, side: T.DoubleSide, color: 0xffffff });
    const wsMesh = add(ws, wsM, (0.98 + 0.26) / 2, (0.89 + 1.24) / 2, 0, 0, -Math.PI / 2, 0); wsMesh.rotation.order = 'YXZ'; wsMesh.rotation.x = Math.atan2(0.98 - 0.26, 1.24 - 0.89);
    // bocchetta del disappannamento alla base del parabrezza
    for (let k = -6; k <= 6; k++) add(new T.BoxGeometry(0.05, 0.004, 0.06), mat(0x040405), 0.86, 0.918, k * 0.1);
    // cuciture sulla palpebra del quadro
    add(new T.TorusGeometry(0.095, 0.0025, 4, 24, Math.PI), mat(0x4a1410), 0.47, 0.93, 0.37, Math.PI / 2, 0, 0).rotation.set(0, Math.PI / 2, 0);
    // rivestimento interno dei montanti A (scuri, non color carrozzeria) e traversa sopra il parabrezza
    for (const z of [1, -1]) I.add(this.rod([0.98, 0.9, z * 0.76], [0.24, 1.24, z * 0.68], 0.05, mat(0x2a282c, { roughness: 0.9 })));
    I.add(this.rod([0.24, 1.24, 0.7], [0.24, 1.24, -0.7], 0.03, mat(0x2a282c, { roughness: 0.9 })));
    // luce del quadro: i quadranti arancio illuminano mani e volante di notte
    this.dashLight = new T.PointLight(0xff8a3a, 0.5, 0.6, 2); this.dashLight.position.set(0.4, 0.92, 0.37); I.add(this.dashLight);

    // specchietto retrovisore vero: un'altra telecamera guarda indietro e disegna su una texture
    add(new T.BoxGeometry(0.04, 0.075, 0.27), dash, 0.38, 1.17, 0);
    this.mirrorRT = new T.WebGLRenderTarget(320, 96);
    const mg = new T.PlaneGeometry(0.25, 0.064); const uv = mg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));                                            // immagine speculare
    this.mirror = add(mg, new T.MeshBasicMaterial({ map: this.mirrorRT.texture, toneMapped: false }), 0.358, 1.17, 0, 0, -Math.PI / 2, 0);
    this.mirrorCam = new T.PerspectiveCamera(22, 320 / 96, 0.3, 300);
    this.mirrorCam.position.set(0.33, 1.17, 0); this.mirrorCam.lookAt(-10, 1.05, 0); I.add(this.mirrorCam);
    add(new T.CylinderGeometry(0.008, 0.008, 0.06, 6), dash, 0.39, 1.22, 0);
    // portafortuna omamori appeso allo specchietto: oscilla con accelerazioni, frenate e cambi corsia
    const charm = new T.Group(); charm.position.set(0.37, 1.13, -0.08); I.add(charm); this.charm = charm;
    add(new T.CylinderGeometry(0.0015, 0.0015, 0.09, 4), mat(0xd8b040), 0, -0.045, 0, 0, 0, 0, charm);
    add(new T.BoxGeometry(0.008, 0.045, 0.028), mat(0xc0201a, { roughness: 0.6 }), 0, -0.115, 0, 0, 0, 0, charm);
    add(new T.BoxGeometry(0.009, 0.012, 0.025), mat(0xe8c050, { metalness: 0.6, roughness: 0.4 }), 0, -0.1, 0, 0, 0, 0, charm);
    this.charmS = { a: 0, va: 0, b: 0, vb: 0, prev: 0 };
  }

  // strumenti supplementari (pressione e temperatura olio, voltmetro) disegnati a lancette
  drawAux(s) {
    const c = this.auxCanvas.getContext('2d'), W = 96;
    c.fillStyle = '#050506'; c.fillRect(0, 0, 288, 96);
    const rpm = s.rpm || 0, vals = [s.running ? Math.min(1, 0.25 + rpm / 9000) : 0, s.running ? 0.55 + Math.min(0.15, rpm / 60000) : 0.1, s.running ? 0.72 : s.ign ? 0.6 : 0];
    ['OIL', 'TEMP', 'VOLT'].forEach((lab, i) => {
      const cx = W * i + 48, cy = 50;
      c.fillStyle = '#0c0c0f'; c.beginPath(); c.arc(cx, cy, 42, 0, 7); c.fill();
      c.strokeStyle = '#8b8f98'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, 42, 0, 7); c.stroke();
      c.strokeStyle = '#ff9a3a'; c.lineWidth = 2;
      for (let k = 0; k <= 8; k++) { const a = Math.PI * (0.8 + k * 0.175); c.beginPath(); c.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30); c.lineTo(cx + Math.cos(a) * 37, cy + Math.sin(a) * 37); c.stroke(); }
      c.fillStyle = '#ffb36a'; c.font = 'bold 13px monospace'; c.textAlign = 'center'; c.fillText(lab, cx, cy + 26);
      const a = Math.PI * (0.8 + vals[i] * 1.4);
      c.strokeStyle = '#ff3a22'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34); c.stroke();
      c.fillStyle = '#222'; c.beginPath(); c.arc(cx, cy, 5, 0, 7); c.fill();
    });
    this.auxTex.needsUpdate = true;
  }

  // braccia: cinematica inversa a due segmenti (spalla, gomito, polso), gomito verso il basso e in fuori
  updateHands(dt, s) {
    if (!this.hands) return;
    const T = this.T, I = this.interior;
    if (this.lastGear !== null && s.gear !== this.lastGear && this.shiftT >= 1) this.shiftT = 0;
    this.lastGear = s.gear;
    this.shiftT = Math.min(1, this.shiftT + dt / 0.75);
    const e = (x) => x * x * (3 - 2 * x), t = this.shiftT;
    this.shiftK = t >= 1 ? 0 : t < 0.35 ? e(t / 0.35) : t < 0.6 ? 1 : e((1 - t) / 0.4);
    I.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(I.matrixWorld).invert(), m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3();
    const local = (o) => { m.multiplyMatrices(inv, o.matrixWorld); m.decompose(p, q, sc); return [p.clone(), q.clone()]; };
    const up = new T.Vector3(0, 1, 0), L1 = 0.31, L2 = 0.3;
    this.hands.forEach((hd, i) => {
      const [pr, qr] = local(hd.rim);
      let pos = pr, rot = qr;
      if (hd.knob && this.shiftK > 0) {
        const [pk, qk] = local(hd.knob), k = this.shiftK;
        pos = pr.clone().lerp(pk, k); rot = qr.clone().slerp(qk, k);
        pos.y += Math.sin(Math.PI * k) * 0.05; pos.x -= Math.sin(Math.PI * k) * 0.04;   // arco: la mano si alza e arretra a metà strada
      }
      // vibrazione della strada che arriva al volante
      pos.y += Math.sin((this.state.t || 0) * 37 + i * 2) * Math.min(0.0012, Math.abs(s.v || 0) * 0.00003);
      hd.h.position.copy(pos); hd.h.quaternion.copy(rot);
      hd.h.updateMatrixWorld(true);
      const [w] = local(hd.h.userData.wrist), S = hd.shoulder;
      const dir = w.clone().sub(S); let d = dir.length(); dir.normalize(); d = Math.min(d, L1 + L2 - 0.001);
      const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), hgt = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      const pole = new T.Vector3(-0.2, -1, i === 0 ? 0.55 : -0.35);
      pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
      const el = S.clone().add(dir.clone().multiplyScalar(a)).add(pole.multiplyScalar(hgt));
      const seg = (mesh, A, B) => { const v = B.clone().sub(A); mesh.position.copy(A); mesh.quaternion.setFromUnitVectors(up, v.clone().normalize()); mesh.scale.set(1, v.length(), 1); };
      seg(hd.upper, S, el); seg(hd.fore, el, w); hd.elbow.position.copy(el);
    });
  }

  // lo specchietto si ridisegna solo dall'abitacolo, un fotogramma su due
  renderMirror() {
    if (!this.mirrorRT || !this.cockpitOn || (this.mf = (this.mf || 0) + 1) % 2) return;
    const r = this.renderer, prev = r.getRenderTarget();
    this.mirror.visible = false; this.interior.visible = false;
    r.setRenderTarget(this.mirrorRT); r.render(this.scene, this.mirrorCam); r.setRenderTarget(prev);
    this.mirror.visible = true; this.interior.visible = this.cockpitOn;
  }
  // dall'abitacolo si vedono solo interni e cofano: la scocca esterna (tetto, montanti, specchietti) si nasconde
  setCabinView(on) {
    if (!this.body) return;
    if (this.interior) this.interior.visible = on;
    this.body.children.forEach((c) => {
      if (c === this.interior || c.isLight) return;
      if (c === this.hoodOnly) { c.visible = on; return; }
      if (on) { if (c.visible) { c.userData.cabinHid = true; c.visible = false; } }
      else if (c.userData.cabinHid) { c.visible = true; c.userData.cabinHid = false; }
    });
  }

  // il quadro strumenti del gioco disegnato sul cruscotto
  setCluster(canvas) {
    const T = this.T;
    this.clusterTex = new T.CanvasTexture(canvas); this.clusterTex.encoding = T.sRGBEncoding;
    this.clusterMat.map = this.clusterTex; this.clusterMat.needsUpdate = true;
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
    if (this.hoodOnly) { this.hoodOnly.visible = false; if (this.cockpitOn) this.setCabinView(true); }
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
    // abitacolo: volante, leva del cambio, quadro aggiornato
    if (this.steerWheel) {
      const wr = Math.max(-2.4, Math.min(2.4, (s.steer || 0) * 3.2));   // sterzo a sinistra = volante in senso antiorario per chi guida
      this.steerWheel.rotation.x = wr; if (this.gripRot) this.gripRot.rotation.x = Math.max(-0.6, Math.min(0.6, wr));
    }
    if (this.shifter) {
      const pos = { '-1': [-0.06, 0.07], 0: [0, 0], 1: [0.06, 0.07], 2: [-0.06, 0.07], 3: [0.06, 0], 4: [-0.06, 0], 5: [0.06, -0.07], 6: [-0.06, -0.07] }[s.gear ?? 0] || [0, 0];
      this.shifter.position.x += (0.12 + pos[0] - this.shifter.position.x) * Math.min(1, dt * 18);
      this.shifter.position.z += (pos[1] - this.shifter.position.z) * Math.min(1, dt * 18);
    }
    if (this.clusterTex && this.cockpitOn && (this.cf = (this.cf || 0) + 1) % 2 === 0) this.clusterTex.needsUpdate = true;
    this.updateHands(dt, s);
    if (this.charm) {
      const c = this.charmS, k = Math.min(dt, 0.05), steer = s.steer || 0, lat = (steer - c.prev) / Math.max(k, 1e-3) * Math.abs(s.v || 0) * 0.4; c.prev = steer;
      c.va += (-40 * Math.sin(c.a) - 1.2 * c.va + lat * 2) * k; c.a += c.va * k;                       // di lato
      c.vb += (-40 * Math.sin(c.b) - 1.2 * c.vb + (s.acc || 0) * 4 + (Math.random() - 0.5) * Math.abs(s.v || 0) * 0.3) * k; c.b += c.vb * k;   // avanti e indietro
      this.charm.rotation.set(c.a, 0, c.b);
    }
    if (this.cockpitOn) {
      if (this.cf % 6 === 0) this.drawAux(s);
      this.dashLight.intensity = s.ign ? 0.5 : 0.05;
    }
    // frecce
    const bl = s.signal && Math.floor(st.t * 3) % 2 === 0;
    (this.turnLights || []).forEach((b) => { b.sp.visible = !!(bl && (s.signal === 'L') === b.left); });
    if (this.beforeRender) this.beforeRender(dt, s);
    if (this.controls.enabled) this.controls.update();
    if (this.visible) { this.renderMirror(); this.draw(); }
  }
}
