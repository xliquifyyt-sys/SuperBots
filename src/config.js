// Central tuning for Super Bots.

export const ARENA = {
  size: 64,          // arena is size x size, centered on origin
  wallHeight: 4,
  wallThickness: 1,
};

export const ROUND = {
  toWin: 2,          // best of 3
  duration: 90,      // seconds per round
  introTime: 3,      // countdown before control is given
  outroTime: 2.5,    // pause after a round ends
};

export const PICKUPS = {
  respawn: 14,       // seconds
  healthAmount: 35,
  energyAmount: 60,
};

// Bot classes. Values are per-second unless noted.
export const BOT_CLASSES = {
  striker: {
    id: 'striker',
    name: 'Striker',
    tagline: 'Fast. Relentless. Twin blasters that never stop.',
    color: 0x2fd3ff,
    accent: 0xffffff,
    maxHp: 100,
    maxEnergy: 100,
    energyRegen: 12,
    speed: 13,
    accel: 60,
    radius: 1.0,
    height: 2.2,
    weapon: {
      name: 'Twin Blasters',
      damage: 9,
      cooldown: 0.13,
      projectileSpeed: 48,
      spread: 0.035,
      life: 1.6,
      size: 0.16,
      color: 0x5ff2ff,
      pellets: 1,
    },
    ability: {
      id: 'dash',
      name: 'Dash',
      desc: 'Burst forward, invulnerable for 0.25s.',
      cost: 30,
      cooldown: 2.2,
    },
    special: {
      id: 'overdrive',
      name: 'Overdrive',
      desc: 'Double fire rate and +50% speed for 4s.',
      cost: 70,
      cooldown: 12,
      duration: 4,
    },
  },
  titan: {
    id: 'titan',
    name: 'Titan',
    tagline: 'Walking fortress. Shrugs off hits, punishes mistakes.',
    color: 0xff7a2f,
    accent: 0xffd9a0,
    maxHp: 170,
    maxEnergy: 100,
    energyRegen: 9,
    speed: 8.5,
    accel: 35,
    radius: 1.3,
    height: 2.8,
    weapon: {
      name: 'Siege Cannon',
      damage: 34,
      cooldown: 0.75,
      projectileSpeed: 34,
      spread: 0.01,
      life: 2.2,
      size: 0.38,
      color: 0xffb060,
      pellets: 1,
      splash: 3.2,
      splashDamage: 16,
    },
    ability: {
      id: 'shield',
      name: 'Barrier',
      desc: 'Absorb all damage for 1.6s.',
      cost: 40,
      cooldown: 6,
      duration: 1.6,
    },
    special: {
      id: 'slam',
      name: 'Ground Slam',
      desc: 'Shockwave: 45 damage and knockback in a 7m radius.',
      cost: 80,
      cooldown: 14,
      radius: 7,
      damage: 45,
    },
  },
  phantom: {
    id: 'phantom',
    name: 'Phantom',
    tagline: 'Glass cannon. One rail shot changes everything.',
    color: 0xb04fff,
    accent: 0xf0d8ff,
    maxHp: 80,
    maxEnergy: 100,
    energyRegen: 15,
    speed: 11,
    accel: 55,
    radius: 0.95,
    height: 2.3,
    weapon: {
      name: 'Rail Lance',
      damage: 42,
      cooldown: 1.1,
      projectileSpeed: 110,
      spread: 0.0,
      life: 1.0,
      size: 0.14,
      color: 0xe28cff,
      pellets: 1,
      pierce: true,
    },
    ability: {
      id: 'blink',
      name: 'Blink',
      desc: 'Teleport 9m in your movement direction.',
      cost: 35,
      cooldown: 3.5,
      distance: 9,
    },
    special: {
      id: 'emp',
      name: 'EMP Pulse',
      desc: 'Stun the enemy for 1.8s if within 12m and drain 40 energy.',
      cost: 65,
      cooldown: 13,
      radius: 12,
      stun: 1.8,
    },
  },
};

export const DIFFICULTY = {
  easy:   { name: 'Rookie',   aimError: 0.16, reaction: 0.45, abilityIQ: 0.35, hpMul: 0.85, dmgMul: 0.8 },
  normal: { name: 'Veteran',  aimError: 0.08, reaction: 0.25, abilityIQ: 0.65, hpMul: 1.0,  dmgMul: 1.0 },
  hard:   { name: 'Elite',    aimError: 0.035, reaction: 0.12, abilityIQ: 0.9,  hpMul: 1.15, dmgMul: 1.15 },
};

export const CAMERA = {
  distance: 11,
  height: 6.5,
  lookAhead: 2.5,
  fov: 62,
};
