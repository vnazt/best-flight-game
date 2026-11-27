// hud.js — the NEW glass HUD (REBUILD-0).
// No dark cards: thin translucent strips, big bare numbers with a shadow,
// text-only checklist rows. Seven elements, all ≥18px at 1280, nothing
// clipped or colliding at 768px. Same HUD serves the chase view, live play
// and the cover — one look, one code path.
'use strict';

const HUD_INK = '#eef6ff';
const HUD_DIM = '#b8cfe0';
const HUD_AMBER = '#ffd98a';
const HUD_GLASS = 'rgba(8,20,32,0.32)';
const HUD_EDGE = 'rgba(255,255,255,0.20)';

function glassChip(ctx, x, y, w, h, r) {
  ctx.fillStyle = HUD_GLASS;
  ctx.strokeStyle = HUD_EDGE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();
}

// Big bare number: white fill + dark outline, readable over any terrain.
function bigNumber(ctx, text, x, y, size, align) {
  ctx.font = 'bold ' + size + 'px monospace';
  ctx.textAlign = align || 'left';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(8,20,32,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = HUD_INK;
  ctx.fillText(text, x, y);
}

function hudLabel(ctx, text, x, y, size, color, align) {
  ctx.font = (size >= 20 ? 'bold ' : '') + size + 'px monospace';
  ctx.textAlign = align || 'left';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(8,20,32,0.8)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color || HUD_INK;
  ctx.fillText(text, x, y);
}

// Top glass strip: title left, compass tape centre, landfall right.
function drawTopStrip(ctx, f, m) {
  glassChip(ctx, 16, 14, 1248, 56, 12);
  hudLabel(ctx, 'KAPUAS RIVER RUN', 36, 40, 24, HUD_INK);
  hudLabel(ctx, 'OTTER-9', 36, 60, 14, HUD_DIM);
  // Compass tape, centred.
  ctx.fillStyle = HUD_DIM;
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  for (let deg = Math.floor((f.hdg - 60) / 10) * 10; deg <= f.hdg + 60; deg += 10) {
    const norm = ((deg % 360) + 360) % 360;
    const d = ((norm - f.hdg + 540) % 360) - 180;
    if (Math.abs(d) > 62) continue;
    const x = Math.max(452, Math.min(828, 640 + d * 3.1));
    const txt = norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W' : String(norm).padStart(3, '0');
    ctx.fillText(txt, x, 36);
    ctx.fillRect(x - 1, 42, 2, 7);
  }
  ctx.fillStyle = HUD_AMBER;
  ctx.beginPath();
  ctx.moveTo(640, 20); ctx.lineTo(632, 32); ctx.lineTo(648, 32); ctx.closePath(); ctx.fill();
  hudLabel(ctx, 'HDG ' + String(Math.round(f.hdg)).padStart(3, '0') + '°', 640, 62, 16, HUD_INK, 'center');
  hudLabel(ctx, 'LANDFALL ' + fmtClock(m.landfallSec) + '  ·  STORM 2.6 NM', 1244, 48, 16, '#ff9a7a', 'right');
}

// Big speed / altitude, bare text, mid-frame left and right.
function drawSpeedAlt(ctx, f) {
  hudLabel(ctx, 'AIRSPEED', 40, 300, 16, HUD_DIM);
  bigNumber(ctx, String(Math.round(f.speedKt)), 40, 356, 64);
  hudLabel(ctx, 'KNOTS', 40, 382, 16, HUD_DIM);
  hudLabel(ctx, 'ALTITUDE', 1240, 300, 16, HUD_DIM, 'right');
  bigNumber(ctx, String(Math.round(f.altFt)), 1240, 356, 64, 'right');
  hudLabel(ctx, 'FEET MSL', 1240, 382, 16, HUD_DIM, 'right');
}

// Mission as four plain text rows (no big card), top-right under the strip.
function drawMissionRows(ctx, m) {
  const s = m.sortie;
  let y = 96;
  hudLabel(ctx, '0' + s.n + '  /  ' + s.name.toUpperCase(), 1244, y, 18, HUD_AMBER, 'right');
  y += 26;
  hudLabel(ctx, s.brief, 1244, y, 15, HUD_DIM, 'right');
  y += 28;
  hudLabel(ctx, 'GATES ' + String(m.gatesPassed).padStart(2, '0') + ' / ' + String(m.gatesTotal).padStart(2, '0') + '    PTS ' + fmtScore(m.score), 1244, y, 16, HUD_INK, 'right');
  y += 26;
  for (const c of m.checklist) {
    const label = (c.done ? '✓ ' : '○ ') + c.label + (c.prog ? '  ' + c.prog : '');
    hudLabel(ctx, label, 1244, y, 16, c.done ? HUD_DIM : HUD_INK, 'right');
    y += 24;
  }
}

// Thin THR / FUEL / AIRFRAME bars, bottom-left.
function drawBars(ctx, f) {
  const bars = [
    ['THR', f.throttle, HUD_AMBER],
    ['FUEL', f.fuelKg, '#37e08a'],
    ['AIRFRAME', f.hull, '#37b6e0'],
  ];
  let y = 668;
  for (const [name, v, col] of bars) {
    hudLabel(ctx, name, 40, y, 16, HUD_DIM);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(150, y - 12, 150, 10);
    ctx.fillStyle = col;
    ctx.fillRect(150, y - 12, 150 * Math.max(0, Math.min(1, v / 100)), 10);
    hudLabel(ctx, Math.round(v) + '%', 312, y, 16, HUD_INK);
    y += 30;
  }
}

// Small glass minimap: the river, the villages, the plane.
function drawMinimap(ctx, f) {
  glassChip(ctx, 1004, 620, 260, 160, 12);
  hudLabel(ctx, 'KAPUAS SECTOR', 1022, 646, 15, HUD_DIM);
  hudLabel(ctx, 'N', 1246, 646, 15, HUD_AMBER, 'right');
  ctx.strokeStyle = '#6fb7d9';
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const t = i / 20, z = t * 150;
    const x = 1130 + (riverCenter(z) / 380) * 80;
    const y = 660 + t * 105;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.font = 'bold 14px monospace';
  const labelSides = [1, -1, 1, -1]; // alternate sides: Nanga Era + Sintang
  VILLAGES.forEach((v, vi) => {     // sit 10px apart on the minimap
    if (v.z > 150) return;
    const x = 1130 + (riverCenter(v.z) / 380) * 80;
    const y = 660 + (v.z / 150) * 105;
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = HUD_DIM;
    if (labelSides[vi % labelSides.length] < 0) {
      ctx.textAlign = 'right';
      ctx.fillText(v.name, x - 9, y + 5);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(v.name, x + 9, y + 5);
    }
  });
  const pz = Math.min(150, f.distZ / 10);
  const px = 1130 + (riverCenter(pz) / 380) * 80;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(px, 660 + (pz / 150) * 105, 5, 0, Math.PI * 2); ctx.fill();
}

// One slim radio line, bottom-centre.
function drawRadioLine(ctx, m) {
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(8,20,32,0.8)';
  const text = 'Capt. Vela: ' + m.sortie.radio;
  ctx.strokeText(text, 640, 786);
  ctx.fillStyle = HUD_INK;
  ctx.fillText(text, 640, 786);
}

// The full glass HUD for chase view / live play / cover.
function drawFlightHUD(ctx, f, m) {
  drawTopStrip(ctx, f, m);
  drawSpeedAlt(ctx, f);
  drawMissionRows(ctx, m);
  drawBars(ctx, f);
  drawMinimap(ctx, f);
  drawRadioLine(ctx, m);
}
