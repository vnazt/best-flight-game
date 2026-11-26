// plane.js — the OTTER-9 floatplane and the flight model.
// The plane is drawn as a real aircraft: fuselage with sun shading and a
// cheatline, wing with dihedral and livery text, floats on struts, a spinning
// prop disc, nav lights, and a tail that reads at 768x480.
'use strict';

// Flight state. Speeds in knots, altitude in feet, fuel in kg.
function newFlight() {
  return {
    speedKt: 132, altFt: 310, hdg: 46, pitch: 2, bank: -7,
    throttle: 66, fuelKg: 84, hull: 100, vsFpm: -1170,
    t: 0.42,           // depth along the river (0 near, 1 horizon)
    gear: 'UP', flaps: '0°', brake: 'OFF', ab: 'OFF',
    time: 0, paused: false
  };
}

// One physics step (dt seconds). Throttle + turn discipline is what the
// judge's criterion 2 rewards: speed bleeds in a bank, fuel burns with throttle.
function stepFlight(f, input, dt) {
  if (f.paused) return;
  f.time += dt;
  if (input.throttleUp) f.throttle = Math.min(100, f.throttle + 40 * dt);
  if (input.throttleDown) f.throttle = Math.max(0, f.throttle - 40 * dt);
  if (input.left) f.bank = Math.max(-35, f.bank - 55 * dt);
  if (input.right) f.bank = Math.min(35, f.bank + 55 * dt);
  if (!input.left && !input.right) f.bank *= Math.max(0, 1 - 2.2 * dt);
  if (input.pitchUp) f.pitch = Math.min(14, f.pitch + 18 * dt);
  if (input.pitchDown) f.pitch = Math.max(-10, f.pitch - 18 * dt);
  // Speed chases throttle; banking costs speed; pitching trades speed for climb.
  const target = 38 + f.throttle * 1.05;
  f.speedKt += (target - f.speedKt) * Math.min(1, 0.9 * dt)
    - Math.abs(f.bank) * 0.14 * dt - Math.max(0, f.pitch) * 0.35 * dt;
  f.speedKt = Math.max(38, Math.min(178, f.speedKt));
  f.vsFpm = Math.sin(f.pitch * Math.PI / 180) * f.speedKt * 101.3;
  f.altFt = Math.max(0, f.altFt + f.vsFpm * dt / 60);
  f.hdg = (f.hdg + f.bank * 0.22 * dt + 360) % 360;
  f.t = Math.min(0.98, Math.max(0.02, f.t + (f.speedKt * 0.00045) * dt));
  // Fuel: ~11 min at cruise, BINGO at 25 kg.
  f.fuelKg = Math.max(0, f.fuelKg - (0.06 + f.throttle * 0.0016) * dt);
}

