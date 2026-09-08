// Map definitions. Units are bot widths; y grows downward; (0,0) is the top-left.
// Each terrain entry is a solid rectangle. Spawns are listed left to right.
// Five theme kits, two maps each: one Standard (2-4 players) and one Battle (4-8).

const R = (x, y, w, h) => ({ x, y, w, h });

export const THEMES = {
  lava: {
    id: 'lava', name: 'Lava', sky: ['#3a1410', '#120605'], floor: 'lava', floorColor: '#ff5a1f', floorDeep: '#8a1d05', floorGlow: '#ffd08a',
    rock: '#4a3532', rockLite: '#7a5a50', rockTop: '#8f6a5a', accent: '#ff8a2f', light: '#ffb347', particle: '#ff9a4a', ui: '#ff7a2f',
  },
  ice: {
    id: 'ice', name: 'Ice', sky: ['#7fd3f7', '#2a7fb8'], floor: 'water', floorColor: '#39b6e8', floorDeep: '#1560a0', floorGlow: '#d6f6ff',
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
  emberpit: {
    id: 'emberpit', name: 'Ember Pit', theme: 'lava', size: 'standard', width: 30, height: 17,
    minPlayers: 2, maxPlayers: 4, recommended: 2,
    terrain: [
      R(0, 13, 9, 4), R(21, 13, 9, 4),                 // shore slabs
      R(11.5, 13.8, 7, 3.2),                            // centre island (lower)
      R(2.5, 8.5, 5, 1), R(22.5, 8.5, 5, 1),            // side ledges
      R(12, 8, 6, 1),                                   // centre ledge (cover for the island)
      R(7.5, 4, 1, 6), R(21.5, 4, 1, 6),                // hanging basalt columns (pass beneath)
      R(13.5, 3.5, 3, 0.8),                             // top perch
    ],
    spawns: [[1.5, 12.5], [4.5, 12.5], [7, 12.5], [13, 13.3], [17, 13.3], [23, 12.5], [25.5, 12.5], [28.5, 12.5]],
    powerups: [[15, 7.5], [5, 8], [25, 8], [15, 3], [1, 12.5], [29, 12.5], [15, 13.3]],
    killFloor: { type: 'lava', y: 15.6 },
    teleporters: false,
    hazards: [{ type: 'risingLava', every: 6, amount: 1, label: 'The lava rises!' }, { type: 'geyser', every: 4, points: [[10, 13.8], [20, 13.8], [15, 13.8]], count: 1, dmg: 20, radius: 1.3, label: 'Geyser' }],
    blurb: 'Shore slabs around a sinking island. The lava rises every 6 turns and geysers erupt at announced spots.',
  },
  magmaworks: {
    id: 'magmaworks', name: 'Magma Works', theme: 'lava', size: 'battle', width: 46, height: 21,
    minPlayers: 2, maxPlayers: 8, recommended: 6,
    terrain: [
      R(0, 15, 14, 6), R(32, 15, 14, 6),                // two foundry floors
      R(17, 16.5, 12, 1),                               // low bridge
      R(3, 10.5, 5, 1), R(38, 10.5, 5, 1),              // side ledges
      R(10, 12, 3, 0.9), R(33, 12, 3, 0.9),             // step ledges
      R(19, 11.5, 8, 1),                                // catwalk over the bridge (cover)
      R(21, 6.5, 4, 0.9),                               // crane perch
      R(6, 13, 1, 2), R(39, 13, 1, 2),                  // pipes / pillars
      R(14.5, 7, 1, 5), R(30.5, 7, 1, 5),               // hanging chimneys (pass beneath)
      R(0, 9, 1, 6), R(45, 9, 1, 6),                    // side walls
    ],
    spawns: [[2, 14.5], [6.5, 14.5], [10, 14.5], [12.5, 14.5], [33.5, 14.5], [36, 14.5], [40, 14.5], [44, 14.5]],
    powerups: [[23, 10.5], [23, 5.5], [5, 9.5], [40.5, 9.5], [23, 15.5], [11.5, 11], [34.5, 11], [1.5, 14.5], [44.5, 14.5]],
    killFloor: { type: 'lava', y: 18.6 },
    teleporters: false,
    hazards: [{ type: 'geyser', every: 3, points: [[18.5, 16.5], [23, 16.5], [27.5, 16.5], [15.5, 15], [30.5, 15]], count: 2, dmg: 20, radius: 1.4, label: 'Geysers' }],
    blurb: 'Two foundry floors joined by a bridge over the lava river. Geysers erupt every 3 turns at announced points.',
  },

  // ===================== ICE =====================
  frosthollow: {
    id: 'frosthollow', name: 'Frost Hollow', theme: 'ice', size: 'standard', width: 30, height: 17,
    minPlayers: 2, maxPlayers: 4, recommended: 2,
    terrain: [
      R(0, 13.5, 11, 3.5), R(19, 13.5, 11, 3.5),        // frozen shores
      R(12.5, 8, 5, 1.4),                               // floating ice block
      R(2, 9, 6, 0.9), R(22, 9, 6, 0.9),                // ice shelves
      R(4, 3, 0.8, 7.5), R(25.2, 3, 0.8, 7.5),          // hanging ice pillars (pass beneath)
      R(13.5, 4, 3, 0.8),                               // high perch
      R(9.5, 11.5, 1.2, 2), R(19.3, 11.5, 1.2, 2),      // shore posts
    ],
    spawns: [[1.5, 13], [5.5, 13], [8.5, 13], [13, 7.5], [17, 7.5], [21.5, 13], [24.5, 13], [28.5, 13]],
    powerups: [[15, 3.5], [5, 8.5], [25, 8.5], [15, 7.5], [1, 13], [29, 13], [10, 13]],
    killFloor: { type: 'water', y: 15.4 },
    teleporters: false,
    hazards: [{ type: 'crusher', x: 12.5, w: 5, top: 1, bottom: 8, every: 5, dmg: 40, label: 'Icicles fall' }],
    blurb: 'An ice cave with a floating block in the middle. Icicles crash down on the block every 5 turns.',
  },
  glacierfort: {
    id: 'glacierfort', name: 'Glacier Fortress', theme: 'ice', size: 'battle', width: 48, height: 22,
    minPlayers: 2, maxPlayers: 8, recommended: 8,
    terrain: [
      R(0, 17, 12, 5), R(18, 17.5, 12, 4.5), R(36, 17, 12, 5),   // three frozen floors
      R(2, 12, 6, 1), R(40, 12, 6, 1),                            // low shelves
      R(12, 13.5, 5, 1), R(31, 13.5, 5, 1),                       // gap shelves
      R(21, 12, 6, 1),                                            // centre shelf (cover)
      R(9, 8, 5, 0.9), R(34, 8, 5, 0.9),                          // mid shelves
      R(21.5, 6.5, 5, 0.9),                                       // top shelf
      R(16, 8, 0.9, 6), R(31.1, 8, 0.9, 6),                       // hanging ice columns
      R(0, 8, 1, 9), R(47, 8, 1, 9),                              // cave walls
    ],
    spawns: [[2, 16.5], [6, 16.5], [10, 16.5], [20, 17], [28, 17], [38, 16.5], [42, 16.5], [46, 16.5]],
    powerups: [[24, 6], [11.5, 7.5], [36.5, 7.5], [24, 11.5], [5, 11.5], [43, 11.5], [24, 17], [14.5, 13], [33.5, 13]],
    killFloor: { type: 'water', y: 20.4 },
    teleporters: true,
    hazards: [{ type: 'gusts', every: 3, strength: 10, label: 'Blizzard gust' }, { type: 'crusher', x: 21, w: 6, top: 1, bottom: 12, every: 6, dmg: 40, label: 'Icicles fall' }],
    blurb: 'A frozen fortress on three floors with teleporting edges. Blizzard gusts every 3 turns; icicles drop on the centre shelf.',
  },

  // ===================== JUNGLE =====================
  canopyruins: {
    id: 'canopyruins', name: 'Canopy Ruins', theme: 'jungle', size: 'standard', width: 30, height: 17,
    minPlayers: 2, maxPlayers: 4, recommended: 3,
    terrain: [
      R(0, 13, 8, 4), R(11, 13, 8, 4), R(22, 13, 8, 4),          // mossy ground with two water gaps
      R(2, 8.5, 6, 0.9), R(22, 8.5, 6, 0.9),                     // side ledges
      R(11.5, 6, 7, 0.9),                                        // centre ledge
      R(14.5, 6.9, 1, 3.5),                                      // stone stalactite under the ledge
      R(5, 3.5, 0.8, 6.5), R(24.2, 3.5, 0.8, 6.5),               // hanging vine-wrapped totems
      R(12, 9.5, 2, 0.8), R(16, 9.5, 2, 0.8),                    // step stones
    ],
    spawns: [[1.5, 12.5], [4, 12.5], [7, 12.5], [12.5, 12.5], [17.5, 12.5], [23, 12.5], [26, 12.5], [28.5, 12.5]],
    powerups: [[15, 5.5], [5, 8], [25, 8], [15, 12.5], [1, 12.5], [29, 12.5], [12.5, 9], [17.5, 9]],
    mines: [[9.5, 11], [20.5, 11], [15, 11.2]],
    killFloor: { type: 'water', y: 15.2 },
    teleporters: false,
    hazards: [{ type: 'mines', respawn: 4, dmg: 20, radius: 1.2, label: 'Spike mines' }],
    blurb: 'Overgrown temple ruins. Spike mines float over the water gaps and under the centre ledge.',
  },
  templecrossing: {
    id: 'templecrossing', name: 'Temple Crossing', theme: 'jungle', size: 'battle', width: 46, height: 21,
    minPlayers: 2, maxPlayers: 8, recommended: 6,
    terrain: [
      R(0, 15.5, 13, 5.5), R(17, 16, 12, 5), R(33, 15.5, 13, 5.5), // three ground blocks
      R(2, 10.5, 5, 0.9), R(39, 10.5, 5, 0.9),                    // side ledges
      R(9, 12.5, 4, 0.9), R(33, 12.5, 4, 0.9),                    // low steps
      R(19.5, 11, 7, 0.9),                                        // temple roof (cover)
      R(22, 6, 2, 5),                                             // temple spire
      R(14, 8, 4, 0.9), R(28, 8, 4, 0.9),                         // hanging ledges
      R(6, 13.5, 1, 2), R(39, 13.5, 1, 2),                        // totem stubs
      R(0, 9, 1, 6.5), R(45, 9, 1, 6.5),                          // walls
    ],
    spawns: [[2, 15], [6, 15], [10, 15], [12, 15], [34, 15], [36.5, 15], [40, 15], [44, 15]],
    powerups: [[23, 10.5], [16, 7.5], [30, 7.5], [4.5, 10], [41.5, 10], [23, 15.5], [11, 12], [35, 12], [1.5, 15], [44.5, 15]],
    mines: [[15, 14], [31, 14], [23, 8.5], [10.5, 9.5], [35.5, 9.5]],
    killFloor: { type: 'water', y: 18.6 },
    teleporters: false,
    hazards: [{ type: 'mines', respawn: 4, dmg: 20, radius: 1.2, label: 'Spike mines' }, { type: 'crusher', x: 17, w: 12, top: 1, bottom: 16, every: 6, dmg: 35, label: 'Log drop' }],
    blurb: 'A temple bridge between two jungle ground blocks. Spike mines guard the crossings; a log drops on the bridge every 6 turns.',
  },

  // ===================== SKY =====================
  cloudsteps: {
    id: 'cloudsteps', name: 'Cloud Steps', theme: 'sky', size: 'standard', width: 30, height: 17,
    minPlayers: 2, maxPlayers: 4, recommended: 3,
    terrain: [
      R(1, 11, 6, 1.6), R(9, 13, 5, 1.6), R(16, 13, 5, 1.6), R(23, 11, 6, 1.6),  // floating islands
      R(12.5, 8, 5, 1.1),                                                       // centre island
      R(5, 6.5, 3, 0.8), R(22, 6.5, 3, 0.8),                                    // high perches
      R(13.5, 4, 3, 0.8),                                                       // top perch (cover for centre)
      R(2, 8.5, 3, 0.8), R(25, 8.5, 3, 0.8),                                    // shelters over the side islands
    ],
    spawns: [[2, 10.5], [5.5, 10.5], [10, 12.5], [12.5, 12.5], [17, 12.5], [19.5, 12.5], [24.5, 10.5], [28, 10.5]],
    powerups: [[15, 7.5], [6.5, 6], [23.5, 6], [11.5, 12.5], [18.5, 12.5], [15, 3.5]],
    killFloor: { type: 'void', y: 18 },
    teleporters: false,
    hazards: [{ type: 'wind', max: 7, label: 'Wind' }],
    blurb: 'Floating islands above open sky. The wind changes every turn and bends every shot.',
  },
  nimbus: {
    id: 'nimbus', name: 'Nimbus Reach', theme: 'sky', size: 'battle', width: 50, height: 22,
    minPlayers: 2, maxPlayers: 8, recommended: 8,
    terrain: [
      R(4, 18, 9, 1.6), R(20, 19, 10, 1.6), R(37, 18, 9, 1.6),                  // bottom tier
      R(0, 12, 6, 1.2), R(12, 13, 7, 1.2), R(31, 13, 7, 1.2), R(44, 12, 6, 1.2), // middle tier
      R(8, 7, 5, 1), R(22.5, 6, 5, 1), R(37, 7, 5, 1),                          // top tier
      R(8, 16, 1, 2), R(41, 16, 1, 2), R(24.5, 17, 1, 2),                      // pillars
      R(6, 15, 4, 0.8), R(40, 15, 4, 0.8), R(22, 16, 6, 0.8),                  // cloud shelters
    ],
    spawns: [[1.5, 11.5], [5.5, 17.5], [11, 17.5], [14, 12.5], [35, 12.5], [39, 17.5], [44.5, 17.5], [48, 11.5]],
    powerups: [[25, 5.5], [10.5, 6.5], [39.5, 6.5], [25, 18.5], [15.5, 12.5], [34.5, 12.5], [22, 18.5], [28, 18.5]],
    killFloor: { type: 'void', y: 23 },
    teleporters: true,
    hazards: [{ type: 'gusts', every: 3, strength: 11, label: 'Gust' }],
    blurb: 'Three altitude tiers with teleporting edges. A strong gust hits every 3 turns.',
  },

  // ===================== NEO CITY =====================
  neonalley: {
    id: 'neonalley', name: 'Neon Alley', theme: 'neo', size: 'standard', width: 30, height: 17,
    minPlayers: 2, maxPlayers: 4, recommended: 2,
    terrain: [
      R(0, 13, 9, 4), R(21, 13, 9, 4),                            // street slabs
      R(12, 13.5, 6, 3.5),                                        // container block in the middle
      R(2, 8.5, 5, 0.9), R(23, 8.5, 5, 0.9),                      // catwalks
      R(11, 8, 8, 0.9),                                           // billboard walkway (cover for container)
      R(14.5, 8.9, 1, 3),                                         // support post under the walkway
      R(8, 3.5, 0.8, 6.5), R(21.2, 3.5, 0.8, 6.5),                // hanging signal masts
      R(13.5, 4, 3, 0.8),                                         // rooftop perch
    ],
    spawns: [[1.5, 12.5], [4.5, 12.5], [7, 12.5], [13, 13], [17, 13], [23, 12.5], [25.5, 12.5], [28.5, 12.5]],
    powerups: [[15, 7.5], [4.5, 8], [25.5, 8], [15, 3.5], [1, 12.5], [29, 12.5], [15, 13]],
    killFloor: { type: 'neon', y: 15.6 },
    teleporters: false,
    hazards: [{ type: 'reactor', x: 15, y: 11, r: 3.5, every: 4, dmg: 15, label: 'EMP pulse' }],
    blurb: 'A rain-slick alley between two street slabs. The EMP tower in the middle pulses every 4 turns.',
  },
  skylinegrid: {
    id: 'skylinegrid', name: 'Skyline Grid', theme: 'neo', size: 'battle', width: 46, height: 20,
    minPlayers: 2, maxPlayers: 8, recommended: 6,
    terrain: [
      R(0, 16, 10, 4), R(14, 16, 18, 4), R(36, 16, 10, 4),        // rooftops with two drops
      R(4, 11, 4, 0.9), R(38, 11, 4, 0.9),                        // side catwalks
      R(19, 8, 8, 0.9),                                           // billboard deck (cover)
      R(16.5, 14, 1, 2), R(28.5, 14, 1, 2),                       // pillars flanking the tower
      R(22, 9, 2, 7),                                             // EMP tower
      R(11, 12.5, 3, 0.9), R(32, 12.5, 3, 0.9),                   // drop-side ledges
      R(0, 13.5, 2, 2.5), R(44, 13.5, 2, 2.5),                    // corner blocks
      R(10, 13, 1, 1), R(35, 13, 1, 1),                           // drop lips
    ],
    spawns: [[3, 15.5], [7, 15.5], [15.5, 15.5], [19, 15.5], [27, 15.5], [30.5, 15.5], [39, 15.5], [43, 15.5]],
    powerups: [[23, 7.5], [6, 10.5], [40, 10.5], [23, 15.5], [12.5, 12], [33.5, 12], [1, 15.5], [45, 15.5]],
    killFloor: { type: 'neon', y: 17.6 },
    teleporters: true,
    hazards: [{ type: 'reactor', x: 23, y: 12.5, r: 4, every: 4, dmg: 15, label: 'EMP pulse' }],
    blurb: 'Neon rooftops with teleporting edges. The central EMP tower pulses every 4 turns.',
  },
};

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
