// All tunable numbers for Super Bots live here. World unit = one bot width.

export const PHYS = {
  dt: 1 / 60,
  gravity: 19,            // units / s^2 (y is down): floatier arcs
  botRadius: 0.5,
  maxSimTime: 6,          // seconds of sim per turn
  minSimTime: 0.8,
  restSpeed: 0.35,        // below this a grounded bot counts as at rest
  groundFriction: 6,      // per second velocity damping while grounded
  airDrag: 0.05,
  botRestitution: 0.15,
  missileSpeed: 30,       // at full power (range ~47 units on flat ground)
  jumpSpeed: 16,          // at full power, medium weight (range ~13.5 units)
  weightJump: { light: 1.18, medium: 1.0, heavy: 0.86 },
  weightKnockback: { light: 1.3, medium: 1.0, heavy: 0.6 },
  accuracyGuide: { low: 0.3, medium: 0.55, high: 0.85 },
  knockbackPerDamage: 0.28,
};

export const DMG = {
  missile: 25,
  missileRadius: 1.0,
  selfDestruct: 30,
  selfDestructRadius: 1.5,
  airStrikeBomb: 20,
  airStrikeRadius: 1.2,
  airStrikeBombs: 3,
  poison: 10,
  burn: 8,
  lava: 25,
  reactorPulse: 15,
};

export const TURN = {
  announce: 1.6,
  planOptions: [10, 15, 20, 30],
  cleanup: 0.8,
  suddenDeathHp: 60,
  powerupExpire: 6,
  maxChainKills: 3,
};

