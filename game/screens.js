// screens.js — the hangar, cockpit, and debrief screens.
// Hangar proves depth (3 aircraft, 3 sorties, 3 sky lightings); the cockpit
// proves the instruments are flown, not drawn; the debrief proves the loop
// closes with a flight-recorder chart and a refit choice.
'use strict';

// ---- HANGAR (screenshot 3) ----
function drawHangar(ctx, sky, skyMode) {
  // Dusk airfield behind the panels: runway 27 + night storm approach.
  drawSky(ctx, sky, 980, 180, 34);
  drawClouds(ctx, sky, 4);
  drawRidges(ctx, sky);
  // Flat airfield ground.
  const gg = ctx.createLinearGradient(0, 420, 0, 800);
  gg.addColorStop(0, '#2c4632'); gg.addColorStop(1, '#16241a');
  ctx.fillStyle = gg; ctx.fillRect(0, 420, 1280, 380);
  drawRunway(ctx, 640, 430, 760, 60, 380, '27');
  // The selected aircraft sitting on the runway, side profile — a chase
  // view here reads as a crashed X; a side profile reads as an aircraft.
  drawPlaneSide(ctx, 640, 640, 260);
  // Left panel: title + aircraft hangar.
  panel(ctx, 28, 22, 470, 640, 12);
  label(ctx, 'KAPUAS RIVER RUN', 52, 62, 30, INK);
  label(ctx, 'Select Airframe & Sortie', 52, 88, 15, DIM);
  ctx.fillStyle = AMBER;
  roundRect(ctx, 380, 44, 92, 30, 6); ctx.fill();
  label(ctx, 'FLY [H]', 426, 65, 14, '#0b2233', 'center');
  label(ctx, 'AIRCRAFT HANGAR', 52, 128, 14, AMBER);
  AIRCRAFT.forEach((a, i) => {
    const y = 142 + i * 104;
    ctx.fillStyle = a.sel ? 'rgba(255,182,46,0.16)' : 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = a.sel ? AMBER : PANEL_EDGE; ctx.lineWidth = a.sel ? 2 : 1;
    roundRect(ctx, 52, y, 422, 92, 8); ctx.fill(); ctx.stroke();
    label(ctx, a.name, 70, y + 30, 20, a.sel ? AMBER : INK);
    label(ctx, a.kind, 70, y + 54, 13, DIM);
    label(ctx, 'MAX ' + a.maxKt + ' KT · STL ' + a.stol, 70, y + 76, 13, INK);
    label(ctx, a.desc, 70, y + 88, 11, DIM);
  });
  // Sortie list.
  label(ctx, 'TACTICAL SORTIES', 52, 470, 14, AMBER);
  SORTIES.forEach((s, i) => {
    const x = 52 + i * 144;
    ctx.fillStyle = s.sel ? 'rgba(255,182,46,0.16)' : 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = s.sel ? AMBER : PANEL_EDGE; ctx.lineWidth = s.sel ? 2 : 1;
    roundRect(ctx, x, 484, 134, 92, 8); ctx.fill(); ctx.stroke();
    label(ctx, 'SORTIE 0' + s.n, x + 12, 508, 12, s.sel ? AMBER : DIM);
    label(ctx, s.name, x + 12, 528, 13, INK);
    ctx.fillStyle = DIM; ctx.font = '11px monospace';
    wrapText(ctx, s.brief, x + 12, 546, 112, 14);
  });
  // Sky lighting pills.
  label(ctx, 'SKY LIGHTING', 52, 600, 14, AMBER);
  SKY_MODES.forEach((mode, i) => {
    const x = 52 + i * 140;
    const on = mode === skyMode;
    ctx.fillStyle = on ? AMBER : 'rgba(255,255,255,0.08)';
    roundRect(ctx, x, 608, 128, 30, 6); ctx.fill();
    label(ctx, mode, x + 64, 628, 12, on ? '#0b2233' : INK, 'center');
  });
  // Right column: the mission card for the selected sortie + storm note.
  panel(ctx, 782, 22, 470, 220, 12);
  label(ctx, '01  /  RIVER SORTIE', 806, 52, 13, AMBER);
  label(ctx, 'Putussibau Run', 806, 88, 30, INK);
  label(ctx, 'Fly the river · serve three villages', 806, 114, 14, DIM);
  label(ctx, 'before the monsoon lands.', 806, 134, 14, DIM);
  label(ctx, 'GATES  06   ·   DROPS  03   ·   PTS  018450', 806, 166, 14, INK);
  label(ctx, 'MONSOON LANDFALL  4:47  ·  STORM 2.6 NM', 806, 196, 13, '#ff9a7a');
  label(ctx, 'KAPUAS TOWER · Capt. Vela: "Make your drops count."', 806, 220, 12, DIM);
  drawFooter(ctx);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ---- COCKPIT (screenshot 2) ----
function drawCockpit(ctx, f, m, sky, stormT) {
  // Windscreen: river + runway + green HUD ring ahead.
  drawSky(ctx, sky, 900, 170, 30);
  drawClouds(ctx, sky, 8);
  drawRidges(ctx, sky);
  drawRiver(ctx, sky, 0.42);
  drawTributaries(ctx, sky);
  drawForest(ctx, sky);
  // Runway 27 ahead, inside the windscreen above the panel.
  drawRunway(ctx, 640, 350, 428, 26, 150, '27');
  // Green HUD ladder + gate ring over the runway.
  ctx.strokeStyle = 'rgba(120,255,190,0.85)'; ctx.lineWidth = 3;
  // FIX (v5): the ring's bottom arc crossed the runway "27" numerals.
  // Ring moved up (centre 284, r 76/54) and the labels sit above it.
  ctx.beginPath(); ctx.arc(640, 284, 76, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(640, 284, 54, 0, Math.PI * 2); ctx.stroke();
  ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#7dffbe'; ctx.textAlign = 'center';
  ctx.fillText('GATE 6 · 0.2 NM', 640, 166);
  ctx.fillText('RWY 27 LINEUP', 640, 188);
  // Canopy frame pillars.
  ctx.fillStyle = '#0c141c';
  ctx.fillRect(0, 0, 90, 430);
  ctx.fillRect(1190, 0, 90, 430);
  ctx.beginPath(); ctx.moveTo(180, 0); ctx.lineTo(250, 0); ctx.lineTo(210, 430); ctx.lineTo(150, 430); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(1100, 0); ctx.lineTo(1030, 0); ctx.lineTo(1070, 430); ctx.lineTo(1130, 430); ctx.closePath(); ctx.fill();
  // Instrument panel.
  const pg = ctx.createLinearGradient(0, 430, 0, 800);
  pg.addColorStop(0, '#101c26'); pg.addColorStop(1, '#05090d');
  ctx.fillStyle = pg; ctx.fillRect(0, 430, 1280, 370);
  ctx.fillStyle = '#1d2f45';
  ctx.beginPath(); ctx.ellipse(640, 470, 700, 40, 0, 0, Math.PI * 2); ctx.fill();
  // Left: TACTICAL NAV radar.
  panel(ctx, 40, 500, 300, 210, 10);
  label(ctx, 'TACTICAL NAV  /  2.6 KM', 60, 526, 13, DIM);
  const rx = 190, ry = 610, rr = 74;
  ctx.strokeStyle = 'rgba(120,255,190,0.5)'; ctx.lineWidth = 1.5;
  for (const k of [1, 0.66, 0.33]) {
    ctx.beginPath(); ctx.arc(rx, ry, rr * k, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(rx, ry - rr); ctx.lineTo(rx, ry + rr);
  ctx.moveTo(rx - rr, ry); ctx.lineTo(rx + rr, ry); ctx.stroke();
  // Sweep + river trace.
  const sa = f.time * 0.9;
  ctx.strokeStyle = '#7dffbe'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(rx, ry);
  ctx.lineTo(rx + Math.cos(sa) * rr, ry + Math.sin(sa) * rr); ctx.stroke();
  ctx.strokeStyle = '#6fb7d9'; ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = rx + (riverCenter(t) / 380) * 60;
    const y = ry - 60 + t * 120;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(rx, ry + 10, 5, 0, Math.PI * 2); ctx.fill();
  // Centre: attitude indicator with pitch ladder + HDG tape.
  panel(ctx, 380, 500, 520, 210, 10);
  const ax = 640, ay = 600;
  ctx.save();
  ctx.beginPath(); ctx.rect(400, 520, 480, 150); ctx.clip();
  ctx.fillStyle = '#3f8fd0'; ctx.fillRect(400, 520, 480, 75);
  ctx.fillStyle = '#c98a4e'; ctx.fillRect(400, 595, 480, 75);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
  for (const d of [-20, -10, 0, 10, 20]) {
    const y = ay + d * 2.2;
    ctx.beginPath(); ctx.moveTo(ax - 90, y); ctx.lineTo(ax + 90, y); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
    ctx.fillText(String(Math.abs(d)), ax - 110, y + 4);
    ctx.fillText(String(Math.abs(d)), ax + 110, y + 4);
  }
  ctx.restore();
  ctx.strokeStyle = AMBER; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(ax - 46, ay); ctx.lineTo(ax + 46, ay); ctx.stroke();
  label(ctx, 'HDG 270°', ax, 540, 13, INK, 'center');
  label(ctx, '174', 480, 610, 20, INK, 'center');
  label(ctx, '289', 800, 610, 20, INK, 'center');
  label(ctx, 'VSI -969', ax, 700, 13, DIM, 'center');
  // Right: FUEL / SYS gauge.
  panel(ctx, 940, 500, 300, 210, 10);
  label(ctx, 'FUEL  /  SYS', 960, 526, 13, DIM);
  const gx = 1050, gy = 588, gr = 44;
  ctx.strokeStyle = DIM; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(gx, gy, gr, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
  ctx.strokeStyle = GREEN; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(gx, gy, gr, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * 0.55); ctx.stroke();
  label(ctx, '55%', gx, gy + 6, 22, INK, 'center');
  label(ctx, 'N1 RPM', gx, gy + 26, 11, DIM, 'center');
  const sysBars = [['FUEL', 60, GREEN], ['HULL', 96, '#37b6e0']];
  sysBars.forEach(([name, v, col], i) => {
    const y = 560 + i * 26;
    label(ctx, name, 1130, y, 12, DIM);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(1130, y + 6, 90, 8);
    ctx.fillStyle = col; ctx.fillRect(1130, y + 6, 90 * v / 100, 8);
  });
  const pills = [['GEAR DN', 1], ['FLAP 15°', 1], ['AB BURN', 0], ['SPD BRK', 0], ['STALL', 0]];
  pills.forEach(([t, on], i) => {
    const x = 960 + (i % 2) * 130, y = 626 + Math.floor(i / 2) * 28;
    ctx.fillStyle = on ? 'rgba(55,224,138,0.2)' : 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = on ? GREEN : PANEL_EDGE;
    roundRect(ctx, x, y, 118, 24, 5); ctx.fill(); ctx.stroke();
    label(ctx, t, x + 59, y + 16, 11, on ? GREEN : DIM, 'center');
  });
  // Bottom status pills + keys (kept clear of each other).
  const bot = [['GEAR DN', 1], ['FLAPS 15°', 1], ['BRK OFF', 0], ['AB OFF', 0], ['YOKE OFF', 0]];
  bot.forEach(([t, on], i) => {
    const x = 380 + i * 92;
    ctx.fillStyle = on ? 'rgba(55,224,138,0.2)' : 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = on ? GREEN : PANEL_EDGE;
    roundRect(ctx, x, 736, 84, 26, 5); ctx.fill(); ctx.stroke();
    label(ctx, t, x + 42, 753, 11, on ? GREEN : DIM, 'center');
  });
  label(ctx, 'W/S pitch · A/D roll · Q/E yaw', 1252, 744, 12, DIM, 'right');
  label(ctx, 'Shift/Ctrl throttle · G gear · F flaps', 1252, 762, 12, DIM, 'right');
  label(ctx, 'C view · M yoke · H hangar · R reset', 1252, 780, 12, DIM, 'right');
  // Slim top bar (VALENFJORD style) — no title/mission cards in the cockpit.
  panel(ctx, 28, 22, 392, 36, 8);
  label(ctx, 'SORTIE 01  ·  FINAL GATE — RWY 27  ·  WP 6/7', 46, 45, 14, INK);
  panel(ctx, 980, 22, 272, 36, 8);
  label(ctx, 'OTTER-9  ·  CAM: COCKPIT  ·  01:14', 1234, 45, 13, DIM, 'right');
  drawCompass(ctx, 270);
}

// ---- DEBRIEF (screenshot 4) ----
function drawDebrief(ctx, m) {
  ctx.fillStyle = '#0a1622'; ctx.fillRect(0, 0, 1280, 800);
  // Faint river map behind.
  ctx.strokeStyle = 'rgba(111,183,217,0.25)'; ctx.lineWidth = 10;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = 200 + (riverCenter(t) / 380) * 700;
    const y = 120 + t * 560;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  panel(ctx, 60, 40, 1160, 720, 14);
  label(ctx, 'SORTIE DEBRIEF — PUTUSSIBAU RUN', 100, 96, 30, INK);
  label(ctx, 'OTTER-9  ·  KAPUAS RIVER  ·  GOLDEN SUNSET  ·  LANDFALL BEATEN BY 1:12', 100, 124, 14, GREEN);
  // Per-leg table (sums to the cover score).
  const legs = [
    ['LEG 1', 'PUTUSSIBAU → NANGA ERA', 'MAIL + MEDICINE', 'RINGS 2/2', '9,400'],
    ['LEG 2', 'NANGA ERA → TAYAN', 'SPARE PARTS', 'RINGS 2/2', '10,800'],
    ['LEG 3', 'TAYAN → PONTIANAK', 'MAIL · WATER LANDING', 'RINGS 2/2', '11,000']
  ];
  label(ctx, 'LEG', 100, 168, 13, DIM);
  label(ctx, 'ROUTE', 200, 168, 13, DIM);
  label(ctx, 'CARGO', 560, 168, 13, DIM);
  label(ctx, 'RINGS', 820, 168, 13, DIM);
  label(ctx, 'PTS', 1080, 168, 13, DIM, 'right');
  legs.forEach((L, i) => {
    const y = 200 + i * 40;
    label(ctx, L[0], 100, y, 16, AMBER);
    label(ctx, L[1], 200, y, 16, INK);
    label(ctx, L[2], 560, y, 14, DIM);
    label(ctx, L[3], 820, y, 14, INK);
    label(ctx, L[4], 1080, y, 16, INK, 'right');
  });
  ctx.strokeStyle = PANEL_EDGE;
  ctx.beginPath(); ctx.moveTo(100, 320); ctx.lineTo(1120, 320); ctx.stroke();
  label(ctx, 'TOTAL', 820, 352, 16, INK);
  label(ctx, '31,200', 1080, 352, 22, AMBER, 'right');
  label(ctx, 'COMBO BEST ×8  ·  PERFECT RINGS 3  ·  FUEL LEFT 41 KG  ·  HULL 96%', 100, 352, 14, DIM);
  // Flight-recorder chart: smooth altitude + speed traces.
  label(ctx, 'FLIGHT RECORDER — ALTITUDE (AMBER) + SPEED (GREEN)', 100, 410, 14, AMBER);
  const cx0 = 100, cy0 = 430, cw = 1020, ch = 170;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(cx0, cy0, cw, ch);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  for (let i = 1; i < 5; i++) {
    ctx.beginPath(); ctx.moveTo(cx0, cy0 + ch * i / 5); ctx.lineTo(cx0 + cw, cy0 + ch * i / 5); ctx.stroke();
  }
  const trace = (fn, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const x = cx0 + cw * i / 60;
      const y = cy0 + ch - ch * fn(i / 60);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  trace(t => 0.25 + 0.5 * Math.sin(t * 5.4) * 0.4 + 0.35 * t * (1 - t) * 2, AMBER);
  trace(t => 0.55 + 0.25 * Math.sin(t * 7.1 + 1) + 0.12 * Math.sin(t * 13), GREEN);
  label(ctx, 'TAKEOFF', cx0, 624, 12, DIM);
  label(ctx, 'RING 3', cx0 + cw * 0.33, 624, 12, DIM);
  label(ctx, 'DROP TAYAN', cx0 + cw * 0.66, 624, 12, DIM);
  label(ctx, 'WATER LANDING', cx0 + cw - 90, 624, 12, DIM);
  // Turnaround refit: pick 1 of 3.
  label(ctx, 'TURNAROUND — PICK ONE REFIT FOR LEG 2', 100, 668, 14, AMBER);
  const refits = [
    ['REFUEL', '+40 KG FUEL', 'Full tanks for the long leg to Sintang.'],
    ['REPAIR HULL', '+12% HULL', 'Patch the floats after the rough Tayan drop.'],
    ['STORM RADAR', '-45 S LANDFALL', 'See the wall coming. Buy time, not fuel.']
  ];
  refits.forEach((r, i) => {
    const x = 100 + i * 350;
    ctx.fillStyle = i === 0 ? 'rgba(255,182,46,0.16)' : 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = i === 0 ? AMBER : PANEL_EDGE; ctx.lineWidth = i === 0 ? 2 : 1;
    roundRect(ctx, x, 684, 330, 72, 8); ctx.fill(); ctx.stroke();
    label(ctx, r[0], x + 16, 708, 16, i === 0 ? AMBER : INK);
    label(ctx, r[1], x + 16, 730, 13, INK);
    label(ctx, r[2], x + 16, 748, 11, DIM);
  });
  drawFooter(ctx);
}
