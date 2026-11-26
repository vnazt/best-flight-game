// world.js — the Kapuas River valley: sky, river, rainforest, villages, storm.
// All scenery is seeded and deterministic so every render is stable.
'use strict';

// Seeded RNG (mulberry32) — one fixed seed for the whole valley.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261126);

// Sky palettes: CRISP DAY / GOLDEN SUNSET / STORM DUSK.
const SKIES = {
  day: {
    name: 'CRISP DAY',
    top: '#2f6db3', mid: '#7fb2d9', low: '#cfe6ef',
    sun: '#fff3c4', sunCore: '#ffffff', haze: 'rgba(207,230,239,0.55)',
    ridgeFar: '#7d94a8', ridgeMid: '#6d8a6a', ridgeNear: '#5d7d5a', forest: '#3e7a44',
    forestDark: '#2c5a33', forestLight: '#6fae56', water: '#3f8fb5',
    waterLight: '#9ed8ec', sand: '#d9c48f', mist: 'rgba(230,242,248,0.5)'
  },
  sunset: {
    name: 'GOLDEN SUNSET',
    top: '#2c2a5e', mid: '#8a4a7d', low: '#f0915a',
    sun: '#ffd98a', sunCore: '#fff2c0', haze: 'rgba(240,145,90,0.4)',
    ridgeFar: '#6b4a72', ridgeMid: '#5a5248', ridgeNear: '#4d5c43', forest: '#3d6b3a',
    forestDark: '#2a4d2e', forestLight: '#7fae4e', water: '#557a99',
    waterLight: '#a8d4e6', sand: '#e0b47e', mist: 'rgba(255,190,130,0.35)'
  },
  dusk: {
    name: 'STORM DUSK',
    top: '#141a33', mid: '#3a3f66', low: '#7a5a72',
    sun: '#c9b18a', sunCore: '#e8d5a8', haze: 'rgba(90,90,120,0.5)',
    ridgeFar: '#3d4066', ridgeMid: '#333a3e', ridgeNear: '#2e3d33', forest: '#24402c',
    forestDark: '#182b1e', forestLight: '#4a7a44', water: '#3a5568',
    waterLight: '#8fa8b8', sand: '#8a7a5e', mist: 'rgba(140,150,180,0.3)'
  }
};

// The river centreline: world x (metres from valley centre) as a function of
// depth t (0 = at the camera, 1 = at the horizon). Kept gentle so the river
// stays in frame from the bottom edge all the way to the horizon.
function riverCenter(t) {
  return 120 * Math.sin(t * 5.2 + 0.8) + 60 * Math.sin(t * 11.3 + 2.1);
}
function riverHalfWidth(t) { return 150 - 105 * t; } // narrows toward horizon

// Villages along the river. side: -1 left bank, +1 right bank, 0 on the water.
const VILLAGES = [
  { name: 'PUTUSSIBAU', t: 0.05, side: -1, cargo: 'MAIL',        dist: 0 },
  { name: 'NANGA ERA',  t: 0.33, side: 1,  cargo: 'MEDICINE',    dist: 1 },
  { name: 'TAYAN',      t: 0.56, side: -1, cargo: 'SPARE PARTS', dist: 2 },
  { name: 'SINTANG',    t: 0.76, side: 1,  cargo: 'MAIL',        dist: 3 },
  { name: 'PONTIANAK',  t: 0.96, side: 0,  cargo: '—',           dist: 4 }
];

// Six amber gate rings down the river.
const GATES = [0.12, 0.28, 0.44, 0.60, 0.76, 0.90].map((t, i) => ({
  n: i + 1, t, x: riverCenter(t)
}));

// Tributaries joining the main river.
const TRIBUTARIES = [
  { t: 0.22, side: 1, bend: 1.0 },
  { t: 0.48, side: -1, bend: -1.0 },
  { t: 0.68, side: 1, bend: 0.7 }
];

// Longhouses tucked into the treeline near villages. Only two, both placed
// where their labels can never touch a gate ring or a HUD panel.
const LONGHOUSES = [
  { t: 0.18, side: -1, label: 'LONGHOUSE' },
  { t: 0.50, side: -1, label: 'LONGHOUSE' }
];

