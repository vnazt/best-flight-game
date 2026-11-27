// main.js — game state, loop, input, staged screenshots (REBUILD-0).
// The cover uses a FIXED diagonal chase camera: vanishing point at 1/3 left,
// river running bottom-right -> VP left, sun low left, the Otter-9 big and
// banked at bottom-right, nose to the VP. Live play follows the plane with
// the same 3D engine — one world, one camera family, no 2D sprite anywhere.
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const state = {
  mode: 'fly', // fly | cockpit | hangar | debrief
  shot: null,
  flight: newFlight(),
  mission: newMission(0),
  input: { throttleUp: false, throttleDown: false, left: false, right: false, pitchUp: false, pitchDown: false, drop: false },
  stormT: 0.62,
};

// The world ahead: rings + villages for the current leg and the next one.
// Passed/done flags live on these objects, so they survive frame to frame.
const world = { rings: [], villages: [], builtTo: -1, builtFrom: Infinity };

function ensureWorld(f) {
  const planeZ = f.distZ / 10;
  const needTo = planeZ + 220;
  // Rebuild only when the plane leaves the built window — forward past
  // builtTo, or BACKWARD below builtFrom (the plane went back, e.g. a
  // restart/teleport: the pruned villages behind must come back).
  if (world.builtTo >= needTo && planeZ >= world.builtFrom) return;
  const leg0 = Math.max(0, Math.floor((planeZ - 20) / 240));
  const leg1 = Math.floor(needTo / 240) + 1;
  for (let leg = leg0; leg <= leg1; leg++) {
    for (const r of RINGS) {
      const z = r.z + leg * 240;
      if (z < planeZ - 20 || z > needTo) continue;
      if (!world.rings.some((x) => x.z === z)) {
        world.rings.push({ n: r.n, z, r: r.r, cy: r.cy, label: r.label, big: r.big, passed: false });
      }
    }
    for (const v of VILLAGES) {
      const z = v.z + leg * 240;
      if (z < planeZ - 20 || z > needTo) continue;
      if (!world.villages.some((x) => x.z === z)) {
        world.villages.push({ name: v.name, z, cargo: v.cargo, side: v.side, done: false });
      }
    }
  }
  world.rings = world.rings.filter((r) => r.z >= planeZ - 20);
  world.villages = world.villages.filter((v) => v.z >= planeZ - 20);
  world.builtFrom = planeZ - 20;
  world.builtTo = needTo;
}

// ---- The cover: diagonal composition, vanishing point 1/3 left ----
function drawCoverScene() {
  const f = state.flight, m = state.mission;
  const cam = makeCamera(0, 7, -16, 14.7, 800, 300, 640);
  drawSky(ctx, 1280, 800, {
    sunX: 395, sunY: 235, sunR: 46, storm: true,
    clouds: [[150, 92, 120, 14, 0.9], [1060, 66, 150, 16, 0.9], [300, 158, 96, 12, 0.8], [1140, 190, 110, 13, 0.85], [640, 120, 130, 13, 0.75]],
  });
  drawValley(ctx, cam, -12, 240);
  drawRiver(ctx, cam, -12, 240);
  drawBankLife(ctx, cam, -12, 240);
  drawStormAfter(ctx);
  drawSeaLane(ctx, cam);
  drawRingChain(ctx, cam, RINGS);
  // The Otter-9: 17 units forward, 6.5 right of the camera axis, low and
  // big, banked ~17 deg and yawed a touch off the river line — a 3/4
  // rear-quarter view, so the fuselage shows its LENGTH, not just its tail.
  const px = cam.pos[0] + cam.F[0] * 17 + cam.R[0] * 6.5;
  const pz = cam.pos[2] + cam.F[2] * 17 + cam.R[2] * 6.5;
  drawAircraft(ctx, cam, {
    pos: [px, 2.5, pz],
    yaw: planeYaw(f) + 0.12, pitch: 0.06, roll: 0.30, time: f.time,
  });
  drawVillageLabels(ctx, cam, [
    { text: 'NANGA ERA · MEDICINE', z: 90, side: -1 },
    { text: 'SINTANG · MAIL', z: 60, side: 1 },
  ]);
  drawFlightHUD(ctx, f, m);
}

