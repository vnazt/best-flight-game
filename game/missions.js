// missions.js — the Kapuas sorties, villages, rings and radio.
// CONTENT is the Kapuas identity (kept on purpose: a named Indonesian river
// route is our edge against the flood of generic fighter jets). The CODE is
// written fresh here; no line comes from the old missions file.
'use strict';

// The ring chain, in world units along the river. Drawn far -> near.
const RINGS = [
  { n: 2, z: 195, r: 3.5, cy: 6.5, label: 'G-02 · 1.2 KM', big: false, passed: false },
  { n: 6, z: 150, r: 4.0, cy: 6.5, label: 'G-06 · 910 M', big: false, passed: false },
  { n: 5, z: 90, r: 5.5, cy: 6.5, label: 'G-05 · 640 M', big: false, passed: false },
  { n: 3, z: 45, r: 7.0, cy: 6.5, label: 'GATE 03 · 380 M', big: true, passed: false },
];

// Villages along the river, each waiting on a cargo drop.
const VILLAGES = [
  { name: 'PUTUSSIBAU', z: 0, cargo: 'FUEL', side: -1, done: false },
  { name: 'NANGA ERA', z: 26, cargo: 'MEDICINE', side: -1, done: false },
  { name: 'SINTANG', z: 40, cargo: 'MAIL', side: 1, done: false },
  { name: 'PONTIANAK', z: 150, cargo: 'SPICES', side: 1, done: false },
];

const SORTIES = [
  {
    n: 1, name: 'Putussibau Run',
    brief: 'Fly the river · 3 villages, 6 gates',
    legs: ['Putussibau', 'Nanga Era', 'Sintang', 'Pontianak'],
    checklist: [
      { label: 'Take off', done: true, prog: '' },
      { label: 'Thread the rings', done: false, prog: '2/6' },
      { label: 'Drop Nanga Era', done: false, prog: '' },
      { label: 'Land Pontianak', done: false, prog: '' },
    ],
    gatesTotal: 6, landfallSec: 287, score: 18450,
    radio: '"Make your drops count."',
  },
  {
    n: 2, name: 'Sintang Mail Run',
    brief: 'Mail to Sintang · 4 villages, 5 gates',
    legs: ['Putussibau', 'Nanga Era', 'Sintang'],
    checklist: [
      { label: 'Take off', done: true, prog: '' },
      { label: 'Thread the rings', done: false, prog: '0/5' },
      { label: 'Drop Sintang mail', done: false, prog: '' },
      { label: 'Land Sintang', done: false, prog: '' },
    ],
    gatesTotal: 5, landfallSec: 240, score: 0,
    radio: '"The mail flies or the river waits."',
  },
  {
    n: 3, name: 'Pontianak Dawn',
    brief: 'Dawn patrol to Pontianak · 2 villages, 4 gates',
    legs: ['Sintang', 'Pontianak'],
    checklist: [
      { label: 'Take off', done: true, prog: '' },
      { label: 'Thread the rings', done: false, prog: '0/4' },
      { label: 'Drop Pontianak spices', done: false, prog: '' },
      { label: 'Land Pontianak', done: false, prog: '' },
    ],
    gatesTotal: 4, landfallSec: 320, score: 0,
    radio: '"Dawn over the Kapuas — fly it like you mean it."',
  },
];

function newMission(sortieIdx) {
  const s = SORTIES[sortieIdx || 0];
  return {
    sortie: s,
    gatesPassed: 2, gatesTotal: s.gatesTotal,
    score: s.score, landfallSec: s.landfallSec,
    checklist: s.checklist.map((c) => ({ label: c.label, done: c.done, prog: c.prog })),
    dropsDone: 0, dropsTotal: 3, combo: 0,
    toast: 'OTTER-9 CLEARED FOR TAKEOFF — river is yours, captain.',
  };
}

function fmtClock(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}
function fmtScore(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
