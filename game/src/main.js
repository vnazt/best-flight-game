// Kapuas River Run — main loop, pseudo-3D river renderer, chase + cockpit
// views, input, and the state machine (TITLE / FLY / TURNAROUND / DEBRIEF /
// CRASHED). The river is the route: the world scrolls past as one winding
// band of water under a golden-hour sky.

const Main = (() => {
  const W = 1280, H = 800;
  const FOCAL = 571; // (H/2) / tan(35 deg)
  const Z_FAR = 3600, Z_NEAR = 140;

  let canvas, ctx;
  let G = null; // {f, m, radio, world, view, keys, ...}
  let lastT = 0;
  let landTimer = 0; // delay after landing before the next screen

  function createGame() {
    const rings = River.buildRings();
    const villages = River.VILLAGES.map((v) => ({ ...v, done: false }));
    return {
      f: Flight.createFlight(),
      m: Missions.createMissions(),
      radio: Radio.createRadio(),
      world: { rings, villages },
      view: 'chase',
      keys: {},
      banner: null, bannerSec: 0,
      camX: 0, camY: 30, horizonY: 380,
      shotMode: false, shotClock: 0,
      paused: false,
    };
  }

  function headingDeg(f) {
    const h = 90 + f.lat * 0.12 + f.rollDeg * 0.6;
    return ((h % 360) + 360) % 360;
  }

  // ---------- projection ----------
  function project(wx, wy, z) {
    return {
      x: W / 2 + (wx - G.camX) / z * FOCAL,
      y: G.horizonY + (G.camY - wy) / z * FOCAL,
    };
  }

  // ---------- sky, sun, clouds, monsoon wall ----------
  function drawSky(f) {
    const g = ctx.createLinearGradient(0, 0, 0, G.horizonY + 40);
    g.addColorStop(0, '#241a4e');
    g.addColorStop(0.45, '#7a3d6e');
    g.addColorStop(0.8, '#e8843c');
    g.addColorStop(1, '#f7c873');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, G.horizonY + 40);
    // Low sun, golden hour.
    const sg = ctx.createRadialGradient(1010, 168, 8, 1010, 168, 90);
    sg.addColorStop(0, 'rgba(255, 236, 180, 0.95)');
    sg.addColorStop(0.35, 'rgba(255, 190, 90, 0.55)');
    sg.addColorStop(1, 'rgba(255, 190, 90, 0)');
    ctx.fillStyle = sg;
    ctx.fillRect(900, 60, 220, 220);
    ctx.fillStyle = '#ffedbe';
    ctx.beginPath(); ctx.arc(1010, 168, 34, 0, Math.PI * 2); ctx.fill();
    // Clouds, seeded, drifting slowly with distance flown.
    for (let i = 0; i < 8; i++) {
      const cx = ((i * 173 + f.s * 0.03) % 1500) - 110;
      const cy = 52 + (i * 47) % 150;
      ctx.fillStyle = 'rgba(255, 235, 210, 0.22)';
      ctx.beginPath(); ctx.ellipse(cx, cy, 90 + (i % 3) * 26, 16 + (i % 2) * 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Monsoon wall: a dark front that grows as landfall approaches.
    const wallH = (1 - f.landfallSec / 480) * 230;
    if (wallH > 4) {
      const wg = ctx.createLinearGradient(0, G.horizonY - wallH, 0, G.horizonY);
      wg.addColorStop(0, 'rgba(16, 10, 34, 0.96)');
      wg.addColorStop(0.7, 'rgba(40, 24, 66, 0.82)');
      wg.addColorStop(1, 'rgba(40, 24, 66, 0)');
      ctx.fillStyle = wg;
      ctx.fillRect(0, G.horizonY - wallH, W, wallH);
      ctx.strokeStyle = 'rgba(200, 220, 255, 0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        const x = (i * 97 + f.s * 0.1) % W;
        ctx.beginPath(); ctx.moveTo(x, G.horizonY - wallH + 8 + (i % 5) * 12);
        ctx.lineTo(x - 4, G.horizonY - wallH + 26 + (i % 5) * 12); ctx.stroke();
      }
    }
  }

  // ---------- river + terrain, far to near ----------
  function drawWorld(f) {
    const camS = f.s;
    const seg0 = Math.floor((camS + Z_NEAR) / River.SEG);
    const seg1 = Math.floor((camS + Z_FAR) / River.SEG);
    for (let seg = seg1; seg >= seg0; seg--) {
      const z0 = seg * River.SEG - camS;
      const z1 = z0 + River.SEG;
      if (z1 < Z_NEAR || z0 > Z_FAR) continue;
      const s0 = seg * River.SEG, s1 = s0 + River.SEG;
      const cx0 = River.riverXAt(s0), cx1 = River.riverXAt(s1);
      const hw0 = River.riverHalfAt(s0), hw1 = River.riverHalfAt(s1);
      const g0 = project(G.camX - 520, 0, z0), g1 = project(G.camX - 520, 0, z1);
      const g2 = project(G.camX + 520, 0, z1), g3 = project(G.camX + 520, 0, z0);
      // Grass band, alternating shade for speed sensation.
      ctx.fillStyle = seg % 2 === 0 ? '#3e7833' : '#3a7130';
      ctx.beginPath();
      ctx.moveTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y); ctx.lineTo(g2.x, g2.y); ctx.lineTo(g3.x, g3.y);
      ctx.closePath(); ctx.fill();
      // River band: dusk-blue water with a sunlit centre.
      const r0 = project(cx0 - hw0, 0, z0), r1 = project(cx1 - hw1, 0, z1);
      const r2 = project(cx1 + hw1, 0, z1), r3 = project(cx0 + hw0, 0, z0);
      const rg = ctx.createLinearGradient(r0.x, r0.y, r3.x, r3.y);
      rg.addColorStop(0, '#2f647d'); rg.addColorStop(0.5, '#6fa8bd'); rg.addColorStop(1, '#2f647d');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(r0.x, r0.y); ctx.lineTo(r1.x, r1.y); ctx.lineTo(r2.x, r2.y); ctx.lineTo(r3.x, r3.y);
      ctx.closePath(); ctx.fill();
      // Sandy banks.
      ctx.fillStyle = '#c9a86a';
      const b0 = project(cx0 - hw0 - 5, 0, z0), b1 = project(cx1 - hw1 - 5, 0, z1);
      ctx.beginPath(); ctx.moveTo(r0.x, r0.y); ctx.lineTo(r1.x, r1.y); ctx.lineTo(b1.x, b1.y); ctx.lineTo(b0.x, b0.y); ctx.closePath(); ctx.fill();
      const b2 = project(cx0 + hw0 + 5, 0, z0), b3 = project(cx1 + hw1 + 5, 0, z1);
      ctx.beginPath(); ctx.moveTo(r3.x, r3.y); ctx.lineTo(r2.x, r2.y); ctx.lineTo(b3.x, b3.y); ctx.lineTo(b2.x, b2.y); ctx.closePath(); ctx.fill();
      // Dotted centreline, every third segment.
      if (seg % 3 === 0) {
        const c0 = project(cx0, 0, z0), c1 = project(cx1, 0, z1);
        ctx.strokeStyle = 'rgba(255, 245, 220, 0.65)';
        ctx.lineWidth = Math.max(1, 90 / z0 * 4);
        ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(c1.x, c1.y); ctx.stroke();
      }
      // Canopy trees on the grass.
      for (const t of River.treesForSegment(seg)) {
        const wx = River.riverXAt(s0) + t.off;
        const p = project(wx, 0, z0 + 10);
        if (p.x < -20 || p.x > W + 20 || p.y > H || p.y < G.horizonY) continue;
        const r = Math.max(1.5, Math.min(15, t.size / (z0 + 10) * FOCAL * 0.55));
        ctx.fillStyle = t.shade < 0.33 ? '#2c5a26' : t.shade < 0.66 ? '#35702e' : '#4a8a3a';
        ctx.beginPath(); ctx.arc(p.x, p.y - r * 0.7, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    drawStrips(f);
    drawVillages(f);
    drawRings(f);
  }

  function drawStrips(f) {
    for (const strip of River.STRIPS) {
      const z = strip.s - f.s;
      if (z < Z_NEAR || z > Z_FAR) continue;
      const cx = River.riverXAt(strip.s), hw = River.riverHalfAt(strip.s);
      const a = project(cx - hw, 0, z), b = project(cx + hw, 0, z);
      ctx.strokeStyle = '#7ee0e8'; ctx.lineWidth = Math.max(2, 900 / z);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      // Buoys.
      for (const side of [-1, 1]) {
        const p = project(cx + side * (hw + 4), 0, z);
        ctx.fillStyle = '#ff7a2e';
        ctx.beginPath(); ctx.arc(p.x, p.y - 4, Math.max(2, 260 / z), 0, Math.PI * 2); ctx.fill();
      }
      const lp = project(cx, 0, z);
      ctx.fillStyle = '#f5ead2';
      ctx.font = '700 16px Arial, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(strip.runway + ' · ' + strip.name, lp.x, lp.y - 26);
    }
  }

  function drawVillages(f) {
    for (const v of G.world.villages) {
      const z = v.s - f.s;
      if (z < Z_NEAR || z > Z_FAR) continue;
      const wx = River.riverXAt(v.s) + v.lat;
      const p = project(wx, 0, z);
      const w = Math.max(8, 2400 / z), h = w * 0.55;
      // Longhouse on stilts.
      ctx.fillStyle = '#6b4a26';
      ctx.fillRect(p.x - w / 2, p.y - h, w, h * 0.62);
      ctx.fillStyle = '#a34d1f';
      ctx.beginPath();
      ctx.moveTo(p.x - w / 2 - 4, p.y - h * 0.62);
      ctx.lineTo(p.x, p.y - h * 1.15);
      ctx.lineTo(p.x + w / 2 + 4, p.y - h * 0.62);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3a2a16'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x - w / 2, p.y - h * 0.62); ctx.lineTo(p.x + w / 2, p.y - h * 0.62); ctx.stroke();
      ctx.fillStyle = v.done ? '#7ee081' : '#ffb347';
      ctx.font = '700 15px Arial, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(v.name + (v.done ? ' ✓' : ' · ' + v.cargo), p.x, p.y - h * 1.15 - 8);
    }
  }

  function drawRings(f) {
    for (const ring of G.world.rings) {
      const z = ring.s - f.s;
      if (z < Z_NEAR || z > Z_FAR || ring.passed) continue;
      const wx = River.riverXAt(ring.s) + ring.lat;
      const wy = ring.altFt * Flight.FT_TO_M;
      const p = project(wx, wy, z);
      const rx = Math.max(4, ring.radiusM / z * FOCAL);
      const ry = rx * 0.52;
      ctx.save();
      ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 18;
      ctx.strokeStyle = '#ffcf5e'; ctx.lineWidth = Math.max(2, rx * 0.1);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#f5ead2';
      ctx.font = '700 16px Arial, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('RING ' + ring.num + ' · ' + Math.round(z) + 'M', p.x, p.y - ry - 10);
    }
  }

  // ---------- the aircraft, drawn built: floatplane, chase view ----------
  function drawPlane(f) {
    ctx.save();
    ctx.translate(640, 596);
    ctx.rotate(f.rollDeg * Math.PI / 180 * 0.7);
    const s = 1 + f.thr * 0.04;
    ctx.scale(s, s);
    // Prop blur at the nose.
    ctx.fillStyle = 'rgba(230, 240, 255, 0.20)';
    ctx.beginPath(); ctx.ellipse(14, -118, 10, 52, 0.12, 0, Math.PI * 2); ctx.fill();
    // Floats.
    ctx.fillStyle = '#2e2a24';
    roundRect(-84, 66, 96, 18, 8); ctx.fill();
    roundRect(6, 66, 96, 18, 8); ctx.fill();
    ctx.fillStyle = '#c94f2e';
    ctx.fillRect(-84, 66, 96, 5); ctx.fillRect(6, 66, 96, 5);
    // Struts.
    ctx.strokeStyle = '#3a3630'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-40, 62); ctx.lineTo(-30, 34); ctx.moveTo(54, 62); ctx.lineTo(44, 34); ctx.stroke();
    // Fuselage, nose away (up-screen), tail toward the viewer.
    const fg = ctx.createLinearGradient(-40, -118, 40, 84);
    fg.addColorStop(0, '#f7efdc'); fg.addColorStop(0.6, '#efe3c2'); fg.addColorStop(1, '#d9c69a');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-26, -118);
    ctx.quadraticCurveTo(30, -118, 34, -72);
    ctx.quadraticCurveTo(44, -10, 40, 40);
    ctx.quadraticCurveTo(38, 78, 22, 84);
    ctx.lineTo(-14, 84);
    ctx.quadraticCurveTo(-34, 78, -36, 40);
    ctx.quadraticCurveTo(-40, -10, -34, -72);
    ctx.quadraticCurveTo(-32, -118, -26, -118);
    ctx.closePath(); ctx.fill();
    // Red cheatline.
    ctx.fillStyle = '#c94f2e';
    ctx.beginPath();
    ctx.moveTo(-36, -46); ctx.lineTo(40, -46); ctx.lineTo(40, -34); ctx.lineTo(-38, -34);
    ctx.closePath(); ctx.fill();
    // Windows.
    ctx.fillStyle = '#22384e';
    roundRect(-18, -96, 26, 14, 4); ctx.fill();
    roundRect(12, -96, 20, 14, 4); ctx.fill();
    // Livery text.
    ctx.fillStyle = '#7a2d16';
    ctx.font = '800 13px Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('KAPUAS AIR', 2, -8);
    // Main wing, slight dihedral, red tips, nav lights.
    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath();
    ctx.moveTo(-172, -18); ctx.lineTo(172, -18); ctx.lineTo(158, 6); ctx.lineTo(-158, 6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c94f2e';
    ctx.fillRect(-172, -18, 18, 24); ctx.fillRect(154, -18, 18, 24);
    ctx.fillStyle = '#39d353'; ctx.beginPath(); ctx.arc(-176, -6, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff5a4e'; ctx.beginPath(); ctx.arc(176, -6, 4, 0, Math.PI * 2); ctx.fill();
    // Tailplane + fin.
    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath(); ctx.moveTo(-72, 52); ctx.lineTo(72, 52); ctx.lineTo(60, 68); ctx.lineTo(-60, 68); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c94f2e';
    ctx.beginPath(); ctx.moveTo(-6, 84); ctx.lineTo(-2, 30); ctx.lineTo(16, 30); ctx.lineTo(12, 84); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f5ead2';
    ctx.font = '800 11px Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PK-KPS', 5, 58);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  // ---------- cockpit panel ----------
  function drawDial(x, y, r, label, valueText, frac, color) {
    ctx.fillStyle = '#101c26';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(245,234,210,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      ctx.strokeStyle = 'rgba(245,234,210,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4));
      ctx.lineTo(x + Math.cos(a) * (r - 10), y + Math.sin(a) * (r - 10));
      ctx.stroke();
    }
    const na = Math.PI * 0.75 + Math.max(0, Math.min(1, frac)) * Math.PI * 1.5;
    ctx.strokeStyle = color || '#ffb347'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(na) * (r - 12), y + Math.sin(na) * (r - 12)); ctx.stroke();
    ctx.fillStyle = '#f5ead2';
    ctx.font = '700 13px Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(label, x, y + r + 16);
    ctx.font = '800 17px Arial, sans-serif';
    ctx.fillText(valueText, x, y + 6);
  }

  function drawCockpit(f) {
    // Windscreen: the same world, squeezed into the top 55%.
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, 440); ctx.clip();
    drawSky(f);
    drawWorld(f);
    drawPlaneSmall(f);
    ctx.restore();
    // Panel.
    ctx.fillStyle = '#16222c';
    ctx.fillRect(0, 440, W, 360);
    ctx.strokeStyle = 'rgba(245,234,210,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 440); ctx.lineTo(W, 440); ctx.stroke();
    // Glideslope diamonds.
    const strip = River.STRIPS[f.leg + 1];
    if (strip) {
      const z = strip.s - f.s;
      if (z > 0 && z < 4000) {
        const gs = Math.max(0, Math.min(1, 1 - Math.abs(f.altFt - 120) / 300));
        ctx.fillStyle = gs > 0.7 ? '#7ee081' : '#ffb347';
        ctx.font = '800 18px Arial, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('GLIDESLOPE ' + strip.runway + ' · ' + Math.round(z) + 'M · ' + (gs > 0.7 ? 'ON PATH' : 'CORRECT'), 640, 478);
      }
    }
    drawDial(120, 560, 52, 'AIRSPEED', Math.round(f.spdKt) + '', f.spdKt / 160, '#ffb347');
    drawDial(260, 560, 52, 'ALTITUDE', Math.round(f.altFt) + '', f.altFt / 1200, '#7ee0e8');
    drawDial(400, 560, 52, 'HEADING', String(Math.round(headingDeg(f))).padStart(3, '0'), headingDeg(f) / 360, '#f5ead2');
    drawDial(540, 560, 52, 'FUEL', Math.round(f.fuelKg) + '', f.fuelKg / 140, f.fuelKg <= 25 ? '#ff5a4e' : '#7ee081');
    drawDial(680, 560, 52, 'RPM', Math.round(1200 + f.thr * 1400) + '', f.thr, '#ffb347');
    drawDial(820, 560, 52, 'DAMAGE', Math.round(f.dmgPct) + '%', f.dmgPct / 100, '#ff5a4e');
    // Throttle quadrant.
    ctx.fillStyle = '#0e1820'; ctx.beginPath(); ctx.roundRect(920, 500, 120, 130, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(245,234,210,0.4)'; ctx.stroke();
    ctx.fillStyle = '#f5ead2'; ctx.font = '700 14px Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('THROTTLE', 980, 522);
    ctx.fillStyle = 'rgba(245,234,210,0.2)'; ctx.fillRect(972, 534, 16, 76);
    ctx.fillStyle = '#ffb347'; ctx.fillRect(966, 534 + (1 - f.thr) * 64, 28, 12);
    // Landing checklist, right.
    ctx.fillStyle = '#0e1820'; ctx.beginPath(); ctx.roundRect(1060, 500, 200, 130, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(245,234,210,0.4)'; ctx.stroke();
    ctx.fillStyle = '#ffb347'; ctx.font = '800 15px Arial, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('LANDING CHECK', 1076, 524);
    const items = [
      ['SPEED < 72 KT', f.spdKt < 72],
      ['ALT < 55 FT', f.altFt < 55],
      ['ON THE RIVER', Math.abs(f.lat) < River.riverHalfAt(f.s) + 4],
      ['GEAR — FLOATS', true],
    ];
    items.forEach((it, i) => {
      ctx.fillStyle = it[1] ? '#7ee081' : 'rgba(245,234,210,0.55)';
      ctx.font = '600 14px Arial, sans-serif';
      ctx.fillText((it[1] ? '✓ ' : '· ') + it[0], 1076, 550 + i * 20);
    });
    // Radio + hints.
    ctx.fillStyle = '#f5ead2'; ctx.font = '600 15px Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('W/S pitch · A/D bank · SHIFT/CTRL throttle · SPACE drop cargo · C chase view', 640, 700);
    ctx.fillStyle = '#ffb347'; ctx.font = '700 15px Arial, sans-serif';
    ctx.fillText('SCORE ' + f.score + ' · RINGS ' + f.ringsPassed + '/' + f.ringsTotal + ' · CARGO ' + f.cargoDone + '/' + f.cargoTotal, 640, 730);
  }

  function drawPlaneSmall(f) {
    // Nose-down at the bottom of the windscreen: you are in the cockpit,
    // looking over the floats at the river ahead.
    ctx.save();
    ctx.translate(640, 420);
    ctx.rotate(f.rollDeg * Math.PI / 180 * 0.5);
    ctx.scale(0.38, 0.38);
    ctx.fillStyle = '#efe3c2';
    ctx.beginPath();
    ctx.moveTo(-26, -118); ctx.quadraticCurveTo(30, -118, 34, -72);
    ctx.quadraticCurveTo(44, -10, 40, 40); ctx.quadraticCurveTo(38, 78, 22, 84);
    ctx.lineTo(-14, 84); ctx.quadraticCurveTo(-34, 78, -36, 40);
    ctx.quadraticCurveTo(-40, -10, -34, -72); ctx.quadraticCurveTo(-32, -118, -26, -118);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c94f2e'; ctx.fillRect(-36, -46, 76, 12);
    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath(); ctx.moveTo(-172, -18); ctx.lineTo(172, -18); ctx.lineTo(158, 6); ctx.lineTo(-158, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---------- screens ----------
  function drawTitle(f) {
    drawSky(f);
    drawWorld(f);
    ctx.fillStyle = 'rgba(8, 14, 22, 0.55)';
    ctx.fillRect(0, 0, W, H);
    HUD.text(ctx, 'KAPUAS AIR PRESENTS', 640, 150, 18, HUD.AMBER, '800', 'center');
    HUD.text(ctx, 'KAPUAS RIVER RUN', 640, 216, 64, HUD.CREAM, '800', 'center');
    HUD.text(ctx, 'A bush plane on the Kapuas — Putussibau → Sintang → Pontianak → the sea', 640, 252, 20, HUD.CREAM, '600', 'center');
    HUD.text(ctx, 'Fly the river. Drop the cargo. Beat the monsoon wall home.', 640, 282, 18, HUD.AMBER, '600', 'center');
    // Sortie board.
    HUD.panel(ctx, 390, 320, 500, 150);
    HUD.text(ctx, 'SORTIE BOARD — 3 LEGS', 640, 348, 17, HUD.AMBER, '800', 'center');
    River.LEGS.forEach((leg, i) => {
      HUD.text(ctx, (i + 1) + '  ' + leg.name + ' → ' + leg.toName + '   ·   ' + leg.cargo, 640, 380 + i * 28, 16, HUD.CREAM, '600', 'center');
    });
    // Fly button.
    ctx.fillStyle = '#c94f2e';
    ctx.beginPath(); ctx.roundRect(540, 500, 200, 56, 8); ctx.fill();
    HUD.text(ctx, 'FLY  →', 640, 537, 24, '#fff', '800', 'center');
    HUD.text(ctx, 'W/S pitch · A/D bank · SHIFT/CTRL throttle · SPACE drop cargo · C cockpit', 640, 600, 15, HUD.CREAM, '600', 'center');
    HUD.text(ctx, 'Land on the river strips. Mind the fuel. The wall is coming.', 640, 626, 15, 'rgba(245,234,210,0.75)', '400', 'center');
  }

  function drawTurnaround(f, m) {
    ctx.fillStyle = 'rgba(8, 14, 22, 0.93)';
    ctx.fillRect(0, 0, W, H);
    const leg = River.LEGS[f.leg];
    const done = m.legs.filter((l) => l.status === 'DONE').length;
    HUD.text(ctx, 'TURNAROUND — ' + leg.name, 640, 90, 34, HUD.CREAM, '800', 'center');
    HUD.text(ctx, 'Leg ' + done + ' of 3 done · Score ' + f.score + ' · Landfall in ' + HUD.fmtTime(f.landfallSec), 640, 124, 18, HUD.AMBER, '600', 'center');
    // Sortie board.
    HUD.panel(ctx, 240, 160, 800, 130);
    m.legs.forEach((l, i) => {
      const y = 196 + i * 34;
      HUD.text(ctx, (i + 1) + '  ' + l.name, 270, y, 16, l.status === 'DONE' ? HUD.GREEN : HUD.CREAM, '700');
      HUD.text(ctx, l.status + (l.status === 'DONE' ? ' · ' + l.score + ' pts · rings ' + l.rings + ' · cargo ' + l.cargo : ''), 1010, y, 15, l.status === 'DONE' ? HUD.GREEN : 'rgba(245,234,210,0.6)', '600', 'right');
    });
    // Refit cards.
    ctx.fillStyle = '#0a1218';
    ctx.beginPath(); ctx.roundRect(390, 306, 500, 44, 8); ctx.fill();
    HUD.text(ctx, 'PICK ONE REFIT — it costs monsoon time', 640, 330, 18, HUD.AMBER, '800', 'center');
    Missions.REFITS.forEach((r, i) => {
      const x = 240 + i * 272, y = 350;
      const picked = m._pickedRefit === r.id;
      ctx.fillStyle = picked ? 'rgba(255,179,71,0.25)' : 'rgba(8, 18, 26, 0.85)';
      ctx.beginPath(); ctx.roundRect(x, y, 256, 150, 8); ctx.fill();
      ctx.strokeStyle = picked ? HUD.AMBER : 'rgba(245,234,210,0.4)'; ctx.lineWidth = 2; ctx.stroke();
      HUD.text(ctx, '[' + (i + 1) + '] ' + r.name, x + 128, y + 34, 17, HUD.CREAM, '800', 'center');
      HUD.text(ctx, r.desc, x + 128, y + 66, 16, HUD.CREAM, '600', 'center');
      HUD.text(ctx, 'COSTS ' + r.costSec + 's OF WALL TIME', x + 128, y + 100, 14, HUD.RED, '700', 'center');
      HUD.text(ctx, picked ? 'PICKED ✓' : 'click or press ' + (i + 1), x + 128, y + 128, 14, picked ? HUD.GREEN : 'rgba(245,234,210,0.6)', '600', 'center');
    });
    ctx.fillStyle = '#c94f2e';
    ctx.beginPath(); ctx.roundRect(520, 540, 240, 56, 8); ctx.fill();
    HUD.text(ctx, 'NEXT LEG  →', 640, 577, 22, '#fff', '800', 'center');
    HUD.text(ctx, 'Next: ' + leg.name + ' → ' + leg.toName + ' · ' + leg.cargo, 640, 630, 16, HUD.CREAM, '600', 'center');
  }

  function drawDebrief(f, m) {
    ctx.fillStyle = 'rgba(8, 14, 22, 0.88)';
    ctx.fillRect(0, 0, W, H);
    const d = m.debrief;
    HUD.text(ctx, 'DEBRIEF — FLIGHT RECORDER', 640, 80, 32, HUD.CREAM, '800', 'center');
    HUD.text(ctx, 'SCORE ' + d.totalScore + ' · BEST COMBO x' + d.bestCombo + ' · REFITS: ' + (d.refits.join(', ') || 'none'), 640, 112, 17, HUD.AMBER, '700', 'center');
    HUD.panel(ctx, 180, 140, 920, 150);
    d.legs.forEach((l, i) => {
      const y = 176 + i * 40;
      HUD.text(ctx, (i + 1) + '  ' + l.name, 210, y, 17, HUD.CREAM, '700');
      HUD.text(ctx, l.score + ' pts', 700, y, 17, HUD.AMBER, '700', 'center');
      HUD.text(ctx, 'rings ' + l.rings + ' · cargo ' + l.cargo, 1060, y, 15, 'rgba(245,234,210,0.8)', '600', 'right');
    });
    // Flight-recorder chart: altitude (amber) + speed (green) over the run.
    HUD.panel(ctx, 180, 310, 920, 260);
    HUD.text(ctx, 'ALTITUDE (amber) + SPEED (green) — THE WHOLE RUN', 640, 338, 15, HUD.AMBER, '800', 'center');
    const trace = d.trace;
    if (trace.length > 1) {
      const x0 = 220, x1 = 1060, y0 = 360, y1 = 540;
      ctx.strokeStyle = 'rgba(245,234,210,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
      const tMax = trace[trace.length - 1].t || 1;
      const plot = (get, color) => {
        ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
        trace.forEach((p, i) => {
          const x = x0 + (p.t / tMax) * (x1 - x0);
          const y = y1 - (get(p) / 1500) * (y1 - y0);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      };
      plot((p) => p.altFt, '#ffb347');
      plot((p) => p.spdKt * 8, '#7ee081');
    }
    HUD.text(ctx, d.verdict, 640, 610, 19, HUD.CREAM, '700', 'center');
    HUD.text(ctx, 'Press R to fly the Kapuas again', 640, 644, 15, 'rgba(245,234,210,0.75)', '400', 'center');
  }

  function drawCrashed(f) {
    ctx.fillStyle = 'rgba(60, 8, 4, 0.72)';
    ctx.fillRect(0, 0, W, H);
    HUD.text(ctx, 'SORTIE OVER', 640, 330, 44, '#ff8a7a', '800', 'center');
    HUD.text(ctx, f.crashWhy || 'DOWN', 640, 380, 22, HUD.CREAM, '700', 'center');
    HUD.text(ctx, 'Score ' + f.score + ' · Rings ' + f.ringsPassed + '/' + f.ringsTotal + ' · Cargo ' + f.cargoDone + '/' + f.cargoTotal, 640, 416, 18, HUD.AMBER, '600', 'center');
    HUD.text(ctx, 'Press R to fly again', 640, 460, 16, HUD.CREAM, '600', 'center');
  }

  // ---------- frame ----------
  function render() {
    const f = G.f, m = G.m;
    G.camX = River.riverXAt(f.s) + f.lat * 0.4;
    G.camY = f.altFt * Flight.FT_TO_M + 18;
    G.horizonY = Math.max(300, Math.min(460, 380 + f.pitchDeg * 3 - f.altFt * 0.02));
    ctx.clearRect(0, 0, W, H);

    if (f.state === 'TITLE') {
      const demo = { ...f, s: 4200, altFt: 320, spdKt: 120, thr: 0.7, landfallSec: 480, rollDeg: -6 };
      G.camX = River.riverXAt(demo.s); G.camY = demo.altFt * Flight.FT_TO_M + 18; G.horizonY = 380;
      drawSky(demo); drawWorld(demo); drawTitle(f);
      return;
    }
    if (f.state === 'TURNAROUND') { drawSky(f); drawWorld(f); drawTurnaround(f, m); return; }
    if (f.state === 'DEBRIEF') { drawDebrief(f, m); return; }
    if (f.state === 'CRASHED') { drawSky(f); drawWorld(f); drawCrashed(f); return; }

    // FLY / LANDED
    if (G.view === 'cockpit') {
      drawCockpit(f);
    } else {
      drawSky(f);
      drawWorld(f);
      drawPlane(f);
      // HUD.
      const leg = River.LEGS[f.leg];
      HUD.drawChecklist(ctx, Missions.checklistLines(f, m), leg.name + ' → ' + leg.toName);
      HUD.drawCompass(ctx, headingDeg(f));
      HUD.drawLandfallTimer(ctx, f.landfallSec);
      HUD.drawScore(ctx, f);
      HUD.drawSpeedTape(ctx, f.spdKt);
      HUD.drawAltTape(ctx, f.altFt);
      HUD.drawAttitude(ctx, 640, 700, 46, f.rollDeg, f.pitchDeg);
      HUD.drawGauges(ctx, f);
      HUD.drawMinimap(ctx, f, Missions.nextStops(f));
      if (G.radio.line) HUD.drawRadio(ctx, G.radio.speaker, G.radio.line);
      if (G.banner) HUD.drawBanner(ctx, G.banner[0], G.banner[1]);
      if (f.combo >= 4) HUD.text(ctx, 'ON RAILS! x' + f.combo, 640, 200, 26, HUD.GREEN, '800', 'center');
    }
    if (f.state === 'LANDED') {
      ctx.fillStyle = 'rgba(8, 18, 26, 0.55)';
      ctx.fillRect(0, 0, W, H);
      HUD.text(ctx, 'DOWN SAFE', 640, 360, 44, HUD.GREEN, '800', 'center');
      HUD.text(ctx, 'Score ' + f.score + ' · Rings ' + f.ringsPassed + '/' + f.ringsTotal + ' · Cargo ' + f.cargoDone + '/' + f.cargoTotal, 640, 400, 20, HUD.CREAM, '700', 'center');
    }
  }

  // ---------- events ----------
  function consumeEvents() {
    const f = G.f;
    for (const ev of f.events) {
      if (ev.kind === 'radio') {
        const idx = ev.text.indexOf(': ');
        if (idx > 0) Radio.sayCustom(G.radio, ev.text.slice(0, idx), ev.text.slice(idx + 2));
      } else if (ev.kind === 'bingo') {
        Radio.say(G.radio, 'bingo');
        G.banner = ['BINGO FUEL', '25 KG LEFT — FLY THE SHORT WAY HOME'];
        G.bannerSec = 0;
      } else if (ev.kind === 'ring' && f.combo >= 4) {
        G.banner = ['ON RAILS! x' + f.combo, 'THE RIVER BENDS WITH YOU'];
        G.bannerSec = 0;
      } else if (ev.kind === 'land') {
        const strip = River.STRIPS[f.leg + 1];
        if (strip && strip.name === 'SINTANG') Radio.say(G.radio, 'landSintang');
        else if (strip && strip.name === 'PONTIANAK') Radio.say(G.radio, 'landPontianak');
        else Radio.say(G.radio, 'landSea');
      } else if (ev.kind === 'crash') {
        Radio.say(G.radio, 'crash');
      }
    }
    f.events.length = 0;
  }

  function startLeg(legIndex) {
    const f = G.f, m = G.m;
    const leg = River.LEGS[legIndex];
    f.leg = legIndex;
    f.s = leg.from;
    f.lat = 0;
    f.altFt = 0;
    f.spdKt = 38;
    f.thr = 0.55;
    f.fuelKg = Math.min(f.fuelKg, 100);
    f.ringsPassed = 0;
    f.cargoDone = 0;
    f.combo = 0;
    f.landed = false;
    f.onWater = false;
    f.ringsTotal = G.world.rings.filter((r) => r.leg === legIndex).length;
    f.cargoTotal = G.world.villages.filter((v) => v.s >= leg.from && v.s < leg.to).length;
    for (const r of G.world.rings) if (r.leg === legIndex) r.passed = false;
    for (const v of G.world.villages) if (v.s >= leg.from && v.s < leg.to) v.done = false;
    m.legs[legIndex].status = 'FLYING';
    Flight.startTakeoff(f);
    landTimer = 0;
    G._wallWarned = false;
  }

  function restart() {
    G = createGame();
    startLeg(0);
  }

  // ---------- input ----------
  function readInput() {
    const k = G.keys;
    return {
      pitch: (k['ArrowUp'] || k['KeyW'] ? 1 : 0) - (k['ArrowDown'] || k['KeyS'] ? 1 : 0),
      roll: (k['ArrowRight'] || k['KeyD'] ? 1 : 0) - (k['ArrowLeft'] || k['KeyA'] ? 1 : 0),
      thr: (k['ShiftLeft'] || k['ShiftRight'] ? 1 : 0) - (k['ControlLeft'] || k['ControlRight'] ? 1 : 0),
      drop: !!k['Space'],
    };
  }

  function onKeyDown(e) {
    const f = G.f, m = G.m;
    if (e.code === 'Space') e.preventDefault();
    G.keys[e.code] = true;
    if (e.code === 'Enter') {
      if (f.state === 'TITLE') startLeg(0);
      else if (f.state === 'TURNAROUND') startLeg(f.leg);
    } else if (e.code === 'KeyR') {
      if (f.state === 'CRASHED' || f.state === 'DEBRIEF') restart();
    } else if (e.code === 'KeyC') {
      G.view = G.view === 'cockpit' ? 'chase' : 'cockpit';
    } else if (e.code === 'KeyP') {
      G.paused = !G.paused;
    } else if (f.state === 'TURNAROUND' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
      const refit = Missions.REFITS[Number(e.code.slice(-1)) - 1];
      if (refit && m._pickedRefit !== refit.id) {
        m._pickedRefit = refit.id;
        Missions.applyRefit(f, m, refit.id);
      }
    }
  }

  function onClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    const f = G.f, m = G.m;
    if (f.state === 'TITLE' && x >= 540 && x <= 740 && y >= 500 && y <= 556) startLeg(0);
    if (f.state === 'TURNAROUND') {
      Missions.REFITS.forEach((r, i) => {
        const cx = 240 + i * 272;
        if (x >= cx && x <= cx + 256 && y >= 350 && y <= 500 && m._pickedRefit !== r.id) {
          m._pickedRefit = r.id;
          Missions.applyRefit(f, m, r.id);
        }
      });
      if (x >= 520 && x <= 760 && y >= 540 && y <= 596) startLeg(f.leg);
    }
  }

  // ---------- loop ----------
  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (G.shotMode) G.shotClock += 0.016;
    if (!G.paused && !G.shotMode) {
      const f = G.f;
      if (f.state === 'FLY') {
        Flight.updateFlight(f, dt, readInput(), G.world);
        consumeEvents();
        Radio.tickRadio(G.radio, dt);
        if (G.banner) {
          G.bannerSec += dt;
          if (G.bannerSec > 3.5) G.banner = null;
        }
        if (f.landfallSec < 120 && !G._wallWarned) { G._wallWarned = true; Radio.say(G.radio, 'wallNear'); }
      } else if (f.state === 'LANDED') {
        landTimer += dt;
        if (landTimer > 1.4) {
          const next = Missions.advanceLeg(f, G.m);
          G.m._pickedRefit = null;
          landTimer = 0;
          if (next === 'DEBRIEF') { /* debrief built */ }
        }
      }
      // Space is edge-triggered.
      G.keys['Space'] = false;
    }
    render();
    requestAnimationFrame(frame);
  }

  function boot() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    G = createGame();
    window.__game = G;
    window.__shot = (name) => Shots.applyShot(name);
    window.__flight = Flight;
    window.__missions = Missions;
    const params = new URLSearchParams(location.search);
    const shot = params.get('shot');
    if (shot) {
      G.shotMode = true;
      Shots.applyShot(shot);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
    canvas.addEventListener('click', onClick);
    requestAnimationFrame(frame);
  }

  return { boot, createGame, startLeg, restart, getG: () => G };
})();
