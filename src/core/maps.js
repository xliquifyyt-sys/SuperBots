// Map definitions. Units are bot widths; y grows downward; (0,0) is the top-left.
// terrain: solid rectangles. slopes: right triangles { x, y, w, h, dir } where the
// surface rises toward +x when dir = 1 and toward -x when dir = -1; (x, y) is the
// top-left of the bounding box. Slopes become stair-step rects for collision.
// Each map is built around ONE structural idea so it plays differently.

const R = (x, y, w, h) => ({ x, y, w, h });
const S = (x, y, w, h, dir) => ({ x, y, w, h, dir });

export const THEMES = {
  lava: {
    id: 'lava', name: 'Lava', sky: ['#3a1410', '#120605'], floor: 'lava', floorColor: '#ff5a1f', floorDeep: '#8a1d05', floorGlow: '#ffd08a',
    rock: '#4a3532', rockLite: '#7a5a50', rockTop: '#8f6a5a', accent: '#ff8a2f', light: '#ffb347', particle: '#ff9a4a', ui: '#ff7a2f',
  },
  ice: {
    id: 'ice', name: 'Ice', sky: ['#0d4a74', '#9fe8f8'], floor: 'water', floorColor: '#39b6e8', floorDeep: '#1560a0', floorGlow: '#d6f6ff',
    rock: '#5f8fb8', rockLite: '#c9ecff', rockTop: '#f2fbff', accent: '#9fe8ff', light: '#ffffff', particle: '#ffffff', ui: '#5ff2ff',
  },
  jungle: {
    id: 'jungle', name: 'Jungle', sky: ['#3fb7a8', '#1b6f5f'], floor: 'water', floorColor: '#2fb4b0', floorDeep: '#12605e', floorGlow: '#c8fff5',
    rock: '#5a5f52', rockLite: '#8f9678', rockTop: '#7ed957', accent: '#a8e05a', light: '#fff2a8', particle: '#c8ff7a', ui: '#7ed957',
  },
  sky: {
    id: 'sky', name: 'Sky', sky: ['#5fb6ff', '#dff2ff'], floor: 'void', floorColor: '#eaf6ff', floorDeep: '#ffffff', floorGlow: '#ffffff',
    rock: '#e0c88f', rockLite: '#fff0c4', rockTop: '#ffffff', accent: '#ffcf4a', light: '#ffffff', particle: '#ffffff', ui: '#ffcf4a',
  },
  neo: {
    id: 'neo', name: 'Neo City', sky: ['#1a1550', '#0a0a24'], floor: 'neon', floorColor: '#2a1c6e', floorDeep: '#0a0a24', floorGlow: '#ff3fd8',
    rock: '#2a2f3d', rockLite: '#4a5166', rockTop: '#d9e64a', accent: '#ff3fd8', light: '#3fe9ff', particle: '#3fe9ff', ui: '#ff3fd8',
  },
};

