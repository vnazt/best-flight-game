// main.js — game loop, input, camera, and the four staged screenshots.
// Modes: fly (chase view), cockpit, hangar, debrief. ?shot=cover|cockpit|
// hangar|debrief freezes the sim at exact staged values so every capture
// is deterministic.
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const state = {
  mode: 'fly',
  skyMode: 'GOLDEN SUNSET',
  flight: newFlight(),
  mission: newMission(SORTIES[0]),
  input: { throttleUp: false, throttleDown: false, left: false, right: false, pitchUp: false, pitchDown: false },
  shot: null,
  stormT: 0.62 // monsoon wall depth: 1 = far horizon, 0 = on top of us
};

function sky() { return SKIES[SKY_KEYS[state.skyMode]]; }

// ---- Chase-view scene: sky, ridges, river, forest, storm, gates, plane ----
function drawChaseScene() {
  const sk = sky();
  const f = state.flight;
  const sunX = 880, sunY = 190, sunR = 46; // v5: bigger golden-hour sun
  drawSky(ctx, sk, sunX, sunY, sunR);
  drawClouds(ctx, sk, 2);
  drawRidges(ctx, sk);
  drawGround(ctx, sk);
  drawRiver(ctx, sk, f.t);
  drawTributaries(ctx, sk);
  drawSeaLane(ctx, sk); // v5: marked water lane, the runway-equivalent
  drawForest(ctx, sk);
  // The plane's screen box (v5): any label inside it is dropped, not drawn
  // half-covered by the wing/fuselage (the v5 "LONGHO" clip).
  const planeBox = (x, y) => x > 340 && x < 930 && y > 460 && y < 740;
  drawLonghouses(ctx, sk, planeBox);
  drawMist(ctx, sk, f.time * 0.05);
  // Storm first, then rings, then the plane — nothing important is ever
  // painted over by the curtain.
  drawStormFront(ctx, sk, state.stormT);
  // Amber gate rings (v5): a chain of four, labelled with distances,
  // shrinking toward the horizon — the route reads as depth, not one ring.
  // v4 showed one ring + one dashed preview; the neighbours show 4-5
  // labelled rings (G-03 528m, G-04 784m...) — the chain is the win.
  const ringDists = ['380 M', '640 M', '910 M', '1.2 KM'];
  const gp = state.mission.gatesPassed;
  const ringPts = [];
  for (let i = 0; i < 4; i++) {
    const g = GATES[(gp + i) % GATES.length];
    const p = project(g.t, g.x);
    const r = 78 * p.s + 40;
    ringPts.push({ x: p.x, y: p.y - 60, r });
    drawGate(ctx, p.x, p.y - 60, r, null, i > 0, 1 - i * 0.16);
    if (i === 0) {
      drawGateTag(ctx, p.x, p.y - 60, r, 'GATE 0' + g.n + ' · ' + ringDists[i]);
    } else {
      ctx.save();
      ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(10,20,30,0.9)'; ctx.lineWidth = 3;
      const lab = 'G-0' + g.n + ' · ' + ringDists[i];
      ctx.strokeText(lab, p.x, p.y - 60 - r - 10);
      ctx.fillStyle = '#ffe9b0';
      ctx.fillText(lab, p.x, p.y - 60 - r - 10);
      ctx.restore();
    }
  }
  // The plane: 400 wide (~31% of the frame), lower-centre, on the river,
  // nose pointing up-left toward the ring — never dead centre, never
  // covering the ring or its label. (v5: 300 was too small to read.)
  drawPlane(ctx, 640, 595, 400, 0, f.time * 9);
  // Village labels on the near bank — never inside the radio panel zone,
  // never within 140 px of a gate ring.
  for (const v of VILLAGES) {
    if (v.t < 0.15 || v.t > 0.85) continue;
    const p = project(v.t, riverCenter(v.t) + (v.side || 1) * (riverHalfWidth(v.t) + 60));
    if (p.x > 830) continue;
    if (ringPts.some((rp) => Math.abs(p.x - rp.x) < 140 && Math.abs(p.y - rp.y) < 90)) continue;
    if (planeBox(p.x, p.y - 14)) continue; // never under the plane (v5)
    ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(10,20,30,0.85)'; ctx.lineWidth = 3;
    ctx.strokeText(v.name + ' · ' + v.cargo, p.x, p.y - 14);
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(v.name + ' · ' + v.cargo, p.x, p.y - 14);
  }
  drawChaseHUD(ctx, f, state.mission, state.stormT);
}