// Camera projection: depth t -> screen position. wx is world x in metres.
// FIX (v4): the y mapping was inverted — near ground rendered at the horizon
// and far ground at the bottom of the frame, which is why the v3 cover read
// as a mess. Near (t=0) is now the bottom of the frame, far (t=1) the horizon.
const HORIZON = 330;
function project(t, wx) {
  const k = Math.pow(1 - t, 1.7);            // 1 near, ~0 at horizon
  const y = HORIZON + (800 - HORIZON) * k;   // near = bottom, far = horizon
  const x = 640 + wx * (0.12 + 1.55 * k);
  return { x, y, s: 0.06 + 1.35 * k };
}

// Seeded tree clusters on both banks.
const TREES = [];
(function () {
  for (let i = 0; i < 260; i++) {
    const t = rng();
    const side = rng() < 0.5 ? -1 : 1;
    const off = riverHalfWidth(t) + 30 + rng() * 420;
    TREES.push({ t, x: riverCenter(t) + side * off, clump: rng() < 0.55, h: 14 + rng() * 26 });
  }
})();

// Faceted mountain ridges: far (hazy), mid, near (dark). Three layers with
// atmospheric perspective so the valley reads as depth, not flat triangles.
const RIDGES = [
  { t: 0.97, amp: 105, base: 340, col: 'far', seed: 11 },
  { t: 0.86, amp: 78, base: 350, col: 'mid', seed: 47 },
  { t: 0.78, amp: 55, base: 360, col: 'near', seed: 73 }
];

function drawSky(ctx, sky, sunX, sunY, sunR) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 60);
  g.addColorStop(0, sky.top); g.addColorStop(0.55, sky.mid); g.addColorStop(1, sky.low);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, HORIZON + 60);
  // Big sun with glow.
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, sunR * 3.2);
  glow.addColorStop(0, sky.sun); glow.addColorStop(0.35, sky.sun + 'cc');
  glow.addColorStop(1, 'rgba(255,180,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - sunR * 3.2, sunY - sunR * 3.2, sunR * 6.4, sunR * 6.4);
  ctx.fillStyle = sky.sunCore;
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
}