export const MAPS = {
  // ===================== LAVA =====================
  // Idea: a volcano in the middle. Continuous ground, but the lava rises every few turns
  // and eventually floods the low ground, so the fight climbs the mountain.
  emberpit: {
    id: 'emberpit', name: 'Ember Pit', theme: 'lava', size: 'standard', width: 30, height: 17,
    minPlayers: 2, maxPlayers: 4, recommended: 2,
    terrain: [
      R(0, 13, 14.1, 4), R(15.9, 13, 14.1, 4),          // ground, split by the crater shaft (14.1..15.9)
      R(12, 9, 2.1, 4), R(15.9, 9, 2.1, 4),             // volcano summit, split by the same shaft
      R(13.5, 3.5, 3, 0.8),                             // rim perch above the crater (cover)
      R(8.5, 6, 3, 0.7), R(18.5, 6, 3, 0.7),            // floating steps: summit -> perch, one each side
      R(0, 9, 3.6, 0.8), R(26.4, 9, 3.6, 0.8),          // side ledges, anchored to the walls
    ],
    slopes: [S(6, 9, 6, 4, 1), S(18, 9, 6, 4, -1)],     // mountain flanks: 4 up over 6 across
    spawns: [[1.5, 12.5], [4.5, 12.5], [9, 12.5], [13, 8.5], [17, 8.5], [21, 12.5], [25.5, 12.5], [28.5, 12.5]],
    powerups: [[15, 3], [1.8, 8.5], [28.2, 8.5], [10, 12.5], [20, 12.5], [13, 8.5]],
    killFloor: { type: 'lava', y: 15.4 },
    teleporters: false,
    hazards: [{ type: 'risingLava', every: 4, amount: 0.8, label: 'The lava rises!' }, { type: 'geyser', every: 4, points: [[9, 12.5], [21, 12.5], [4, 12.5], [26, 12.5]], count: 1, dmg: 20, radius: 1.3, label: 'Geyser' }, { type: 'lavaPatch', every: 3, dmg: 20, turns: 2, w: 3, label: 'Burning ground' }],
    blurb: 'A volcano with an open crater straight through to the lava. The lava rises every 4 turns and floods the lowlands, so the fight climbs the mountain and the summit gets narrow.',
  },
  // Idea: a stepped foundry. Long flat floor, a chain of ascending furnace tiers on the
  // right with hanging chimneys, one narrow lava channel on the left to punish careless jumps.
  magmaworks: {
    id: 'magmaworks', name: 'Magma Works', theme: 'lava', size: 'battle', width: 46, height: 21,
    minPlayers: 2, maxPlayers: 8, recommended: 6,
    terrain: [
      R(0, 15, 9, 6), R(12, 15, 34, 6),                 // floor with one lava channel (9..12)
      R(9, 13, 3, 0.8),                                 // grate over the channel (cover for the channel)
      R(24, 12.6, 8, 2.4), R(32, 10.2, 8, 4.8),         // furnace tiers, 20% shorter, still floor-seated
      R(14, 10, 5, 0.9),                                // catwalk on the low side
      R(20, 6.5, 6, 0.9),                               // crane arm (cover over the first tier)
    ],
    slopes: [S(20, 12.6, 4, 2.4, 1)],                   // ramp onto the first tier
    spawns: [[2, 14.5], [6, 14.5], [15, 14.5], [19, 14.5], [27, 12.1], [35, 9.7], [43, 14.5], [22, 14.5]],
    powerups: [[23, 6], [43, 14.5], [5, 14.5], [16.5, 9.5], [28, 12.1], [36, 9.7], [10.5, 12.5], [2, 14.5]],
    killFloor: { type: 'lava', y: 18.6 },
    teleporters: true,
    hazards: [{ type: 'geyser', every: 3, points: [[10.5, 15], [16, 15], [22, 15], [30, 12.6], [38, 10.2]], count: 2, dmg: 20, radius: 1.4, label: 'Geysers' }, { type: 'lavaPatch', every: 3, dmg: 20, turns: 2, w: 3, label: 'Burning ground' }],
    blurb: 'A foundry floor that steps up into furnace tiers on the right. High ground has the view; the low floor has cover. Geysers every 3 turns.',
  },

  // ===================== ICE =====================
  // Idea: a frozen slide. Continuous floor, one long ramp up to a high plateau on the left,
  // a low ceiling of hanging ice over the middle. Icicles crash onto the plateau.
  // Idea: the frozen keel (after the reference shot). A huge ship-hull ice island
  // floats over the water in the middle, four wall shelves around it. Open air
  // everywhere else: falling in the water is the main threat.
  frozenkeel: {
    id: 'frozenkeel', name: 'Frozen Keel', theme: 'ice', size: 'standard', width: 30, height: 17,
    minPlayers: 2, maxPlayers: 4, recommended: 4,
    terrain: [
      { ...R(8, 8.2, 14, 1.3), noFringe: true },        // the keel deck (main island)
      { ...R(9.5, 9.2, 11, 1.3), noCap: true, noFringe: true }, // hull taper 1
      { ...R(11.8, 10.2, 6.4, 1.2), noCap: true },      // hull taper 2 (the keel point, icicles below)
      { ...R(14.5, 6.4, 1, 1.8), noFringe: true },      // snow stump, centred on the deck
      R(0, 4.5, 6, 1.1), R(24, 4.5, 6, 1.1),            // high wall shelves
      R(0, 12, 5, 1.1), R(25, 12, 5, 1.1),              // low water-side shelves
    ],
    slopes: [],
    spawns: [[2, 11.5], [27.5, 11.5], [2.5, 4], [27, 4], [10, 7.7], [19.5, 7.7], [16, 7.7], [12, 7.7]],
    powerups: [[15, 5.9], [3, 3.9], [27, 3.9], [1.5, 11.5], [28.5, 11.5], [20.5, 7.7]],
    killFloor: { type: 'water', y: 15.5 },
    teleporters: false,
    hazards: [{ type: 'gusts', every: 4, strength: 9, label: 'Blizzard gust' }],
    blurb: 'A ship-hull ice island floating over freezing water, ringed by four wall shelves. A blizzard gust sweeps through every 4 turns.',
  },
  // Idea: a fortress. A raised central keep with ramps on both sides, two floating
  // watchtowers at the ends, teleporting edges. Gusts sweep the walls.
  glacierfort: {
    id: 'glacierfort', name: 'Glacier Fortress', theme: 'ice', size: 'battle', width: 48, height: 22,
    minPlayers: 2, maxPlayers: 8, recommended: 8,
    terrain: [
      R(0, 17, 9, 5), R(11, 17, 26, 5), R(39, 17, 9, 5), // frozen ground with two pit holes (9..11 and 37..39)
      R(18, 11, 12, 6),                                 // the keep
      R(22.2, 6.5, 3.6, 0.9),                           // keep roof (cover), 40% shorter, still centred on 24
      R(4, 9, 5, 0.9), R(39, 9, 5, 0.9),                // watchtower tops
      R(4, 7.6, 0.8, 1.4), R(43.2, 7.6, 0.8, 1.4),       // parapet posts at the outer ends of the watchtower tops (L shapes)
      R(10, 13.5, 4, 0.8), R(34, 13.5, 4, 0.8),         // wall walks
    ],
    slopes: [S(12, 11, 6, 6, 1), S(30, 11, 6, 6, -1)],  // ramps up to the keep
    spawns: [[2, 16.5], [6.5, 16.5], [13, 16.5], [21, 10.5], [27, 10.5], [35, 16.5], [41.5, 16.5], [46, 16.5]],
    powerups: [[24, 6], [6.5, 8.5], [41.5, 8.5], [12, 13], [36, 13], [24, 10.5], [3, 16.5], [45, 16.5]],
    killFloor: { type: 'water', y: 20.4 },
    teleporters: true,
    hazards: [{ type: 'gusts', every: 3, strength: 10, label: 'Blizzard gust' }],
    blurb: 'A frozen keep with ramps, watchtowers, and two pit holes in the ice. Teleporting edges and a blizzard gust every 3 turns.',
  },

  // ===================== JUNGLE =====================
  // Idea: vertical canopy. Solid ground, then three tiers of tree platforms stacked
  // upward. Fights go up, not across. Mines hang in the branches.
  canopyruins: {
    id: 'canopyruins', name: 'Canopy Ruins', theme: 'jungle', size: 'standard', width: 30, height: 18,
    minPlayers: 2, maxPlayers: 4, recommended: 3,
    terrain: [
      R(0, 14, 30, 4),                                  // jungle floor
      R(2.5, 9.5, 5, 0.9), R(22.5, 9.5, 5, 0.9),        // low branches
      R(9.5, 13.2, 2, 0.8), R(19, 13.2, 2, 0.8),        // mossy ground bumps (low cover)
      R(11.5, 4, 7, 0.9),                               // middle branch
      R(5.5, 6.5, 3.5, 0.8), R(21.5, 6.5, 3.5, 0.8),    // mid branches: low branch -> high side branch
      R(1, 3.5, 4, 0.9), R(25, 3.5, 4, 0.9),            // high side branches
    ],
    slopes: [],
    spawns: [[2, 13.5], [8.4, 13.5], [12.7, 13.5], [17.8, 13.5], [23, 13.5], [28, 13.5], [4.5, 9], [25, 9]],
    powerups: [[15, 3.5], [2.5, 3], [27.5, 3], [5, 9], [25, 9], [9, 13.5], [21, 13.5]],
    mines: [[9.5, 7.5], [20.5, 7.5], [15, 11.8], [7, 3], [23, 3]],
    killFloor: { type: 'water', y: 16.2 },
    teleporters: false,
    hazards: [{ type: 'mines', respawn: 4, dmg: 20, radius: 1.2, random: true, label: 'Spike mines' }],
    blurb: 'Solid jungle floor under three tiers of branches. Climb for the high ground and watch the spike mines hanging in the canopy.',
  },
  // Idea: the temple. A big stepped pyramid fills the middle; flat ground either side.
  // King of the hill on the top step, where the log drops.
  templecrossing: {
    id: 'templecrossing', name: 'Temple Crossing', theme: 'jungle', size: 'battle', width: 46, height: 21,
    minPlayers: 2, maxPlayers: 8, recommended: 6,
    terrain: [
      R(0, 16, 9.5, 5), R(13, 16, 22.5, 5), R(39, 16, 7, 5), // ground split by two wide pit passages (9.5..13 and 35.5..39)
      R(13, 13, 20, 0.8), R(16, 10, 14, 3), R(19, 7, 8, 3), // pyramid steps; the base is a lintel over a through tunnel (13..33)
      R(21, 3.5, 4, 0.8),                               // altar canopy (cover on the summit)
      R(3, 11, 5, 0.9), R(38, 11, 5, 0.9),              // side tree platforms
      R(6, 6.5, 4, 0.8), R(9.2, 5.1, 0.8, 1.4),         // L-shaped floating platform above the left ledge, post at its right end
      R(36, 6.5, 4, 0.8), R(36, 5.1, 0.8, 1.4),         // mirrored L above the right ledge, post at its left end
    ],
    slopes: [],
    spawns: [[2, 15.5], [7.2, 15.5], [15, 12.5], [31, 12.5], [34.5, 15.5], [39.3, 15.5], [43, 15.5], [45.5, 15.5]],
    powerups: [[23, 3], [23, 6.5], [5.5, 10.5], [40.5, 10.5], [14, 12.5], [32, 12.5], [2, 15.5], [44, 15.5]],
    mines: [[6, 15.5], [30, 12.5], [23, 5.3]],
    killFloor: { type: 'water', y: 18.6 },
    teleporters: true,
    hazards: [{ type: 'mines', respawn: 4, dmg: 20, radius: 1.2, random: true, label: 'Spike mines' }, { type: 'crusher', x: 19, w: 8, top: 1, bottom: 7, every: 5, dmg: 35, label: 'Log drop' }],
    blurb: 'A stepped temple pyramid flanked by two pit holes. The summit is king of the hill, and a log drops on it every 5 turns.',
  },

  // ===================== SKY =====================
  // Idea: the staircase. Islands rise from left to right like steps. Low side is safe
  // from nothing; high side sees everything. Wind decides who gets to climb.
  cloudsteps: {
    id: 'cloudsteps', name: 'Cloud Steps', theme: 'sky', size: 'standard', width: 30, height: 17,
    minPlayers: 2, maxPlayers: 4, recommended: 3,
    terrain: [
      R(0, 13, 6, 1.6), R(8, 10.6, 5, 1.6), R(15, 8.2, 5, 1.6), R(22, 5.8, 5, 1.6), R(28, 3.8, 2, 1.4),  // step islands with gaps between them
      R(1.5, 8, 3, 0.8), R(16, 3.6, 3, 0.8),            // shelters above the steps
      R(9.5, 15.4, 4, 1.2),                             // catch platform under the low steps
    ],
    slopes: [],
    pads: [{ x: 21, y: 13, to: [17.5, 3.1], label: 'Updraft vent' }],   // floats in the middle gap -> top-centre shelter
    spawns: [[1.5, 12.5], [4.5, 12.5], [9.5, 10.1], [12, 10.1], [16.5, 7.7], [19, 7.7], [23.5, 5.3], [29, 3.3]],
    powerups: [[3, 7.5], [17.5, 3.1], [11.5, 14.9], [24.5, 5.3], [29, 3.3], [0.8, 12.5]],
    killFloor: { type: 'void', y: 18 },
    teleporters: false,
    hazards: [{ type: 'wind', max: 7, label: 'Wind' }],
    blurb: 'Islands rising like a staircase. The wind changes every turn and decides who can climb.',
  },
  // Idea: the ring. A wide floating ring of islands around an empty centre with a single
  // high pillar island in the middle. Teleporting edges close the loop. Gusts push into the void.
  nimbus: {
    id: 'nimbus', name: 'Nimbus Reach', theme: 'sky', size: 'battle', width: 50, height: 22,
    minPlayers: 2, maxPlayers: 8, recommended: 8,
    terrain: [
      R(0, 15, 14, 1.8), R(36, 15, 14, 1.8),            // outer islands (linked by teleporting edges)
      R(10, 19, 30, 1.6),                               // long bottom island
      R(22, 8, 6, 1.4),                                 // centre pillar island
      R(6, 10, 5, 1), R(39, 10, 5, 1),                  // upper side islands
      R(13, 5.5, 5, 0.9), R(32, 5.5, 5, 0.9),           // high perches (cover for the side islands)
      R(20, 13.5, 3, 0.8), R(27, 13.5, 3, 0.8),         // step stones to the centre
    ],
    slopes: [],
    pads: [{ x: 5, y: 20, to: [25, 7.5], label: 'Rescue vent' },          // under the left shelf: fall past it and get thrown up to the tower cap
           { x: 44, y: 20, to: [25, 7.5], label: 'Rescue vent' }],        // under the right shelf, same
    spawns: [[2, 14.5], [7, 14.5], [12, 14.5], [16, 18.5], [34, 18.5], [38, 14.5], [43, 14.5], [48, 14.5]],
    powerups: [[25, 7.5], [8.5, 9.5], [41.5, 9.5], [15.5, 5], [34.5, 5], [25, 18.5], [21.5, 13], [28.5, 13]],
    killFloor: { type: 'void', y: 23 },
    teleporters: true,
    hazards: [{ type: 'gusts', every: 3, strength: 11, label: 'Gust' }],
    blurb: 'A ring of islands around an empty centre with one high pillar island in the middle. Teleporting edges close the loop; gusts every 3 turns.',
  },

  // ===================== NEO CITY =====================
  // Idea: the ramp (after the reference map). Continuous street, a long ramp climbing to
  // a raised plateau with a cliff notch, three thin catwalks at different heights.
  neonalley: {
    id: 'neonalley', name: 'Neon Alley', theme: 'neo', size: 'standard', width: 30, height: 17,
    minPlayers: 2, maxPlayers: 4, recommended: 2,
    terrain: [
      R(0, 14, 30, 3),                                  // street
      R(12, 9, 8, 5),                                   // plateau
      R(21.5, 11.5, 8.5, 2.5),                          // lower shelf past the cliff notch
      R(2, 5, 9, 0.7),                                  // upper-left catwalk
      R(0, 9.5, 4, 0.7),                                // mid-left catwalk
      R(23, 7.5, 5, 0.7),                               // right catwalk (cover for the shelf)
      R(24.5, 4.2, 3.5, 0.7), R(26, 4.9, 0.8, 2.6),     // L-shaped neon sign beam over the catwalk
    ],
    slopes: [S(4, 9, 8, 5, 1)],                         // the ramp
    spawns: [[1.5, 13.5], [3, 9], [6, 4.5], [14, 8.5], [18, 8.5], [23, 11], [27, 11], [29, 11]],
    powerups: [[6, 4.5], [1.5, 9], [25.5, 7], [16, 8.5], [21, 13.5], [28, 11], [9, 13.5]],
    killFloor: { type: 'neon', y: 16.2 },
    teleporters: false,
    hazards: [{ type: 'reactor', x: 20.5, y: 12, r: 2.2, every: 4, dmg: 15, label: 'EMP pulse' }],
    blurb: 'A neon street with a long ramp up to a plateau and three catwalks. The EMP node in the cliff notch pulses every 4 turns.',
  },
  // Idea: rooftops. Three buildings of different heights with two vertical drops between
  // them, a billboard deck bridging the tallest gap. Teleporting edges wrap the block.
  skylinegrid: {
    id: 'skylinegrid', name: 'Skyline Grid', theme: 'neo', size: 'battle', width: 46, height: 20,
    minPlayers: 2, maxPlayers: 8, recommended: 6,
    terrain: [
      R(0, 12, 14, 8),                                  // tall building (left)
      R(17, 16, 12, 4),                                 // low building (middle)
      R(32, 10.5, 14, 9.5),                             // tallest building (right), lowered 1.5
      // the two alleys between buildings are open pit holes down to the rail
      R(19, 12, 8, 0.8),                                // billboard deck over the low roof (cover)
      R(3, 7.5, 5, 0.8), R(36, 6, 5, 0.8),              // rooftop signs (right one lowered with its tower)
      R(10, 10.6, 0.8, 1.4), R(41, 9.1, 0.8, 1.4),      // small rooftop vents (standing cover)
    ],
    slopes: [],
    spawns: [[2, 11.5], [7, 11.5], [12, 11.5], [19, 15.5], [27, 15.5], [34, 10], [39, 10], [44, 10]],
    powerups: [[5.5, 7], [38.5, 5.5], [23, 11.5], [23, 15.5], [1, 11.5], [45, 10], [10, 11.5], [42, 10]],
    killFloor: { type: 'neon', y: 20 },
    teleporters: true,
    hazards: [{ type: 'reactor', x: 23, y: 14, r: 3, every: 4, dmg: 15, label: 'EMP pulse' }],
    blurb: 'Three rooftops at three heights with open pit alleys between them. Teleporting edges wrap the block; the billboard tower pulses every 4 turns.',
  },
};

