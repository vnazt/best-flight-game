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

function draw() {
  ctx.clearRect(0, 0, 1280, 800);
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
