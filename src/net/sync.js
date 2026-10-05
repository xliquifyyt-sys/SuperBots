// Applies the server's authoritative turn list to a local Match.
// The browser animates playback; tests fast-forward it. Both use this class.

import { Match, worldDigest } from '../core/match.js';

export class Mirror {
  constructor() {
    this.match = null;
    this.yourBotId = 0;
    this.errors = [];
    this.deadline = 0;
  }

  start(msg) {
    const players = msg.players.map((p) => ({ name: p.name, botId: p.botId, team: p.team, isAI: !!p.isAI }));
    const saved = this.match && this.match.onPlayed;
    this.match = new Match(players, msg.settings, msg.seed);
    this.match.clock = 'client';
    this.match.onPlayed = saved || null;
    this.match.start();
    this.yourBotId = msg.yourBotId;
    // Only the local seat is this machine's human. Remote players stay in the
    // roster, and their actions arrive in the server's playback list.
    for (const b of this.match.world.bots) b.human = b.id === msg.yourBotId;
    return this.match;
  }

  // Replay completed turns, then join the live phase. Used on reconnect.
  rebuild(msg) {
    const played = this.match && this.match.onPlayed;
    this.start(msg);
    this.match.onPlayed = null;
    for (const turn of msg.history || []) {
      if (this.match.phase === 'over') break;
      if (this.match.phase === 'announce') this.match.beginPlan();
      this.match.beginPlayback(turn.actions);
      this.match.world.runToEnd();
      this.match.phase = 'played';
      this.match.beginCleanup();
      this.match.beginAnnounce();
    }
    this.match.onPlayed = played;
    if (msg.playback) {
      if (this.match.phase === 'announce') this.match.beginPlan();
      if (this.match.phase === 'plan') this.match.beginPlayback(msg.playback.actions);
    } else if (msg.phase === 'plan' && this.match.phase === 'announce') {
      this.match.beginPlan();
    }
    if (msg.deadline) this.deadline = msg.deadline;
    return this.match;
  }

  handle(msg) {
    if (!this.match || this.match.phase === 'over') return null;
    if (msg.t === 'phase' && (msg.phase === 'announce' || msg.phase === 'plan' || msg.phase === 'over')) {
      this.enterTurn(msg.turn);
      if (msg.phase === 'plan' && this.match.phase === 'announce') this.match.beginPlan();
      if (msg.phase === 'plan') {
        this.deadline = msg.deadline || 0;
        this.checkDigest(msg.digest, msg.turn);
      }
      if (msg.phase === 'over') this.checkDigest(msg.digest, msg.turn);
      return msg.phase;
    }
    if (msg.t === 'playback') {
      if (this.match.phase === 'announce') this.match.beginPlan();
      if (this.match.phase === 'plan') this.match.beginPlayback(msg.actions);
      return 'playback';
    }
    return null;
  }

  enterTurn(turn) {
    const m = this.match;
    if (!m || m.phase === 'over') return;
    if (m.turn === turn && (m.phase === 'announce' || m.phase === 'plan' || m.phase === 'over')) return;
    if (m.phase === 'resolve') {
      m.world.runToEnd();
      m.phase = 'played';
    }
    if (m.phase === 'played') m.beginCleanup();
    if (m.phase === 'cleanup') m.beginAnnounce();
  }

  checkDigest(digest, turn) {
    if (!digest || !this.match) return;
    const mine = worldDigest(this.match.world);
    if (mine !== digest) this.errors.push(`turn ${turn}: client ${mine} server ${digest}`);
  }

  fastForward() {
    if (this.match && this.match.phase === 'resolve') this.match.finishPlayback();
  }
}
