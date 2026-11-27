// aircraft.js — the Otter-9 floatplane as a real 3D object.
// Local coords: +z = nose, +y = up, +/-x = wings. The model is a set of
// polygons; each face is transformed (roll, pitch, yaw, translate),
// backface-culled against the camera, Lambert-shaded and painted far to
// near through the SAME camera that renders the valley — so the plane is
// IN the world, not a sticker on top of it.
'use strict';

// Rotate a local point: roll about the forward axis, pitch about the lateral
// axis, yaw about the vertical, then translate to the world position.
function aircraftTransformPoint(p, t) {
  const cr = Math.cos(t.roll), sr = Math.sin(t.roll);
  const u1 = p[0] * cr - p[1] * sr, v1 = p[0] * sr + p[1] * cr, w1 = p[2];
  const cp = Math.cos(t.pitch), sp = Math.sin(t.pitch);
  const v2 = v1 * cp - w1 * sp, w2 = v1 * sp + w1 * cp, u2 = u1;
  const cy = Math.cos(t.yaw), sy = Math.sin(t.yaw);
  const u3 = u2 * cy + w2 * sy, w3 = -u2 * sy + w2 * cy, v3 = v2;
  return [t.pos[0] + u3, t.pos[1] + v3, t.pos[2] + w3];
}

