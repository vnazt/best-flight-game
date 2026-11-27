// perspective.js — the new 3D core of Kapuas River Run (REBUILD-0).
// A true pinhole perspective camera + deterministic value noise + sky.
// NOTHING here is screen-space sprite logic: every world point goes through
// the same projection, so the aircraft, the rings and the terrain share one
// depth, one scale and one vanishing point.
'use strict';

// ---- Seeded randomness (the ONLY randomness in the render path) ----
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer lattice hash -> [0,1). Deterministic for ANY (x,z), so the terrain
// is identical wherever the camera window sits.
function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) % 100000) / 100000;
}

function smooth(t) { return t * t * (3 - 2 * t); }

// Smooth value noise over a lattice of cellW x cellH world units.
function valueNoise(x, z, cellW, cellH) {
  const gx = x / cellW, gz = z / cellH;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  const fx = smooth(gx - ix), fz = smooth(gz - iz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  const top = a + (b - a) * fx, bot = c + (d - c) * fx;
  return top + (bot - top) * fz; // 0..1
}

// Two-octave terrain noise, centred on 0.
function terrainNoise(x, z) {
  return (valueNoise(x, z, 19, 26) - 0.5) * 11 + (valueNoise(x + 57, z + 91, 6, 8) - 0.5) * 3.2;
}

// ---- Colour helpers ----
function hexRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function rgbStr(c, alpha) {
  return alpha == null
    ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'
    : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + alpha + ')';
}
// Lambert shade: brightness 0..1 scales a base colour toward black/white.
function shadeRgb(base, bright) {
  const b = Math.max(0, Math.min(1.15, bright));
  return [base[0] * b, base[1] * b, base[2] * b];
}

// Sun direction (normalised), shared by terrain + aircraft shading.
const SUN_DIR = (function () {
  const l = Math.sqrt(0.5 * 0.5 + 0.8 * 0.8 + 0.35 * 0.35);
  return [0.5 / l, 0.8 / l, -0.35 / l];
})();
const HAZE_RGB = [214, 226, 232];

// ---- Pinhole camera ----
// World: x = lateral, y = up, z = forward (the river runs +z).
// yawDeg rotates the look direction toward +x; the river's vanishing point
// then lands LEFT of centre: VP.x = centreX - f * tan(yaw).
function makeCamera(px, py, pz, yawDeg, focal, horizonY, centreX) {
  const yaw = yawDeg * Math.PI / 180;
  const F = [Math.sin(yaw), 0, Math.cos(yaw)];      // forward
  const R = [Math.cos(yaw), 0, -Math.sin(yaw)];     // right
  const U = [0, 1, 0];                             // up
  return {
    pos: [px, py, pz], F, R, U, f: focal, horizonY, centreX, yawDeg,
    // Project a world point. Returns {x, y, d} (d = depth along F) or null
    // when the point is behind / too close to the lens.
    project(x, y, z) {
      const vx = x - px, vy = y - py, vz = z - pz;
      const cz = vx * F[0] + vy * F[1] + vz * F[2];
      if (cz < 2) return null;
      const cx = vx * R[0] + vy * R[1] + vz * R[2];
      const cy = vx * U[0] + vy * U[1] + vz * U[2];
      return { x: centreX + focal * cx / cz, y: horizonY - focal * cy / cz, d: cz };
    },
    // Screen position of the vanishing point of the +z direction.
    vanishingPoint() {
      return { x: centreX - focal * Math.tan(yaw), y: horizonY };
    },
  };
}

// ---- Sky (screen-space background, shared by every shot) ----
// opts: { sunX, sunY, sunR, clouds: [[x,y,w,h,alpha]...], storm: bool }
// The sun sits low near the vanishing point; the storm wall is a dark mass
// far away at the RIGHT end of the horizon, never mid-frame.
function drawSky(ctx, W, H, opts) {
  const g = ctx.createLinearGradient(0, 0, 0, 380);
  g.addColorStop(0, '#2a6bc0');
  g.addColorStop(0.5, '#7fb9e6');
  g.addColorStop(0.82, '#ffd98a');
  g.addColorStop(1, '#ffe9b8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 380);
  // Sun + halo at the vanishing point.
  const sx = opts.sunX, sy = opts.sunY, sr = opts.sunR;
  const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, sr * 4.4);
  glow.addColorStop(0, 'rgba(255,238,175,0.95)');
  glow.addColorStop(0.4, 'rgba(255,205,110,0.45)');
  glow.addColorStop(1, 'rgba(255,180,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - sr * 4.4, sy - sr * 4.4, sr * 8.8, sr * 8.8);
  ctx.fillStyle = '#fff7d2';
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  // Layered clouds: two layers, lit from below, kept clear of the centre.
  for (const c of opts.clouds) {
    ctx.fillStyle = 'rgba(255,248,236,' + c[4] + ')';
    ctx.beginPath();
    ctx.ellipse(c[0], c[1], c[2], c[3], 0, 0, Math.PI * 2);
    ctx.ellipse(c[0] + c[2] * 0.42, c[1] - c[3] * 0.55, c[2] * 0.55, c[3] * 0.9, 0, 0, Math.PI * 2);
    ctx.ellipse(c[0] - c[2] * 0.45, c[1] + c[3] * 0.2, c[2] * 0.5, c[3] * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (opts.storm) {
    // (Storm mass is drawn after the terrain by drawStormAfter, so it is
    // visible above the ridge instead of buried behind the valley wall.)
  }
}

// Monsoon wall over the right ridge — drawn AFTER the terrain so it reads
// as weather over the ridge, not a blob buried behind the valley wall.
function drawStormAfter(ctx) {
  ctx.fillStyle = 'rgba(38,34,66,0.85)';
  for (const o of [[-60, 0, 130, 36], [10, -12, 150, 44], [80, 2, 110, 34]]) {
    ctx.beginPath();
    ctx.ellipse(1130 + o[0], 288 + o[1], o[2] / 2, o[3] / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const r = mulberry32(7);
  ctx.strokeStyle = 'rgba(190,210,235,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const rx = 1040 + r() * 220;
    const ry = 308 + r() * 40;
    ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 26);
  }
  ctx.stroke();
}

// Fill a projected polygon (array of {x,y} or nulls). Skips if any vertex
// failed to project — a face straddling the lens is dropped, never smeared.
function fillProjected(ctx, pts, fill) {
  if (!pts || pts.length < 3) return;
  for (const p of pts) if (!p) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}
