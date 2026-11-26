// hud.js — the GULLWING-style HUD frame.
// Dark navy rounded panels, amber accents, big readable numbers:
// title card, compass tape, mission card, AIRSPEED / ALTITUDE,
// flight instruments, minimap, wind, checklist, storm banner, radio.
'use strict';

const PANEL = 'rgba(8,32,48,0.88)';
const PANEL_EDGE = 'rgba(120,180,210,0.25)';
const INK = '#eaf6ff';
const DIM = '#9db8c8';
const AMBER = '#ffb62e';
const GREEN = '#37e08a';

function panel(ctx, x, y, w, h, r) {
  ctx.fillStyle = PANEL;
  ctx.strokeStyle = PANEL_EDGE; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}

function label(ctx, text, x, y, size, color, align) {
  ctx.fillStyle = color || DIM;
  ctx.font = 'bold ' + size + 'px monospace';
  ctx.textAlign = align || 'left';
  ctx.fillText(text, x, y);
}

function drawTitleCard(ctx, status) {
  panel(ctx, 28, 22, 330, 92, 10);
  label(ctx, 'KAPUAS RIVER RUN', 46, 56, 24, INK);
  label(ctx, 'OTTER-9  /  FLIGHT TELEMETRY', 46, 82, 13, DIM);
  panel(ctx, 28, 122, 330, 34, 8);
  ctx.fillStyle = GREEN;
  ctx.beginPath(); ctx.arc(48, 139, 5, 0, Math.PI * 2); ctx.fill();
  label(ctx, '● ' + status, 62, 145, 14, INK);
  label(ctx, 'LIVE', 318, 145, 13, DIM, 'right');
}

function drawCompass(ctx, hdg) {
  panel(ctx, 430, 22, 420, 64, 10);
  ctx.fillStyle = DIM; ctx.font = '13px monospace'; ctx.textAlign = 'center';
  // Marks generated around the current heading, every 10 degrees.
  for (let deg = Math.floor((hdg - 60) / 10) * 10; deg <= hdg + 60; deg += 10) {
    const norm = ((deg % 360) + 360) % 360;
    const d = ((norm - hdg + 540) % 360) - 180;
    if (Math.abs(d) > 62) continue;
    const x = Math.max(452, Math.min(828, 640 + d * 3.1));
    const txt = norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W'
      : String(norm).padStart(3, '0');
    ctx.fillText(txt, x, 44);
    ctx.fillRect(x - 1, 52, 2, 8);
  }
  // Amber marker on the next gate bearing.
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(640, 28); ctx.lineTo(632, 40); ctx.lineTo(648, 40); ctx.closePath(); ctx.fill();
  label(ctx, 'HDG  ' + String(Math.round(hdg)).padStart(3, '0') + '°', 640, 78, 17, INK, 'center');
}

function drawMissionCard(ctx, m) {
  const s = m.sortie;
  panel(ctx, 922, 22, 330, 140, 10);
  label(ctx, '0' + s.n + '  /  RIVER SORTIE', 940, 48, 13, AMBER);
  label(ctx, s.name, 940, 82, 30, INK);
  label(ctx, s.brief, 940, 106, 13, DIM);
  label(ctx, 'GATES  ' + String(m.gatesPassed).padStart(2, '0') + ' / ' + String(m.gatesTotal).padStart(2, '0'), 940, 134, 15, INK);
  label(ctx, 'PTS  ' + fmtScore(m.score), 1234, 134, 15, INK, 'right');
  label(ctx, 'NEXT  380 M', 940, 152, 12, DIM);
}

function drawSpeedAlt(ctx, speedKt, altFt) {
  panel(ctx, 28, 300, 150, 108, 10);
  label(ctx, 'AIRSPEED', 46, 330, 13, DIM);
  label(ctx, String(Math.round(speedKt)), 46, 386, 44, INK);
  label(ctx, 'KNOTS', 46, 398, 12, DIM);
  panel(ctx, 1102, 300, 150, 108, 10);
  label(ctx, 'ALTITUDE', 1120, 330, 13, DIM);
  label(ctx, String(Math.round(altFt)), 1120, 386, 44, INK);
  label(ctx, 'FEET MSL', 1120, 398, 12, DIM);
}

function drawInstruments(ctx, f, m) {
  panel(ctx, 28, 620, 330, 150, 10);
  label(ctx, 'FLIGHT INSTRUMENTS', 46, 646, 13, DIM);
  // Attitude ball.
  const ax = 96, ay = 700, ar = 42;
  ctx.save();
  ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#3f8fd0'; ctx.fillRect(ax - ar, ay - ar, ar * 2, ar);
  ctx.fillStyle = '#c98a4e'; ctx.fillRect(ax - ar, ay, ar * 2, ar);
  ctx.save();
  ctx.translate(ax, ay); ctx.rotate((f.bank || 0) * Math.PI / 180);
  ctx.translate(0, (f.pitch || 0) * 2);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-ar, 0); ctx.lineTo(ar, 0); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#ffb62e'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(ax - 16, ay); ctx.lineTo(ax + 16, ay); ctx.stroke();
  ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  // V/S gauge.
  const vx = 196, vy = 700, vr = 30;
  ctx.strokeStyle = DIM; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(vx, vy, vr, 0, Math.PI * 2); ctx.stroke();
  const vsA = -Math.PI / 2 + Math.max(-1, Math.min(1, (f.vsFpm || 0) / 2200)) * Math.PI * 0.8;
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(vx, vy);
  ctx.lineTo(vx + Math.cos(vsA) * (vr - 4), vy + Math.sin(vsA) * (vr - 4)); ctx.stroke();
  label(ctx, 'V/S', vx, vy - vr - 6, 11, DIM, 'center');
  label(ctx, Math.round(f.vsFpm || 0) + ' FPM', vx, vy + vr + 16, 11, INK, 'center');
  // Fuel / throttle / airframe bars.
  const bars = [
    ['FUEL', m.fuelKg, 100, GREEN], ['THROTTLE', f.throttle, 100, AMBER],
    ['AIRFRAME', f.hull, 100, '#37b6e0']
  ];
  bars.forEach(([name, v, max, col], i) => {
    const y = 662 + i * 32;
    label(ctx, name, 250, y, 12, DIM);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(250, y + 6, 92, 8);
    ctx.fillStyle = col;
    ctx.fillRect(250, y + 6, 92 * Math.max(0, Math.min(1, v / max)), 8);
    label(ctx, Math.round(v) + '%', 348, y + 14, 11, INK, 'right');
  });
}

