// Map definitions. Units are bot widths; y grows downward; (0,0) is the top-left.
// Each terrain entry is a solid rectangle. Spawns are listed left to right.

const R = (x, y, w, h) => ({ x, y, w, h });

export const THEMES = {
  industrial: {
    name: 'Industrial', sky: ['#1b2230', '#0d1119'], far: '#222b3a', mid: '#2c3648', ground: '#5b6577', groundEdge: '#8f9bb0',
    accent: '#ff9d2f', light: '#5ff2ff', floor: 'acid', floorColor: '#5fd32a', floorGlow: '#c8ff7a', particle: '#5ff2ff',
  },
  lava: {
    name: 'Lava', sky: ['#2a0d0d', '#0d0505'], far: '#3a1a14', mid: '#4d2418', ground: '#4a3b3a', groundEdge: '#8a6e63',
    accent: '#ff6a1f', light: '#ffb347', floor: 'lava', floorColor: '#e8471a', floorGlow: '#ffd08a', particle: '#ff9a4a',
  },
  sky: {
    name: 'Sky', sky: ['#9fd6ff', '#e8f6ff'], far: '#c9e6ff', mid: '#ffffff', ground: '#f0e6c8', groundEdge: '#d6a94f',
    accent: '#ffcf4a', light: '#ffffff', floor: 'void', floorColor: '#dff2ff', floorGlow: '#ffffff', particle: '#ffffff',
  },
};