// ---------- Bots ----------
export const BOTS = {
  bulwark: {
    id: 'bulwark', name: 'Bulwark', cls: 'Heavy tank', hp: 140, weight: 'heavy', accuracy: 'medium',
    color: '#4f7cff', shape: 'block', desc: 'Anchors a fight. Walls off lanes and punishes clustering.',
    passive: 'Immune to knockback while Bastion Wall is up.',
    s1: { id: 'bastionWall', name: 'Bastion Wall', cd: 3, desc: 'Deploy a 3-segment barrier toward your aim for 2 turns. Blocks projectiles; breaks after 40 damage.' },
    s2: { id: 'siegeShell', name: 'Siege Shell', cd: 4, desc: 'Slow heavy shell: 55 damage, radius 1.5, strong knockback.', dmg: 55, radius: 1.5 },
  },
  magmaw: {
    id: 'magmaw', name: 'Magmaw', cls: 'Heavy brawler', hp: 140, weight: 'heavy', accuracy: 'low',
    color: '#ff5a1f', shape: 'jaw', desc: 'Gets in close and sets the ground on fire.',
    passive: 'Completely immune to Burn damage. Survives the first lava contact each turn.',
    s1: { id: 'moltenSlam', name: 'Molten Slam', cd: 3, desc: 'Jump toward your aim and slam: 35 damage, radius 2.5, leaves a burning patch: 15 damage on contact.', dmg: 35, radius: 2.5 },
    s2: { id: 'emberSpit', name: 'Ember Spit', cd: 2, desc: 'Spit 3 short-range fire globs: 12 damage each, applies Burn.', dmg: 12, radius: 0.7 },
  },
  volt: {
    id: 'volt', name: 'Volt', cls: 'Medium marksman', hp: 130, weight: 'medium', accuracy: 'high',
    color: '#ffe23a', shape: 'bolt', desc: 'The reliable marksman. Beams ignore walls.',
    passive: 'Missile speed +15%.',
    s1: { id: 'chainArc', name: 'Chain Arc', cd: 3, desc: 'Instant beam that pierces terrain and bots: 40 damage, then arcs to one more bot nearby for 15.', dmg: 40, arcDmg: 15, arcRange: 6 },
    s2: { id: 'staticField', name: 'Static Field', cd: 4, desc: 'Drops a wide field at impact: 30 damage, bots inside are Shocked (no specials next turn).', dmg: 30, radius: 3 },
  },
  warden: {
    id: 'warden', name: 'Warden', cls: 'Medium defender', hp: 130, weight: 'medium', accuracy: 'medium',
    color: '#3ddc97', shape: 'shield', desc: 'Turns enemy shots around and pins targets down.',
    passive: 'Takes 20% less damage from projectiles that hit from above.',
    s1: { id: 'deflector', name: 'Deflector', cd: 4, desc: 'Dome shield for 1 turn that reflects projectiles back along their path.' },
    s2: { id: 'anchorBolt', name: 'Anchor Bolt', cd: 3, desc: 'Projectile that Roots the target for 1 turn (no jump) and deals 45.', dmg: 45, radius: 0.9 },
  },
  skyla: {
    id: 'skyla', name: 'Skyla', cls: 'Medium aerial', hp: 130, weight: 'medium', accuracy: 'high',
    color: '#8fd3ff', shape: 'wing', desc: 'Owns the air. Repositions and shoots in one move.',
    passive: 'Not affected by map wind.',
    s1: { id: 'updraft', name: 'Updraft', cd: 2, desc: 'Leap with 2x height and rain 3 missiles straight down from the apex: 15 damage each.', dmg: 15, radius: 0.9 },
    s2: { id: 'galeShot', name: 'Gale Shot', cd: 3, desc: 'Long wind blast that shoves bots, projectiles and power-ups: 20 damage. Jumping into the wind fights the push.', dmg: 20 },
  },
  phantom: {
    id: 'phantom', name: 'Phantom', cls: 'Light assassin', hp: 120, weight: 'light', accuracy: 'high',
    color: '#c46bff', shape: 'blade', desc: 'Appears next to you, then disappears.',
    passive: 'After a kill, next special cooldown is 1 turn shorter.',
    s1: { id: 'blinkStrike', name: 'Blink Strike', cd: 3, desc: 'Teleport to your aim point (max 60% of map width), then release 4 shards: 6 damage each.', dmg: 6, radius: 0.8 },
    s2: { id: 'toxicBomb', name: 'Toxic Bomb', cd: 3, desc: 'Toxic cloud at impact: bots inside take 5 damage per tick, up to 35 this turn. The cloud clears when the turn ends.', dmg: 5, radius: 2.4 },
  },
  ricochet: {
    id: 'ricochet', name: 'Ricochet', cls: 'Light trickster', hp: 120, weight: 'light', accuracy: 'medium',
    color: '#ff4fa3', shape: 'ball', desc: 'Bank shots off everything. Map knowledge wins.',
    passive: 'Own jump bounces once off terrain.',
    s1: { id: 'pinball', name: 'Pinball', cd: 2, desc: 'Missile that bounces up to 4 times: 30 damage per bot hit, +5 per bounce.', dmg: 30, radius: 0.9, param: { name: 'Bounces', values: [1, 2, 3, 4], default: 4 } },
    s2: { id: 'splitShot', name: 'Split Shot', cd: 3, desc: 'Projectile splits into 4 at apex: 15 damage each.', dmg: 15, radius: 0.8 },
  },
  gravitas: {
    id: 'gravitas', name: 'Gravitas', cls: 'Control', hp: 130, weight: 'medium', accuracy: 'low',
    color: '#9aa4b8', shape: 'orb', desc: 'Drags everyone together. Best friend of every Siege Shell.',
    passive: 'Heavy knockback resistance while keeping a Medium jump.',
    s1: { id: 'singularity', name: 'Singularity', cd: 4, desc: 'Pulls all bots within a huge radius toward the impact point for the rest of the turn.', radius: 9.1 },
    s2: { id: 'shockwave', name: 'Shockwave', cd: 3, desc: 'Radial burst from yourself: 50 damage to all within radius 3, heavy knockback.', dmg: 50, radius: 3 },
  },
};
export const BOT_IDS = Object.keys(BOTS);