// Turn slopes into stair-step collision rects: one thin column per 0.5 units,
// each only as tall as the ramp surface at that column, so the ramp collides
// like a ramp instead of a solid block.
for (const m of Object.values(MAPS)) {
  m.slopes = m.slopes || [];
  for (const s of m.slopes) {
    const cols = Math.max(2, Math.round(s.w / 0.5));
    for (let j = 0; j < cols; j++) {
      const frac = s.dir === 1 ? (j + 1) / cols : (cols - j) / cols;  // surface height fraction in this column
      const hh = s.h * frac;
      m.terrain.push({ x: s.x + (j * s.w) / cols, y: s.y + s.h - hh, w: s.w / cols + 0.02, h: hh, step: true });
    }
  }
}

export const MAP_IDS = Object.keys(MAPS);
export const THEME_IDS = Object.keys(THEMES);

export function pickSpawns(map, n) {
  const s = map.spawns;
  if (n >= s.length) return s.slice(0, n);
  if (n === 1) return [s[0]];
  const out = [];
  for (let i = 0; i < n; i++) out.push(s[Math.round((i * (s.length - 1)) / (n - 1))]);
  return out;
}

export function mapsForPlayers(n) {
  return MAP_IDS.filter((id) => MAPS[id].maxPlayers >= n);
}
