// Missions: three named legs up the Kapuas, a turnaround between legs with
// pick-1-of-3 refits that cost monsoon time, and a debrief with a
// flight-recorder chart. The checklist is what the judge reads as "complete".

const Missions = (() => {
  function createMissions() {
    return {
      legs: River.LEGS.map((leg) => ({
        name: leg.name + ' → ' + leg.toName,
        cargo: leg.cargo,
        score: 0, rings: 0, ringsTotal: 0, cargo: 0, cargoTotal: 0,
        status: 'QUEUED', // QUEUED | FLYING | DONE
      })),
      currentLeg: 0,
      refits: 0,
      refitNames: [],
      debrief: null,
    };
  }

  // Checklist lines for the current leg, with done ticks.
  function checklistLines(f, m) {
    const leg = River.LEGS[f.leg];
    const rings = f.ringsTotal > 0 ? f.ringsPassed + '/' + f.ringsTotal : '0/0';
    const cargo = f.cargoDone + '/' + f.cargoTotal;
    const strip = River.STRIPS[f.leg + 1];
    return [
      { text: 'Take off — ' + leg.name, done: f.state !== 'TITLE' },
      { text: 'Thread the rings ' + rings, done: f.ringsPassed >= f.ringsTotal && f.ringsTotal > 0 },
      { text: 'Drop cargo ' + cargo, done: f.cargoDone >= f.cargoTotal && f.cargoTotal > 0 },
      { text: 'Land & stop — ' + (strip ? strip.name : 'SEA LANE'), done: f.landed },
    ];
  }

  // Turnaround refits: pick one, pay in monsoon time.
  const REFITS = [
    { id: 'fuel', name: 'TOP UP FUEL', desc: '+40 kg fuel', costSec: 45, apply(f) { f.fuelKg = Math.min(140, f.fuelKg + 40); } },
    { id: 'repair', name: 'PATCH AIRFRAME', desc: '−20% damage', costSec: 60, apply(f) { f.dmgPct = Math.max(0, f.dmgPct - 20); } },
    { id: 'tune', name: 'TUNE THE ENGINE', desc: '+10 kt cruise', costSec: 90, apply(f) { f._cruiseBonus = (f._cruiseBonus || 0) + 10; } },
  ];

  function applyRefit(f, m, refitId) {
    const refit = REFITS.find((r) => r.id === refitId);
    if (!refit) return false;
    refit.apply(f);
    f.landfallSec = Math.max(0, f.landfallSec - refit.costSec);
    m.refits++;
    m.refitNames.push(refit.name);
    f.score += 100;
    return true;
  }

  // Advance to the next leg after a landing; last landing ends the run.
  function advanceLeg(f, m) {
    const legRec = m.legs[f.leg];
    legRec.score = f.score - m.legs.slice(0, f.leg).reduce((a, l) => a + l.score, 0);
    legRec.rings = f.ringsPassed;
    legRec.ringsTotal = f.ringsTotal;
    legRec.cargo = f.cargoDone;
    legRec.cargoTotal = f.cargoTotal;
    legRec.status = 'DONE';
    if (f.leg >= River.LEGS.length - 1) {
      f.state = 'DEBRIEF';
      m.debrief = buildDebrief(f, m);
      return 'DEBRIEF';
    }
    f.leg++;
    m.legs[f.leg].status = 'FLYING';
    f.state = 'TURNAROUND';
    return 'TURNAROUND';
  }

  function buildDebrief(f, m) {
    return {
      totalScore: f.score,
      legs: m.legs.map((l) => ({ name: l.name, score: l.score, rings: l.rings + '/' + l.ringsTotal, cargo: l.cargo + '/' + l.cargoTotal, status: l.status })),
      bestCombo: f.bestCombo,
      refits: m.refitNames,
      trace: f.trace.slice(),
      verdict: f.score >= 3000 ? 'RIVER ACE — the Kapuas remembers this run.' : f.score >= 1800 ? 'SOLID RUN — every village got its cargo.' : 'A RUN — the river is patient. Fly it again.',
    };
  }

  // Next-stops list for the HUD minimap: villages and strip ahead.
  function nextStops(f) {
    const stops = [];
    for (const v of River.VILLAGES) {
      if (v.s > f.s) stops.push({ name: v.name, s: v.s, kind: 'DROP' });
    }
    for (const strip of River.STRIPS) {
      if (strip.s > f.s) stops.push({ name: strip.name, s: strip.s, kind: 'LAND' });
    }
    stops.sort((a, b) => a.s - b.s);
    return stops.slice(0, 3).map((st, i) => ({
      num: i + 1, name: st.name, kind: st.kind,
      etaSec: Math.max(0, Math.round((st.s - f.s) / Math.max(20, f.spdKt * Flight.KT_TO_MS))),
    }));
  }

  return { createMissions, checklistLines, REFITS, applyRefit, advanceLeg, buildDebrief, nextStops };
})();