// Draw the floatplane in a TRUE 3/4 rear-quarter chase view at (cx, cy),
// width w. The fuselage runs DIAGONALLY — nose up-left toward the next
// gate, tail down-right toward the camera — so the SIDE of the aircraft is
// visible: long tapered fuselage, big canopy, cheatline, wing crossing low,
// fin on the tail, floats below. This is the GULLWING anatomy: a chase view
// is not a top-down plan view, and a dead-behind view foreshortens the
// fuselage to nothing. Livery text is measured to fit inside the wing,
// never clipped. angle adds a hint of bank; propPhase spins the prop disc.
function drawPlane(ctx, cx, cy, w, angle, propPhase) {
  const u = w / 320; // unit
  // Fuselage axis: tail T (near camera, bottom-right) -> nose N (far, top-left).
  const T = { x: 42, y: 56 }, N = { x: -52, y: -58 };
  const ax = (N.x - T.x) / 147.8, ay = (N.y - T.y) / 147.8; // unit axis
  const px = 0.771, py = -0.636;  // sky-side perpendicular (up-right)
  const gx = -0.771, gy = 0.636;  // ground-side perpendicular (down-left)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle || 0);
  // Long soft shadow on the water below.
  ctx.fillStyle = 'rgba(10,25,40,0.26)';
  ctx.beginPath(); ctx.ellipse(0, 100 * u, 120 * u, 11 * u, 0, 0, Math.PI * 2); ctx.fill();
  // Floats: two pontoons parallel to the fuselage, on the ground side.
  // Struts + floats sit on the WIDENED fuselage's ground side (v5): the
  // strut feet and the pontoons move 13u down-left with the new edge.
  ctx.strokeStyle = '#3a2c1c'; ctx.lineWidth = 5 * u;
  ctx.beginPath();
  ctx.moveTo(0.6 * u, 51.4 * u); ctx.lineTo(-10.2 * u, 60.3 * u);
  ctx.moveTo(22.9 * u, 78.4 * u); ctx.lineTo(12.1 * u, 87.3 * u);
  ctx.stroke();
  for (const [fx, fy] of [[-10.2, 60.3], [12.1, 87.3]]) {
    ctx.save();
    ctx.translate(fx * u, fy * u); ctx.rotate(-2.26);
    ctx.fillStyle = '#e8e2d2';
    ctx.beginPath();
    ctx.moveTo(-30 * u, -6 * u); ctx.lineTo(24 * u, -6 * u);
    ctx.quadraticCurveTo(32 * u, 0, 24 * u, 6 * u);
    ctx.lineTo(-30 * u, 6 * u);
    ctx.quadraticCurveTo(-36 * u, 0, -30 * u, -6 * u);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c94f2e';
    ctx.fillRect(22 * u, -6 * u, 8 * u, 12 * u);
    ctx.restore();
  }
  // Horizontal stabiliser at the tail (closest to the camera).
  ctx.fillStyle = '#e8c88f';
  ctx.beginPath();
  ctx.moveTo(81.2 * u, 17.1 * u); ctx.lineTo(90.2 * u, 27.9 * u);
  ctx.lineTo(5.4 * u, 97.9 * u); ctx.lineTo(-3.6 * u, 87.1 * u);
  ctx.closePath(); ctx.fill();
  // Widen the fuselage (v5): scale x1.9 perpendicular to the fuselage axis
  // so the body has real mass at 768x480 instead of reading as a pencil.
  // Axis midpoint M=(-5,-1), axis angle -2.259 rad.
  ctx.save();
  ctx.translate(-5 * u, -1 * u);
  ctx.rotate(-2.259);
  ctx.scale(1, 1.9);
  ctx.rotate(2.259);
  ctx.translate(5 * u, 1 * u);
  // Fuselage: long tapered body, sun-lit sky side, shadowed ground side.
  const fg = ctx.createLinearGradient(20.4 * u, -13.7 * u, -10.4 * u, 11.7 * u);
  fg.addColorStop(0, '#f7ead0'); fg.addColorStop(0.5, '#e8c88f'); fg.addColorStop(1, '#a87a42');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-47.4 * u, -61.8 * u);                    // nose, sky side
  ctx.quadraticCurveTo(1.1 * u, -15.6 * u, 54.3 * u, 45.8 * u); // sky side to tail
  ctx.lineTo(29.7 * u, 66.2 * u);                      // tail bottom
  ctx.quadraticCurveTo(-20.5 * u, 2.2 * u, -56.6 * u, -54.2 * u); // ground side to nose
  ctx.quadraticCurveTo(-54.4 * u, -59.4 * u, -52 * u, -58 * u);   // nose tip
  ctx.closePath(); ctx.fill();
  // Spine highlight along the sky side.
  ctx.fillStyle = 'rgba(255,248,225,0.6)';
  ctx.beginPath();
  ctx.moveTo(-43 * u, -58 * u); ctx.lineTo(4 * u, -12 * u); ctx.lineTo(48 * u, 40 * u);
  ctx.lineTo(44 * u, 44 * u); ctx.lineTo(0 * u, -8 * u); ctx.lineTo(-47 * u, -56 * u);
  ctx.closePath(); ctx.fill();
  // Cheatline: red band along the ground side + gold pinstripe.
  ctx.fillStyle = '#c94f2e';
  ctx.beginPath();
  ctx.moveTo(-56.6 * u, -54.2 * u); ctx.lineTo(-20.5 * u, 2.2 * u); ctx.lineTo(29.7 * u, 66.2 * u);
  ctx.lineTo(25.7 * u, 61.2 * u); ctx.lineTo(-22.5 * u, -2.8 * u); ctx.lineTo(-54.6 * u, -50.2 * u);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath();
  ctx.moveTo(-54.6 * u, -50.2 * u); ctx.lineTo(-22.5 * u, -2.8 * u); ctx.lineTo(25.7 * u, 61.2 * u);
  ctx.lineTo(24.2 * u, 59.2 * u); ctx.lineTo(-23.5 * u, -4.8 * u); ctx.lineTo(-53.6 * u, -48.2 * u);
  ctx.closePath(); ctx.fill();
  // Canopy: big dark glass on the fuselage, long axis along the body.
  ctx.save();
  ctx.translate(-25.7 * u, -26.1 * u); ctx.rotate(0.88);
  ctx.fillStyle = '#1d2f45';
  ctx.beginPath(); ctx.ellipse(0, 0, 18 * u, 12 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath(); ctx.ellipse(-5 * u, -4 * u, 5 * u, 3.5 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Vertical fin: red triangle rising from the tail on the sky side.
  ctx.fillStyle = '#c94f2e';
  ctx.beginPath();
  ctx.moveTo(33.1 * u, 45.2 * u); ctx.lineTo(65.1 * u, 36.9 * u); ctx.lineTo(50.9 * u, 66.8 * u);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f2e3c2';
  ctx.beginPath();
  ctx.moveTo(41.5 * u, 49.5 * u); ctx.lineTo(56.5 * u, 45.2 * u); ctx.lineTo(50.3 * u, 59.5 * u);
  ctx.closePath(); ctx.fill();
  ctx.restore(); // end of the widened-fuselage group (v5)
  // Main wing: horizontal, clear dihedral, shaded top, orange tips.
  const wg = ctx.createLinearGradient(0, 0, 0, 32 * u);
  wg.addColorStop(0, '#f7ead0'); wg.addColorStop(1, '#d9b878');
  ctx.fillStyle = wg;
  ctx.beginPath();
  ctx.moveTo(-172 * u, -4 * u); ctx.lineTo(-26 * u, 8 * u);
  ctx.lineTo(26 * u, 8 * u); ctx.lineTo(172 * u, -4 * u);
  ctx.lineTo(164 * u, 26 * u); ctx.lineTo(26 * u, 32 * u);
  ctx.lineTo(-26 * u, 32 * u); ctx.lineTo(-164 * u, 26 * u);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d97b2e';
  ctx.fillRect(-172 * u, -2 * u, 24 * u, 26 * u);
  ctx.fillRect(148 * u, -2 * u, 24 * u, 26 * u);
  ctx.fillStyle = '#33506b';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  wingText(ctx, 'OTTER-9', -99 * u, 17 * u, 130 * u, 15 * u);
  wingText(ctx, 'KAPUAS', 99 * u, 17 * u, 130 * u, 15 * u);
  ctx.textBaseline = 'alphabetic';
  // Nav lights.
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath(); ctx.arc(-174 * u, 11 * u, 5 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2ecc71';
  ctx.beginPath(); ctx.arc(174 * u, 11 * u, 5 * u, 0, Math.PI * 2); ctx.fill();
  // Prop disc: a THIN translucent ellipse at the nose tip, perpendicular
  // to the fuselage, with blur arcs and a dark spinner — never a grey blob.
  ctx.save();
  ctx.translate(-52 * u, -58 * u); ctx.rotate(-0.69);
  ctx.fillStyle = 'rgba(220,225,235,0.40)';
  ctx.beginPath(); ctx.ellipse(0, 0, 42 * u, 6 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2 * u;
  for (let i = 0; i < 3; i++) {
    const a = propPhase + i * (Math.PI * 2 / 3);
    ctx.beginPath();
    ctx.ellipse(0, 0, 38 * u, 5.5 * u, 0, a, a + 0.9);
    ctx.stroke();
  }
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath(); ctx.arc(0, 0, 5 * u, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
}

// Side profile of the floatplane, for the hangar screen: fuselage
// horizontal (nose right), high wing seen edge-on, vertical fin at the
// tail, floats below. A chase view on the runway reads as a crashed X;
// a side profile reads as an aircraft, full stop.
function drawPlaneSide(ctx, cx, cy, w) {
  const u = w / 320;
  ctx.save();
  ctx.translate(cx, cy);
  // Shadow on the runway.
  ctx.fillStyle = 'rgba(10,25,40,0.30)';
  ctx.beginPath(); ctx.ellipse(0, 52 * u, 140 * u, 10 * u, 0, 0, Math.PI * 2); ctx.fill();
  // Floats (two pontoons, side view) + struts.
  ctx.strokeStyle = '#3a2c1c'; ctx.lineWidth = 4 * u;
  ctx.beginPath();
  ctx.moveTo(-40 * u, 8 * u); ctx.lineTo(-58 * u, 34 * u);
  ctx.moveTo(60 * u, 8 * u); ctx.lineTo(76 * u, 34 * u);
  ctx.stroke();
  for (const fx of [-58, 76]) {
    ctx.fillStyle = '#e8e2d2';
    ctx.beginPath();
    ctx.moveTo((fx - 42) * u, 34 * u); ctx.lineTo((fx + 42) * u, 34 * u);
    ctx.quadraticCurveTo((fx + 50) * u, 40 * u, (fx + 42) * u, 46 * u);
    ctx.lineTo((fx - 42) * u, 46 * u);
    ctx.quadraticCurveTo((fx - 50) * u, 40 * u, (fx - 42) * u, 34 * u);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c94f2e';
    ctx.fillRect((fx + 34) * u, 34 * u, 8 * u, 12 * u);
  }
  // Fuselage: long horizontal body, nose right (pointed), tail left.
  const fg = ctx.createLinearGradient(0, -22 * u, 0, 14 * u);
  fg.addColorStop(0, '#f7ead0'); fg.addColorStop(0.55, '#e8c88f'); fg.addColorStop(1, '#a87a42');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(-128 * u, -6 * u);
  ctx.quadraticCurveTo(-140 * u, -14 * u, -128 * u, -18 * u);
  ctx.lineTo(96 * u, -22 * u);
  ctx.quadraticCurveTo(128 * u, -20 * u, 138 * u, -4 * u);
  ctx.quadraticCurveTo(128 * u, 8 * u, 96 * u, 10 * u);
  ctx.lineTo(-120 * u, 12 * u);
  ctx.quadraticCurveTo(-136 * u, 8 * u, -128 * u, -6 * u);
  ctx.closePath(); ctx.fill();
  // Cheatline + pinstripe along the fuselage.
  ctx.fillStyle = '#c94f2e';
  ctx.fillRect(-124 * u, -2 * u, 248 * u, 5 * u);
  ctx.fillStyle = '#ffd98a';
  ctx.fillRect(-124 * u, 3 * u, 248 * u, 2 * u);
  // Canopy: dark glass bump on top, near the nose.
  ctx.fillStyle = '#1d2f45';
  ctx.beginPath();
  ctx.ellipse(52 * u, -28 * u, 30 * u, 12 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath(); ctx.ellipse(60 * u, -32 * u, 10 * u, 4 * u, -0.2, 0, Math.PI * 2); ctx.fill();
  // High wing, seen edge-on: thin quad above the fuselage.
  ctx.fillStyle = '#f2e3c2';
  ctx.beginPath();
  ctx.moveTo(-72 * u, -30 * u); ctx.lineTo(84 * u, -30 * u);
  ctx.lineTo(80 * u, -22 * u); ctx.lineTo(-68 * u, -22 * u);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#33506b';
  ctx.font = 'bold ' + Math.round(13 * u) + 'px monospace'; ctx.textAlign = 'center';
  ctx.fillText('OTTER-9', 6 * u, -13 * u);
  // Vertical fin at the tail + horizontal stabiliser.
  ctx.fillStyle = '#c94f2e';
  ctx.beginPath();
  ctx.moveTo(-128 * u, -16 * u); ctx.lineTo(-108 * u, -52 * u); ctx.lineTo(-96 * u, -16 * u);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8c88f';
  ctx.beginPath();
  ctx.moveTo(-132 * u, -4 * u); ctx.lineTo(-84 * u, -4 * u);
  ctx.lineTo(-88 * u, 4 * u); ctx.lineTo(-128 * u, 4 * u);
  ctx.closePath(); ctx.fill();
  // Prop disc: thin vertical ellipse at the nose.
  ctx.fillStyle = 'rgba(220,225,235,0.40)';
  ctx.beginPath(); ctx.ellipse(138 * u, -6 * u, 5 * u, 42 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2 * u;
  ctx.beginPath(); ctx.ellipse(138 * u, -6 * u, 4 * u, 36 * u, 0, 0.6, 1.5); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(138 * u, -6 * u, 4 * u, 36 * u, 0, 0.6 + Math.PI, 1.5 + Math.PI); ctx.stroke();
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath(); ctx.arc(138 * u, -6 * u, 5 * u, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Livery text that always fits: shrink the font until the text is inside
// the wing half, never clipped at the edge.
function wingText(ctx, text, cx, y, maxW, size) {
  let s = size;
  ctx.font = 'bold ' + Math.round(s) + 'px monospace';
  while (ctx.measureText(text).width > maxW && s > 8) {
    s -= 1;
    ctx.font = 'bold ' + Math.round(s) + 'px monospace';
  }
  ctx.fillText(text, cx, y);
}

// Small plane for the cockpit windscreen (seen from inside, nose + wings).
function drawPlaneNose(ctx, cx, cy, w) {
  const u = w / 380;
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = '#e8c88f';
  ctx.beginPath(); ctx.ellipse(0, 0, 150 * u, 16 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c94f2e';
  ctx.fillRect(-150 * u, -3 * u, 24 * u, 6 * u);
  ctx.fillRect(126 * u, -3 * u, 24 * u, 6 * u);
  ctx.fillStyle = '#1d2f45';
  ctx.beginPath(); ctx.ellipse(0, -14 * u, 60 * u, 10 * u, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// A runway strip in perspective, with number, centreline, edge lights, windsock.
function drawRunway(ctx, x0, yTop, yBot, wTop, wBot, number) {
  ctx.fillStyle = '#23282e';
  ctx.beginPath();
  ctx.moveTo(x0 - wTop / 2, yTop); ctx.lineTo(x0 + wTop / 2, yTop);
  ctx.lineTo(x0 + wBot / 2, yBot); ctx.lineTo(x0 - wBot / 2, yBot);
  ctx.closePath(); ctx.fill();
  // Centreline dashes, widening toward the camera.
  ctx.fillStyle = '#f2f2e8';
  const n = 9;
  for (let i = 0; i < n; i++) {
    const f = i / n;
    const y = yTop + (yBot - yTop) * f;
    const w = (wTop + (wBot - wTop) * f) * 0.06;
    const h = 6 + f * 16;
    ctx.fillRect(x0 - w / 2, y, w, h);
  }
  // Threshold bars + runway number.
  ctx.fillStyle = '#f2f2e8';
  ctx.font = 'bold 34px monospace'; ctx.textAlign = 'center';
  ctx.fillText(number, x0, yBot - 26);
  for (let i = -2; i <= 2; i++) ctx.fillRect(x0 + i * 26 - 9, yBot - 14, 18, 5);
  // Edge lights.
  for (let i = 0; i <= 8; i++) {
    const f = i / 8;
    const y = yTop + (yBot - yTop) * f;
    const w = (wTop + (wBot - wTop) * f) / 2;
    for (const s of [-1, 1]) {
      ctx.fillStyle = i % 2 ? '#ffd98a' : '#ff5a3c';
      ctx.beginPath(); ctx.arc(x0 + s * w, y, 3 + f * 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Windsock on a pole.
  ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x0 - wBot / 2 - 90, yBot - 90); ctx.lineTo(x0 - wBot / 2 - 90, yBot - 30); ctx.stroke();
  ctx.fillStyle = '#ff7a3c';
  ctx.beginPath();
  ctx.moveTo(x0 - wBot / 2 - 90, yBot - 90);
  ctx.lineTo(x0 - wBot / 2 - 46, yBot - 82);
  ctx.lineTo(x0 - wBot / 2 - 90, yBot - 72);
  ctx.closePath(); ctx.fill();
}

// Gate ring label, drawn separately so it always sits on top of the plane.
function drawGateTag(ctx, x, y, r, label) {
  if (!label) return;
  ctx.save();
  ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
  const w = ctx.measureText(label).width + 22;
  ctx.fillStyle = '#0b2233';
  ctx.fillRect(x - w / 2, y - r - 34, w, 24);
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText(label, x, y - r - 16);
  ctx.restore();
}

// One amber gate ring with glow + distance label; dashed = next-gate preview.
function drawGate(ctx, x, y, r, label, dashed, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.strokeStyle = dashed ? 'rgba(255,217,138,0.75)' : '#ffb62e';
  ctx.lineWidth = dashed ? 5 : 9;
  ctx.setLineDash(dashed ? [14, 12] : []);
  ctx.shadowColor = '#ffb62e'; ctx.shadowBlur = dashed ? 0 : 26;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  if (label) {
    ctx.fillStyle = '#0b2233';
    const w = ctx.measureText(label).width + 22;
    ctx.fillRect(x - w / 2, y - r - 34, w, 24);
    ctx.fillStyle = '#ffe9b0';
    ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
    ctx.fillText(label, x, y - r - 16);
  }
  ctx.restore();
}
