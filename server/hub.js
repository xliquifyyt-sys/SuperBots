// Lobbies, presence, and the authoritative match. The server runs src/core/match.js.
// Clients send plans; the server resolves and broadcasts the action list for playback.

import { randomInt } from 'crypto';
import { AI_NAMES, DEFAULT_SETTINGS } from '../src/core/defs.js';
import { Match, packAction, worldDigest } from '../src/core/match.js';
import { addNotification, areFriends, friendIds, friendState, listNotifications, recordResult, userById } from './db.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PLAN = new Set([10, 15, 20, 30]);
const CAP = new Set([0, 20, 30, 40]);

export function sanitizeSettings(input = {}) {
  const s = { ...DEFAULT_SETTINGS, powerupPool: { ...DEFAULT_SETTINGS.powerupPool } };
  const src = input || {};
  if (src.mode === 'teams' || src.mode === 'ffa') s.mode = src.mode;
  if (PLAN.has(Number(src.planTimer))) s.planTimer = Number(src.planTimer);
  if (CAP.has(Number(src.turnCap))) s.turnCap = Number(src.turnCap);
  if (src.onTurnCap === 'hp' || src.onTurnCap === 'suddenDeath') s.onTurnCap = src.onTurnCap;
  if (['off', 'low', 'normal', 'high'].includes(src.powerups)) s.powerups = src.powerups;
  if (['off', 'rare', 'normal'].includes(src.airStrikes)) s.airStrikes = src.airStrikes;
  if (typeof src.hazards === 'boolean') s.hazards = src.hazards;
  if ([0.75, 1, 1.5].includes(Number(src.startingHp))) s.startingHp = Number(src.startingHp);
  if ([0.75, 1, 1.5].includes(Number(src.damage))) s.damage = Number(src.damage);
  if (src.cooldowns === 'fast' || src.cooldowns === 'normal') s.cooldowns = src.cooldowns;
  if (['none', 'mirror', 'random'].includes(src.restriction)) s.restriction = src.restriction;
  if (typeof src.friendlyFire === 'boolean') s.friendlyFire = src.friendlyFire;
  if (['easy', 'normal', 'hard'].includes(src.aiDifficulty)) s.aiDifficulty = src.aiDifficulty;
  if (typeof src.map === 'string' && src.map.length < 40) s.map = src.map;
  if (src.powerupPool && typeof src.powerupPool === 'object') {
    for (const k of Object.keys(s.powerupPool)) if (typeof src.powerupPool[k] === 'boolean') s.powerupPool[k] = src.powerupPool[k];
  }
  return s;
}

function lobbyCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

export class Hub {
  constructor(db) {
    this.db = db;
    this.sockets = new Map();
    this.lobbies = new Map();
    this.userLobby = new Map();
    this.status = new Map();
  }

  connect(user, ws) {
    let set = this.sockets.get(user.id);
    if (!set) { set = new Set(); this.sockets.set(user.id, set); }
    set.add(ws);
    ws.userId = user.id;
    const lobby = this.lobbyFor(user.id);
    if (lobby) {
      const seat = lobby.seats.find((s) => s.userId === user.id);
      if (seat) seat.connected = true;
      const live = lobby.host && !lobby.host.finished;
      if (live) lobby.host.rejoin(user.id);
      this.touch(user.id, live ? 'playing' : 'lobby', lobby.code);
      this.send(ws, lobby.view());
      if (lobby.host) this.send(ws, lobby.host.resync(user.id));
    } else {
      this.touch(user.id, 'online');
    }
    this.pushFriends(user.id);
    for (const note of listNotifications(this.db, user.id)) if (!note.read) this.send(ws, { t: 'notification', notification: note });
    this.fanoutPresence(user.id);
  }

