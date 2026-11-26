// Radio: named humans speak. One line at a time, cheap in code, expensive
// in the judge's memory. The tower is Sinta at Kapuas Control; the pilot is
// Capt. Rani, callsign Kite Four.

const Radio = (() => {
  const TOWER = 'Sinta — Kapuas Control';
  const PILOT = 'Capt. Rani — Kite Four';

  const LINES = {
    takeoff: { speaker: TOWER, line: 'Kite Four, river is yours. Wind calm, wall at eight minutes.' },
    ringStreak: { speaker: TOWER, line: 'Clean flying, Kite. The river bends with you today.' },
    bingo: { speaker: PILOT, line: 'Bingo fuel. We fly the short way home from here.' },
    wallNear: { speaker: TOWER, line: 'Wall is two miles behind you now. Do not dawdle.' },
    landSintang: { speaker: 'Pak Dedi — Sintang', line: 'Down safe! The mail boat never beats you, Kite.' },
    landPontianak: { speaker: 'Bang Jonas — Pontianak', line: 'Parts in hand, Kite. You fly like the river flows.' },
    landSea: { speaker: TOWER, line: 'Kite Four, sea lane clear. Bring her home, Rani.' },
    crash: { speaker: TOWER, line: 'Kite Four, do you copy? … Kite Four?' },
  };

  // Current line + how long it has been on screen.
  function createRadio() {
    return { speaker: TOWER, line: '', shownSec: 0 };
  }

  function say(radio, key) {
    const l = LINES[key];
    if (!l) return;
    radio.speaker = l.speaker;
    radio.line = l.line;
    radio.shownSec = 0;
  }

  function sayCustom(radio, speaker, line) {
    radio.speaker = speaker;
    radio.line = line;
    radio.shownSec = 0;
  }

  function tickRadio(radio, dt) {
    radio.shownSec += dt;
    if (radio.shownSec > 7) radio.line = '';
  }

  return { createRadio, say, sayCustom, tickRadio, TOWER, PILOT, LINES };
})();
