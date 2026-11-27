// flight.js — the flight model: throttle, bank, pitch, fuel, rings,
// cargo drops, water landings and crashes. Pure state update, no drawing:
// the renderer reads the same state, so what the screenshots show is what
// the simulation does. Deterministic: no randomness anywhere in here.
'use strict';

function newFlight() {
  return {
    state: 'flying', // flying | landed | crashed
    speedKt: 132, altFt: 310, hdg: 46, pitch: 2, bank: -7,
    throttle: 66, fuelKg: 84, hull: 100, vsFpm: -1170,
    distZ: 12, latX: 0, // distZ = metres along the river (1 world unit = 10 m)
    time: 2.4, paused: false,
  };
}

// World position of the aircraft: it follows the river's meander, offset
// laterally by latX, at an altitude scaled from feet to world units.
function planeWorldPos(f) {
  const z = f.distZ / 10;
  return [riverCenter(z) + f.latX, 1.5 + f.altFt / 120, z];
}

// Yaw follows the river's tangent. The compass heading is a display
// number; the aircraft always flies down the river.
function planeYaw(f) {
  const z = f.distZ / 10;
  const slope = 8 * 0.02 * Math.cos(z * 0.02) + 4 * 0.043 * Math.cos(z * 0.043 + 1.3);
  return Math.atan(slope);
}

// input: { throttleUp, throttleDown, left, right, pitchUp, pitchDown, drop }
// world: { rings: [{z, r, passed}], villages: [{z, name, done}] }
function updateFlight(f, input, dt, mission, world) {
  if (f.state !== 'flying' || f.paused) return;
  // Throttle: W/S.
  if (input.throttleUp) f.throttle = Math.min(100, f.throttle + 30 * dt);
  if (input.throttleDown) f.throttle = Math.max(0, f.throttle - 30 * dt);
  // Speed chases the throttle with lag (heavy floatplane feel).
  const targetSpeed = 40 + f.throttle * 1.6;
  f.speedKt += (targetSpeed - f.speedKt) * Math.min(1, 0.9 * dt);
  // Bank: A/D. Heading and lateral drift follow the bank.
  const bankTarget = (input.right ? 35 : 0) + (input.left ? -35 : 0);
  f.bank += (bankTarget - f.bank) * Math.min(1, 4 * dt);
  f.hdg = (f.hdg + f.bank * 0.35 * dt + 360) % 360;
  f.latX += Math.sin(f.bank * Math.PI / 180) * f.speedKt * 0.514 * dt * 0.05;
  f.latX = Math.max(-14, Math.min(14, f.latX));
  // Pitch: ArrowUp/Down. Vertical speed follows pitch and speed.
  const pitchTarget = (input.pitchUp ? 12 : 0) + (input.pitchDown ? -12 : 0);
  f.pitch += (pitchTarget - f.pitch) * Math.min(1, 3 * dt);
  f.vsFpm = f.pitch * f.speedKt * 6;
  f.altFt = Math.max(0, f.altFt + f.vsFpm * dt / 60);
  // Forward motion + fuel + landfall clock.
  const prevZ = f.distZ;
  f.distZ += f.speedKt * 0.514 * dt;
  f.fuelKg = Math.max(0, f.fuelKg - dt * (0.10 + f.throttle * 0.0008));
  mission.landfallSec = Math.max(0, mission.landfallSec - dt);
  f.time += dt;
  // Ring passes: crossing a ring's z-line inside its radius scores.
  for (const ring of world.rings) {
    if (ring.passed) continue;
    if (prevZ / 10 < ring.z && f.distZ / 10 >= ring.z) {
      ring.passed = true;
      if (Math.abs(f.latX) < ring.r) {
        mission.combo = (mission.combo || 0) + 1;
        mission.score += 500 + mission.combo * 100;
        mission.gatesPassed++;
        mission.toast = 'GATE ' + ring.n + ' CLEAN +' + (500 + mission.combo * 100) + ' — nice line, Otter-Nine.';
      } else {
        mission.combo = 0;
        mission.toast = 'GATE ' + ring.n + ' MISSED — line up on the river.';
      }
    }
  }
  // Cargo drop: E, low over an unfinished village.
  if (input.drop) {
    const v = world.villages.find((x) => !x.done && Math.abs(f.distZ / 10 - x.z) < 18);
    if (v && f.altFt < 700) {
      v.done = true;
      mission.dropsDone++;
      mission.score += 400;
      mission.checklist[2].done = mission.dropsDone >= 1;
      mission.toast = 'CARGO AWAY +400 — ' + v.name + ' thanks you, Otter-Nine.';
    } else {
      mission.toast = 'NO DROP ZONE — line up over a village, low and slow.';
    }
  }
  // Water landing / crash: touching the water decides the sortie.
  if (f.altFt <= 2) {
    const z = f.distZ / 10;
    if (f.speedKt < 90 && Math.abs(f.latX) < riverHalf(z)) {
      f.state = 'landed';
      mission.score += 1000;
      mission.toast = 'ON THE WATER +1000 — Pontianak, safe and dry.';
    } else {
      f.state = 'crashed';
      f.hull = Math.max(0, f.hull - 40);
      mission.toast = 'CRASH — you hit the bank at ' + Math.round(f.speedKt) + ' kt. The river forgives once.';
    }
  }
  if (f.fuelKg <= 0 && f.altFt > 2) {
    f.state = 'crashed';
    mission.toast = 'FLAMEOUT — out of fuel over the jungle. The river forgives once.';
  }
}
