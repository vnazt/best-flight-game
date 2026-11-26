// Screenshot presets: staged, deterministic states of the real game, one
// per screenshot. Each preset sets the live game state (never a mock render)
// and lets the normal renderer draw it. Shots are real captures of the
// game's own code in a browser.

const Shots = (() => {
  function stageFlight(G, opts) {
    const f = G.f;
    Object.assign(f, {
      state: 'FLY', s: opts.s, lat: opts.lat || 0, altFt: opts.altFt, spdKt: opts.spdKt,
      thr: opts.thr || 0.7, pitchDeg: opts.pitchDeg || 0, rollDeg: opts.rollDeg || 0,
      fuelKg: opts.fuelKg, dmgPct: opts.dmgPct, score: opts.score, combo: opts.combo || 0,
      ringsPassed: opts.ringsPassed, ringsTotal: opts.ringsTotal,
      cargoDone: opts.cargoDone, cargoTotal: opts.cargoTotal,
      leg: opts.leg, landfallSec: opts.landfallSec, timeSec: opts.timeSec || 0,
    });
    // Mark the right rings as already passed for the checklist.
    for (const r of G.world.rings) {
      r.passed = r.leg === opts.leg && r.num <= opts.ringsPassed;
    }
    for (const v of G.world.villages) {
      v.done = v.s < opts.s && v.s >= River.LEGS[opts.leg].from;
    }
    if (opts.radio) Radio.sayCustom(G.radio, opts.radio[0], opts.radio[1]);
    if (opts.banner) { G.banner = opts.banner; G.bannerSec = 0; }
    G.view = opts.view || 'chase';
  }

  function applyShot(name) {
    const G = Main.getG();
    const f = G.f, m = G.m;
    if (name === 'cover') {
      // Mid-sortie, leg 2: rings 9/10, cargo 2/3, monsoon 4:47, combo x8.
      m.legs[0].status = 'DONE'; m.legs[0].score = 8450;
      m.legs[1].status = 'FLYING';
      stageFlight(G, {
        leg: 1, s: 12800, lat: -12, altFt: 310, spdKt: 132, thr: 0.78,
        pitchDeg: 2, rollDeg: -14, fuelKg: 62, dmgPct: 4, score: 18450, combo: 8,
        ringsPassed: 9, ringsTotal: 10, cargoDone: 2, cargoTotal: 3,
        landfallSec: 287, timeSec: 212,
        radio: ['Sinta — Kapuas Control', 'Clean flying, Kite. The river bends with you today.'],
        banner: ['THE MONSOON WALL', 'LANDFALL 4:47 · WALL 2.6 NM BEHIND'],
      });
    } else if (name === 'cockpit') {
      // Final approach, leg 3: on glideslope to the sea lane, fuel low.
      m.legs[0].status = 'DONE'; m.legs[0].score = 8450;
      m.legs[1].status = 'DONE'; m.legs[1].score = 12300;
      m.legs[2].status = 'FLYING';
      stageFlight(G, {
        leg: 2, s: 24800, lat: 6, altFt: 180, spdKt: 68, thr: 0.42,
        pitchDeg: -3, rollDeg: 4, fuelKg: 41, dmgPct: 9, score: 26800, combo: 0,
        ringsPassed: 5, ringsTotal: 6, cargoDone: 1, cargoTotal: 1,
        landfallSec: 96, timeSec: 402, view: 'cockpit',
        radio: ['Sinta — Kapuas Control', 'Kite Four, sea lane clear. Bring her home, Rani.'],
      });
    } else if (name === 'turnaround') {
      // Between legs at Sintang: sortie board + refit pick-1-of-3.
      m.legs[0].status = 'DONE'; m.legs[0].score = 8450;
      m.legs[0].rings = '8/8'; m.legs[0].cargo = '1/1';
      m.legs[1].status = 'FLYING';
      f.state = 'TURNAROUND';
      f.leg = 1;
      f.score = 8450;
      f.fuelKg = 38; f.dmgPct = 12; f.landfallSec = 320;
      m._pickedRefit = 'fuel';
      G.view = 'chase';
    } else if (name === 'debrief') {
      // End of the run: per-leg table + flight-recorder chart.
      f.state = 'DEBRIEF';
      f.score = 3120;
      f.bestCombo = 8;
      m.legs[0].status = 'DONE'; m.legs[0].score = 8450; m.legs[0].rings = '8/8'; m.legs[0].cargo = '1/1';
      m.legs[1].status = 'DONE'; m.legs[1].score = 12300; m.legs[1].rings = '9/10'; m.legs[1].cargo = '2/2';
      m.legs[2].status = 'DONE'; m.legs[2].score = 10450; m.legs[2].rings = '6/6'; m.legs[2].cargo = '1/1';
      m.refitNames = ['TOP UP FUEL', 'PATCH AIRFRAME'];
      // A believable recorder trace: smooth climb, cruise and descent.
      const trace = [];
      for (let t = 0; t <= 420; t += 2) {
        trace.push({
          t,
          altFt: Math.round(260 + 150 * Math.sin(t / 47) + 60 * Math.sin(t / 19)),
          spdKt: Math.round(105 + 35 * Math.sin(t / 29 + 1)),
        });
      }
      m.debrief = {
        totalScore: 31200, bestCombo: 8, refits: m.refitNames, trace,
        legs: m.legs.map((l) => ({ name: l.name, score: l.score, rings: l.rings, cargo: l.cargo, status: l.status })),
        verdict: 'RIVER ACE — the Kapuas remembers this run.',
      };
      G.view = 'chase';
    }
  }

  return { applyShot };
})();
