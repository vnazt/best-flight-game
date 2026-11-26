// Kapuas River world: the river IS the route. A bush plane flies the Kapuas
// from Putussibau to the sea, following its bends; villages, rings and water
// strips all sit on the river itself. All world data is deterministic.

const River = (() => {
  const PATH_LEN = 26000; // metres, Putussibau -> sea lane
  const SEG = 20; // segment length in metres

  // River centreline: sum of sines, so every bend is a route decision.
  function riverXAt(s) {
    return 200 * Math.sin(s / 1100) + 130 * Math.sin(s / 470 + 1.3) + 55 * Math.sin(s / 210 + 0.4);
  }
  function riverHalfAt(s) { return 14 + 4 * Math.sin(s / 600 + 2); }

  // Deterministic pseudo-random for trees, clouds and speckles.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Three legs, hulu -> hilir, each with its own cargo and strip.
  const LEGS = [
    { index: 0, name: 'PUTUSSIBAU', toName: 'SINTANG', from: 0, to: 9000,
      cargo: 'MAIL + MEDICINE', villages: ['NANGA ERA'] },
    { index: 1, name: 'SINTANG', toName: 'PONTIANAK', from: 9000, to: 18000,
      cargo: 'MEDICINE + SPARE PARTS', villages: ['SANGGAU', 'TAYAN'] },
    { index: 2, name: 'PONTIANAK', toName: 'SEA LANE', from: 18000, to: 26000,
      cargo: 'LAST MAIL RUN', villages: ['KUBU RAYA'] },
  ];

  // Villages sit on the river bank; each is a cargo drop.
  const VILLAGES = [
    { s: 3200, name: 'NANGA ERA', lat: -30, cargo: 'MAIL', contact: 'Pak Dedi',
      line: 'Mail\'s here, Kite. Drop it low and slow.' },
    { s: 12500, name: 'SANGGAU', lat: 34, cargo: 'MEDICINE', contact: 'Ibu Lestari',
      line: 'The clinic is waiting on those cold boxes.' },
    { s: 15200, name: 'TAYAN', lat: -28, cargo: 'SPARE PARTS', contact: 'Bang Jonas',
      line: 'Pump parts, Kite. The longhouse generator died.' },
    { s: 21400, name: 'KUBU RAYA', lat: 30, cargo: 'MAIL', contact: 'Ibu Mira',
      line: 'Last bag of the day. Bring her home safe.' },
  ];

  // Water strips: the river widens into a marked lane.
  const STRIPS = [
    { s: 0, name: 'PUTUSSIBAU', runway: 'RIVER 09' },
    { s: 9000, name: 'SINTANG', runway: 'RIVER 18' },
    { s: 18000, name: 'PONTIANAK', runway: 'RIVER 27' },
    { s: 26000, name: 'SEA LANE', runway: 'SEA 36' },
  ];

  // Rings: one per ~750 m inside each leg, at a flown altitude.
  function buildRings() {
    const rings = [];
    LEGS.forEach((leg) => {
      const n = leg.index === 2 ? 6 : 8;
      for (let i = 0; i < n; i++) {
        const s = leg.from + 900 + i * ((leg.to - leg.from - 1600) / (n - 1));
        rings.push({
          s: Math.round(s), leg: leg.index, num: i + 1,
          lat: Math.round(34 * Math.sin(i * 1.7 + leg.index * 2.1)),
          altFt: Math.round(240 + 90 * Math.sin(i * 0.9 + leg.index)),
          radiusM: 16, passed: false,
        });
      }
    });
    return rings;
  }

  // The monsoon wall: a dark front that marches upriver as the clock runs.
  // wallNm = distance of the wall behind the plane, in nautical miles.
  function monsoonWallNm(landfallSeconds) {
    return Math.max(0, landfallSeconds / 60 * 0.55);
  }

  // Rainforest canopy speckles for one segment, deterministic by segment id.
  function treesForSegment(segId) {
    const rnd = mulberry32(segId * 7919 + 13);
    const trees = [];
    const n = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const side = rnd() < 0.5 ? -1 : 1;
      trees.push({
        off: side * (26 + rnd() * 130),
        size: 3 + rnd() * 7,
        shade: rnd(),
      });
    }
    return trees;
  }

  return {
    PATH_LEN, SEG, LEGS, VILLAGES, STRIPS,
    riverXAt, riverHalfAt, mulberry32, buildRings, monsoonWallNm, treesForSegment,
  };
})();
