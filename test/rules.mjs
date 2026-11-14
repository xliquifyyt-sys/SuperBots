// Same-turn wipeout is a shared win. Sudden Death stays for a turn-cap tie.
// The human aim guide shortens with lower accuracy.
import { readFileSync } from 'fs';
import { Match } from '../src/core/match.js';
import { BOTS, TURN, aimPreviewCount, playerAimGuide } from '../src/core/defs.js';

let failed = 0;
function check(cond, msg) {
  if (!cond) { failed++; console.log('FAIL', msg); }
  else console.log('ok  ', msg);
}

const quiet = { map: 'emberpit', hazards: false, powerups: 'off', airStrikes: 'off', planTimer: 15, turnCap: 0 };

function match(players, settings, seed = 11) {
  const m = new Match(players, { ...quiet, ...settings }, seed);
  m.start();
  return m;
}

function kill(m, bots) {
  for (const b of bots) m.world.kill(b, null, 'fell', TURN.maxChainKills);
}

// Deaths are stamped with the current world turn. The next announce is what checks the win.
function resolveWipe(m, bots) {
  m.beginPlan();
  kill(m, bots);
  m.beginCleanup();
  m.beginAnnounce();
}

const ffa = [
  { name: 'Ada', botId: 'volt', team: 0, isAI: true },
  { name: 'Bea', botId: 'magmaw', team: 1, isAI: true },
  { name: 'Cal', botId: 'warden', team: 2, isAI: true },
];

// --- same-turn wipe: shared win, nobody respawns ---
{
  const m = match(ffa);
  const ids = m.world.bots.map((b) => b.id);
  resolveWipe(m, m.world.alive());
  check(m.phase === 'over', 'wipe ends the match');
  check(m.winner && m.winner.type === 'draw' && m.winner.shared === true, 'wipe is a shared win');
  check(m.winner && ids.every((id) => m.winner.ids.includes(id)) && m.winner.ids.length === 3, 'every bot eliminated that turn shares it');
  check(m.world.suddenDeath === false && m.world.sdRound === 0, 'wipe does not start Sudden Death');
  check(m.world.bots.every((b) => !b.alive && b.hp === 0), 'wiped bots stay dead');
  check(!m.log.some((l) => l.events.some((e) => e.type === 'suddenDeath')), 'wipe log has no suddenDeath event');
}

// --- one survivor still wins outright ---
{
  const m = match(ffa.slice(0, 2), {}, 12);
  resolveWipe(m, [m.world.bots[0]]);
  check(m.winner && m.winner.type === 'player' && m.winner.ids.length === 1 && m.winner.ids[0] === 1, 'last bot standing wins');
  check(!m.world.suddenDeath, 'a single elimination is not Sudden Death');
}

// --- teams: both teams wiped together share the win ---
{
  const teams = [
    { name: 'A1', botId: 'volt', team: 0, isAI: true },
    { name: 'A2', botId: 'bulwark', team: 0, isAI: true },
    { name: 'B1', botId: 'magmaw', team: 1, isAI: true },
    { name: 'B2', botId: 'warden', team: 1, isAI: true },
  ];
  const m = match(teams, { mode: 'teams' }, 13);
  resolveWipe(m, m.world.alive());
  check(m.winner && m.winner.type === 'draw' && m.winner.shared && m.winner.ids.length === 4, 'team wipe is a shared win');
  check(!m.world.suddenDeath, 'team wipe does not start Sudden Death');
}

// --- teams: one team left is a team win ---
{
  const teams = [
    { name: 'A1', botId: 'volt', team: 0, isAI: true },
    { name: 'B1', botId: 'magmaw', team: 1, isAI: true },
    { name: 'B2', botId: 'warden', team: 1, isAI: true },
  ];
  const m = match(teams, { mode: 'teams' }, 14);
  resolveWipe(m, m.world.bots.filter((b) => b.team === 1));
  check(m.winner && m.winner.type === 'team' && m.winner.team === 0, 'surviving team wins');
  check(!m.world.suddenDeath, 'a team win is not Sudden Death');
}

