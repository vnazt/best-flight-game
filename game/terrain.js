// terrain.js — the Kapuas valley: heightfield mesh, river, bank life,
// ring chain and sea-lane. Everything is a 3D object seen through the same
// camera that sees the aircraft, so depth, scale and haze are consistent.
// All noise is a function of ABSOLUTE (x,z): the valley never jumps as the
// camera window moves forward in live play.
'use strict';

// ---- The river (from the spec: a gentle meander down the valley) ----
function riverCenter(z) { return 8 * Math.sin(z * 0.02) + 4 * Math.sin(z * 0.043 + 1.3); }
function riverHalf(z) { return 9 + z * 0.02; }

// ---- Valley height ----
function valleyHeight(x, z) {
  const d = Math.abs(x - riverCenter(z)) - riverHalf(z);
  if (d <= 0) return -0.6; // channel floor, under the water
  return Math.pow(d, 1.35) * 0.32 + terrainNoise(x, z);
}

function terrainBaseColor(h, distFromRiver) {
  if (h > 55) return [233, 238, 242]; // snow on the highest peaks
  if (h > 30) return mixRgb([122, 106, 74], [90, 110, 62], (55 - h) / 25); // rock -> moss
  if (h > 8) return mixRgb([74, 122, 68], [122, 106, 74], (h - 8) / 22); // moss -> rock
  if (distFromRiver < 3) return [58, 102, 58]; // valley floor, lit
  return mixRgb([64, 110, 62], [74, 122, 68], Math.min(1, h / 8));
}

// ---- Heightfield mesh (painter's algorithm, per-face Lambert + haze) ----
// z0..z1 is the ABSOLUTE window (live play slides it forward with the plane).
function drawValley(ctx, cam, z0, z1) {
  const NX = 24, NZ = 40;
  const xs = [], zs = [];
  for (let i = 0; i <= NX; i++) xs.push(-70 + 140 * i / NX);
  for (let j = 0; j <= NZ; j++) zs.push(z0 + (z1 - z0) * Math.pow(j / NZ, 2.0));
  const H = [];
  for (let j = 0; j <= NZ; j++) {
    H.push([]);
    for (let i = 0; i <= NX; i++) H[j].push(valleyHeight(xs[i], zs[j]));
  }
  const items = [];
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const a = [xs[i], H[j][i], zs[j]], b = [xs[i + 1], H[j][i + 1], zs[j]];
      const c = [xs[i], H[j + 1][i], zs[j + 1]], d = [xs[i + 1], H[j + 1][i + 1], zs[j + 1]];
      for (const t of [[a, b, d], [a, d, c]]) {
        const pa = cam.project(t[0][0], t[0][1], t[0][2]);
        const pb = cam.project(t[1][0], t[1][1], t[1][2]);
        const pc = cam.project(t[2][0], t[2][1], t[2][2]);
        if (!pa || !pb || !pc) continue;
        // Face normal (3D) for Lambert shading.
        const ux = t[1][0] - t[0][0], uy = t[1][1] - t[0][1], uz = t[1][2] - t[0][2];
        const vx = t[2][0] - t[0][0], vy = t[2][1] - t[0][1], vz = t[2][2] - t[0][2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; } // face the sky
        const lam = 0.62 + 0.38 * Math.max(0, nx * SUN_DIR[0] + ny * SUN_DIR[1] + nz * SUN_DIR[2]);
        const hm = (t[0][1] + t[1][1] + t[2][1]) / 3;
        const zm = (t[0][2] + t[1][2] + t[2][2]) / 3;
        const dm = Math.min(
          Math.abs(t[0][0] - riverCenter(t[0][2])) - riverHalf(t[0][2]),
          Math.abs(t[1][0] - riverCenter(t[1][2])) - riverHalf(t[1][2]),
          Math.abs(t[2][0] - riverCenter(t[2][2])) - riverHalf(t[2][2]));
        let col = shadeRgb(terrainBaseColor(hm, dm), lam);
        col = mixRgb(col, HAZE_RGB, Math.min(0.7, zm / 260));
        items.push({ z: zm, pts: [pa, pb, pc], fill: rgbStr(col) });
      }
    }
  }
  items.sort((a, b) => b.z - a.z);
  for (const it of items) fillProjected(ctx, it.pts, it.fill);
}