  disconnect(user, ws) {
    const set = this.sockets.get(user.id);
    if (set) { set.delete(ws); if (!set.size) this.sockets.delete(user.id); }
    if (this.sockets.has(user.id)) return;
    const lobby = this.lobbyFor(user.id);
    if (lobby && lobby.host && !lobby.host.finished) {
      const seat = lobby.seats.find((s) => s.userId === user.id);
      if (seat) seat.connected = false;
      lobby.host.abandon(user.id);
      lobby.broadcast();
      this.touch(user.id, 'playing', lobby.code);
    } else if (lobby) {
      this.leaveLobby(user.id);
    }
    this.touch(user.id, 'offline');
    this.fanoutPresence(user.id);
  }

  touch(userId, status, lobbyCode = null) {
    this.status.set(userId, { status, lobbyCode, at: Date.now() });
  }

  send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }

  sendUser(userId, msg) {
    const set = this.sockets.get(userId);
    if (!set) return;
    for (const ws of set) this.send(ws, msg);
  }

  online(userId) { return this.sockets.has(userId); }

  presenceOf(userId) {
    if (!this.online(userId)) return { status: 'offline', lobbyCode: null };
    const s = this.status.get(userId);
    return { status: s?.status || 'online', lobbyCode: s?.lobbyCode || null };
  }

  fanoutPresence(userId) {
    const presence = { t: 'presence', userId, ...this.presenceOf(userId) };
    for (const id of friendIds(this.db, userId)) this.sendUser(id, presence);
  }

  pushFriends(userId) { this.sendUser(userId, { t: 'friends', ...this.socialView(userId) }); }

  socialView(userId) {
    const state = friendState(this.db, userId);
    const decorate = (row) => ({ ...row, ...this.presenceOf(row.id) });
    return { friends: state.friends.map(decorate), incoming: state.incoming, outgoing: state.outgoing };
  }

  notify(userId, kind, payload) {
    const note = addNotification(this.db, userId, kind, payload);
    this.sendUser(userId, { t: 'notification', notification: note });
    return note;
  }

  lobbyFor(userId) {
    const code = this.userLobby.get(userId);
    return code ? this.lobbies.get(code) : null;
  }

  createLobby(userId, settings) {
    if (this.lobbyFor(userId)) this.leaveLobby(userId);
    const user = userById(this.db, userId);
    let code = lobbyCode();
    while (this.lobbies.has(code)) code = lobbyCode();
    const lobby = new Lobby(this, code, user, sanitizeSettings(settings));
    this.lobbies.set(code, lobby);
    this.userLobby.set(userId, code);
    this.touch(userId, 'lobby', code);
    this.fanoutPresence(userId);
    lobby.broadcast();
    return lobby;
  }

  joinLobby(userId, code) {
    const lobby = this.lobbies.get(String(code || '').toUpperCase());
    if (!lobby) return { error: 'No lobby with that code.' };
    if (lobby.host && !lobby.host.finished) return { error: 'That match has already started.' };
    if (lobby.seats.some((s) => s.userId === userId)) { lobby.broadcast(); return {}; }
    if (lobby.seats.length >= 8) return { error: 'That lobby is full.' };
    const prev = this.lobbyFor(userId);
    if (prev && prev !== lobby) this.leaveLobby(userId);
    const user = userById(this.db, userId);
    lobby.seats.push({ kind: 'human', userId, name: user.username, botId: 'volt', team: lobby.seats.length % 2, ready: false, connected: true });
    this.userLobby.set(userId, lobby.code);
    this.touch(userId, 'lobby', lobby.code);
    this.fanoutPresence(userId);
    lobby.broadcast();
    return {};
  }

  leaveLobby(userId) {
    const lobby = this.lobbyFor(userId);
    if (!lobby) return;
    if (lobby.host && !lobby.host.finished) {
      lobby.host.abandon(userId);
      const seat = lobby.seats.find((s) => s.userId === userId);
      if (seat) seat.connected = false;
      this.userLobby.delete(userId);
      this.touch(userId, this.online(userId) ? 'online' : 'offline');
      this.fanoutPresence(userId);
      lobby.broadcast();
      return;
    }
    lobby.seats = lobby.seats.filter((s) => s.userId !== userId);
    this.userLobby.delete(userId);
    this.touch(userId, this.online(userId) ? 'online' : 'offline');
    this.fanoutPresence(userId);
    if (lobby.hostId === userId || !lobby.seats.some((s) => s.kind === 'human')) {
      for (const s of lobby.seats) if (s.userId) this.userLobby.delete(s.userId);
      this.lobbies.delete(lobby.code);
      lobby.broadcastRaw({ t: 'lobby', closed: true, code: lobby.code });
    } else {
      lobby.broadcast();
    }
  }

  invite(fromId, toId) {
    const lobby = this.lobbyFor(fromId);
    if (!lobby) return { error: 'Create a lobby before inviting.' };
    if (lobby.host && !lobby.host.finished) return { error: 'The match has already started.' };
    if (!areFriends(this.db, fromId, toId)) return { error: 'You can only invite friends.' };
    const from = userById(this.db, fromId);
    this.notify(toId, 'lobby_invite', { code: lobby.code, fromId, fromName: from.username });
    return {};
  }

  onMessage(user, msg) {
    const id = user.id;
    if (msg.t === 'lobby.create') { this.createLobby(id, msg.settings || {}); return; }
    if (msg.t === 'lobby.join') {
      const r = this.joinLobby(id, msg.code);
      if (r.error) this.sendUser(id, { t: 'error', message: r.error });
      return;
    }
    if (msg.t === 'lobby.leave') { this.leaveLobby(id); return; }
    if (msg.t === 'lobby.settings') {
      const lobby = this.hostLobby(id);
      if (!lobby) return;
      lobby.settings = sanitizeSettings({ ...lobby.settings, ...(msg.settings || {}) });
      lobby.broadcast();
      return;
    }
    if (msg.t === 'lobby.seat') {
      const lobby = this.lobbyFor(id);
      if (!lobby || (lobby.host && !lobby.host.finished)) return;
      const seat = lobby.seats.find((s) => s.userId === id);
      if (!seat) return;
      if (typeof msg.botId === 'string') seat.botId = msg.botId;
      if (Number.isInteger(msg.team)) seat.team = ((msg.team % 4) + 4) % 4;
      lobby.broadcast();
      return;
    }
    if (msg.t === 'lobby.ready') {
      const lobby = this.lobbyFor(id);
      if (!lobby) return;
      const seat = lobby.seats.find((s) => s.userId === id);
      if (seat) seat.ready = !!msg.ready;
      lobby.broadcast();
      return;
    }
    if (msg.t === 'lobby.addAi') {
      const lobby = this.hostLobby(id);
      if (!lobby || lobby.seats.length >= 8) return;
      const n = lobby.seats.length;
      lobby.seats.push({ kind: 'ai', userId: null, name: AI_NAMES[n % AI_NAMES.length], botId: 'random', team: n % 2, ready: true, connected: true });
      lobby.broadcast();
      return;
    }
    if (msg.t === 'lobby.kick') {
      const lobby = this.hostLobby(id);
      if (!lobby) return;
      const seat = lobby.seats[msg.index];
      if (!seat || seat.kind !== 'ai') return;
      lobby.seats.splice(msg.index, 1);
      lobby.broadcast();
      return;
    }
    if (msg.t === 'lobby.start') {
      const lobby = this.hostLobby(id);
      if (!lobby) return;
      const err = lobby.startMatch();
      if (err) this.sendUser(id, { t: 'error', message: err });
      return;
    }
    if (msg.t === 'invite') {
      const r = this.invite(id, msg.userId);
      if (r.error) this.sendUser(id, { t: 'error', message: r.error });
      return;
    }
    if (msg.t === 'action') {
      const lobby = this.lobbyFor(id);
      if (lobby?.host) lobby.host.submit(id, msg.action);
      return;
    }
    if (msg.t === 'playbackDone') {
      const lobby = this.lobbyFor(id);
      if (lobby?.host) lobby.host.ack(id, msg.turn);
      return;
    }
    if (msg.t === 'resync') {
      const lobby = this.lobbyFor(id);
      if (lobby?.host) this.sendUser(id, lobby.host.resync(id));
    }
  }

  hostLobby(userId) {
    const lobby = this.lobbyFor(userId);
    if (!lobby || lobby.hostId !== userId) return null;
    if (lobby.host && !lobby.host.finished) return null;
    return lobby;
  }
}

