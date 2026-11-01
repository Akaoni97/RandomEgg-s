// 2JZ Night Run — intro con "Redline at Midnight" di sottofondo.
// Scena in pixel art (320×180, ingrandita a pixel netti) che pulsa sui bassi della canzone:
// città di notte, strada in prospettiva, lampioni, traffico, la Supra JZA80 vista da dietro
// con i quattro fanali tondi e l'alettone ad arco. I titoli sono HTML sopra la tela.
// Il ritmo viene da un inviluppo dei bassi calcolato in anticipo (20 valori al secondo), così
// funziona anche aprendo il file in locale, dove Web Audio non può analizzare l'mp3.
//
// Scaletta legata alla canzone: 0–4,5 s città e orologio che scatta a mezzanotte; 4,6 s entra la
// cassa e parte la corsa, arriva la Supra; 10,5 s crescendo; 12 s titolo; 14 s menu.

/* global window, document, Audio */
(function () {
  const ENV = '0732110000100063100006421111000000384131152110100000655842211100000161101000100000000191A6341035119834211192OSOPPQOQMPGNGJI732228RKLLJMJLLKJKNSIIIGGF74225AOSLPINURPLD43OYNKKJLE742233ONMNOLNNMKOSIRM8721GVMQbfOCNJCPOQs_sNIOMPPSTdmRNQMH97dfZWk_sWSMRUSd_xL5333211111112HYbd_xTPPTJNPPNRPJ52101b_-SLKHIA66FLTuvdI854212ezoKGDDCZLIKKKHIKK8AERPJGGHGFIWRBVr_ZK7434Dl_nB424642211143ESWal_nK932PLONG5553224Cl_nGMHJKFIIOPe-qQJHJKPHKp-lKIKIIIg_yQKNLOI9GTJKOJHJHHPYI9ct-OA2114Ow_a9545422354MRKLIXbv-dLA29NMMOG6442222Nv_aDKJIFGILMQlvbNFKFLIEUzyQGEHEDFn_qPQQRQNQUgaOB42125VXVWkxqQRPSPSc__K7345322331164QVobypRRNDETRPQQF952243az_UMQFJG86HMUtweH65ELFFbrrHEBBABQvzgQQPPOPBKPINDCDBCFTLDTq_aD3210Cn_pC4344631268DA9GBGKC8652276667565222323549F55866655D6434224521421233421h_qWQUUWPMCakdGHJJJJOSPGaooQOA564KvybHEFHDDDBBCA98DTWQs-eI65POLML8AA32332Ou_ZMHIJHHJMMSmzkLJIKCCDQtwWIHGHFIn-sJMONPF8IWLNILJHHJWQONi_nG82322X_xMHEGFCDCCABA86QReb-uNA41DQOMM9D833222a_yJOLMKILNQTXsxXLIOLMLIe_qQKJKIEQtyaLQMROQRSWJOFJIGHKYSKPkuQ74244Cn_oC42C6343338VPRPFPj-jMG63NNMMKGE62244Cj_iLE9A9ABFKIdwrG628JKJLo_mJCBDABg_-ULQTQRRDVRILKIKIKMUOFaovM85332Lx-ZIDHHCDCDABIKFJRgWprWFE98DJGHEEB324443522Tn_ZFEGHFKGHCB65NqzgERdeFBCBB411000000000000000000000000000000000000000111110000001JEA5333343332EGC64333333329HD943443434324221111111111Sz_eMLKMNMRVbbONMNA7IeYbWt-bTSMRTVo_lE5133422211055OYWl_rQTQRJPNRPROG6214Dn_iSNKGHC59HJf_vVB85443Eq-eFFDBIYg_xPGGJHF78IbSICDBECLRJ9eryPF9343Oz_c763431022ANUHJILVy_fNG8ANMMLJ7542433P-_bDULLJLJLONm_nB639PGETv_VDBABBGt_lMQMRQNSUdhNB93345YWUXi_vTVSTXSb_zL5333223423432KVTh_vTRH9GUPOMNGB54433a_yQNQGKGD9HLTuuhMGBBJDGf-uQHHJFFTxzjOQPQNPHLVQQJHIFHHVOEWr_bF3233Bl_nB444433443EcLSLSZk_pMHGDPLLNLG8521211453Lg_qLKKIKLevzK7333322112532221e-tURTSWQREZkeGHJHJINRQEdrrRO9554Kv-bIDFGCDCABB9A8CUUPtzcI65POLMLAAB32333Py_bMHGIIGJNMUn-iMKHLEDDRqyYJGIFFIm_rLJONND8HVJLIKIGHJUSNMl-rJ72322W__MGDGGDCBC9AA75QSYe_wMA41ESPOM7D633222d_xJOLKLIKMQRVqxXKJPMPLJg-qSJKLJDRu-ZMQMRNOQRXKOFJHHHLZSJPmxR74145Cn_mC31D6453327VQSOGQkyhLF63OOOMLGD84442Cl_lNDA999BGLKczuI528IMJMq_lICBCABe_-SLPRQPQCTQIKKIKIJOVMEcptM74343KwyaIDHJDDBDABILEJRhZqsXFD96DIGHEEA313233522Sm_aFFGHGJFIBA64Or-dESefFACB7521421111110011010000000332212511111110011111111000001YwuTMFGEFDGNGCIMHI95hQaYNJAJGF8FGPA9321100000000008STOJRSSRRLMRNPPQP821003QVRKOHHD62101BTPLC732217GEFCECBRReLSPJGEFECLLCGGQJG8AnSaNNGAHF788CQYcXWMRRVMTJPOPIJJGD95211000000000000000000000000000000000000000000000000KuybNJFGFEDNIAKGNL97acZcRJFHHG7CGQEA533222122233334MSRKSSPTRRJPORQSOG53222NWOQNLGHA53227RQOE854445GGGDCFAHVcRPSOEFFEDFOGDKPHMA7kRZUMIAHDC6AAKYaTXJPSOMMONMKJGHGFLMIA521111111431212111223G5JOB95656565545534322322232AOI8432INH94223232225OL87222112112JQAA32BC311000000001d_sWQUSXPLEXpeGGKJKKMUPFdrpRO9464Mx-bJDFIDDCBBC997DTVSu_fJ75PNLMK79B32233Qv_bLHIGJGJLKRl_lNKIKDDDStxWIGHEFJj_sLLNOOIAFUKMJJJHHKSPNLo_qH62322a_zNGDGFCCBB9A975PVdezuN941ERNMN8C733222e_yIOKMIILMQPVqxXLIOMPMLg_qPKJMIEPuyZMPLROPRRVJPFJJGHKYRKTnxQ74134Bp_pD43C8333329VRSPGQm-jMF63OOOMLFD83233Cp_nNEA999BFLLaxtI628HMKMo_mJCBDABc_zSLQSQQTDTRIMLKLIJNVPEbnvN74342Mz_bJDGHCDCDACIKFKSharuYFEB7DHGHDCB423342421Sm_aFEGIFKGHBA64PsxeDTffGBDB88OM9833332214462000112444343333333MPA922451001515446F3KKA7214NJ9734521111235533655200H5EMH9611644ENHA6433I3ENGB533333235641211213544433333324OM873363222531111BC21000000000000000000000000000000000000000000000000000000000000000000000000|0L743322233233SG53343G753332232333BJ73539SB443322223D7FG84433322222BT63352324332323335E3M95632GO77ND677466J9eYPRRRQQPQIRNZLB7986FUPQQNPNOOOMNaZOMMKOaHCAABDSTORRQcVROF43bbSUTQaNBKIFA9VSRSUTUTSPWXPcOCB43VbSXlfPHXSKXOg__gPMRUSSVilijTTNHDJoeanzxlYVQWaX_zoFALVRI86787545Sbaz_pSRUWLQTRQUgM73234zztQONNMB5FLJp-pdMA7XA67xxkOVTPMYOQTQPKLLSKJRTeWUSPRMTbXKv_wWOJIDIg-xeDI8YPQJF756KMQgalzykRB37ZTTQOAYPHC8Hf-zdKXUPTPOWYRzzlSVNZcYPk-wbPaVRKJ__sPMSSSOBOeViVQMMWSZYQI_zqSPH749o_uUFIGcL8AFSNZZQXZbxztbQI4FRXTXOUOMHHIGn-vSJYOSVSPURh_sWNQMdWRKt_vWPKSUWf_-kWZYXZWZkqbgRFA89HeXUnzwkUYUZYXz_uHLJWQLD9E889QLZcjvwmUWXHRbZVZUaRMIDKDxzwUYXMPULJOMs_oaFOGeXOQwqkKVROIHo_teWXSSRaKcVbaSMSMIRaYOu-vWULG74a__kHEAYHKB69UQQJGTRdaLHDKICOKEDLEaNHFEB7DRLVXJIPJJOGCYQNKG8RMP89G97EKLM96__qdedafcVWpkoaaZRWbcUQQxvmXYOHNOi_rZRQNjYNIDEPNHHRehrytgPGEYYWVTEXePILLGpyuSTdZaVNTgbk_veNRZhWMLs_sXPLMOTh_viNORTaRLbiaoZYTKLSjZPl_xhUYSNLNt_rMQHXbWOGEBCK97bghz-pUF87UdYUUEeXNLEBAx_qFaeYZVVbeZsysYYSQlaWT_-kZSRSbSszudXUTZeYYobbgVTTMRffXSpyuZMNBGKa__eHLDcXOTLLIGYTUeWhxxhUL99UTSSOLhSJEILbzyfVVPMLIIPaU-vnII8TdZWfy_eaXRTQJ__tSRUbebaRgWiYVNPfWcXSPyxqaNMIHBj_rWQRQjUSPMCCTRLQeppvuXNJERWVOUMZcH8FGCCVNJtvuWMKQbbfeTMRRMqztcRdcaaVUSJ744222212322322343222122233421100000100035666778766754eHCB988898978ZKDAA88899988UQD9756BDA9A99aC75765533477s_xfWURTaVXigiYUYQLFUlhfv_tabXQWbk-ygIB2XINNHD495HKXZjy-lTZVUUVSYTUgMJ35Ke_whVVNLNPHNNH__pUF7SMHCd-vWHPRKNX_-rKOMPQM9IRchVMHGONXbLE_wpSHB7MFq_uUARQbF42DIHYXMQSMt_wdRLJOTRSUOUTIBBPGp_xUJcOWWVOSSj_xb9OObWJKq-wURMHINc_zgSYVaXXZjnfdMQHEOGlZYszzoadZWdby-rKNNYSMEBJEANF9dca__qWXOHSZTUTPcPCAIMIyztUWVLRVPLTMpzlbPUNfXQP_-oTWRVNJt_sdQWUXRRHUfcaUPSNLQbUHu-xZXQLKEY-wb9EPcQJJDMBRfPRZYj-_gQSNJWSQWTPXF86887GVNjyyjOWUQXS-vsLONUPNE7326RLFEHC_-oYZYXjcbZokqedXSUacURNzznYZNGPNi_sYTTMhXNJDFMJILPggqzsdQGGYcXaSFWfPKMKKq_wSRZWVSOShdj_waQRXlWOLrzsZRKNOTg_xgOMRUYSMcfUkWUTKLRjZOj_wjTZSSSNs_tNNHYdZMFEBBH87bee__sTG87XeaWTEdSLNFC9__pFZbWWVSZdYoxqXYURnbbT_zkWRRTYRv-weWURZdYXlbaeWURMOehWRo_vWMMCGMc-zeDGBeWRZRMGGbVYcZm-whWK99VUTSQLgUPJIGb_ydSSPPMHJRZTzzpJF9TdfZi_-dXYXTPJ__tSRSYfbZPeWhaWNQYVbYOQ_znVNMKHCj_qXSPTpWSNKCCPSKRentysXNIGPRUOUMYaJ8FCADULKrvvXNLNaafbSMSSOpztbNfccYVTRIA85A32111332287591100011322648821111220099B96777766754uvlPRJNKNINWMGLOHI75nSYQKJDIFD8FGO8832110000000000EUTQMTUUTTOOTRTSUP831006WXUNRLLF52102IURLB53211CKIIFHHDTUlRSRLMJMLHSTGMHTJE7DsUUJJGBGE798DPUVPPILLOHMGIJJEEFCA73110000000000000000000000000000000000000000000000001jvrXQLMNNKIXODOJOLA7jbZUOJGIHGADHQEB86665656768A99ISSUOWTSYVUPSUWVVSGHB878TXTXUOLMB7667DUSQICDAEEEQPQNLOISXkbPUTLOPMLNXNJQTKNA9rTXOIHBGCB7AANTUMPGJMLGIHHHGEDDDDVSIFA66568768PJ998A79899AOAWSHHEHGLILHJISJCECB8A888BAMWMA89AUSHD866765556GYOCC665666567WUDE97XaA42111111003__oaZaYgdSbnopbdZQVZbYPO-znYZMHOQn_tcUROlSKJEGRKFCRffs_tfSHFXbWVSDTgSLFGKs_vTRXbXVOTgZk_wfQQYjXNLs_sXPKNLPgxwhPOPWcVLYfWoWTTLLReVOj_yiRUQUKNx_sNPHYcYOGDBBE87ang_zqSF87XdXTTFcVKLEA9_-qEZbYWVTYeWpwrZbVPlcXV_zkWQQTXRqzucVTRafZYmabgWUSMPbgUSv_uXPNBFIa_-gIJEdcNNQNIHZWUeVm_wiWK88VUTRQIhUNGGJd_-eTVQNNIIQZVxxoJH8TbdViy_dVSSWQJ-_sRRSafdbPeXicUPQYSdYQQ-ypXOMJIBn_sYSRQlUSOLDDSRKSgosyrVNJIPVSOUMVbJ9FFEBOIJsvuXNLObbgbQLSQLp_tcOfdbeaXTKIWOBC54544448DU721436AHNHABDA8979EbTCC54NP632272977AL5WNDA22KaRFLJLRC9876IJJF77BA9322P5QQJEA22TC7PQID9655P4QRGE7554GK76KQJ9LIHE69NKD78766555CaOCCBEUHMPMG96544II84333211000000003221000000000000000000000001000000000000000000000000000000';
  const W = 320, H = 180, HOR = 98;
  const A64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
  const dec = (s) => Array.from(s, (c) => A64.indexOf(c) / 63);
  const [LOW, ALL] = ENV.split('|').map(dec);
  const T_KICK = 4.6, T_TITLE = 12.0, T_MENU = 14.0;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

  class Intro {
    constructor(root, opts = {}) {
      this.root = root; this.opts = opts;
      this.cv = root.querySelector('canvas'); this.cv.width = W; this.cv.height = H;
      this.c = this.cv.getContext('2d'); this.c.imageSmoothingEnabled = false;
      this.audio = new Audio(opts.src); this.audio.loop = true; this.audio.preload = 'auto'; this.audio.volume = 0.8;
      this.state = 'wait';           // wait → play → menu → done
      this.t0 = performance.now(); this.muted = false; this.flash = 0; this.shake = 0;
      this.z = 0; this.speed = 0; this.kickPrev = 0; this.flame = 0; this.carY = 1;
      this.rnd = (() => { let s = 20260; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
      this.buildCity();
      this.traffic = Array.from({ length: 5 }, (_, i) => ({ z: 20 + i * 18, lane: i % 2 ? -1 : 1, oncoming: i % 2 === 1 }));
      this.active = true;
      const loop = () => { if (!this.active) return; this.frame(); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }

    // --------------------------------------------------------------- controlli
    start() {
      if (this.state !== 'wait') return;
      this.state = 'play'; this.root.classList.add('playing');
      this.audio.currentTime = 0;
      const p = this.audio.play(); if (p && p.catch) p.catch(() => {});
    }
    skip() { if (this.state === 'wait') this.start(); if (this.audio.currentTime < T_MENU) this.audio.currentTime = T_MENU; this.toMenu(); }
    toMenu() { if (this.state === 'menu' || this.state === 'done') return; this.state = 'menu'; this.root.classList.add('title', 'menu'); }
    advance() { if (this.state === 'wait') this.start(); else if (this.state === 'play') this.skip(); else if (this.state === 'menu') this.opts.onGo?.(); }
    mute(m = !this.muted) { this.muted = m; this.audio.muted = m; this.root.classList.toggle('muted', m); }
    // si entra in gioco: la musica sfuma e la scena si chiude
    finish() {
      if (this.state === 'done') return;
      this.state = 'done'; this.root.classList.add('out');
      const a = this.audio, v0 = a.volume, t0 = performance.now();
      const fade = () => { const k = (performance.now() - t0) / 2200; if (k >= 1) { a.pause(); a.volume = v0; return; } a.volume = v0 * (1 - k) * (1 - k); requestAnimationFrame(fade); };
      fade();
      setTimeout(() => { this.active = false; this.root.hidden = true; }, 900);
    }

    // --------------------------------------------------------------- città
    buildCity() {
      const r = this.rnd;
      this.layers = [0, 1].map((L) => {
        const b = []; let x = -40;
        while (x < W + 40) {
          const w = 14 + Math.floor(r() * (L ? 26 : 20)), h = (L ? 34 : 22) + Math.floor(r() * (L ? 52 : 34));
          const wins = []; for (let yy = 4; yy < h - 3; yy += 4) for (let xx = 3; xx < w - 3; xx += 4) if (r() < 0.5) wins.push([xx, yy, r() < 0.12 ? 1 : 0, r()]);
          b.push({ x, w, h, wins, neon: L && r() < 0.35 ? { y: 6 + Math.floor(r() * (h - 16)), c: r() < 0.5 ? '#ff2e88' : '#2ee6ff', ph: r() * 6 } : null, ant: r() < 0.25 });
          x += w + (L ? 2 : 1) + Math.floor(r() * 4);
        }
        return b;
      });
      this.stars = Array.from({ length: 60 }, () => [r() * W, r() * (HOR - 40), r()]);
    }

    env(t) {
      const i = Math.floor(t * 20), f = t * 20 - i;
      const g = (a) => (a[i] ?? 0) * (1 - f) + (a[i + 1] ?? 0) * f;
      return { low: g(LOW), all: g(ALL) };
    }

    // --------------------------------------------------------------- fotogramma
    frame() {
      const now = performance.now(), dt = Math.min(0.05, (now - (this.prev || now)) / 1000); this.prev = now;
      const playing = this.state !== 'wait';
      const T = playing ? this.audio.currentTime || 0 : 0;
      const e = playing ? this.env(T) : { low: 0.12 + Math.sin(now / 900) * 0.05, all: 0.1 };
      // colpi di cassa: salita rapida del basso
      const kick = e.low - this.kickPrev > 0.18 && e.low > 0.5; this.kickPrev = this.kickPrev * 0.6 + e.low * 0.4;
      if (kick && T > T_KICK) { this.flash = Math.max(this.flash, 0.22); this.flame = 1; this.shake = 0.6; }
      if (playing && T >= T_TITLE && !this.root.classList.contains('title')) { this.root.classList.add('title'); this.flash = 1; this.shake = 1.4; }
      if (this.state === 'play' && T >= T_MENU) this.toMenu();
      this.flash = Math.max(0, this.flash - dt * 2.2); this.flame = Math.max(0, this.flame - dt * 5); this.shake = Math.max(0, this.shake - dt * 3);
      // velocità: quasi ferma prima della cassa, corsa dopo, spinta nel crescendo
      const run = playing ? ease((T - T_KICK + 0.3) / 1.6) : 0, build = playing ? ease((T - 10.3) / 1.7) : 0;
      const tgt = 1.5 + run * (14 + e.low * 10) + build * 8;
      this.speed += (tgt - this.speed) * Math.min(1, dt * 2.5);
      this.z += this.speed * dt;
      this.carY += ((playing && T > T_KICK + 0.2 ? 0 : 1) - this.carY) * Math.min(1, dt * 2.2);
      this.rpm = clamp(0.18 + run * 0.35 + e.low * 0.35 + build * 0.3 + (T > T_TITLE - 0.4 && T < T_TITLE + 0.5 ? 0.3 : 0), 0, 1.02);
      this.root.style.setProperty('--e', e.low.toFixed(3));
      const clock = this.root.querySelector('.intro-clock');
      if (clock) {
        const s = playing ? Math.min(59, 55 + Math.floor(T)) : 55;
        clock.textContent = playing && T >= 3.9 ? '00:00' : '23:59:' + String(s).padStart(2, '0');
        clock.classList.toggle('mid', playing && T >= 3.9);
        clock.classList.toggle('gone', playing && T >= 7.5);
      }
      this.draw(T, e, playing, build);
    }

    // --------------------------------------------------------------- disegno
    draw(T, e, playing, build) {
      const c = this.c, now = performance.now() / 1000;
      const sx = this.shake ? Math.round((Math.random() - 0.5) * this.shake * 3) : 0, sy = this.shake ? Math.round((Math.random() - 0.5) * this.shake * 2) : 0;
      c.setTransform(1, 0, 0, 1, sx, sy);
      // cielo
      const g = c.createLinearGradient(0, 0, 0, HOR);
      g.addColorStop(0, '#04050c'); g.addColorStop(0.6, '#0d0b22'); g.addColorStop(1, '#2a1238');
      c.fillStyle = g; c.fillRect(-4, -4, W + 8, HOR + 6);
      for (const [x, y, p] of this.stars) { if (Math.sin(now * 2 + p * 20) > -0.3) { c.fillStyle = p > 0.8 ? '#cfe6ff' : '#5a6a90'; c.fillRect(x | 0, y | 0, 1, 1); } }
      // luna con alone
      this.glow(226, 14, 26, 'rgba(180,200,255,0.10)'); c.fillStyle = '#dfe6f2'; this.disc(226, 14, 7); c.fillStyle = '#b9c3d6'; c.fillRect(223, 12, 2, 2); c.fillRect(228, 16, 2, 1);
      // skyline a due piani, ondeggia appena (la Supra cambia traiettoria)
      const sway = Math.sin(now * 0.35) * 6;
      this.skyline(this.layers[0], HOR, 0.35, sway * 0.4, '#0b0d1f', '#3b3460', now);
      this.skyline(this.layers[1], HOR + 1, 1, sway, '#06070f', '#ffcf6a', now);
      // foschia luminosa all'orizzonte
      const hz = c.createLinearGradient(0, HOR - 18, 0, HOR + 4);
      hz.addColorStop(0, 'rgba(255,60,140,0)'); hz.addColorStop(1, `rgba(255,70,150,${0.18 + e.low * 0.2})`);
      c.fillStyle = hz; c.fillRect(0, HOR - 18, W, 22);
      this.road(sway, e, now);
      this.trafficDraw(sway);
      this.supra(T, e, playing, now);
      // linee di velocità nel crescendo
      if (build > 0 || this.speed > 22) {
        c.globalCompositeOperation = 'lighter';
        const n = Math.floor(10 + build * 26);
        for (let i = 0; i < n; i++) {
          const a = (i * 2.399 + now * 0.7) % (Math.PI * 2), r0 = 40 + ((now * 260 + i * 37) % 160), r1 = r0 + 10 + build * 22;
          c.strokeStyle = `rgba(160,230,255,${0.08 + build * 0.18})`; c.lineWidth = 1;
          c.beginPath(); c.moveTo(160 + Math.cos(a) * r0, HOR + Math.sin(a) * r0 * 0.6); c.lineTo(160 + Math.cos(a) * r1, HOR + Math.sin(a) * r1 * 0.6); c.stroke();
        }
        c.globalCompositeOperation = 'source-over';
      }
      this.tach(e);
      // lampo sui colpi e sul titolo
      if (this.flash > 0) { c.fillStyle = `rgba(255,240,250,${this.flash * 0.55})`; c.fillRect(-4, -4, W + 8, H + 8); }
      // righe di scansione leggere
      c.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < H; y += 2) c.fillRect(-4, y, W + 8, 1);
    }
    disc(x, y, r) { const c = this.c; for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy)); c.fillRect(Math.round(x - w), Math.round(y + dy), w * 2 + 1, 1); } }
    glow(x, y, r, col) {
      const c = this.c, g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.globalCompositeOperation = 'source-over';
    }
    skyline(bs, base, k, off, body, win, now) {
      const c = this.c;
      for (const b of bs) {
        const x = Math.round(b.x + off), top = base - b.h * k;
        c.fillStyle = body; c.fillRect(x, top, b.w, base - top);
        if (b.ant) { c.fillRect(x + (b.w >> 1), top - 6, 1, 6); if (Math.sin(now * 3 + b.x) > 0.6) { c.fillStyle = '#ff3030'; c.fillRect(x + (b.w >> 1), top - 7, 1, 1); } }
        for (const [wx, wy, on2, p] of b.wins) {
          if (wy * k > b.h * k - 2) continue;
          const lit = on2 ? Math.sin(now * 0.8 + p * 30) > 0 : p < 0.82;
          if (!lit) continue;
          c.fillStyle = k < 1 ? win : p < 0.3 ? '#9fd8ff' : win;
          c.globalAlpha = k < 1 ? 0.5 : 0.75; c.fillRect(x + wx * (k < 1 ? 0.7 : 1), top + wy * k, 2, k < 1 ? 1 : 2); c.globalAlpha = 1;
        }
        if (b.neon) {
          const on = Math.sin(now * 7 + b.neon.ph) > -0.85;
          if (on) { c.fillStyle = b.neon.c; c.fillRect(x + 2, top + b.neon.y, b.w - 4, 3); this.glow(x + b.w / 2, top + b.neon.y + 1, b.w * 0.8, b.neon.c === '#ff2e88' ? 'rgba(255,46,136,0.25)' : 'rgba(46,230,255,0.22)'); }
        }
      }
    }
    // strada in prospettiva: asfalto, bordi, strisce che corrono, lampioni ai lati
    proj(z, x, sway) { const s = 60 / Math.max(0.6, z); return { x: 160 + (x - sway * 0.05) * s * 1.6, y: HOR + s * 1.35, s }; }
    road(sway, e, now) {
      const c = this.c;
      c.fillStyle = '#07080d'; c.fillRect(0, HOR, W, H - HOR);
      // asfalto: bande di lontananza
      for (let y = HOR; y < H; y++) {
        const k = (y - HOR) / (H - HOR), half = 6 + k * 220;
        c.fillStyle = `rgb(${12 + k * 10 | 0},${13 + k * 11 | 0},${22 + k * 16 | 0})`;
        c.fillRect(160 - half - sway * k * 0.3, y, half * 2, 1);
      }
      // riflessi bagnati delle luci della città
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const x = 30 + i * 52 + Math.sin(i * 7) * 10; c.fillStyle = i % 2 ? 'rgba(255,46,136,0.06)' : 'rgba(46,230,255,0.05)'; c.fillRect(x, HOR + 4, 3, H - HOR); }
      c.globalCompositeOperation = 'source-over';
      // strisce
      const seg = 6, off = this.z % seg;
      for (let i = 0; i < 18; i++) {
        const z0 = i * seg - off + 1.2, z1 = z0 + seg * 0.45;
        if (z0 <= 2.2) continue;
        for (const lx of [-1.75, 1.75]) {
          const a = this.proj(z0, lx, sway), b = this.proj(z1, lx, sway);
          const w = Math.max(1, a.s * 0.12);
          c.fillStyle = '#c9ccd6'; c.fillRect(Math.round(a.x - w / 2), Math.round(b.y), Math.ceil(w), Math.max(1, Math.round(a.y - b.y)));
        }
        for (const lx of [-5.2, 5.2]) {
          const a = this.proj(z0, lx, sway), b = this.proj(z0 + seg, lx, sway);
          c.fillStyle = '#d8c070'; c.fillRect(Math.round(a.x), Math.round(b.y), 1, Math.max(1, Math.round(a.y - b.y)));
        }
      }
      // lampioni: palo, braccio, lampada con pozza di luce
      const ls = 22, lo = this.z % ls;
      for (let i = 6; i >= 0; i--) {
        const z = i * ls - lo + 3; if (z < 0.9) continue;
        for (const side of [-1, 1]) {
          const p = this.proj(z, side * 7.2, sway), top = p.y - p.s * 7;
          c.fillStyle = '#1a1d2a'; c.fillRect(Math.round(p.x), Math.round(top), Math.max(1, Math.round(p.s * 0.18)), Math.round(p.y - top));
          const lx = p.x - side * p.s * 1.6;
          c.fillRect(Math.round(Math.min(p.x, lx)), Math.round(top), Math.round(Math.abs(p.x - lx)), Math.max(1, Math.round(p.s * 0.12)));
          this.glow(lx, top + 1, p.s * 3.2, `rgba(255,190,110,${0.28 + e.all * 0.12})`);
          c.fillStyle = '#ffe2a8'; c.fillRect(Math.round(lx - p.s * 0.3), Math.round(top), Math.max(1, Math.round(p.s * 0.6)), Math.max(1, Math.round(p.s * 0.2)));
          this.glow(lx, p.y, p.s * 4, 'rgba(255,170,90,0.08)');
        }
      }
    }
    trafficDraw(sway) {
      const c = this.c;
      for (const t of this.traffic) {
        t.z += (t.oncoming ? -(this.speed + 16) : -(this.speed - 9)) * 0.016;
        if (t.z < 0.8) t.z += 90; if (t.z > 95) t.z -= 90;
        const p = this.proj(t.z, t.lane * 3.4, sway), w = p.s * 1.8, h = p.s * 0.9;
        if (p.y > H + 4 || t.z < 1.5) continue;
        c.fillStyle = '#0c0e16'; c.fillRect(Math.round(p.x - w / 2), Math.round(p.y - h), Math.round(w), Math.round(h));
        const col = t.oncoming ? 'rgba(220,235,255,0.6)' : 'rgba(255,40,40,0.55)';
        for (const s of [-1, 1]) { this.glow(p.x + s * w * 0.35, p.y - h * 0.5, Math.max(3, p.s * 1.4), col); c.fillStyle = t.oncoming ? '#f4f8ff' : '#ff3a2a'; c.fillRect(Math.round(p.x + s * w * 0.35 - 1), Math.round(p.y - h * 0.55), 2, 1); }
      }
    }
    // la Supra da dietro: carrozzeria rossa, lunotto, quattro fanali tondi, alettone ad arco, scarico
    supra(T, e, playing, now) {
      const c = this.c, k = this.carY;
      const bounce = Math.round(e.low * 1.6) + (Math.sin(now * 18) > 0.7 ? 1 : 0);
      const cx = 160 + Math.round(Math.sin(now * 0.35) * 4), by = Math.round(160 + k * 70 - bounce);
      if (by > H + 40) return;
      // luce dei fari sull'asfalto davanti
      this.glow(cx, by - 30, 60, 'rgba(200,220,255,0.10)');
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(cx - 54, by + 1, 108, 4);
      // gomme
      c.fillStyle = '#050507'; c.fillRect(cx - 50, by - 13, 16, 15); c.fillRect(cx + 34, by - 13, 16, 15);
      c.fillStyle = '#1a1b20'; c.fillRect(cx - 49, by - 12, 2, 13); c.fillRect(cx + 47, by - 12, 2, 13);
      // carrozzeria: fianchi larghi, coda arrotondata
      const red = '#b0141c', red2 = '#7a0c12', hi = '#ff5b5b';
      c.fillStyle = red2; c.fillRect(cx - 50, by - 22, 100, 12);
      c.fillStyle = red; c.fillRect(cx - 52, by - 30, 104, 12); c.fillRect(cx - 48, by - 34, 96, 4);
      c.fillStyle = hi; c.fillRect(cx - 46, by - 34, 92, 1);
      // tetto e lunotto molto inclinato
      c.fillStyle = red2; c.fillRect(cx - 30, by - 50, 60, 3);
      for (let i = 0; i < 16; i++) { const w = 30 + i * 1.1; c.fillStyle = i < 2 ? red : '#0a1222'; c.fillRect(Math.round(cx - w), by - 50 + i, Math.round(w * 2), 1); }
      c.fillStyle = 'rgba(120,170,255,0.25)'; for (let i = 0; i < 10; i++) c.fillRect(cx - 18 + i * 2, by - 46 + i, 3, 1);   // riflesso
      // pannello dei fanali: fascia nera con quattro fanali tondi
      c.fillStyle = '#120608'; c.fillRect(cx - 50, by - 29, 100, 9);
      const brake = playing && this.state !== 'wait' ? 0.6 + e.low * 0.6 : 0.3;
      for (const x of [-40, -29, 29, 40]) {
        c.fillStyle = '#3a0508'; this.disc(cx + x, by - 25, 4);
        c.fillStyle = `rgb(255,${40 + brake * 40 | 0},${30 + brake * 20 | 0})`; this.disc(cx + x, by - 25, 3);
        c.fillStyle = '#ffd0c0'; c.fillRect(cx + x - 1, by - 26, 2, 1);
        this.glow(cx + x, by - 25, 12 + brake * 10, `rgba(255,30,30,${0.25 + brake * 0.3})`);
      }
      // targa
      c.fillStyle = '#e8e8dc'; c.fillRect(cx - 9, by - 18, 18, 6); c.fillStyle = '#16304a';
      c.fillRect(cx - 7, by - 16, 2, 3); c.fillRect(cx - 4, by - 16, 3, 1); c.fillRect(cx - 4, by - 14, 3, 1); c.fillRect(cx + 1, by - 16, 2, 3); c.fillRect(cx + 4, by - 16, 2, 3);
      // alettone ad arco: montanti e lama sopra il baule
      c.fillStyle = red2; c.fillRect(cx - 44, by - 44, 3, 12); c.fillRect(cx + 41, by - 44, 3, 12);
      c.fillStyle = red; c.fillRect(cx - 50, by - 47, 100, 3); c.fillStyle = hi; c.fillRect(cx - 50, by - 47, 100, 1);
      c.fillStyle = '#4a070c'; c.fillRect(cx - 52, by - 48, 3, 6); c.fillRect(cx + 49, by - 48, 3, 6);
      // paraurti, diffusore, scarico
      c.fillStyle = '#16080a'; c.fillRect(cx - 46, by - 10, 92, 4);
      c.fillStyle = '#8c939e'; this.disc(cx + 30, by - 8, 3); c.fillStyle = '#111'; this.disc(cx + 30, by - 8, 2);
      if (this.flame > 0.05) {
        this.glow(cx + 30, by - 6, 14 * this.flame + 4, `rgba(255,140,40,${0.5 * this.flame})`);
        c.fillStyle = '#ffd36a'; c.fillRect(cx + 28, by - 7, 4, 3 + Math.round(this.flame * 5));
        c.fillStyle = '#7ad0ff'; c.fillRect(cx + 29, by - 7, 2, 2);
      }
    }
    // contagiri in basso a sinistra: sale con la musica e tocca la zona rossa al titolo
    tach(e) {
      const c = this.c, x = 30, y = 158, r = 18, rpm = this.rpm || 0;
      c.fillStyle = 'rgba(4,6,12,0.85)'; this.disc(x, y, r + 2);
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (0.75 + i * 0.1875), red = i >= 7;
        c.fillStyle = red ? '#ff3a3a' : '#8fb8d8';
        c.fillRect(Math.round(x + Math.cos(a) * (r - 2)), Math.round(y + Math.sin(a) * (r - 2)), 1, 1);
      }
      const a = Math.PI * (0.75 + rpm * 1.5);
      c.strokeStyle = '#ff6a2a'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3)); c.stroke();
      c.fillStyle = rpm > 0.85 && Math.sin(performance.now() / 50) > 0 ? '#ff2e2e' : '#2a3448'; c.fillRect(x - 3, y + 6, 6, 2);
      void e;
    }
  }
  window.NightIntro = Intro;
})();