// Build the Otter-9 faces. Each face: { pts: [[u,v,w]...], col: [r,g,b] }.
function buildOtterFaces() {
  const F = [];
  const quad = (a, b, c, d, col) => F.push({ pts: [a, b, c, d], col });
  // Fuselage: tapered prism, tail -> nose. (w, halfW, halfH, yCentre)
  const S = [
    { w: -4.6, hw: 0.18, hh: 0.26, yc: 0.25 },
    { w: -2.8, hw: 0.48, hh: 0.56, yc: 0.15 },
    { w: 0.0, hw: 0.66, hh: 0.74, yc: 0.10 },
    { w: 2.5, hw: 0.50, hh: 0.50, yc: 0.05 },
    { w: 4.6, hw: 0.22, hh: 0.24, yc: 0.00 },
  ];
  for (let i = 0; i < S.length - 1; i++) {
    const A = S[i], B = S[i + 1];
    const top = (s) => [s.hw, s.hh + s.yc, s.w], topL = (s) => [-s.hw, s.hh + s.yc, s.w];
    const bot = (s) => [s.hw, -s.hh + s.yc, s.w], botL = (s) => [-s.hw, -s.hh + s.yc, s.w];
    quad(topL(A), top(A), top(B), topL(B), [240, 214, 170]);       // top, sunlit
    quad(bot(A), botL(A), botL(B), bot(B), [120, 92, 60]);         // belly
    quad(botL(A), topL(A), topL(B), botL(B), [165, 128, 82]);      // left side
    quad(top(A), bot(A), bot(B), top(B), [185, 145, 95]);          // right side
  }
  // Red cheatline along each fuselage side (breaks the plain-box read).
  // It sits 0.02 outside the side surface, following the taper.
  for (const s of [-1, 1]) {
    quad([s * 0.52, 0.13, -2.8], [s * 0.52, 0.35, -2.8], [s * 0.74, 0.30, 0.0], [s * 0.74, 0.08, 0.0], [176, 58, 46]);
    quad([s * 0.74, 0.08, 0.0], [s * 0.74, 0.30, 0.0], [s * 0.57, 0.25, 2.5], [s * 0.57, 0.03, 2.5], [176, 58, 46]);
  }
  // Tail cap + nose cap.
  quad([-0.22, 0.55, -4.6], [0.22, 0.55, -4.6], [0.22, -0.05, -4.6], [-0.22, -0.05, -4.6], [160, 122, 80]);
  quad([-0.28, 0.30, 4.6], [0.28, 0.30, 4.6], [0.28, -0.30, 4.6], [-0.28, -0.30, 4.6], [120, 90, 60]);
  // Cockpit: sloped windshield + side windows (dark glass), hugging the
  // fuselage surface (top at z=1.5 is y≈0.73, at z=3.1 y≈0.50).
  quad([-0.40, 0.76, 1.5], [0.40, 0.76, 1.5], [0.30, 0.52, 3.1], [-0.30, 0.52, 3.1], [28, 42, 51]);
  quad([-0.62, 0.45, 1.6], [-0.62, 0.70, 1.6], [-0.48, 0.68, 3.0], [-0.48, 0.42, 3.0], [34, 50, 60]);
  quad([0.62, 0.45, 1.6], [0.48, 0.42, 3.0], [0.48, 0.68, 3.0], [0.62, 0.70, 1.6], [34, 50, 60]);
  // Main wing: top + bottom quads per side, dihedral, orange tips.
  // Planform per side: leading edge z=1.25, trailing edge z=-0.35;
  // the tip sits 0.55 higher than the root (dihedral).
  for (const s of [-1, 1]) {
    const rt = s * 0.8, tp = s * 4.8;
    quad([rt, 0.42, 1.25], [tp, 0.97, 1.25], [tp, 0.97, -0.35], [rt, 0.42, -0.35], [236, 217, 168]); // top
    quad([rt, 0.30, 1.25], [tp, 0.85, 1.25], [tp, 0.85, -0.35], [rt, 0.30, -0.35], [168, 132, 90]); // bottom
    // Orange tip cap.
    quad([s * 4.45, 0.93, 1.25], [s * 4.8, 0.97, 1.25], [s * 4.8, 0.97, -0.35], [s * 4.45, 0.93, -0.35], [224, 123, 57]);
  }
  // Wing leading-edge stripe (red, on the top surface near the leading edge)
  // so the wing reads as a built part, not a flat plank.
  for (const s of [-1, 1]) {
    const rt = s * 0.8, tp = s * 4.8;
    quad([rt, 0.44, 1.25], [tp, 0.99, 1.25], [tp, 0.99, 0.85], [rt, 0.44, 0.85], [196, 90, 60]);
  }
  // Tail fin: swept, red, BOTH sides + thin white stripe; stabilizers top+bottom.
  quad([0.02, 0.50, -2.5], [0.02, 0.50, -3.7], [0.02, 1.60, -3.95], [0.02, 1.45, -2.75], [176, 58, 46]);
  quad([-0.02, 0.50, -2.5], [-0.02, 1.45, -2.75], [-0.02, 1.60, -3.95], [-0.02, 0.50, -3.7], [150, 48, 40]);
  quad([0.03, 0.85, -2.7], [0.03, 0.85, -3.55], [0.03, 1.25, -3.8], [0.03, 1.15, -2.85], [232, 232, 228]);
  quad([-0.03, 0.85, -2.7], [-0.03, 1.15, -2.85], [-0.03, 1.25, -3.8], [-0.03, 0.85, -3.55], [210, 210, 206]);
  for (const s of [-1, 1]) {
    quad([0, 0.62, -2.5], [s * 2.2, 0.82, -2.5], [s * 2.2, 0.82, -3.4], [0, 0.62, -3.4], [214, 190, 150]); // stabilizer top
    quad([0, 0.50, -2.5], [s * 2.2, 0.70, -2.5], [s * 2.2, 0.70, -3.4], [0, 0.50, -3.4], [160, 138, 108]); // stabilizer bottom
  }
  // Floats (two boxes) + struts.
  for (const s of [-1, 1]) {
    const u = s * 1.05;
    quad([u - 0.35, -1.15, -2.4], [u + 0.35, -1.15, -2.4], [u + 0.35, -1.15, 2.6], [u - 0.35, -1.15, 2.6], [202, 164, 106]); // top
    quad([u - 0.35, -1.55, -2.4], [u + 0.35, -1.55, -2.4], [u + 0.35, -1.55, 2.6], [u - 0.35, -1.55, 2.6], [140, 108, 70]); // bottom
    quad([u - 0.35, -1.55, 2.6], [u + 0.35, -1.55, 2.6], [u + 0.35, -1.15, 2.6], [u - 0.35, -1.15, 2.6], [170, 134, 88]); // bow
    quad([u - 0.35, -1.55, -2.4], [u - 0.35, -1.15, -2.4], [u + 0.35, -1.15, -2.4], [u + 0.35, -1.55, -2.4], [150, 118, 78]); // stern
    quad([u - 0.09, -1.15, -1.1], [u + 0.09, -1.15, -1.1], [u + 0.09, -0.55, -0.6], [u - 0.09, -0.55, -0.6], [120, 96, 64]); // strut rear
    quad([u - 0.09, -1.15, 1.5], [u + 0.09, -1.15, 1.5], [u + 0.09, -0.55, 0.9], [u - 0.09, -0.55, 0.9], [120, 96, 64]); // strut front
  }
  return F;
}