function drawClouds(ctx, sky, seedOff) {
  const r = mulberry32(99 + seedOff);
  ctx.fillStyle = 'rgba(255,244,230,0.85)';
  for (let i = 0; i < 9; i++) {
    const cx = r() * 1280, cy = 40 + r() * 220, w = 60 + r() * 130, h = 12 + r() * 16;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + w * 0.4, cy - h * 0.5, w * 0.55, h * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Soft haze where sky meets the ridges — a gradient, never a hard stripe.
  const hz = ctx.createLinearGradient(0, HORIZON - 44, 0, HORIZON + 26);
  hz.addColorStop(0, 'rgba(255,220,180,0)');
  hz.addColorStop(0.5, sky.haze);
  hz.addColorStop(1, 'rgba(255,220,180,0)');
  ctx.fillStyle = hz;
  ctx.fillRect(0, HORIZON - 44, 1280, 70);
}

function drawRidges(ctx, sky) {
  for (const ridge of RIDGES) {
    const r = mulberry32(ridge.seed);
    const col = ridge.col === 'far' ? sky.ridgeFar : ridge.col === 'mid' ? sky.ridgeMid : sky.ridgeNear;
    // Gradient fill: hazy light at the peaks, darker at the base — depth,
    // not a flat triangle.
    const rg = ctx.createLinearGradient(0, HORIZON - ridge.amp - 20, 0, HORIZON + 40);
    rg.addColorStop(0, col);
    rg.addColorStop(1, shade(col, -28));
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.moveTo(0, HORIZON + 40);
    let x = -40;
    while (x < 1320) {
      const w = 110 + r() * 170;
      const peak = HORIZON - 16 - r() * ridge.amp;
      // Rounded peak: quadratic shoulders instead of a sharp spike.
      ctx.quadraticCurveTo(x + w * 0.28, peak + 26, x + w / 2, peak);
      ctx.quadraticCurveTo(x + w * 0.72, peak + 26, x + w, HORIZON + 30 + r() * 20);
      x += w;
    }
    ctx.lineTo(1320, HORIZON + 40); ctx.closePath(); ctx.fill();
    // Warm rim light on the sun side of each peak.
    ctx.strokeStyle = 'rgba(255,200,120,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath();
    const r2 = mulberry32(ridge.seed);
    x = -40;
    while (x < 1320) {
      const w = 90 + r2() * 160;
      const peak = HORIZON - 20 - r2() * ridge.amp;
      ctx.moveTo(x + w / 2 - 14, peak + 22);
      ctx.lineTo(x + w / 2, peak);
      x += w;
    }
    ctx.stroke();
  }
}

// Darken a #rrggbb colour by amt (negative = darker).
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// The forest floor. FIX (v4): v3 never painted the ground below the
// horizon, so the lower half of the cover was a black void with trees
// floating on it. The valley floor is dark rainforest green, hazy far away.
function drawGround(ctx, sky) {
  const gg = ctx.createLinearGradient(0, HORIZON, 0, 800);
  gg.addColorStop(0, shade(sky.forest, 14));
  gg.addColorStop(0.45, sky.forestDark);
  gg.addColorStop(1, '#101f14');
  ctx.fillStyle = gg;
  ctx.fillRect(0, HORIZON, 1280, 800 - HORIZON);
  // A few darker clearings so the floor is not one flat slab.
  const r = mulberry32(515);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(r() * 1280, HORIZON + 60 + r() * 380, 90 + r() * 160, 22 + r() * 26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRiver(ctx, sky, camT) {
  // Water band from the horizon down to the bottom of the frame.
  const steps = 26;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const c = riverCenter(t), w = riverHalfWidth(t);
    const p = project(t, c - w);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const c = riverCenter(t), w = riverHalfWidth(t);
    const p = project(t, c + w);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  const wg = ctx.createLinearGradient(0, HORIZON, 0, 800);
  wg.addColorStop(0, sky.water); wg.addColorStop(1, sky.waterLight);
  ctx.fillStyle = wg; ctx.fill();
  // Sunlit centre streak — wide and bright gold, so the river reads as
  // water at a glance, never as a road or a shadow.
  ctx.strokeStyle = 'rgba(255,220,150,0.7)'; ctx.lineWidth = 9;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = 0.15 + (i / steps) * 0.85;
    const p = project(t, riverCenter(t) + 26 * Math.sin(t * 9));
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,245,210,0.55)'; ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = 0.1 + (i / steps) * 0.9;
    const p = project(t, riverCenter(t) - 34 * Math.sin(t * 7 + 1));
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  // Sandy banks.
  ctx.strokeStyle = sky.sand; ctx.lineWidth = 9;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = project(t, riverCenter(t) + side * riverHalfWidth(t));
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
}

function drawTributaries(ctx, sky) {
  ctx.strokeStyle = sky.waterLight; ctx.lineCap = 'round';
  for (const tr of TRIBUTARIES) {
    ctx.lineWidth = 16 * (1 - tr.t) + 4;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const f = i / 10;
      const t = tr.t - f * 0.16;
      const x = riverCenter(tr.t) + tr.side * (riverHalfWidth(tr.t) + f * 260 + tr.bend * 60 * f * f);
      const p = project(Math.max(0.02, t), x);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
}

function drawForest(ctx, sky) {
  const r = mulberry32(2027);
  for (const tr of TREES) {
    const p = project(tr.t, tr.x);
    const h = tr.h * p.s;
    if (h < 2) continue;
    const tone = r() < 0.5 ? sky.forest : (r() < 0.5 ? sky.forestDark : sky.forestLight);
    if (tr.clump) {
      // Canopy clump: three stacked crowns with a warm highlight + trunk.
      ctx.fillStyle = '#3a2c1c';
      ctx.fillRect(p.x - h * 0.06, p.y - h * 0.2, h * 0.12, h * 0.2);
      ctx.fillStyle = sky.forestDark;
      ctx.beginPath();
      ctx.moveTo(p.x - h * 0.9, p.y); ctx.lineTo(p.x - h * 0.3, p.y - h);
      ctx.lineTo(p.x + h * 0.2, p.y - h * 0.7); ctx.lineTo(p.x + h * 0.9, p.y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.moveTo(p.x - h * 0.55, p.y - h * 0.5); ctx.lineTo(p.x - h * 0.1, p.y - h * 1.05);
      ctx.lineTo(p.x + h * 0.45, p.y - h * 0.55); ctx.closePath(); ctx.fill();
      ctx.fillStyle = sky.forestLight;
      ctx.beginPath();
      ctx.moveTo(p.x - h * 0.35, p.y - h * 0.45); ctx.lineTo(p.x, p.y - h);
      ctx.lineTo(p.x + h * 0.3, p.y - h * 0.4); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = tr.h > 30 ? tone : sky.forestDark;
      ctx.beginPath();
      ctx.moveTo(p.x - h * 0.45, p.y); ctx.lineTo(p.x, p.y - h); ctx.lineTo(p.x + h * 0.45, p.y);
      ctx.closePath(); ctx.fill();
    }
  }
}

function drawLonghouses(ctx, sky) {
  for (const lh of LONGHOUSES) {
    const p = project(lh.t, riverCenter(lh.t) + lh.side * (riverHalfWidth(lh.t) + 90));
    const w = 74 * p.s + 18, h = 20 * p.s + 8;
    ctx.fillStyle = '#5a3d24';
    ctx.fillRect(p.x - w / 2, p.y - h, w, h * 0.7);
    ctx.fillStyle = '#c98a3e';
    ctx.beginPath();
    ctx.moveTo(p.x - w / 2 - 4, p.y - h * 0.7);
    ctx.lineTo(p.x, p.y - h * 1.7);
    ctx.lineTo(p.x + w / 2 + 4, p.y - h * 0.7);
    ctx.closePath(); ctx.fill();
    ctx.font = 'bold ' + Math.max(12, Math.round(13 * p.s + 6)) + 'px monospace';
    ctx.textAlign = 'center';
    if (p.x <= 820) { // never let the label run under the radio panel
      ctx.strokeStyle = 'rgba(10,20,30,0.85)'; ctx.lineWidth = 3;
      ctx.strokeText(lh.label, p.x, p.y - h * 1.9);
      ctx.fillStyle = '#ffe9b0';
      ctx.fillText(lh.label, p.x, p.y - h * 1.9);
    }
  }
}

function drawMist(ctx, sky, drift) {
  ctx.fillStyle = sky.mist;
  for (const [y0, h, ph] of [[560, 26, 0], [640, 34, 2.1]]) {
    ctx.beginPath();
    ctx.ellipse(640 + Math.sin(drift + ph) * 60, y0, 560, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The advancing monsoon wall. FIX (v4): v3 painted it as a wide diagonal
// gradient slab across the whole frame, which read as a grey highway.
// The storm is now a VERTICAL rain curtain standing at the far right bank:
// dark cloud mass above the horizon, vertical rain streaks falling onto the
// far terrain, soft left edge. It never crosses the river or the plane.
function drawStormFront(ctx, sky, stormT) {
  if (stormT <= 0.02) return;
  // Curtain position follows the timer: the more the landfall clock has
  // run down, the further left (closer) its edge has advanced.
  const x0 = 1080 - stormT * 200;   // left edge, ~956 at stormT 0.62
  const x1 = 1280;
  const cx = (x0 + x1) / 2;
  // Dark cloud mass above the horizon, right side only.
  ctx.fillStyle = 'rgba(38,34,66,0.92)';
  for (const [ox, oy, w, h] of [[-70, 0, 150, 42], [10, -14, 170, 50], [90, 2, 130, 40]]) {
    ctx.beginPath();
    ctx.ellipse(cx + ox, 268 + oy, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(20,22,48,0.9)';
  ctx.beginPath();
  ctx.ellipse(cx, 300, 210, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rain curtain: vertical streaks from the cloud base down to the far
  // terrain, with a soft fading left edge.
  const g = ctx.createLinearGradient(x0, 0, x0 + 130, 0);
  g.addColorStop(0, 'rgba(20,26,51,0)');
  g.addColorStop(0.35, 'rgba(20,26,51,0.5)');
  g.addColorStop(1, 'rgba(20,26,51,0.66)');
  ctx.fillStyle = g;
  ctx.fillRect(x0, 300, x1 - x0, 170);
  const r = mulberry32(7);
  ctx.strokeStyle = 'rgba(190,210,235,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 22; i++) {
    const rx = x0 + 20 + r() * (x1 - x0 - 30);
    const ry = 312 + r() * 110;
    ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 38);
  }
  ctx.stroke();
  // Faint haze where the rain meets the far ground.
  const hz = ctx.createLinearGradient(0, 440, 0, 500);
  hz.addColorStop(0, 'rgba(40,45,80,0.28)');
  hz.addColorStop(1, 'rgba(40,45,80,0)');
  ctx.fillStyle = hz;
  ctx.fillRect(x0, 440, x1 - x0, 60);
  // Label in clear sky above the cloud mass, on a dark backing so it
  // always reads. Clear of the mission card (ends y 162) and the sun.
  ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
  const tw = ctx.measureText('MONSOON WALL').width + 24;
  ctx.fillStyle = 'rgba(8,20,32,0.88)';
  ctx.fillRect(cx - tw / 2, 216, tw, 24);
  ctx.fillStyle = '#ffd98a';
  ctx.fillText('MONSOON WALL', cx, 233);
}