class Lobby {
  constructor(hub, code, hostUser, settings) {
    this.hub = hub;
    this.code = code;
    this.hostId = hostUser.id;
    this.settings = settings;
    this.seats = [{ kind: 'human', userId: hostUser.id, name: hostUser.username, botId: 'volt', team: 0, ready: false, connected: true }];
    this.host = null;
  }

  view() {
    return {
      t: 'lobby',
      code: this.code,
      hostId: this.hostId,
      settings: this.settings,
      inMatch: !!(this.host && !this.host.finished),
      seats: this.seats.map((s, index) => ({
        index, kind: s.kind, userId: s.userId, name: s.name, botId: s.botId, team: s.team, ready: !!s.ready, connected: s.connected !== false,
      })),
    };
  }

  broadcast() {
    const view = this.view();
    for (const s of this.seats) if (s.userId) this.hub.sendUser(s.userId, view);
  }

  broadcastRaw(msg) {
    for (const s of this.seats) if (s.userId) this.hub.sendUser(s.userId, msg);
  }

  startMatch() {
    if (this.host && !this.host.finished) return 'A match is already running.';
    const humans = this.seats.filter((s) => s.kind === 'human');
    if (this.seats.length < 2) return 'Need at least two players or bots.';
    if (humans.some((s) => !s.ready)) return 'Every player has to ready up.';
    if (humans.some((s) => s.connected === false)) return 'A player is disconnected.';
    if (this.settings.mode === 'teams' && new Set(this.seats.map((s) => s.team)).size < 2) return 'Teams mode needs two teams.';
    for (const s of this.seats) if (s.kind === 'human') this.hub.touch(s.userId, 'playing', this.code);
    for (const s of this.seats) if (s.userId) this.hub.fanoutPresence(s.userId);
    this.host = new MatchHost(this);
    return null;
  }
}