// Draw the Otter-9. t = { pos:[x,y,z], yaw, pitch, roll, time }.
// Returns the projected centre + nose (for labels / HUD anchoring).
function drawAircraft(ctx, cam, t) {
  const faces = buildOtterFaces();
  const items = [];
  for (const f of faces) {
    const uniq = new Set(f.pts.map((p) => p.join(',')));
    if (uniq.size < 3) continue;
    const wpts = f.pts.map((p) => aircraftTransformPoint(p, t));
    const pp = wpts.map((p) => cam.project(p[0], p[1], p[2]));
    if (pp.some((p) => !p)) continue;
    // Face normal (for shading only — see the no-culling note below).
    const ux = wpts[1][0] - wpts[0][0], uy = wpts[1][1] - wpts[0][1], uz = wpts[1][2] - wpts[0][2];
    const vx = wpts[2][0] - wpts[0][0], vy = wpts[2][1] - wpts[0][1], vz = wpts[2][2] - wpts[0][2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    // NO backface culling: the painter's sort (far -> near) already hides
    // a face's far side behind its near side. Culling by normal direction
    // was wrong here — several faces are wound inward, so the camera saw
    // the far side's interior and the plane read as a hollow box. Shading
    // uses |n.sun| so both windings shade the same.
    const lam = 0.6 + 0.4 * Math.abs(nx * SUN_DIR[0] + ny * SUN_DIR[1] + nz * SUN_DIR[2]);
    const col = shadeRgb(f.col, lam);
    items.push({ z: wpts.reduce((a, p) => a + (p[2] - cam.pos[2]), 0) / wpts.length, pts: pp, fill: rgbStr(col) });
  }
  items.sort((a, b) => b.z - a.z);
  for (const it of items) fillProjected(ctx, it.pts, it.fill);
  // Prop disc (translucent) + hub + spinning blades at the nose.
  const disc = [];
  for (let i = 0; i <= 20; i++) {
    const a = i / 20 * Math.PI * 2;
    const w = aircraftTransformPoint([Math.cos(a) * 0.95, Math.sin(a) * 0.95, 4.75], t);
    disc.push(cam.project(w[0], w[1], w[2]));
  }
  if (disc.every((p) => p)) {
    ctx.fillStyle = 'rgba(210,225,240,0.12)';
    ctx.beginPath();
    ctx.moveTo(disc[0].x, disc[0].y);
    for (let i = 1; i < disc.length; i++) ctx.lineTo(disc[i].x, disc[i].y);
    ctx.closePath();
    ctx.fill();
    const hub = cam.project(...aircraftTransformPoint([0, 0, 4.8], t));
    if (hub) {
      ctx.fillStyle = '#3a2c1c';
      ctx.beginPath(); ctx.arc(hub.x, hub.y, 5, 0, Math.PI * 2); ctx.fill();
      // Two blade streaks, spinning with time.
      const ba = (t.time || 0) * 9;
      ctx.strokeStyle = 'rgba(40,30,20,0.7)';
      ctx.lineWidth = 4;
      for (const off of [0, Math.PI]) {
        const b1 = cam.project(...aircraftTransformPoint([Math.cos(ba + off) * 0.9, Math.sin(ba + off) * 0.9, 4.78], t));
        if (b1) { ctx.beginPath(); ctx.moveTo(hub.x, hub.y); ctx.lineTo(b1.x, b1.y); ctx.stroke(); }
      }
    }
  }
  // Nav lights on the wingtips.
  for (const [u, col] of [[-4.8, '#ff4a3c'], [4.8, '#37e08a']]) {
    const w = aircraftTransformPoint([u, 0.97, 0.3], t);
    const p = cam.project(w[0], w[1], w[2]);
    if (p) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Wing registration, drawn along the projected right wing.
  const wr = cam.project(...aircraftTransformPoint([1.2, 0.5, 0.6], t));
  const wt = cam.project(...aircraftTransformPoint([4.4, 1.0, 0.3], t));
  if (wr && wt) {
    const ang = Math.atan2(wt.y - wr.y, wt.x - wr.x);
    ctx.save();
    ctx.translate((wr.x + wt.x) / 2, (wr.y + wt.y) / 2);
    ctx.rotate(ang);
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    ctx.fillText(t.label || 'OTTER-9', 0, 5);
    ctx.restore();
  }
  const centre = cam.project(t.pos[0], t.pos[1], t.pos[2]);
  const nose = cam.project(...aircraftTransformPoint([0, 0, 4.8], t));
  return { centre, nose };
}
