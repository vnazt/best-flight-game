// missions.js — sorties, cargo, checklist, radio, scoring.
// The river is the route: each sortie serves 2–3 villages in one run,
// so one flight batches several deliveries instead of one.
'use strict';

// Three aircraft for the hangar screen.
const AIRCRAFT = [
  {
    id: 'OTTER-9', name: 'OTTER-9', kind: 'River Floatplane',
    maxKt: 132, stol: 54, desc: 'Single radial on floats. Slow, honest, lands anywhere.',
    sel: true
  },
  {
    id: 'HORNBILL-2', name: 'HORNBILL-2', kind: 'Twin-Engine Bush Plane',
    maxKt: 168, stol: 71, desc: 'Two turboprops. Carries the clinic fridge.',
    sel: false
  },
  {
    id: 'MERAK-7', name: 'MERAK-7', kind: 'Seaplane Clinic',
    maxKt: 121, stol: 48, desc: 'Flying clinic. Vaccines and a stretcher.',
    sel: false
  }
];

// Three named sorties. Sortie 1 is the cover sortie.
const SORTIES = [
  {
    n: 1, name: 'Putussibau Run', brief: 'Fly the river · 3 villages, 6 gates',
    legs: ['PUTUSSIBAU', 'NANGA ERA', 'TAYAN'], cargo: ['MAIL', 'MEDICINE', 'SPARE PARTS'],
    gates: 6, sel: true
  },
  {
    n: 2, name: 'Tayan Medicine Run', brief: 'Cold-boxes to Tayan · one stop',
    legs: ['TAYAN', 'SINTANG'], cargo: ['MEDICINE', 'MAIL'],
    gates: 4, sel: false
  },
  {
    n: 3, name: 'Pontianak Storm Approach', brief: 'Night storm · runway 27 approach',
    legs: ['SINTANG', 'PONTIANAK'], cargo: ['SPARE PARTS', 'MAIL'],
    gates: 5, sel: false
  }
];

// Sky lighting modes (hangar pills).
const SKY_MODES = ['CRISP DAY', 'GOLDEN SUNSET', 'STORM DUSK'];
const SKY_KEYS = { 'CRISP DAY': 'day', 'GOLDEN SUNSET': 'sunset', 'STORM DUSK': 'dusk' };

// Named humans on the radio — the tower is a person, not a beep.
const RADIO = [
  { from: 'KAPUAS TOWER · Capt. Vela', text: 'Otter-Nine, storm front 2.6 NM and closing. Make your drops count.' },
  { from: 'NANGA ERA · Nurse Sari', text: 'Medicine cold-box is ready on the dock. Come in low over the longhouse.' },
  { from: 'TAYAN · Pak Dedi', text: 'Spare parts for the generator — my village is dark tonight without them.' },
  { from: 'SINTANG · Lena', text: 'Mail sack on the float dock. Mind the crosswind at the bend.' }
];

// Mission state for one sortie. Scoring: ring +175, cargo drop +400,
// water landing +500, perfect ring (centred) +250, combo multiplier on streaks.
function newMission(sortie) {
  return {
    sortie,
    gatesPassed: 0, gatesTotal: sortie.gates,
    dropsDone: 0, dropsTotal: sortie.legs.length,
    score: 0, combo: 1, comboBest: 1,
    fuelKg: 100, hull: 100, throttle: 66,
    speedKt: 0, altFt: 0, hdg: 46, vsFpm: 0,
    landfallSec: 287, // 4:47 on the clock
    checklist: [
      { label: 'Take off', done: true },
      { label: 'Thread the rings', done: false, prog: '2/6' },
      { label: 'Drop Nanga Era', done: false },
      { label: 'Land Pontianak', done: false }
    ],
    radio: RADIO[0],
    toast: 'POSITIVE CLIMB — Follow the amber marker on the compass.'
  };
}

function fmtClock(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}
function fmtScore(n) { return String(Math.round(n)).padStart(5, '0'); }