class MatchHost {
  constructor(lobby) {
    this.lobby = lobby;
    this.hub = lobby.hub;
    this.finished = false;
    this.history = [];
    this.waiting = null;
    this.planEndsAt = 0;
    this.seed = randomInt(1, 0x7fffffff);
    this.roster = lobby.seats.map((s) => ({
      name: s.name,
      botId: !s.botId || s.botId === 'random' ? undefined : s.botId,
      team: s.team,
      isAI: s.kind === 'ai',
      userId: s.userId || null,
    }));
    this.settings = sanitizeSettings(lobby.settings);
    this.match = new Match(this.roster.map((p) => ({ name: p.name, botId: p.botId, team: p.team, isAI: p.isAI })), this.settings, this.seed);
    this.match.start();
    const msg = { t: 'match', seed: this.seed, settings: this.settings, players: this.roster };
    for (const s of lobby.seats) {
      if (!s.userId) continue;
      this.hub.sendUser(s.userId, { ...msg, yourBotId: lobby.seats.indexOf(s) });
    }
    this._broadcastPhase();
    this.timer = setInterval(() => {
      try { this.tick(0.05); } catch (err) { console.error('tick', err); this.finished = true; clearInterval(this.timer); }
    }, 50);
  }

  humanSeats() { return this.lobby.seats.filter((s) => s.kind === 'human' && s.userId); }

  broadcast(msg) {
    for (const s of this.humanSeats()) this.hub.sendUser(s.userId, msg);
  }

  tick(dt) {
    if (this.finished) return;
    const m = this.match;
    if (this.waiting) {
      const need = this.humanSeats().filter((s) => s.connected !== false).map((s) => s.userId);
      const done = need.every((id) => this.waiting.acks.has(id));
      if (done || Date.now() - this.waiting.since > 20000) this._closePlayback();
      else return;
    }
    if (m.phase === 'resolve') { this._openPlayback(); return; }
    const before = `${m.phase}:${m.turn}`;
    m.update(dt);
    if (m.phase === 'resolve') { this._openPlayback(); return; }
    const after = `${m.phase}:${m.turn}`;
    if (after !== before) this._broadcastPhase();
    if (m.phase === 'over') this._finish();
  }

