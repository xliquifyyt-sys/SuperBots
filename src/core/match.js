// Match orchestration: lobby settings -> World, the turn loop phases, win checks,
// turn cap and Sudden Death. Rendering-agnostic; the app calls update(dt).

import { World } from './sim.js';
import { MAPS, MAP_IDS, pickSpawns, mapsForPlayers } from './maps.js';
import { BOTS, BOT_IDS, TURN, PHYS, TEAM_COLORS, AI_NAMES, AI_DIFFICULTY, DEFAULT_SETTINGS } from './defs.js';
import { RNG, hashSeed } from './rng.js';
import { AIPlanner } from '../ai/planner.js';

export const PHASES = ['announce', 'plan', 'resolve', 'cleanup', 'over'];

export class Match {
  // players: [{ name, botId, team, isAI }], settings: host settings
  constructor(players, settingsIn, seed = Date.now()) {
    this.settings = { ...DEFAULT_SETTINGS, ...settingsIn };
    this.seed = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
    const rng = new RNG(this.seed ^ 0x9e3779b9);

    // Map
    let mapId = this.settings.map;
    const eligible = mapsForPlayers(players.length);
    if (mapId === 'random' || !eligible.includes(mapId)) mapId = rng.pick(eligible.length ? eligible : MAP_IDS);
    this.map = MAPS[mapId];

    // Bot restrictions
    let roster = players.map((p) => ({ ...p }));
    if (this.settings.restriction === 'mirror') { const id = roster[0].botId || rng.pick(BOT_IDS); roster.forEach((p) => (p.botId = id)); }
    else if (this.settings.restriction === 'random') roster.forEach((p) => (p.botId = rng.pick(BOT_IDS)));
    roster.forEach((p, i) => { if (!p.botId) p.botId = rng.pick(BOT_IDS); if (!p.name) p.name = AI_NAMES[i % AI_NAMES.length]; });

    // Spawns: in team mode, sort by team so teammates get adjacent pads.
    const order = roster.map((p, i) => i);
    if (this.settings.mode === 'teams') order.sort((a, b) => roster[a].team - roster[b].team);
    const pads = pickSpawns(this.map, roster.length);
    const spawnOf = new Array(roster.length);
    order.forEach((pi, k) => (spawnOf[pi] = pads[k]));
    roster = roster.map((p, i) => ({ ...p, spawn: spawnOf[i], color: this.settings.mode === 'teams' ? TEAM_COLORS[p.team % 4] : BOTS[p.botId].color }));

    this.world = new World(this.map, this.settings, roster, this.seed);
    this.players = roster;
    this.phase = 'idle';
    this.phaseTime = 0;
    this.planDeadline = 0;
    this.turn = 0;
    this.winner = null;      // { type: 'player'|'team'|'draw', ids: [] }
    this.log = [];
    this.playbackSpeed = 1;
    this.skipRequested = false;
    this.pendingActions = {};
    this.onPhase = null;     // callback(phase, info)
    this.diff = AI_DIFFICULTY[this.settings.aiDifficulty] || AI_DIFFICULTY.normal;
    this.ai = new AIPlanner(this.world, this.diff, new RNG(this.seed ^ 0x51ed27));
    this.announceInfo = [];
    this.humans = this.world.bots.filter((b) => b.human);
  }

  start() { this.beginAnnounce(); }

  beginAnnounce() {
    this.turn = this.world.turn + 1;
    this.announceInfo = this.world.startTurn();
    this.checkWin();
    if (this.winner) { this.setPhase('over'); return; }
    this.setPhase('announce');
    this.phaseTime = TURN.announce + (this.announceInfo.length ? 0.4 * Math.min(3, this.announceInfo.length) : 0);
  }

  beginPlan() {
    this.pendingActions = {};
    this.setPhase('plan');
    this.phaseTime = this.settings.planTimer;
    this.planDeadline = this.settings.planTimer;
    // AI decisions are computed now (they're deterministic given the world) and submitted at the deadline.
    for (const b of this.world.bots) {
      if (!b.alive || !b.isAI) continue;
      this.pendingActions[b.id] = this.ai.plan(b);
    }
  }

  // Human submits (or updates) an action during plan.
  submitAction(botId, action) {
    if (this.phase !== 'plan') return false;
    this.pendingActions[botId] = action;
    return true;
  }

  allHumansLocked() {
    return this.humans.filter((b) => b.alive).every((b) => this.pendingActions[b.id] && this.pendingActions[b.id].locked);
  }

  beginResolve() {
    for (const b of this.world.bots) {
      if (!b.alive) continue;
      const a = this.pendingActions[b.id] || { type: 'skip' };
      this.world.submit(b.id, a);
    }
    this.world.resolve();
    this.setPhase('resolve');
    this.skipRequested = false;
  }