// ---- Live chase view: the camera follows the plane ----
function drawLiveScene() {
  const f = state.flight, m = state.mission;
  ensureWorld(f);
  const pos = planeWorldPos(f);
  const yaw = planeYaw(f);
  const fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
  const cam = makeCamera(
    pos[0] - fwd[0] * 16, pos[1] + 3.5, pos[2] - fwd[2] * 16,
    yaw * 180 / Math.PI, 800, 300, 640);
  const z0 = Math.max(0, pos[2] - 12), z1 = pos[2] + 220;
  drawSky(ctx, 1280, 800, {
    sunX: 640, sunY: 250, sunR: 46, storm: state.stormT > 0.4,
    clouds: [[180, 110, 130, 15, 0.9], [980, 90, 150, 16, 0.9], [560, 160, 100, 12, 0.8], [1120, 190, 110, 13, 0.85]],
  });
  drawValley(ctx, cam, z0, z1);
  drawRiver(ctx, cam, z0, z1);
  drawBankLife(ctx, cam, z0, z1);
  if (state.stormT > 0.4) drawStormAfter(ctx);
  drawSeaLane(ctx, cam);
  const visibleRings = world.rings
    .filter((r) => r.z >= pos[2] - 5 && r.z <= pos[2] + 200)
    .sort((a, b) => b.z - a.z);
  drawRingChain(ctx, cam, visibleRings);
  drawAircraft(ctx, cam, {
    pos, yaw, pitch: -f.pitch * 0.01, roll: -f.bank * Math.PI / 180, time: f.time,
  });
  drawFlightHUD(ctx, f, m);
  if (m.toast) {
    hudLabel(ctx, m.toast, 640, 100, 16, HUD_AMBER, 'center');
  }
}

function draw() {
  ctx.clearRect(0, 0, 1280, 800);
  if (state.shot === 'cover') { drawCoverScene(); return; }
  if (state.shot === 'cockpit') { drawCockpitScene(ctx, state.flight, state.mission); return; }
  if (state.shot === 'hangar') { drawHangarScene(ctx, state.flight, state.mission); return; }
  if (state.shot === 'debrief') { drawDebriefScene(ctx, state.flight, state.mission); return; }
  if (state.mode === 'cockpit') { drawCockpitScene(ctx, state.flight, state.mission); return; }
  if (state.mode === 'hangar') { drawHangarScene(ctx, state.flight, state.mission); return; }
  if (state.mode === 'debrief') { drawDebriefScene(ctx, state.flight, state.mission); return; }
  drawLiveScene();
}

let lastTs = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  if (!state.shot) {
    const dropNow = state.input.drop;
    state.input.drop = false;
    updateFlight(state.flight, Object.assign({}, state.input, { drop: dropNow }), dt, state.mission, world);
    state.stormT = 0.15 + (state.mission.landfallSec / 287) * 0.55;
    if (state.flight.state !== 'flying' && state.mode === 'fly') state.mode = 'debrief';
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
    Object.assign(f, { speedKt: 132, altFt: 310, hdg: 46, pitch: 2, bank: -7, throttle: 66, fuelKg: 84, hull: 100, vsFpm: -1170, time: 2.4, distZ: 12, latX: 0, state: 'flying' });
    Object.assign(m, { gatesPassed: 2, score: 18450, landfallSec: 287 });
    m.checklist[1].prog = '2/6';
    state.stormT = 0.62;
  } else if (name === 'cockpit') {
    state.mode = 'cockpit';
    Object.assign(f, { speedKt: 174, altFt: 289, hdg: 270, pitch: -3, bank: 0, throttle: 56, fuelKg: 55, hull: 96, vsFpm: -969, time: 74, distZ: 120, latX: 0, state: 'flying' });
    Object.assign(m, { gatesPassed: 5, score: 27100, landfallSec: 212 });
    state.stormT = 0.5;
  } else if (name === 'hangar') {
    state.mode = 'hangar';
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
  ArrowUp: 'pitchUp', ArrowDown: 'pitchDown',
  ShiftLeft: 'throttleUp', ShiftRight: 'throttleUp',
};
window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code] != null) { state.input[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.code === 'KeyC') state.mode = state.mode === 'cockpit' ? 'fly' : 'cockpit';
  if (e.code === 'KeyH') state.mode = state.mode === 'hangar' ? 'fly' : 'hangar';
  if (e.code === 'KeyP') state.flight.paused = !state.flight.paused;
  if (e.code === 'KeyE') state.input.drop = true;
  if (e.code === 'Enter' && state.mode === 'debrief') {
    state.flight = newFlight();
    state.mission = newMission(0);
    world.rings = []; world.villages = []; world.builtTo = -1; world.builtFrom = Infinity;
    state.mode = 'fly';
  }
  if (state.mode === 'debrief' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
    state.mission.refit = Number(e.code.slice(-1));
  }
});
window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code] != null) state.input[KEYMAP[e.code]] = false;
});

// ---- Boot ----
(function boot() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (shot) { stageShot(shot); window.__ready = true; window.__game = state; window.__flight = { updateFlight }; return; }
  requestAnimationFrame(loop);
  window.__ready = true;
  window.__game = state; // exposed for the headless playtest
  window.__flight = { updateFlight };
  window.__world = world;
})();