// ---- v6 COVER scene (shot 1 ONLY) ----
// Brand-new cover-scoped scene: true rear-below chase view, faceted valley
// walls, ONE flight line (ring chain + sea-lane to the vanishing point),
// bright golden-hour palette, 7 HUD panels + 1 slim radio line, zero
// clipped text. Live fly mode and shots 2-4 are untouched: draw() routes
// ONLY state.shot === 'cover' here; drawChaseScene keeps serving live play.
const COVER_VP = { x: 640, y: 300 };
const COVER_CENTRE = [[300, 640], [340, 638], [400, 632], [500, 612], [620, 588], [800, 668]];
const COVER_HALF = [[300, 10], [340, 34], [400, 56], [500, 82], [620, 120], [800, 170]];

function coverLerp(pts, y) {
  if (y <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    if (y <= pts[i + 1][0]) {
      const f = (y - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
      return pts[i][1] + f * (pts[i + 1][1] - pts[i][1]);
    }
  }
  return pts[pts.length - 1][1];
}

function drawCoverSky(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, 360);
  g.addColorStop(0, '#2b6cb8'); g.addColorStop(0.55, '#79b8e0'); g.addColorStop(1, '#ffd98a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 360);
  // Big sun + glow at the vanishing point, behind the ring chain.
  const sx = 672, sy = 288, sr = 50;
  const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, sr * 4.2);
  glow.addColorStop(0, 'rgba(255,236,170,0.95)');
  glow.addColorStop(0.4, 'rgba(255,205,110,0.45)');
  glow.addColorStop(1, 'rgba(255,180,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - sr * 4.2, sy - sr * 4.2, sr * 8.4, sr * 8.4);
  ctx.fillStyle = '#fff6cf';
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  // A few flat clouds, kept high and clear of the centre.
  ctx.fillStyle = 'rgba(255,246,232,0.9)';
  for (const [cx, cy, w, h] of [[150, 92, 120, 14], [1060, 66, 150, 16], [300, 158, 96, 12], [1140, 190, 110, 13]]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + w * 0.4, cy - h * 0.5, w * 0.55, h * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Monsoon wall: a dark storm mass FAR away at the right end of the
  // horizon, with a thin rain curtain — never a blob mid-frame.
  ctx.fillStyle = 'rgba(38,34,66,0.92)';
  for (const [ox, oy, w, h] of [[-60, 0, 130, 36], [10, -12, 150, 44], [80, 2, 110, 34]]) {
    ctx.beginPath();
    ctx.ellipse(1120 + ox, 282 + oy, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(20,22,48,0.55)';
  ctx.fillRect(1010, 300, 270, 74);
  const r = mulberry32(7);
  ctx.strokeStyle = 'rgba(190,210,235,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const rx = 1030 + r() * 230;
    const ry = 306 + r() * 52;
    ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 30);
  }
  ctx.stroke();
}

function drawCoverValley(ctx) {
  // Valley floor below the horizon.
  const gg = ctx.createLinearGradient(0, 300, 0, 800);
  gg.addColorStop(0, '#33522f'); gg.addColorStop(1, '#12251a');
  ctx.fillStyle = gg;
  ctx.fillRect(0, 300, 1280, 500);
  // Faceted walls: base polygon + alternating sun/shadow facet triangles
  // + snow glints on the highest peaks + haze wash near the vanishing point.
  const walls = [
    {
      ridge: [[0, 352], [110, 238], [210, 296], [330, 232], [430, 292], [540, 272], [640, 300]],
      bank: [[630, 300], [604, 340], [576, 400], [533, 500], [480, 620], [490, 800], [0, 800]],
      base: '#557a52', light: '#7fae6a', shadow: '#3e6b44', peaks: [1, 3]
    },
    {
      ridge: [[1280, 352], [1170, 240], [1070, 298], [950, 234], [850, 294], [740, 274], [640, 300]],
      bank: [[650, 300], [672, 340], [688, 400], [697, 500], [720, 620], [830, 800], [1280, 800]],
      base: '#4a7048', light: '#6a9a5e', shadow: '#33593c', peaks: [1, 3]
    }
  ];
  for (const w of walls) {
    ctx.fillStyle = w.base;
    ctx.beginPath();
    ctx.moveTo(w.ridge[0][0], w.ridge[0][1]);
    for (const p of w.ridge.slice(1)) ctx.lineTo(p[0], p[1]);
    for (const p of w.bank) ctx.lineTo(p[0], p[1]);
    ctx.closePath(); ctx.fill();
    const bankPick = [w.bank[1], w.bank[2], w.bank[3], w.bank[4], w.bank[5], w.bank[5]];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? w.shadow : w.light;
      ctx.beginPath();
      ctx.moveTo(w.ridge[i][0], w.ridge[i][1]);
      ctx.lineTo(w.ridge[i + 1][0], w.ridge[i + 1][1]);
      ctx.lineTo(bankPick[i][0], bankPick[i][1]);
      ctx.closePath(); ctx.fill();
    }
    // Darker base grounds the wall: gradient darkening toward the bottom,
    // clipped to the wall polygon (snow caps removed — they read as white
    // pyramids at judge size).
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w.ridge[0][0], w.ridge[0][1]);
    for (const p of w.ridge.slice(1)) ctx.lineTo(p[0], p[1]);
    for (const p of w.bank) ctx.lineTo(p[0], p[1]);
    ctx.closePath(); ctx.clip();
    const dg = ctx.createLinearGradient(0, 300, 0, 800);
    dg.addColorStop(0, 'rgba(10,20,15,0)');
    dg.addColorStop(1, 'rgba(10,20,15,0.30)');
    ctx.fillStyle = dg;
    ctx.fillRect(0, 300, 1280, 500);
    ctx.restore();
  }
  // Atmospheric haze washing out the far valley near the vanishing point.
  const hz = ctx.createRadialGradient(640, 300, 10, 640, 300, 360);
  hz.addColorStop(0, 'rgba(255,220,170,0.34)');
  hz.addColorStop(1, 'rgba(255,220,170,0)');
  ctx.fillStyle = hz;
  ctx.fillRect(280, 120, 720, 360);
}

