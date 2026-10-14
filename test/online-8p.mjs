// Nightly QA: an 8-bot online match with 4 scripted clients + 4 server AI on a battle map with
// hazards, power-ups and air strikes on. Every client must stay digest-identical to the server
// every turn, all clients must receive the same winner, and the match must end.
// Usage: node test/online-8p.mjs [map]   (default nimbus)
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import WebSocket from 'ws';
import { startServer } from '../server/index.js';
import { Mirror } from '../src/net/sync.js';
import { worldDigest } from '../src/core/match.js';

const mapId = process.argv[2] || 'nimbus';
const app = await startServer({ port: 0, dataFile: join(mkdtempSync(join(tmpdir(), 'superbots-8p-')), 'superbots.sqlite'), staticFiles: false });
const base = `http://127.0.0.1:${app.port}`;
let failed = 0;
const check = (cond, msg) => { if (!cond) { failed++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const t0 = Date.now();

class Client {
  constructor(name) { this.name = name; this.queue = []; this.waiters = []; this.mirror = new Mirror(); }
  async signup() {
    const res = await fetch(base + '/api/auth/guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: this.name }) });
    const d = await res.json(); if (res.status !== 200) throw new Error(this.name + ' signup ' + JSON.stringify(d));
    this.token = d.token; this.user = d.user;
  }
  connect() {
    this.ws = new WebSocket(`ws://127.0.0.1:${app.port}/ws?token=${this.token}`);
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      try {
        if (msg.t === 'match') this.mirror.start(msg);
        else if (msg.t === 'resync') this.mirror.rebuild(msg);
        else if (msg.t === 'phase' || msg.t === 'playback') {
          this.mirror.handle(msg);
          if (msg.t === 'playback') { this.mirror.fastForward(); this.send({ t: 'playbackDone', turn: msg.turn }); }
        }
      } catch (err) { this.mirror.errors.push('handle: ' + err.message); }
      this.queue.push(msg);
      const w = this.waiters; this.waiters = []; for (const f of w) f();
    });
    return new Promise((resolve, reject) => { this.ws.on('open', resolve); this.ws.on('error', reject); });
  }
  send(msg) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); }
  async waitFor(pred, ms = 30000) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      const f = this.queue.find(pred); if (f) return f;
      await new Promise((r) => { const tm = setTimeout(r, 200); this.waiters.push(() => { clearTimeout(tm); r(); }); });
    }
    throw new Error(this.name + ' timed out; recent: ' + this.queue.slice(-8).map((m) => m.t + (m.phase ? ':' + m.phase : '')).join(', '));
  }
}

const bots = ['volt', 'magmaw', 'ricochet', 'gravitas'];
const clients = ['Qa1', 'Qa2', 'Qa3', 'Qa4'].map((n) => new Client(n));
for (const c of clients) { await c.signup(); await c.connect(); }
const [host] = clients;
host.send({ t: 'lobby.create', settings: { map: mapId, mode: 'ffa', turnCap: 30, onTurnCap: 'hp', hazards: true, powerups: 'high', airStrikes: 'normal', planTimer: 10 } });
const lobby = await host.waitFor((m) => m.t === 'lobby' && m.code);
for (const c of clients.slice(1)) { c.send({ t: 'lobby.join', code: lobby.code }); await c.waitFor((m) => m.t === 'lobby' && m.code === lobby.code); }
await host.waitFor((m) => m.t === 'lobby' && m.seats.length === 4);
clients.forEach((c, i) => c.send({ t: 'lobby.seat', botId: bots[i], team: i }));
for (let i = 0; i < 4; i++) host.send({ t: 'lobby.addAi' });
await host.waitFor((m) => m.t === 'lobby' && m.seats.length === 8);
for (const c of clients) c.send({ t: 'lobby.ready', ready: true });
await new Promise((r) => setTimeout(r, 200));
host.send({ t: 'lobby.start' });
for (const c of clients) await c.waitFor((m) => m.t === 'match');
check(host.mirror.match.world.bots.length === 8, '8 bots in the match');
check(new Set(clients.map((c) => c.mirror.yourBotId)).size === 4, 'each client is seated on its own bot');

// Scripted actions: each client cycles missile / s1 / s2 / jump with varied aims.
const acts = ['missile', 's1', 'missile', 's2', 'jump'];
let turns = 0;
for (let turn = 1; turn <= 40; turn++) {
  const plan = await host.waitFor((m) => m.t === 'phase' && ((m.phase === 'plan' && m.turn === turn) || m.phase === 'over'), 40000);
  if (plan.phase === 'over') break;
  turns = turn;
  clients.forEach((c, i) => {
    const me = c.mirror.match.world.bots[c.mirror.yourBotId];
    if (!me || !me.alive) return;
    const dir = me.x < c.mirror.match.world.map.width / 2 ? 1 : -1;
    const type = acts[(turn + i) % acts.length];
    c.send({ t: 'action', action: { type, aim: { dx: dir * 0.8, dy: -0.6, power: 0.55 + ((turn * 7 + i * 3) % 40) / 100 }, locked: true } });
  });
  const pb = await host.waitFor((m) => (m.t === 'playback' && m.turn === turn) || (m.t === 'phase' && m.phase === 'over'), 40000);
  if (pb.t === 'phase') break;
}
const overs = [];
for (const c of clients) overs.push(await c.waitFor((m) => m.t === 'phase' && m.phase === 'over', 40000));
check(overs[0].winner && overs[0].winner.type, 'the match reaches a result in ' + turns + ' turns');
check(overs.every((o) => JSON.stringify(o.winner) === JSON.stringify(overs[0].winner)), 'all 4 clients receive the same result');
for (const c of clients) check(c.mirror.errors.length === 0, `${c.name} stays digest-identical to the server ${c.mirror.errors.slice(0, 2).join(' | ')}`);
const digests = new Set(clients.map((c) => worldDigest(c.mirror.match.world)));
check(digests.size === 1, 'all 4 client worlds end on the same digest');
console.log(`online 8p ${mapId}: ${turns} turns, ${Math.round((Date.now() - t0) / 1000)}s`);
for (const c of clients) { try { c.ws.close(); } catch { /* closed */ } }
app.close();
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nonline 8-bot match passed');
process.exit(0);