// ---------- Power-ups ----------
export const POWERUPS = {
  repair:    { id: 'repair',    name: 'Repair Kit',     kind: 'instant', color: '#5cff7a', icon: '+',  weight: 12, desc: '+40 HP.' },
  overclock: { id: 'overclock', name: 'Overclock',      kind: 'instant', color: '#5ff2ff', icon: '⟳', weight: 8,  desc: 'Reset both special cooldowns.' },
  amp:       { id: 'amp',       name: 'Amp',            kind: 'buff',    color: '#ff7a2f', icon: '▲', weight: 8,  turns: 4, desc: '+50% damage dealt. Lasts 4 turns, starting the turn you grab it.' },
  plating:   { id: 'plating',   name: 'Plating',        kind: 'buff',    color: '#c0c8d8', icon: '◆', weight: 8,  turns: 4, desc: '-50% damage taken. Lasts 4 turns, starting the turn you grab it.' },
  toxin:     { id: 'toxin',     name: 'Toxin',          kind: 'contact', color: '#9dff2f', icon: '☠', weight: 6,  turns: 4, desc: 'Next bot you collide with is Poisoned (10/turn for 3 turns). Held for 4 turns.' },
  frost:     { id: 'frost',     name: 'Frost',          kind: 'contact', color: '#b5f4ff', icon: '❄', weight: 6,  turns: 4, desc: 'Next bot you collide with is Frozen (no jump next turn). Held for 4 turns.' },
  thrusters: { id: 'thrusters', name: 'Thrusters',      kind: 'buff',    color: '#ffd84f', icon: '⇈', weight: 7,  turns: 4, desc: 'Jump distance x1.75. Lasts 4 turns, starting the turn you grab it.' },
  reflector: { id: 'reflector', name: 'Reflector Coat', kind: 'buff',    color: '#e8f0ff', icon: '◐', weight: 5,  turns: 2, desc: 'The first projectile to hit you is reflected back. Lasts this turn and the next.' },
  shockwire: { id: 'shockwire', name: 'Shockwire',      kind: 'contact', color: '#ffe23a', icon: '⚡', weight: 5,  turns: 4, desc: 'Next bot you collide with is Shocked (no specials next turn). Held for 4 turns.' },
  rally:     { id: 'rally',     name: 'Rally Beacon',   kind: 'buff',    color: '#ff9cf0', icon: '★', weight: 6,  turns: 2, teamsOnly: true, desc: 'You and all teammates gain +20 HP and +10% damage for 2 turns.' },
};
export const POWERUP_IDS = Object.keys(POWERUPS);

// ---------- Host settings ----------
export const SETTING_OPTIONS = {
  mode: ['ffa', 'teams'],
  planTimer: [10, 15, 20, 30],
  turnCap: [0, 20, 30, 40],
  onTurnCap: ['hp', 'suddenDeath'],
  powerups: ['off', 'low', 'normal', 'high'],
  airStrikes: ['off', 'rare', 'normal'],
  startingHp: [0.75, 1, 1.5],
  damage: [0.75, 1, 1.5],
  cooldowns: ['normal', 'fast'],
  restriction: ['none', 'mirror', 'random'],
};

export const DEFAULT_SETTINGS = {
  mode: 'ffa',
  map: 'random',
  planTimer: 15,
  turnCap: 0,
  onTurnCap: 'hp',
  powerups: 'normal',
  powerupPool: Object.fromEntries(POWERUP_IDS.map((id) => [id, true])),
  airStrikes: 'normal',
  hazards: true,
  startingHp: 1,
  damage: 1,
  cooldowns: 'normal',
  restriction: 'none',
  friendlyFire: false,
  aiDifficulty: 'normal',
};

export const PRESETS = {
  classic:  { name: 'Classic',  patch: { planTimer: 15, powerups: 'normal', airStrikes: 'normal', hazards: true, damage: 1, cooldowns: 'normal', restriction: 'none' } },
  chaos:    { name: 'Chaos',    patch: { powerups: 'high', cooldowns: 'fast', damage: 1.5, airStrikes: 'normal', hazards: true } },
  tactical: { name: 'Tactical', patch: { planTimer: 30, powerups: 'low', hazards: false, airStrikes: 'rare', damage: 1, cooldowns: 'normal' } },
  mirror:   { name: 'Mirror Match', patch: { restriction: 'mirror' } },
};

export const TEAM_COLORS = ['#3b8bff', '#ff8c2f', '#3ddc97', '#c46bff'];
export const TEAM_NAMES = ['Blue', 'Orange', 'Green', 'Purple'];

export const AI_DIFFICULTY = {
  easy:   { name: 'Rookie',  aimNoise: 0.12, samples: 40,  specialIQ: 0.4 },
  normal: { name: 'Veteran', aimNoise: 0.05, samples: 90,  specialIQ: 0.7 },
  hard:   { name: 'Elite',   aimNoise: 0.025, samples: 160, specialIQ: 0.95 },
};

export const AI_NAMES = ['Rex', 'Nova', 'Juno', 'Kilo', 'Mira', 'Ozzy', 'Pax', 'Quill', 'Rune', 'Sable', 'Tango', 'Vex'];