// ---- River: water strip + gold sun path + glitter + sandy banks ----
function drawRiver(ctx, cam, z0, z1) {
  const step = 6;
  for (let z = z1 - step; z >= z0; z -= step) {
    const z2 = z + step;
    const c1 = riverCenter(z), c2 = riverCenter(z2);
    const h1 = riverHalf(z), h2 = riverHalf(z2);
    const quad = [
      cam.project(c1 - h1, 0.25, z), cam.project(c1 + h1, 0.25, z),
      cam.project(c2 + h2, 0.25, z2), cam.project(c2 - h2, 0.25, z2),
    ];
    if (quad.some((p) => !p)) continue;
    const k = Math.min(1, z / 240);
    fillProjected(ctx, quad, rgbStr(mixRgb([110, 182, 216], [47, 127, 176], k)));
  }
  // Gold sun path down the river centre, wider near the camera.
  ctx.strokeStyle = 'rgba(255,220,150,0.4)';
  ctx.lineCap = 'round';
  for (let z = Math.max(z0, 4); z <= Math.min(z1, 150); z += 6) {
    const a = cam.project(riverCenter(z), 0.32, z);
    const b = cam.project(riverCenter(z + 6), 0.32, z + 6);
    if (!a || !b) continue;
    ctx.lineWidth = Math.max(2, 26 * (1 - z / 170));
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // Seeded glitter flecks on the water (absolute-z placement: stable).
  for (let zi = Math.floor(z0 / 6); zi * 6 <= Math.min(z1, 140); zi++) {
    const z = zi * 6 + 2;
    if (z < 4) continue; // too close to the lens: a fleck here would be huge
    for (let k = 0; k < 2; k++) {
      const x = riverCenter(z) + (hash2(zi, k + 5) - 0.5) * riverHalf(z) * 1.4;
      const p = cam.project(x, 0.35, z);
      if (!p) continue;
      const w = (8 + hash2(zi, k + 9) * 30) * (0.35 + Math.max(0, (130 - z)) / 130);
      ctx.fillStyle = 'rgba(255,226,160,' + (0.3 + hash2(zi, k + 13) * 0.4).toFixed(2) + ')';
      ctx.fillRect(p.x - w / 2, p.y, w, 2.5);
    }
  }
  // Sandy banks.
  ctx.strokeStyle = '#d9c48f';
  ctx.lineWidth = 5;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    let started = false;
    for (let z = z0; z <= Math.min(z1, 150); z += 6) {
      const p = cam.project(riverCenter(z) + s * riverHalf(z), 0.3, z);
      if (!p) continue;
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
}

// ---- Bank life: canopy trees (absolute lattice) + longhouses ----
function drawBankLife(ctx, cam, z0, z1) {
  const items = [];
  for (let zi = Math.floor(z0 / 7); zi * 7 <= z1; zi++) {
    const z = zi * 7;
    if (z < 14) continue; // too close to the lens: a tree here is a lollipop
    const n = hash2(zi, 11) < 0.45 ? 1 : (hash2(zi, 17) < 0.5 ? 2 : 0);
    for (let k = 0; k < n; k++) {
      const side = hash2(zi, k + 3) < 0.5 ? -1 : 1;
      const x = riverCenter(z) + side * (riverHalf(z) + 3 + hash2(zi, k + 7) * 14);
      items.push({ z, kind: 'tree', x, h: 3 + hash2(zi, k + 13) * 5, w: 1.2 + hash2(zi, k + 19) * 1.0 });
    }
  }
  // Longhouses with warm lit windows, at fixed absolute river miles.
  for (const [z, side, off] of [[40, -1, 8], [80, 1, 9], [130, -1, 10]]) {
    if (z < z0 || z > z1) continue;
    items.push({ z, kind: 'house', x: riverCenter(z) + side * (riverHalf(z) + off), w: 5.5 + (z % 2), h: 3.0 + (z % 2) * 0.4 });
  }
  items.sort((a, b) => b.z - a.z);
  for (const it of items) {
    const baseY = valleyHeight(it.x, it.z);
    if (it.kind === 'tree') {
      // Canopy blob: overlapping ellipses billboarded at the projected
      // trunk point, sized by depth — reads as round forest, not triangles.
      const c = cam.project(it.x, baseY + it.h * 0.55, it.z);
      const b = cam.project(it.x, baseY, it.z);
      if (!c || !b) continue;
      const rx = Math.min(45, Math.max(3, 800 * it.w / c.d)), ry = rx * 0.72;
      ctx.strokeStyle = '#2c4a30';
      ctx.lineWidth = Math.max(2, rx * 0.14);
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(c.x, c.y + ry * 0.5); ctx.stroke();
      ctx.fillStyle = '#24402c';
      ctx.beginPath(); ctx.ellipse(c.x, c.y + ry * 0.25, rx, ry * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a7a44';
      ctx.beginPath(); ctx.ellipse(c.x - rx * 0.25, c.y - ry * 0.15, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6a9a58';
      ctx.beginPath(); ctx.ellipse(c.x - rx * 0.35, c.y - ry * 0.4, rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      const hw = it.w / 2, hh = it.h;
      const front = [
        cam.project(it.x - hw, baseY, it.z), cam.project(it.x + hw, baseY, it.z),
        cam.project(it.x + hw, baseY + hh * 0.7, it.z), cam.project(it.x - hw, baseY + hh * 0.7, it.z),
      ];
      const roof = [
        cam.project(it.x - hw - 0.6, baseY + hh * 0.7, it.z), cam.project(it.x + hw + 0.6, baseY + hh * 0.7, it.z),
        cam.project(it.x, baseY + hh, it.z + 1.2),
      ];
      if (front.some((p) => !p) || roof.some((p) => !p)) continue;
      fillProjected(ctx, front, '#6b4a2e');
      fillProjected(ctx, roof, '#8a5a34');
      ctx.fillStyle = '#ffd98a';
      for (let k = -1; k <= 1; k++) {
        const wp = cam.project(it.x + k * hw * 0.5, baseY + hh * 0.35, it.z - 0.1);
        if (wp) ctx.fillRect(wp.x - 3, wp.y - 3, 6, 6);
      }
    }
  }
}

// ---- Sea-lane: centreline dashes, amber buoys, threshold + PAPI ----
function drawSeaLane(ctx, cam) {
  for (let z = 44; z >= 4; z -= 4) {
    const p = cam.project(riverCenter(z), 0.4, z);
    if (!p) continue;
    const w = 1.5 + 5 * (1 - z / 50);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(p.x - w / 2, p.y - w, w, w * 2.4);
  }
  for (const z of [40, 32, 24, 16, 8]) {
    for (const s of [-1, 1]) {
      const p = cam.project(riverCenter(z) + s * (riverHalf(z) - 1), 0.4, z);
      if (!p) continue;
      const r = Math.max(2.5, 6 * (1 - z / 55));
      ctx.fillStyle = 'rgba(255,182,46,0.35)';
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffb62e';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  const tc = cam.project(riverCenter(6), 0.4, 6);
  if (tc) {
    ctx.fillStyle = '#f2f2e8';
    for (let i = -2; i <= 2; i++) ctx.fillRect(tc.x + i * 24 - 7, tc.y - 2, 14, 5);
    const papi = ['#ffffff', '#ffffff', '#ff5a3c', '#ff5a3c'];
    papi.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(tc.x + 80 + i * 13, tc.y - 7, 4, 0, Math.PI * 2); ctx.fill();
    });
  }
}

// ---- Ring chain: true 3D circles, projected as polylines ----
// rings: [{z, r, cy, label, big}] — drawn far to near by the caller order.
function drawRing(ctx, cam, ring) {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const a = i / 40 * Math.PI * 2;
    pts.push(cam.project(riverCenter(ring.z) + Math.cos(a) * ring.r, ring.cy + Math.sin(a) * ring.r, ring.z));
  }
  if (pts.some((p) => !p)) return null;
  const c = cam.project(riverCenter(ring.z), ring.cy, ring.z);
  const apparentR = c ? Math.abs(pts[0].x - c.x) : 0;
  ctx.save();
  if (ring.big) { ctx.shadowColor = '#ffb62e'; ctx.shadowBlur = 22; }
  ctx.strokeStyle = 'rgba(8,20,32,0.9)';
  ctx.lineWidth = ring.big ? 13 : 8;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = ring.big ? '#ffb62e' : 'rgba(255,182,46,0.85)';
  ctx.lineWidth = ring.big ? 8 : 5;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
  if (c && ring.label) {
    ctx.save();
    if (ring.big) {
      ctx.font = 'bold 14px monospace';
      const w = ctx.measureText(ring.label).width + 22;
      const lx = c.x + apparentR + 24;
      ctx.fillStyle = 'rgba(8,20,32,0.92)';
      ctx.fillRect(lx, c.y - 12, w, 24);
      ctx.fillStyle = '#ffe9b0';
      ctx.textAlign = 'left';
      ctx.fillText(ring.label, lx + 11, c.y + 5);
    } else if (apparentR >= 30) {
      // The second ring only: short text LEFT of the ring, right-aligned —
      // the rings converge on the sun, so labels above the ring land on
      // the sun disc, and a chip lands inside the big ring. Farther rings
      // are dots and need no label.
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'right';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(8,20,32,0.9)';
      const ty = c.y + (ring.z < 120 ? -14 : 16);
      const tx = c.x - apparentR - 30;
      ctx.strokeText(ring.label, tx, ty);
      ctx.fillStyle = '#ffe9b0';
      ctx.fillText(ring.label, tx, ty);
    }
    // (Far rings with apparentR < 18 get no label — a dot needs none.)
    ctx.restore();
  }
  return c;
}

function drawRingChain(ctx, cam, rings) {
  // Caller passes far-to-near; each ring paints over the ones behind it.
  for (const r of rings) drawRing(ctx, cam, r);
}

// ---- Village labels on the banks (projected, with dark outline) ----
function drawVillageLabels(ctx, cam, labels) {
  for (const lab of labels) {
    const x = riverCenter(lab.z) + lab.side * (riverHalf(lab.z) + 14);
    const p = cam.project(x, valleyHeight(x, lab.z) + 4, lab.z);
    if (!p) continue;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(10,20,30,0.85)';
    ctx.lineWidth = 3;
    ctx.strokeText(lab.text, p.x, p.y);
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(lab.text, p.x, p.y);
  }
}