  beginCleanup() {
    this.world.endTurn();
    this.setPhase('cleanup');
    this.phaseTime = TURN.cleanup;
    this.log.push({ turn: this.turn, events: this.world.events.slice() });
  }

  checkWin() {
    const w = this.world;
    const alive = w.alive();
    const teams = this.settings.mode === 'teams';
    const aliveTeams = [...new Set(alive.map((b) => b.team))];
    const standing = teams ? aliveTeams.length : alive.length;
    if (standing === 1) {
      this.winner = teams ? { type: 'team', ids: alive.map((b) => b.id), team: aliveTeams[0] } : { type: 'player', ids: [alive[0].id] };
      return;
    }
    if (standing === 0) {
      // Everyone died this turn -> Sudden Death among those who died this turn.
      const sdBots = w.bots.filter((b) => !b.alive && b.diedTurn === w.turn - 1);
      if (w.sdRound < 6 && sdBots.length >= 2 && (!teams || new Set(sdBots.map((b) => b.team)).size >= 2)) { w.enterSuddenDeath(sdBots); this.announceInfo.unshift({ type: 'sudden', text: 'SUDDEN DEATH' }); return; }
      this.winner = { type: 'draw', ids: sdBots.map((b) => b.id) };
      return;
    }
    // Turn cap
    if (this.settings.turnCap && this.turn > this.settings.turnCap && !w.suddenDeath) {
      const score = (b) => b.hp;
      if (teams) {
        const totals = {}; for (const b of alive) totals[b.team] = (totals[b.team] || 0) + score(b);
        const best = Math.max(...Object.values(totals)); const top = Object.keys(totals).filter((t) => totals[t] === best).map(Number);
        if (top.length === 1 || this.settings.onTurnCap === 'hp') { this.winner = { type: 'team', team: top[0], ids: alive.filter((b) => b.team === top[0]).map((b) => b.id), byCap: true }; return; }
        const tied = alive.filter((b) => top.includes(b.team));
        for (const b of w.bots) if (!tied.includes(b)) b.alive = false;
        w.enterSuddenDeath(tied); this.announceInfo.unshift({ type: 'sudden', text: 'TURN CAP: SUDDEN DEATH' });
      } else {
        const best = Math.max(...alive.map(score)); const top = alive.filter((b) => score(b) === best);
        if (top.length === 1 || this.settings.onTurnCap === 'hp') { this.winner = { type: 'player', ids: [top[0].id], byCap: true }; return; }
        for (const b of w.bots) if (!top.includes(b)) b.alive = false;
        w.enterSuddenDeath(top); this.announceInfo.unshift({ type: 'sudden', text: 'TURN CAP: SUDDEN DEATH' });
      }
    }
  }

  setPhase(p) { this.phase = p; if (this.onPhase) this.onPhase(p); }

  // Called every frame by the app with real elapsed seconds.
  update(dt) {
    switch (this.phase) {
      case 'announce':
        this.phaseTime -= dt;
        if (this.phaseTime <= 0) this.beginPlan();
        break;
      case 'plan':
        this.phaseTime -= dt;
        if (this.phaseTime <= 0 || this.allHumansLocked()) this.beginResolve();
        break;
      case 'resolve': {
        if (this.skipRequested) { this.world.runToEnd(); this.beginCleanup(); break; }
        // step the sim in fixed increments at playbackSpeed
        this.acc = (this.acc || 0) + dt * this.playbackSpeed;
        let finished = false;
        let guard = 0;
        while (this.acc >= PHYS.dt && guard++ < 12) {
          this.acc -= PHYS.dt;
          if (this.world.step(PHYS.dt)) { finished = true; break; }
        }
        if (finished) { this.acc = 0; this.beginCleanup(); }
        break;
      }
      case 'cleanup':
        this.phaseTime -= dt;
        if (this.phaseTime <= 0) this.beginAnnounce();
        break;
    }
  }

  // Headless: play the whole match with AI for everyone (humans auto-skip). Returns result summary.
  static simulateHeadless(players, settings, seed, maxTurns = 120) {
    const m = new Match(players.map((p) => ({ ...p, isAI: true })), settings, seed);
    m.start();
    let guard = 0;
    while (m.phase !== 'over' && guard++ < maxTurns * 4) {
      if (m.phase === 'announce') m.beginPlan();
      else if (m.phase === 'plan') m.beginResolve();
      else if (m.phase === 'resolve') { m.world.runToEnd(); m.beginCleanup(); }
      else if (m.phase === 'cleanup') m.beginAnnounce();
    }
    return { winner: m.winner, turns: m.turn, map: m.map.id, bots: m.world.bots.map((b) => ({ name: b.name, botId: b.botId, hp: b.hp, alive: b.alive, stats: b.stats, diedTurn: b.diedTurn })), log: m.log };
  }
}