// --- turn-cap tie still enters Sudden Death ---
{
  const m = match(ffa.slice(0, 2), { turnCap: 1, onTurnCap: 'suddenDeath' }, 15);
  m.turn = 2;
  m.world.bots[0].hp = 40;
  m.world.bots[1].hp = 40;
  m.checkWin();
  check(!m.winner && m.world.suddenDeath && m.world.sdRound === 1, 'tied turn cap starts Sudden Death');
  check(m.world.bots.every((b) => b.alive && b.hp === TURN.suddenDeathHp), 'tied bots respawn at Sudden Death HP');
  check(m.world.events.some((e) => e.type === 'suddenDeath'), 'turn-cap Sudden Death emits an event');
  // A wipe during that Sudden Death is a shared win, not another round.
  resolveWipe(m, m.world.alive());
  check(m.winner && m.winner.type === 'draw' && m.winner.shared && m.winner.ids.length === 2, 'wipe during Sudden Death is a shared win');
  check(m.world.sdRound === 1, 'wipe during Sudden Death does not start another round');
  check(m.world.bots.every((b) => !b.alive), 'bots stay dead after a Sudden Death wipe');
}

// --- turn-cap HP tiebreak still picks a winner and skips Sudden Death ---
{
  const m = match(ffa.slice(0, 2), { turnCap: 1, onTurnCap: 'hp' }, 16);
  m.turn = 2;
  m.world.bots[0].hp = 40;
  m.world.bots[1].hp = 40;
  m.checkWin();
  check(m.winner && m.winner.type === 'draw' && m.winner.byCap && !m.world.suddenDeath, 'HP tiebreak does not start Sudden Death');
}

// --- aim guide length follows accuracy ---
{
  check(BOTS.magmaw.accuracy === 'low' && BOTS.bulwark.accuracy === 'medium' && BOTS.volt.accuracy === 'high', 'roster accuracies used by the guide');
  const m = match([{ name: 'Ada', botId: 'volt', team: 0, isAI: false }], {}, 17);
  const bot = m.world.bots[0];
  bot.x = 16; bot.y = 8;
  const aim = { dx: 0.2, dy: -1, power: 0.4 };
  const missile = m.world.previewAction(bot, 'missile', aim);
  const jump = m.world.previewAction(bot, 'jump', aim);
  check(missile.points.length > 30 && jump.points.length > 30, 'preview arcs are long enough to shorten');
  for (const [label, points] of [['missile', missile.points], ['jump', jump.points]]) {
    const low = playerAimGuide(points, 'low');
    const med = playerAimGuide(points, 'medium');
    const high = playerAimGuide(points, 'high');
    check(low.fraction === 0.3 && med.fraction === 0.55 && high.fraction === 0.85, `${label} fractions are 30 / 55 / 85`);
    check(low.count < med.count && med.count < high.count && high.count < points.length, `${label} visible length grows with accuracy and stays short of the full flight`);
    check(low.count === aimPreviewCount(points.length, 0.3), `${label} count matches the renderer formula`);
    check(!low.reachesImpact && !med.reachesImpact && !high.reachesImpact, `${label} landing marker is hidden when the line stops short`);
  }
  const placed = playerAimGuide(missile.points, 'low', { pointTarget: true });
  check(placed.fraction === 1 && placed.reachesImpact && placed.count === missile.points.length, 'point-target moves still show the whole spot');
  const gameSrc = readFileSync(new URL('../src/ui/game.js', import.meta.url), 'utf8');
  const drawSrc = readFileSync(new URL('../src/render/renderer.js', import.meta.url), 'utf8');
  check(gameSrc.includes('playerAimGuide(') && !/fraction:\s*1/.test(gameSrc), 'the HUD passes the accuracy fraction');
  check(drawSrc.includes('aimPreviewCount(') && drawSrc.includes('shownImpact'), 'the renderer draws the shortened arc and drops the true impact');
}

// --- M0-03: Chain Arc hits the body outline, not a 0.75 circle ---
{
  const m = match([{ name: 'Ada', botId: 'volt', team: 0, isAI: true }, { name: 'Bea', botId: 'bulwark', team: 1, isAI: true }], {}, 21);
  const [volt, bul] = m.world.bots;
  const aim = { dx: 1, dy: 0, power: 1 };
  volt.x = 8; volt.y = 6; volt.facing = 1;
  // Bulwark's hull top reaches 0.9 above its centre: the centre is 0.9 below the beam (outside the old 0.75 circle) but the outline touches it.
  bul.x = 16; bul.y = 6.9; bul.facing = 1;
  const before = bul.hp;
  m.world.chainArc(volt, aim, BOTS.volt.s1);
  check(bul.hp < before, 'Chain Arc hits a bot whose outline crosses the beam even when its centre is outside 0.75');
  // Hull bottom (+0.614) sits 0.4 above the beam: clear miss.
  bul.hp = before; bul.y = 6 - 0.614 - 0.4;
  m.world.chainArc(volt, aim, BOTS.volt.s1);
  check(bul.hp === before, 'Chain Arc misses a bot whose outline stays clear of the beam');
  // A Volt aimed away does not hit a bot behind it.
  bul.y = 6; bul.x = 3;
  m.world.chainArc(volt, aim, BOTS.volt.s1);
  check(bul.hp === before, 'Chain Arc does not hit a bot behind the caster');
}