export const MAPS = {
  scrapyard: {
    id: 'scrapyard', name: 'Scrapyard', theme: 'industrial', size: 'standard', width: 28, height: 16,
    minPlayers: 2, maxPlayers: 4, recommended: 2,
    terrain: [
      R(0, 13, 11, 3), R(17, 13, 11, 3),          // ground either side of the acid pit
      R(11.5, 11, 5, 0.8),                          // crusher platform over the pit
      R(3, 9, 4, 0.8), R(21, 9, 4, 0.8),            // side ledges
      R(8.5, 11, 1, 2), R(18.5, 11, 1, 2),          // pillars
      R(0, 6, 1, 7), R(27, 6, 1, 7),                // side walls
    ],
    spawns: [[2, 12.5], [5, 12.5], [7.5, 12.5], [10, 12.5], [18, 12.5], [20.5, 12.5], [23, 12.5], [26, 12.5]],
    powerups: [[5, 8.5], [23, 8.5], [14, 10.5], [3, 12.5], [25, 12.5]],
    killFloor: { type: 'acid', y: 14.6 },
    teleporters: false,
    hazards: [{ type: 'crusher', x: 11.5, w: 5, top: 4, bottom: 11, every: 5, dmg: 40 }],
    blurb: 'Two scrap heaps around an acid pit. The crusher drops on the centre platform every 5 turns.',
  },
  caldera: {
    id: 'caldera', name: 'Caldera', theme: 'lava', size: 'standard', width: 26, height: 16,
    minPlayers: 2, maxPlayers: 4, recommended: 2,
    terrain: [
      R(0, 11, 7, 5), R(9.5, 12.5, 7, 3.5), R(19, 11, 7, 5),   // three rock islands
      R(2, 7, 3, 0.8), R(11.5, 8.5, 3, 0.8), R(21, 7, 3, 0.8),  // high ledges
      R(7.5, 9, 0.8, 2), R(17.7, 9, 0.8, 2),                    // stalagmite cover
    ],
    spawns: [[1.5, 10.5], [4, 10.5], [6, 10.5], [11, 12], [15, 12], [20, 10.5], [22, 10.5], [24.5, 10.5]],
    powerups: [[3.5, 6.5], [13, 8], [22.5, 6.5], [13, 12], [1, 10.5], [25, 10.5]],
    killFloor: { type: 'lava', y: 14.2 },
    teleporters: false,
    hazards: [{ type: 'risingLava', every: 6, amount: 1 }],
    blurb: 'Three islands in a lava lake. The lava rises one unit every 6 turns.',
  },
  stratos: {
    id: 'stratos', name: 'Stratos', theme: 'sky', size: 'standard', width: 30, height: 17,
    minPlayers: 2, maxPlayers: 4, recommended: 3,
    terrain: [
      R(1, 11, 6, 1.6), R(9, 13, 5, 1.6), R(16, 13, 5, 1.6), R(23, 11, 6, 1.6),  // floating islands
      R(12.5, 8, 5, 1.1),                                                       // centre island
      R(5, 6.5, 3, 0.8), R(22, 6.5, 3, 0.8),                                    // high perches
    ],
    spawns: [[2, 10.5], [5.5, 10.5], [10, 12.5], [12.5, 12.5], [17, 12.5], [19.5, 12.5], [24.5, 10.5], [28, 10.5]],
    powerups: [[15, 7.5], [6.5, 6], [23.5, 6], [11.5, 12.5], [18.5, 12.5]],
    killFloor: { type: 'void', y: 18 },
    teleporters: false,
    hazards: [{ type: 'wind', max: 7 }],
    blurb: 'Floating islands above open sky. Wind changes every turn and bends every shot.',
  },
  foundry: {
    id: 'foundry', name: 'Foundry', theme: 'lava', size: 'battle', width: 46, height: 20,
    minPlayers: 2, maxPlayers: 8, recommended: 6,
    terrain: [
      R(0, 14, 18, 6), R(28, 14, 18, 6),          // two platforms
      R(18, 15.5, 10, 0.8),                        // bridge
      R(6, 12, 1.2, 2), R(12, 12, 1.2, 2), R(33, 12, 1.2, 2), R(39, 12, 1.2, 2),  // pillars
      R(2, 9, 4, 0.8), R(40, 9, 4, 0.8),           // overhangs
      R(20, 10, 6, 0.8),                           // catwalk above the bridge
      R(0, 8, 1, 6), R(45, 8, 1, 6),               // side walls
    ],
    spawns: [[2.5, 13.5], [7.5, 13.5], [11, 13.5], [16, 13.5], [30, 13.5], [35, 13.5], [38.5, 13.5], [43.5, 13.5]],
    powerups: [[23, 9.5], [23, 15], [4, 8.5], [42, 8.5], [9, 13.5], [37, 13.5], [16, 13.5], [30, 13.5]],
    killFloor: { type: 'lava', y: 17.6 },
    teleporters: false,
    hazards: [{ type: 'geyser', every: 3, points: [[19.5, 15.5], [23, 15.5], [26.5, 15.5], [20.5, 9.5], [25.5, 9.5]], count: 2, dmg: 20, radius: 1.4 }],
    blurb: 'Two platforms split by a lava river and joined by a bridge. Geysers erupt at announced points every 3 turns.',
  },
  nimbus: {
    id: 'nimbus', name: 'Nimbus Reach', theme: 'sky', size: 'battle', width: 50, height: 22,
    minPlayers: 2, maxPlayers: 8, recommended: 8,
    terrain: [
      R(4, 18, 9, 1.6), R(20, 19, 10, 1.6), R(37, 18, 9, 1.6),                  // bottom tier
      R(0, 12, 6, 1.2), R(12, 13, 7, 1.2), R(31, 13, 7, 1.2), R(44, 12, 6, 1.2), // middle tier
      R(8, 7, 5, 1), R(22.5, 6, 5, 1), R(37, 7, 5, 1),                          // top tier
      R(8, 16, 1, 2), R(41, 16, 1, 2), R(24.5, 17, 1, 2),                      // pillars
    ],
    spawns: [[1.5, 11.5], [5.5, 17.5], [11, 17.5], [14, 12.5], [35, 12.5], [39, 17.5], [44.5, 17.5], [48, 11.5]],
    powerups: [[25, 5.5], [10.5, 6.5], [39.5, 6.5], [25, 18.5], [15.5, 12.5], [34.5, 12.5], [22, 18.5], [28, 18.5]],
    killFloor: { type: 'void', y: 23 },
    teleporters: true,
    hazards: [{ type: 'gusts', every: 3, strength: 11 }],
    blurb: 'Three altitude tiers with teleporting edges. A strong gust hits every 3 turns.',
  },
  reactor: {
    id: 'reactor', name: 'Reactor Core', theme: 'industrial', size: 'battle', width: 44, height: 20,
    minPlayers: 2, maxPlayers: 8, recommended: 6,
    terrain: [
      R(0, 16, 10, 4), R(14, 16, 16, 4), R(34, 16, 10, 4),  // ground with two acid pits
      R(4, 11, 4, 0.8), R(36, 11, 4, 0.8),                   // side ledges
      R(19, 8, 6, 0.8),                                      // reactor cap
      R(16.5, 14, 1, 2), R(26.5, 14, 1, 2),                  // pillars flanking the core
      R(0, 13.5, 2, 2.5), R(42, 13.5, 2, 2.5),               // corner blocks
      R(10, 13, 1, 1), R(33, 13, 1, 1),                      // pit lips
    ],
    spawns: [[3, 15.5], [7, 15.5], [15.5, 15.5], [19, 15.5], [25, 15.5], [28.5, 15.5], [37, 15.5], [41, 15.5]],
    powerups: [[22, 7.5], [6, 10.5], [38, 10.5], [22, 15.5], [12, 12.5], [32, 12.5], [1, 11.5], [43, 11.5]],
    killFloor: { type: 'acid', y: 17.6 },
    teleporters: true,
    hazards: [{ type: 'reactor', x: 22, y: 12.5, r: 4, every: 4, dmg: 15 }],
    blurb: 'Industrial arena with acid pits and teleporting edges. The central reactor pulses every 4 turns.',
  },
};

export const MAP_IDS = Object.keys(MAPS);

// Choose n spawns spread as evenly as possible across the list.
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