function drawMinimap(ctx, m, stormT) {
  panel(ctx, 1022, 600, 230, 170, 10);
  label(ctx, 'KAPUAS SECTOR', 1040, 626, 13, DIM);
  label(ctx, 'N', 1228, 626, 13, AMBER, 'right');
  // River polyline down the minimap.
  ctx.strokeStyle = '#6fb7d9'; ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const x = 1137 + (riverCenter(t) / 380) * 92;
    const y = 640 + t * 112;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Villages as dots + labels (skip any label the storm band would cover).
  ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
  for (const v of VILLAGES) {
    const x = 1137 + (riverCenter(v.t) / 380) * 92;
    const y = 640 + v.t * 112;
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    if (v.t < 0.8 && Math.abs(v.t - stormT) > 0.08) { ctx.fillStyle = DIM; ctx.fillText(v.name, x + 7, y + 3); }
  }
  // Storm front band on the minimap, tied to the same timer.
  if (stormT > 0.02) {
    const sy = 640 + stormT * 112;
    ctx.fillStyle = 'rgba(20,26,51,0.75)';
    ctx.fillRect(1032, sy - 4, 210, 10);
    ctx.fillStyle = 'rgba(10,20,30,0.85)';
    ctx.fillRect(1036, sy - 22, 148, 14);
    ctx.fillStyle = '#ff9a7a';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('STORM FRONT · 2.6 NM', 1040, sy - 11);
  }
  // Plane marker.
  const px = 1137 + (riverCenter(0.42) / 380) * 92;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(px, 640 + 0.42 * 112, 5, 0, Math.PI * 2); ctx.fill();
}

function drawWind(ctx) {
  label(ctx, 'WIND  8 KT', 1240, 182, 13, INK, 'right');
  ctx.strokeStyle = GREEN; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(1248, 178); ctx.lineTo(1268, 172); ctx.stroke();
  ctx.fillStyle = GREEN;
  ctx.beginPath(); ctx.moveTo(1268, 172); ctx.lineTo(1260, 168); ctx.lineTo(1260, 176); ctx.closePath(); ctx.fill();
}

function drawStormBanner(ctx, m) {
  panel(ctx, 470, 120, 340, 44, 8);
  ctx.fillStyle = '#ff9a7a';
  ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
  ctx.fillText('MONSOON LANDFALL  ' + fmtClock(m.landfallSec), 640, 140);
  label(ctx, 'STORM FRONT 2.6 NM · CLOSING', 640, 156, 11, '#ffb6a0', 'center');
}

function drawChecklist(ctx, m) {
  panel(ctx, 28, 470, 300, 128, 10);
  label(ctx, 'MISSION CHECKLIST', 46, 496, 13, AMBER);
  m.checklist.forEach((c, i) => {
    const y = 522 + i * 24;
    ctx.fillStyle = c.done ? GREEN : 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.arc(56, y - 4, 7, 0, Math.PI * 2); ctx.fill();
    if (c.done) {
      ctx.strokeStyle = '#0b2233'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(52, y - 4); ctx.lineTo(55, y - 1); ctx.lineTo(60, y - 8); ctx.stroke();
    }
    label(ctx, c.label + (c.prog ? '  ' + c.prog : ''), 72, y, 14, c.done ? DIM : INK);
  });
}

function drawToast(ctx, text) {
  const w = ctx.measureText(text).width + 44;
  panel(ctx, 640 - w / 2, 716, w, 40, 8);
  label(ctx, text, 640, 742, 14, INK, 'center');
}

function drawFooter(ctx) {
  label(ctx, 'P  /  ESC  PAUSE', 560, 786, 12, DIM, 'center');
  label(ctx, 'H  FLIGHT MANUAL', 720, 786, 12, DIM, 'center');
}

function drawRadio(ctx, m) {
  panel(ctx, 922, 470, 330, 112, 10);
  label(ctx, 'RADIO · ' + m.radio.from, 940, 496, 12, AMBER);
  ctx.fillStyle = INK; ctx.font = '14px monospace'; ctx.textAlign = 'left';
  wrapText(ctx, '"' + m.radio.text + '"', 940, 518, 294, 19);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y); line = w; y += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
}

// Full chase-view HUD, in draw order.
function drawChaseHUD(ctx, f, m, stormT) {
  drawTitleCard(ctx, f.altFt > 5 ? 'AIRBORNE' : 'GEAR DOWN');
  drawCompass(ctx, f.hdg);
  drawMissionCard(ctx, m);
  drawSpeedAlt(ctx, f.speedKt, f.altFt);
  drawInstruments(ctx, f, m);
  drawMinimap(ctx, m, stormT);
  drawWind(ctx);
  drawStormBanner(ctx, m);
  drawChecklist(ctx, m);
  drawRadio(ctx, m);
  drawToast(ctx, m.toast);
  drawFooter(ctx);
}