// --- M0-03: Bulwark is knockback-immune only beside its own wall ---
{
  const m = match([{ name: 'Ada', botId: 'bulwark', team: 0, isAI: true }, { name: 'Bea', botId: 'volt', team: 1, isAI: true }], {}, 22);
  const w = m.world, bul = w.bots[0];
  bul.x = 16; bul.y = 6; bul.vx = 0; bul.vy = 0;
  const seg = (x) => ({ rect: { x: x - 0.2, y: bul.y - 1.275, w: 0.4, h: 0.85 }, owner: bul.id, hp: 10, turns: 3, color: bul.color, seg: 0 });
  check(BOTS.bulwark.s1.guardRange > 0, 'guard range lives in defs');
  w.walls = [seg(bul.x + 1.4)]; bul.wallImmune = true;
  check(w.knockMul(bul) === 0, 'Bulwark beside its wall takes no knockback');
  w.explode(bul.x - 1.2, bul.y, 1.5, 20, w.bots[1], {});
  check(bul.vx === 0 && bul.vy === 0, 'a blast next to a guarded Bulwark does not move it');
  w.walls = [seg(bul.x + 12)]; bul.wallImmune = true; bul.vx = 0; bul.vy = 0;
  check(w.knockMul(bul) > 0, 'a wall far across the map does not grant immunity');
  w.explode(bul.x - 1.2, bul.y, 1.5, 20, w.bots[1], {});
  check(bul.vx > 0, 'a blast moves Bulwark when its wall is far away');
  const enemyWall = seg(bul.x + 1.4); enemyWall.owner = w.bots[1].id;
  w.walls = [enemyWall]; bul.wallImmune = false;
  check(w.knockMul(bul) > 0, 'standing beside someone else\'s wall grants nothing');
}

// --- M0-03: a tied turn-cap HP tiebreak is a draw, not the first entry ---
{
  const m = match(ffa, { turnCap: 1, onTurnCap: 'hp' }, 23);
  m.turn = 2;
  m.world.bots[0].hp = 30; m.world.bots[1].hp = 55; m.world.bots[2].hp = 55;
  m.checkWin();
  check(m.winner && m.winner.type === 'draw' && !m.winner.shared && m.winner.byCap, 'tied HP at the cap is a draw');
  check(m.winner && m.winner.ids.length === 2 && m.winner.ids.includes(1) && m.winner.ids.includes(2), 'the draw is between the tied bots only');
  check(!m.world.suddenDeath && m.world.bots.every((b) => b.alive), 'the HP draw does not start Sudden Death or kill anyone');
}
{
  const m = match(ffa.slice(0, 2), { turnCap: 1, onTurnCap: 'hp' }, 24);
  m.turn = 2;
  m.world.bots[0].hp = 41; m.world.bots[1].hp = 40;
  m.checkWin();
  check(m.winner && m.winner.type === 'player' && m.winner.ids[0] === 0 && m.winner.byCap, 'a clear HP lead at the cap still wins outright');
}
{
  const teams = [
    { name: 'A1', botId: 'volt', team: 0, isAI: true },
    { name: 'A2', botId: 'bulwark', team: 0, isAI: true },
    { name: 'B1', botId: 'magmaw', team: 1, isAI: true },
    { name: 'B2', botId: 'warden', team: 1, isAI: true },
  ];
  const m = match(teams, { mode: 'teams', turnCap: 1, onTurnCap: 'hp' }, 25);
  m.turn = 2;
  const [a1, a2, b1, b2] = m.world.bots;
  a1.hp = 50; a2.hp = 30; b1.hp = 40; b2.hp = 40;
  m.checkWin();
  check(m.winner && m.winner.type === 'draw' && m.winner.byCap && m.winner.ids.length === 4, 'tied team HP totals at the cap are a draw');
  check(m.winner && m.winner.teams && m.winner.teams.includes(0) && m.winner.teams.includes(1), 'the team draw names both tied teams');
}

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall rule checks passed');