  _openPlayback() {
    const m = this.match;
    const actions = {};
    for (const b of m.world.bots) if (b.action) actions[b.id] = packAction(b.action);
    m.world.runToEnd();
    this.waiting = { turn: m.turn, actions, acks: new Set(), since: Date.now() };
    for (const s of this.humanSeats()) if (s.connected === false) this.waiting.acks.add(s.userId);
    this.broadcast({ t: 'playback', turn: m.turn, actions });
  }

  _closePlayback() {
    const turn = this.waiting;
    this.waiting = null;
    this.history.push({ turn: turn.turn, actions: turn.actions });
    if (this.match.phase === 'resolve') this.match.beginCleanup();
  }

  _broadcastPhase() {
    const m = this.match;
    if (m.phase === 'announce') {
      this.broadcast({ t: 'phase', phase: 'announce', turn: m.turn, suddenDeath: !!m.world.suddenDeath, announce: m.announceInfo });
    } else if (m.phase === 'plan') {
      this.planEndsAt = Date.now() + m.phaseTime * 1000;
      this.broadcast({ t: 'phase', phase: 'plan', turn: m.turn, deadline: this.planEndsAt, suddenDeath: !!m.world.suddenDeath, digest: worldDigest(m.world) });
    } else if (m.phase === 'over') {
      this.broadcast({ t: 'phase', phase: 'over', turn: m.turn, winner: m.winner, digest: worldDigest(m.world) });
    }
  }

  submit(userId, action) {
    const seat = this.lobby.seats.find((s) => s.userId === userId);
    if (!seat || seat.connected === false) return;
    const bot = this.match.world.bots[this.lobby.seats.indexOf(seat)];
    if (!bot || !bot.alive || !bot.human) return;
    this.match.submitAction(bot.id, packAction(action));
  }

  ack(userId, turn) {
    if (this.waiting && this.waiting.turn === turn) this.waiting.acks.add(userId);
  }

  abandon(userId) {
    const index = this.lobby.seats.findIndex((s) => s.userId === userId);
    if (index < 0) return;
    const bot = this.match.world.bots[index];
    if (!bot) return;
    bot.human = false;
    bot.isAI = true;
    if (this.match.phase === 'plan' && bot.alive) {
      const cur = this.match.pendingActions[bot.id];
      if (!cur || !cur.locked) this.match.pendingActions[bot.id] = this.match.ai.plan(bot);
    }
    if (this.waiting) this.waiting.acks.add(userId);
  }

  rejoin(userId) {
    const index = this.lobby.seats.findIndex((s) => s.userId === userId);
    if (index < 0 || this.finished) return;
    const bot = this.match.world.bots[index];
    if (!bot) return;
    bot.human = true;
    bot.isAI = false;
  }

  resync(userId) {
    const index = this.lobby.seats.findIndex((s) => s.userId === userId);
    return {
      t: 'resync',
      seed: this.seed,
      settings: this.settings,
      players: this.roster,
      yourBotId: index,
      history: this.history,
      phase: this.waiting ? 'playback' : this.match.phase,
      turn: this.match.turn,
      deadline: this.planEndsAt,
      digest: worldDigest(this.match.world),
      playback: this.waiting ? { turn: this.waiting.turn, actions: this.waiting.actions } : null,
      winner: this.match.winner,
    };
  }

  _finish() {
    if (this.finished) return;
    this.finished = true;
    clearInterval(this.timer);
    const ids = this.match.winner?.ids || [];
    for (const s of this.humanSeats()) {
      const index = this.lobby.seats.indexOf(s);
      recordResult(this.hub.db, s.userId, ids.includes(index));
      this.hub.touch(s.userId, 'lobby', this.lobby.code);
      this.hub.fanoutPresence(s.userId);
    }
    for (const s of this.lobby.seats) if (s.kind === 'human') s.ready = false;
    this.lobby.broadcast();
  }
}
