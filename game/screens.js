// screens.js — cockpit, hangar and debrief, all NEW (REBUILD-0).
// Cockpit and hangar render through the SAME 3D engine as the cover:
// the world you see through the windscreen is the world the plane flies in.
// Debrief is a fresh 2D layout: flight-recorder chart + leg table + refit.
'use strict';

// ---- Cockpit: through the windscreen ----
function drawCockpitScene(ctx, f, m) {
  const pos = planeWorldPos(f);
  const yawDeg = planeYaw(f) * 180 / Math.PI;
  const cam = makeCamera(pos[0], pos[1] + 1.0, pos[2] - 1.5, yawDeg, 800, 300, 640);
  const z0 = Math.max(0, pos[2] - 10), z1 = pos[2] + 200;
  drawSky(ctx, 1280, 800, {
    sunX: 640, sunY: 250, sunR: 46, storm: false,
    clouds: [[180, 110, 130, 15, 0.9], [980, 90, 150, 16, 0.9], [560, 160, 100, 12, 0.8], [1120, 190, 110, 13, 0.85]],
  });
  drawValley(ctx, cam, z0, z1);
  drawRiver(ctx, cam, z0, z1);
  drawBankLife(ctx, cam, z0, z1);
  drawSeaLane(ctx, cam);
  drawRingChain(ctx, cam, RINGS.slice().reverse());
  // Nose cowling bump at the bottom centre (you are IN the plane).
  ctx.fillStyle = '#d9c48f';
  ctx.beginPath();
  ctx.ellipse(640, 812, 190, 46, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#8a6a42';
  ctx.beginPath();
  ctx.ellipse(640, 806, 60, 14, 0, Math.PI, 0);
  ctx.fill();
  // Windscreen frame: dark pillars + top bar.
  ctx.fillStyle = '#0b1a28';
  ctx.fillRect(0, 0, 1280, 26);
  ctx.beginPath(); ctx.moveTo(0, 26); ctx.lineTo(120, 600); ctx.lineTo(180, 600); ctx.lineTo(60, 26); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(1280, 26); ctx.lineTo(1160, 600); ctx.lineTo(1100, 600); ctx.lineTo(1220, 26); ctx.closePath(); ctx.fill();
  // Dashboard: bottom panel with instruments that are actually flown.
  const dg = ctx.createLinearGradient(0, 600, 0, 800);
  dg.addColorStop(0, '#12283c'); dg.addColorStop(1, '#0a1622');
  ctx.fillStyle = dg;
  ctx.fillRect(0, 600, 1280, 200);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.moveTo(0, 600); ctx.lineTo(1280, 600); ctx.stroke();
  // Attitude indicator (centre): horizon line rolled by bank, pitched.
  const ax = 640, ay = 700, ar = 62;
  ctx.save();
  ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#2a6bc0'; ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
  ctx.fillStyle = '#7a5a34'; ctx.fillRect(ax - ar, ay, ar * 2, ar * 2);
  ctx.translate(ax, ay);
  ctx.rotate(-f.bank * Math.PI / 180);
  ctx.translate(0, f.pitch * 2);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-ar, 0); ctx.lineTo(ar, 0); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = HUD_EDGE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = HUD_AMBER;
  ctx.beginPath(); ctx.moveTo(ax - 8, ay); ctx.lineTo(ax + 8, ay); ctx.lineTo(ax, ay + 8); ctx.closePath(); ctx.fill();
  hudLabel(ctx, 'ATT', ax, ay + ar + 22, 14, HUD_DIM, 'center');
  // Speed tape (left) + alt tape (right).
  hudLabel(ctx, 'IAS', 240, 640, 16, HUD_DIM);
  bigNumber(ctx, String(Math.round(f.speedKt)), 240, 700, 52);
  hudLabel(ctx, 'KT', 240, 730, 16, HUD_DIM);
  hudLabel(ctx, 'ALT', 1040, 640, 16, HUD_DIM, 'right');
  bigNumber(ctx, String(Math.round(f.altFt)), 1040, 700, 52, 'right');
  hudLabel(ctx, 'FT', 1040, 730, 16, HUD_DIM, 'right');
  // Compass strip on the dashboard top edge.
  ctx.fillStyle = HUD_DIM;
  ctx.font = '14px monospace'; ctx.textAlign = 'center';
  for (let deg = Math.floor((f.hdg - 40) / 10) * 10; deg <= f.hdg + 40; deg += 10) {
    const norm = ((deg % 360) + 360) % 360;
    const d = ((norm - f.hdg + 540) % 360) - 180;
    if (Math.abs(d) > 42) continue;
    const x = 640 + d * 4;
    ctx.fillText(norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W' : String(norm).padStart(3, '0'), x, 628);
  }
  hudLabel(ctx, 'HDG ' + String(Math.round(f.hdg)).padStart(3, '0') + '°', 640, 660, 16, HUD_INK, 'center');
  // Fuel bar + landing checklist.
  hudLabel(ctx, 'FUEL', 60, 640, 16, HUD_DIM);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(60, 652, 140, 12);
  ctx.fillStyle = '#37e08a';
  ctx.fillRect(60, 652, 140 * Math.max(0, Math.min(1, f.fuelKg / 100)), 12);
  hudLabel(ctx, Math.round(f.fuelKg) + '%', 60, 690, 16, HUD_INK);
  hudLabel(ctx, 'LANDING CHECKLIST', 60, 740, 15, HUD_AMBER);
  hudLabel(ctx, 'GEAR DOWN · FLAPS 20 · SPEED 90', 60, 764, 15, HUD_INK);
  hudLabel(ctx, 'GATES ' + m.gatesPassed + '/' + m.gatesTotal + '   PTS ' + fmtScore(m.score), 1220, 740, 16, HUD_INK, 'right');
  hudLabel(ctx, 'LANDFALL ' + fmtClock(m.landfallSec), 1220, 764, 16, '#ff9a7a', 'right');
}

// ---- Hangar: three Otters moored on the float base ----
function drawHangarScene(ctx, f, m) {
  const cam = makeCamera(0, 2.5, -10, 0, 800, 300, 640);
  drawSky(ctx, 1280, 800, {
    sunX: 950, sunY: 250, sunR: 50, storm: false,
    clouds: [[160, 100, 140, 15, 0.9], [700, 80, 160, 16, 0.9], [420, 170, 100, 12, 0.8]],
  });
  drawValley(ctx, cam, -8, 140);
  drawRiver(ctx, cam, -8, 140);
  drawBankLife(ctx, cam, -8, 140);
  // Three parked Otters moored on the water by the base, near to far so
  // the nearest one reads big. Floats sit at water level (y=1.8).
  const parked = [
    { x: riverCenter(12) - 6, z: 12, yaw: 0.6, label: 'OTTER-9' },
    { x: riverCenter(30) + 10, z: 30, yaw: -0.4, label: 'OTTER-4' },
    { x: riverCenter(48) + 8, z: 48, yaw: 1.0, label: 'OTTER-2' },
  ];
  for (const p of parked) {
    drawAircraft(ctx, cam, { pos: [p.x, 1.8, p.z], yaw: p.yaw, pitch: 0, roll: 0, time: 0, label: p.label });
  }
  // Windsock on the right bank.
  const wsx = riverCenter(24) + 18;
  const ws = cam.project(wsx, valleyHeight(wsx, 24) + 6, 24);
  if (ws) {
    ctx.strokeStyle = '#c8c8c8'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(ws.x, ws.y + 40); ctx.lineTo(ws.x, ws.y); ctx.stroke();
    ctx.fillStyle = '#ff7a3c';
    ctx.beginPath(); ctx.moveTo(ws.x, ws.y); ctx.lineTo(ws.x + 34, ws.y + 6); ctx.lineTo(ws.x, ws.y + 12); ctx.closePath(); ctx.fill();
  }
  // Sortie board (glass chip, left) + title.
  glassChip(ctx, 40, 90, 380, 300, 12);
  hudLabel(ctx, 'PUTUSSIBAU FLOAT BASE', 60, 122, 18, HUD_AMBER);
  hudLabel(ctx, 'NEXT SORTIE', 60, 152, 15, HUD_DIM);
  hudLabel(ctx, '01 / Putussibau Run', 60, 182, 20, HUD_INK);
  hudLabel(ctx, 'Fly the river · 3 villages, 6 gates', 60, 208, 15, HUD_DIM);
  hudLabel(ctx, 'FLEET', 60, 244, 15, HUD_DIM);
  hudLabel(ctx, 'OTTER-9  ·  READY', 60, 270, 16, HUD_INK);
  hudLabel(ctx, 'OTTER-4  ·  FUELING', 60, 296, 16, HUD_INK);
  hudLabel(ctx, 'OTTER-2  ·  MAINTENANCE', 60, 322, 16, HUD_INK);
  hudLabel(ctx, 'WIND 240° / 08 KT · QNH 1013', 60, 362, 15, HUD_DIM);
  hudLabel(ctx, 'HANGAR — 3 OTTERS READY', 640, 60, 22, HUD_INK, 'center');
  hudLabel(ctx, 'Pick your bird. The river does not wait.', 640, 88, 16, HUD_DIM, 'center');
}

// ---- Debrief: flight-recorder chart + leg table + refit picks ----
function drawDebriefScene(ctx, f, m) {
  const bg = ctx.createLinearGradient(0, 0, 0, 800);
  bg.addColorStop(0, '#0d1f31'); bg.addColorStop(1, '#0a1622');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1280, 800);
  hudLabel(ctx, 'DEBRIEF — PUTUSSIBAU RUN', 40, 56, 26, HUD_INK);
  hudLabel(ctx, 'OTTER-9 · Capt. Vela', 40, 84, 16, HUD_DIM);
  hudLabel(ctx, 'SCORE', 1240, 40, 16, HUD_DIM, 'right');
  bigNumber(ctx, fmtScore(m.score), 1240, 84, 56, 'right');
  // Flight-recorder chart (left): altitude (amber) + speed (blue) over 287 s.
  glassChip(ctx, 40, 110, 720, 300, 12);
  hudLabel(ctx, 'FLIGHT RECORDER — ALTITUDE / SPEED', 60, 138, 15, HUD_DIM);
  const rnd = mulberry32(99);
  const alt = [], spd = [];
  for (let i = 0; i <= 60; i++) {
    alt.push(280 + Math.sin(i * 0.22) * 60 + (rnd() - 0.5) * 24);
    spd.push(120 + Math.sin(i * 0.15 + 1) * 30 + (rnd() - 0.5) * 14);
  }
  const plot = (series, min, max, col) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.beginPath();
    series.forEach((v, i) => {
      const x = 70 + (i / 60) * 660;
      const y = 380 - ((v - min) / (max - min)) * 210;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = 170 + i * 52;
    ctx.beginPath(); ctx.moveTo(70, y); ctx.lineTo(730, y); ctx.stroke();
  }
  plot(alt, 180, 420, '#ffb62e');
  plot(spd, 60, 200, '#37b6e0');
  hudLabel(ctx, '— ALT (FT)', 70, 400, 14, '#ffb62e');
  hudLabel(ctx, '— SPD (KT)', 190, 400, 14, '#37b6e0');
  hudLabel(ctx, '0:00', 70, 428, 14, HUD_DIM);
  hudLabel(ctx, '4:47', 700, 428, 14, HUD_DIM, 'right');
  // Per-leg table (right).
  glassChip(ctx, 790, 110, 450, 300, 12);
  hudLabel(ctx, 'LEG BY LEG', 810, 138, 15, HUD_DIM);
  const legs = [
    ['Putussibau → N. Era', '1:52', '18%', '+5,400'],
    ['Nanga Era → Sintang', '1:31', '14%', '+7,200'],
    ['Sintang → Pontianak', '1:24', '11%', '+5,850'],
  ];
  let y = 172;
  hudLabel(ctx, 'LEG', 810, y, 14, HUD_DIM);
  hudLabel(ctx, 'TIME', 1080, y, 14, HUD_DIM, 'right');
  hudLabel(ctx, 'FUEL', 1150, y, 14, HUD_DIM, 'right');
  hudLabel(ctx, 'PTS', 1225, y, 14, HUD_DIM, 'right');
  y += 30;
  for (const [leg, t, fuel, pts] of legs) {
    hudLabel(ctx, leg, 810, y, 16, HUD_INK);
    hudLabel(ctx, t, 1080, y, 16, HUD_INK, 'right');
    hudLabel(ctx, fuel, 1150, y, 16, HUD_INK, 'right');
    hudLabel(ctx, pts, 1225, y, 16, HUD_AMBER, 'right');
    y += 34;
  }
  hudLabel(ctx, 'GATES 2/6 · DROPS 1/3 · LANDING CLEAN', 810, y + 16, 15, HUD_DIM);
  // Refit pick-1-of-3 (bottom row).
  hudLabel(ctx, 'REFIT — PICK ONE', 40, 452, 18, HUD_AMBER);
  const refits = [
    ['1 · AUX TANKS', '+20% fuel', 'Fly the long leg without a stop.', true],
    ['2 · LIGHT FLOATS', '+8 kt cruise', 'Lighter floats, faster river.', false],
    ['3 · STORM RADAR', 'See the wall', 'The monsoon stops surprising you.', false],
  ];
  refits.forEach(([title, gain, desc, picked], i) => {
    const x = 40 + i * 410;
    glassChip(ctx, x, 470, 390, 190, 12);
    if (picked) {
      ctx.strokeStyle = HUD_AMBER;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(x, 470, 390, 190, 12); ctx.stroke();
    }
    hudLabel(ctx, title, x + 20, 506, 20, picked ? HUD_AMBER : HUD_INK);
    hudLabel(ctx, gain, x + 20, 540, 17, '#37e08a');
    hudLabel(ctx, desc, x + 20, 570, 15, HUD_DIM);
    hudLabel(ctx, picked ? 'SELECTED' : 'PRESS ' + (i + 1), x + 20, 630, 15, picked ? HUD_AMBER : HUD_DIM);
  });
  hudLabel(ctx, 'Press 1 / 2 / 3 to refit · ENTER to fly again', 640, 720, 17, HUD_INK, 'center');
  hudLabel(ctx, '"Clean water, clean gates. Same again tomorrow, captain." — Capt. Vela', 640, 752, 15, HUD_DIM, 'center');
}