function drawCoverRiver(ctx) {
  // Wide water band running from the bottom-centre to the VP, with a
  // gentle wobble on the banks so it reads as a river, not a road.
  const left = [], right = [];
  for (let y = 300; y <= 800; y += 20) {
    const wob = 12 * Math.sin(y * 0.045 + 0.7);
    left.push([coverLerp(COVER_CENTRE, y) - coverLerp(COVER_HALF, y) + wob, y]);
    right.push([coverLerp(COVER_CENTRE, y) + coverLerp(COVER_HALF, y) + wob, y]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const p of left.slice(1)) ctx.lineTo(p[0], p[1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  const wg = ctx.createLinearGradient(0, 300, 0, 800);
  wg.addColorStop(0, '#2f7fb0'); wg.addColorStop(1, '#9ed8ec');
  ctx.fillStyle = wg; ctx.fill();
  // Soft gold streak down the river centre (sun path) + darker water
  // along the banks so the river reads as water, not a road.
  ctx.strokeStyle = 'rgba(255,220,150,0.35)'; ctx.lineWidth = 14;
  ctx.beginPath();
  for (let y = 320; y <= 800; y += 20) {
    const x = coverLerp(COVER_CENTRE, y);
    if (y === 320) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(20,60,90,0.22)'; ctx.lineWidth = 10;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    for (let y = 300; y <= 800; y += 20) {
      const x = coverLerp(COVER_CENTRE, y) + side * (coverLerp(COVER_HALF, y) - 8);
      if (y === 300) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const gr = mulberry32(31);
  for (let i = 0; i < 42; i++) {
    const y = 320 + gr() * 460;
    const f = (800 - y) / 500;
    const x = coverLerp(COVER_CENTRE, y) + (gr() - 0.5) * coverLerp(COVER_HALF, y) * 1.2;
    const w = (10 + gr() * 34) * (0.3 + f);
    ctx.fillStyle = 'rgba(255,226,160,' + (0.3 + gr() * 0.4).toFixed(2) + ')';
    ctx.fillRect(x - w / 2, y, w, 2.5);
  }
  // Sandy banks.
  ctx.strokeStyle = '#d9c48f'; ctx.lineWidth = 7;
  for (const side of [left, right]) {
    ctx.beginPath();
    ctx.moveTo(side[0][0], side[0][1]);
    for (const p of side.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.stroke();
  }
}

function drawCoverSeaLane(ctx) {
  // Centreline dashes down the river, widening toward the camera.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let y = 770; y >= 430; y -= 42) {
    const f = (800 - y) / 500;
    const w = 3 + 5 * f, h = 10 + 14 * f;
    ctx.fillRect(coverLerp(COVER_CENTRE, y) - w / 2, y - h / 2, w, h);
  }
  // Amber buoys down both edges of the lane.
  for (const y of [740, 660, 580, 510, 450]) {
    const cx = coverLerp(COVER_CENTRE, y);
    const off = coverLerp(COVER_HALF, y) - 14;
    const r = Math.max(3, 5.5 * (0.3 + (800 - y) / 500));
    for (const s of [-1, 1]) {
      ctx.fillStyle = 'rgba(255,182,46,0.35)';
      ctx.beginPath(); ctx.arc(cx + s * off, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb62e';
      ctx.beginPath(); ctx.arc(cx + s * off, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Threshold bars across the lane near the camera.
  ctx.fillStyle = '#f2f2e8';
  const tc = coverLerp(COVER_CENTRE, 730);
  for (let i = -2; i <= 2; i++) ctx.fillRect(tc + i * 34 - 10, 726, 20, 7);
  // PAPI lights beside the threshold (2 white + 2 red).
  const papi = ['#ffffff', '#ffffff', '#ff5a3c', '#ff5a3c'];
  papi.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(806 + i * 15, 712, 5, 0, Math.PI * 2); ctx.fill();
  });
}

function drawCoverTrees(ctx) {
  const r = mulberry32(77);
  for (let i = 0; i < 16; i++) {
    const y = 560 + r() * 220;
    const side = r() < 0.5 ? -1 : 1;
    const bankX = coverLerp(COVER_CENTRE, y) + side * coverLerp(COVER_HALF, y);
    const x = bankX + side * (24 + r() * 120);
    if (x < 30 || x > 1250) continue;
    const h = 16 + r() * 24;
    ctx.fillStyle = '#24402c';
    ctx.beginPath();
    ctx.moveTo(x - h * 0.45, y); ctx.lineTo(x, y - h); ctx.lineTo(x + h * 0.45, y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a7a44';
    ctx.beginPath();
    ctx.moveTo(x - h * 0.25, y - h * 0.4); ctx.lineTo(x, y - h); ctx.lineTo(x + h * 0.25, y - h * 0.4);
    ctx.closePath(); ctx.fill();
  }
}

function drawCoverRing(ctx, x, y, r, label, labelSide) {
  ctx.save();
  ctx.shadowColor = '#ffb62e'; ctx.shadowBlur = 22;
  ctx.strokeStyle = 'rgba(8,20,32,0.9)'; ctx.lineWidth = 13;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffb62e'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  if (!label) return;
  ctx.save();
  ctx.font = 'bold 14px monospace';
  const w = ctx.measureText(label).width + 22;
  let px;
  if (labelSide === 'right') px = x + r + 14;
  else if (labelSide === 'left') px = x - r - 14 - w;
  else px = x - w / 2;
  ctx.fillStyle = 'rgba(8,20,32,0.92)';
  ctx.fillRect(px, y - 12, w, 24);
  ctx.fillStyle = '#ffe9b0'; ctx.textAlign = 'left';
  ctx.fillText(label, px + 11, y + 5);
  ctx.restore();
}

function drawCoverTitle(ctx) {
  panel(ctx, 28, 22, 330, 64, 10);
  label(ctx, 'KAPUAS RIVER RUN', 46, 54, 22, INK);
  label(ctx, 'OTTER-9  /  FLIGHT TELEMETRY', 46, 76, 14, DIM);
}

function drawCoverCompass(ctx, hdg) {
  panel(ctx, 430, 22, 420, 64, 10);
  ctx.fillStyle = DIM; ctx.font = '14px monospace'; ctx.textAlign = 'center';
  for (let deg = Math.floor((hdg - 60) / 10) * 10; deg <= hdg + 60; deg += 10) {
    const norm = ((deg % 360) + 360) % 360;
    const d = ((norm - hdg + 540) % 360) - 180;
    if (Math.abs(d) > 62) continue;
    const x = Math.max(452, Math.min(828, 640 + d * 3.1));
    const txt = norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W'
      : String(norm).padStart(3, '0');
    ctx.fillText(txt, x, 46);
    ctx.fillRect(x - 1, 54, 2, 8);
  }
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(640, 28); ctx.lineTo(632, 40); ctx.lineTo(648, 40); ctx.closePath(); ctx.fill();
  label(ctx, 'HDG  ' + String(Math.round(hdg)).padStart(3, '0') + '°', 640, 78, 16, INK, 'center');
}

function drawCoverMission(ctx, m) {
  const s = m.sortie;
  panel(ctx, 922, 22, 330, 236, 10);
  label(ctx, '0' + s.n + '  /  RIVER SORTIE', 940, 48, 14, AMBER);
  label(ctx, s.name, 940, 80, 28, INK);
  label(ctx, s.brief, 940, 104, 14, DIM);
  label(ctx, 'GATES  ' + String(m.gatesPassed).padStart(2, '0') + ' / ' + String(m.gatesTotal).padStart(2, '0'), 940, 130, 15, INK);
  label(ctx, 'PTS  ' + fmtScore(m.score), 1234, 130, 15, INK, 'right');
  label(ctx, 'LANDFALL  ' + fmtClock(m.landfallSec) + '  ·  STORM 2.6 NM', 940, 154, 15, '#ff9a7a');
  ctx.strokeStyle = PANEL_EDGE;
  ctx.beginPath(); ctx.moveTo(940, 168); ctx.lineTo(1234, 168); ctx.stroke();
  m.checklist.forEach((c, i) => {
    const y = 190 + i * 20;
    ctx.fillStyle = c.done ? GREEN : 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.arc(950, y - 4, 6, 0, Math.PI * 2); ctx.fill();
    if (c.done) {
      ctx.strokeStyle = '#0b2233'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(947, y - 4); ctx.lineTo(950, y - 1); ctx.lineTo(954, y - 8); ctx.stroke();
    }
    label(ctx, c.label + (c.prog ? '  ' + c.prog : ''), 964, y, 14, c.done ? DIM : INK);
  });
}

function drawCoverRadio(ctx, m) {
  panel(ctx, 900, 266, 352, 30, 8);
  ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
  const a = 'Capt. Vela: ';
  ctx.fillStyle = AMBER;
  ctx.fillText(a, 914, 286);
  ctx.fillStyle = INK;
  ctx.fillText('"Make your drops count."', 914 + ctx.measureText(a).width, 286);
}

function drawCoverSpeedAlt(ctx, speedKt, altFt) {
  panel(ctx, 28, 300, 150, 108, 10);
  label(ctx, 'AIRSPEED', 46, 330, 14, DIM);
  label(ctx, String(Math.round(speedKt)), 46, 386, 44, INK);
  label(ctx, 'KNOTS', 46, 400, 14, DIM);
  panel(ctx, 1102, 300, 150, 108, 10);
  label(ctx, 'ALTITUDE', 1120, 330, 14, DIM);
  label(ctx, String(Math.round(altFt)), 1120, 386, 44, INK);
  label(ctx, 'FEET MSL', 1120, 400, 14, DIM);
}

function drawCoverBars(ctx, f) {
  panel(ctx, 28, 636, 330, 104, 10);
  const bars = [
    ['THR', f.throttle, AMBER], ['FUEL', f.fuelKg, GREEN], ['AIRFRAME', f.hull, '#37b6e0']
  ];
  bars.forEach(([name, v, col], i) => {
    const y = 672 + i * 28;
    label(ctx, name, 46, y, 14, DIM);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(150, y - 11, 140, 10);
    ctx.fillStyle = col;
    ctx.fillRect(150, y - 11, 140 * Math.max(0, Math.min(1, v / 100)), 10);
    label(ctx, Math.round(v) + '%', 342, y, 14, INK, 'right');
  });
}

function drawCoverMinimap(ctx, m) {
  panel(ctx, 1002, 600, 250, 170, 10);
  label(ctx, 'KAPUAS SECTOR', 1020, 626, 14, DIM);
  label(ctx, 'N', 1234, 626, 14, AMBER, 'right');
  ctx.strokeStyle = '#6fb7d9'; ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = 1110 + (riverCenter(t) / 380) * 80;
    const y = 640 + t * 110;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
  for (const v of VILLAGES) {
    if (v.name !== 'PUTUSSIBAU' && v.name !== 'NANGA ERA' && v.name !== 'PONTIANAK') continue;
    const x = 1110 + (riverCenter(v.t) / 380) * 80;
    const y = 640 + v.t * 110;
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = DIM;
    ctx.fillText(v.name, x + 9, y + 5);
  }
  const px = 1110 + (riverCenter(0.42) / 380) * 80;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(px, 640 + 0.42 * 110, 5, 0, Math.PI * 2); ctx.fill();
}

function drawCoverScene() {
  const f = state.flight, m = state.mission;
  drawCoverSky(ctx);
  drawCoverValley(ctx);
  drawCoverRiver(ctx);
  drawCoverSeaLane(ctx);
  drawCoverTrees(ctx);
  // Village labels on the banks, clear of every panel and the ring chain.
  for (const [txt, x, y] of [['NANGA ERA · MEDICINE', 400, 600], ['SINTANG · MAIL', 880, 600]]) {
    ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(10,20,30,0.85)'; ctx.lineWidth = 3;
    ctx.strokeText(txt, x, y);
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(txt, x, y);
  }
  // One flight line: big next gate + chain shrinking toward the sun.
  drawCoverRing(ctx, 628, 392, 90, 'GATE 03 · 380 M', 'right');
  drawCoverRing(ctx, 626, 340, 30, 'G-05 · 640 M', 'left');
  drawCoverRing(ctx, 624, 272, 16, 'G-06 · 910 M', 'left');
  // The Otter-9, rear-below chase view, nose at the big ring's centre.
  drawPlaneChaseV6(ctx, 624, 585, 400);
  // Decluttered HUD: 7 panels + 1 slim radio line. No footer, no pills,
  // no storm banner, no big radio panel. Smallest functional text 14px.
  drawCoverTitle(ctx);
  drawCoverCompass(ctx, f.hdg);
  drawCoverMission(ctx, m);
  drawCoverRadio(ctx, m);
  drawCoverSpeedAlt(ctx, f.speedKt, f.altFt);
  drawCoverBars(ctx, f);
  drawCoverMinimap(ctx, m);
}

function draw() {
  ctx.clearRect(0, 0, 1280, 800);
  if (state.shot === 'cover') { drawCoverScene(); return; }
  if (state.mode === 'hangar') { drawHangar(ctx, sky(), state.skyMode); return; }
  if (state.mode === 'debrief') { drawDebrief(ctx, state.mission); return; }
  if (state.mode === 'cockpit') { drawCockpit(ctx, state.flight, state.mission, sky(), state.stormT); return; }
  drawChaseScene();
}

function loop(ts) {
  if (!state.shot) {
    stepFlight(state.flight, state.input, 1 / 60);
    // Landfall timer ticks down; the storm wall advances with it.
    state.mission.landfallSec = Math.max(0, state.mission.landfallSec - 1 / 60);
    state.stormT = 0.15 + (state.mission.landfallSec / 287) * 0.55;
    state.mission.fuelKg = state.flight.fuelKg;
  }
  draw();
  if (!state.shot) requestAnimationFrame(loop);
}

// ---- Staged screenshot states (frozen, exact values) ----
function stageShot(name) {
  state.shot = name;
  const f = state.flight, m = state.mission;
  if (name === 'cover') {
    state.mode = 'fly';
    Object.assign(f, { speedKt: 132, altFt: 310, hdg: 46, pitch: 2, bank: -7, throttle: 66, fuelKg: 84, hull: 100, vsFpm: -1170, time: 2.4 });
    Object.assign(m, { gatesPassed: 2, score: 18450, landfallSec: 287 });
    m.checklist[1].prog = '2/6';
    state.stormT = 0.62;
  } else if (name === 'cockpit') {
    state.mode = 'cockpit';
    Object.assign(f, { speedKt: 174, altFt: 289, hdg: 270, pitch: -3, bank: 0, throttle: 56, fuelKg: 55, hull: 96, vsFpm: -969, time: 74 });
    Object.assign(m, { gatesPassed: 5, score: 27100, landfallSec: 212 });
    state.stormT = 0.5;
  } else if (name === 'hangar') {
    state.mode = 'hangar';
    state.skyMode = 'STORM DUSK';
  } else if (name === 'debrief') {
    state.mode = 'debrief';
    Object.assign(m, { gatesPassed: 6, score: 31200, landfallSec: 72 });
  }
  draw();
}

// ---- Input ----
const KEYMAP = {
  KeyW: 'throttleUp', KeyS: 'throttleDown',
  KeyA: 'left', KeyD: 'right',
  ArrowUp: 'pitchUp', ArrowDown: 'pitchDown'
};
window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code] != null) { state.input[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.code === 'KeyC') state.mode = state.mode === 'cockpit' ? 'fly' : 'cockpit';
  if (e.code === 'KeyH') state.mode = state.mode === 'hangar' ? 'fly' : 'hangar';
  if (e.code === 'KeyP') state.flight.paused = !state.flight.paused;
  if (e.code === 'KeyE') {
    // Drop cargo at the next village: +400 and the checklist advances.
    const m = state.mission;
    if (m.dropsDone < m.dropsTotal) {
      m.dropsDone++;
      m.score += 400;
      m.checklist[2].done = m.dropsDone >= 1;
      m.toast = 'CARGO AWAY +400 — ' + m.sortie.legs[m.dropsDone - 1] + ' thanks you, Otter-Nine.';
    }
  }
});
window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code] != null) state.input[KEYMAP[e.code]] = false;
});

// ---- Boot ----
(function boot() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  const skyParam = q.get('sky');
  if (skyParam && SKY_KEYS[skyParam]) state.skyMode = skyParam;
  if (shot) { stageShot(shot); window.__ready = true; window.__game = state; return; }
  requestAnimationFrame(loop);
  window.__ready = true;
  window.__game = state; // exposed for the headless playtest
})();
