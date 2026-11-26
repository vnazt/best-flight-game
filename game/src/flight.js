// Flight model: throttle + turn discipline, fuel and damage as decisions.
// The plane flies the river; rings, cargo drops and water landings are scored.
// Speeds in knots, altitude in feet, distances in metres.

const Flight = (() => {
  const KT_TO_MS = 0.514444;
  const FT_TO_M = 0.3048;

  function createFlight() {
    return {
      s: 0, lat: 0, altFt: 0, spdKt: 0, thr: 0,
      pitchDeg: 0, rollDeg: 0,
      fuelKg: 100, dmgPct: 0,
      score: 0, combo: 0, bestCombo: 0,
      ringsPassed: 0, ringsTotal: 0,
      cargoDone: 0, cargoTotal: 0,
      state: 'TITLE', // TITLE | FLY | TURNAROUND | DEBRIEF | CRASHED | LANDED
      leg: 0, onWater: false, landed: false, airborne: false,
      timeSec: 0, landfallSec: 8 * 60, // monsoon landfall countdown
      events: [], // {kind, text} consumed by radio + HUD
      trace: [], // flight-recorder: {t, altFt, spdKt} sampled 2x/sec
      _traceAcc: 0,
    };
  }

  function emit(f, kind, text) { f.events.push({ kind, text }); }

  // One physics step. input: {pitch:-1..1, roll:-1..1, thr:-1..1, drop:bool}
  function updateFlight(f, dt, input, world) {
    if (f.state !== 'FLY') return;
    f.timeSec += dt;
    f.landfallSec = Math.max(0, f.landfallSec - dt);

    // Throttle: 0..1, speed chases throttle with lag.
    f.thr = Math.min(1, Math.max(0, f.thr + input.thr * dt * 0.45));
    const targetSpd = 42 + f.thr * 108;
    f.spdKt += (targetSpd - f.spdKt) * Math.min(1, dt * 0.55);

    // Pitch: climb/descent rate from the pitch angle and true airspeed.
    f.pitchDeg += (input.pitch * 9 - f.pitchDeg) * Math.min(1, dt * 3);
    f.rollDeg += (input.roll * 28 - f.rollDeg) * Math.min(1, dt * 3.2);
    f.altFt = Math.max(0, f.altFt + Math.sin(f.pitchDeg * Math.PI / 180) * f.spdKt * KT_TO_MS * dt / FT_TO_M);
    f.altFt = Math.min(1500, f.altFt);
    f.lat += Math.sin(f.rollDeg * Math.PI / 180) * f.spdKt * KT_TO_MS * dt * 2.4;
    f.lat = Math.max(-160, Math.min(160, f.lat));
    f.s += f.spdKt * KT_TO_MS * dt;

    // Fuel: throttle burns it slowly — a full tank lasts ~11 minutes at cruise.
    const before = f.fuelKg;
    f.fuelKg = Math.max(0, f.fuelKg - (0.05 + f.thr * 0.12) * dt);
    if (before > 25 && f.fuelKg <= 25) emit(f, 'bingo', 'BINGO FUEL — 25 kg left. Every litre is a decision now.');
    if (f.fuelKg <= 0) { crashFlight(f, 'OUT OF FUEL'); return; }

    // Flying low over land (off the river) scrapes the canopy.
    const riverHalf = River.riverHalfAt(f.s);
    if (f.altFt < 60 && Math.abs(f.lat) > riverHalf + 8) {
      f.dmgPct = Math.min(100, f.dmgPct + dt * 14);
      if (f.dmgPct >= 100) { crashFlight(f, 'CLIPPED THE CANOPY'); return; }
    }

    // Rings: pass through the centre, score and combo.
    for (const ring of world.rings) {
      if (!ring.passed && f.s >= ring.s - 12 && f.s <= ring.s + 12) {
        const dLat = Math.abs(f.lat - ring.lat);
        const dAlt = Math.abs(f.altFt - ring.altFt);
        if (dLat < ring.radiusM + 6 && dAlt < 130) {
          ring.passed = true;
          f.ringsPassed++;
          f.combo++;
          f.bestCombo = Math.max(f.bestCombo, f.combo);
          const pts = 150 + f.combo * 25;
          f.score += pts;
          emit(f, 'ring', 'RING ' + ring.num + ' + ' + pts + (f.combo > 1 ? ' · COMBO x' + f.combo : ''));
        } else if (f.s > ring.s + 12) {
          ring.passed = true; // missed: counts as passed-through, combo breaks
          f.combo = 0;
          emit(f, 'miss', 'MISSED RING ' + ring.num + ' — combo lost.');
        }
      } else if (!ring.passed && f.s > ring.s + 12) {
        ring.passed = true;
        f.combo = 0;
        emit(f, 'miss', 'MISSED RING ' + ring.num + ' — combo lost.');
      }
    }

    // Cargo drop: Space over a village, low and slow.
    if (input.drop) {
      for (const v of world.villages) {
        if (!v.done && Math.abs(f.s - v.s) < 90 && Math.abs(f.lat - v.lat) < 42 && f.altFt < 420) {
          v.done = true;
          f.cargoDone++;
          f.score += 400;
          emit(f, 'cargo', 'CARGO AWAY — ' + v.cargo + ' for ' + v.name + ' +400');
          emit(f, 'radio', v.contact + ': ' + v.line);
        }
      }
    }

    // Monsoon landfall: the wall catches the plane.
    if (f.landfallSec <= 0) { crashFlight(f, 'THE MONSOON CAUGHT YOU'); return; }

    // Once airborne, the plane stays airborne until it lands. A fresh
    // spawn sits at alt 0, spd 38 on a strip — it must not land instantly.
    if (f.altFt > 80 || f.spdKt > 80) f.airborne = true;

    // Water landing at a strip: slow, low, on the river.
    for (const strip of River.STRIPS) {
      if (strip.s > 0 && Math.abs(f.s - strip.s) < 70) {
        if (f.airborne && f.spdKt < 72 && f.altFt < 55 && Math.abs(f.lat) < River.riverHalfAt(f.s) + 4) {
          landFlight(f, strip);
          return;
        }
        if (f.airborne && f.altFt < 12 && Math.abs(f.lat) > River.riverHalfAt(f.s) + 4) {
          crashFlight(f, 'DITCHED IN THE TREES'); return;
        }
      }
    }

    // Flight-recorder trace, 2 samples a second.
    f._traceAcc += dt;
    if (f._traceAcc >= 0.5) {
      f._traceAcc = 0;
      f.trace.push({ t: Math.round(f.timeSec * 10) / 10, altFt: Math.round(f.altFt), spdKt: Math.round(f.spdKt) });
      if (f.trace.length > 600) f.trace.shift();
    }
  }

  function crashFlight(f, why) {
    f.state = 'CRASHED';
    f.crashWhy = why;
    f.combo = 0;
    emit(f, 'crash', why + ' — sortie over.');
  }

  function landFlight(f, strip) {
    f.state = 'LANDED';
    f.landed = true;
    f.onWater = true;
    f.airborne = false;
    f.spdKt = 0;
    f.score += 500;
    emit(f, 'land', 'DOWN SAFE — ' + strip.name + ' ' + strip.runway + ' +500');
  }

  function startTakeoff(f) {
    f.state = 'FLY';
    f.altFt = 0;
    f.spdKt = 38;
    f.thr = 0.55;
    f.airborne = false;
    emit(f, 'radio', 'Sinta — Kapuas Control: Kite Four, river is yours. Wind calm, wall at eight minutes.');
  }

  return { createFlight, updateFlight, startTakeoff, crashFlight, landFlight, KT_TO_MS, FT_TO_M };
})();
