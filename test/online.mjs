// Two players sign in, become friends, one invites the other, and they play a
// full authoritative match. A third check drops a socket and reconnects.
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import WebSocket from 'ws';
import { startServer } from '../server/index.js';
import { Mirror } from '../src/net/sync.js';

const app = await startServer({ port: 0, dataFile: join(mkdtempSync(join(tmpdir(), 'superbots-')), 'superbots.sqlite'), staticFiles: false });
const base = `http://127.0.0.1:${app.port}`;
let failed = 0;
const check = (cond, msg) => { if (!cond) { failed++; console.log('FAIL', msg); } else console.log('ok  ', msg); };

async function api(path, body, token, method) {
  const res = await fetch(base + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

class Client {
  constructor(name) { this.name = name; this.queue = []; this.waiters = []; this.mirror = new Mirror(); this.user = null; this.token = null; this.ws = null; }
  async signup() {
    const res = await api('/api/auth/guest', { username: this.name });
    if (res.status !== 200) throw new Error(this.name + ' signup ' + JSON.stringify(res.data));
    this.token = res.data.token;
    this.user = res.data.user;
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
      } catch (err) { console.error(this.name, 'handle', err); }
      this.queue.push(msg);
      const waiters = this.waiters;
      this.waiters = [];
      for (const w of waiters) w();
    });
    return new Promise((resolve, reject) => { this.ws.on('open', resolve); this.ws.on('error', reject); });
  }
  send(msg) { this.ws.send(JSON.stringify(msg)); }
  async waitFor(pred, ms = 20000) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      const found = this.queue.find(pred);
      if (found) return found;
      await new Promise((r) => {
        const timer = setTimeout(r, 200);
        this.waiters.push(() => { clearTimeout(timer); r(); });
      });
    }
    const seen = this.queue.map((m) => m.t + (m.phase ? ':' + m.phase : '') + (m.turn ? '#' + m.turn : '')).slice(-12).join(', ');
    throw new Error(this.name + ' timed out. recent: ' + seen);
  }
}

const google = await api('/api/auth/google', { idToken: 'nope' });
check(google.status === 501, 'Google sign-in reports unconfigured without a client id');
const apple = await api('/api/auth/apple', { identityToken: 'nope' });
check(apple.status === 501, 'Apple sign-in reports unconfigured without a client id');
const bad = await api('/api/auth/guest', { username: 'no' });
check(bad.status === 400, 'short usernames are rejected');

const ada = new Client('Ada');
const bea = new Client('Bea');
await ada.signup();
await bea.signup();
check(ada.user.friendCode && ada.user.friendCode !== bea.user.friendCode, 'each account has its own friend code');
const dup = await api('/api/auth/guest', { username: 'ada' });
check(dup.status === 409, 'usernames are unique regardless of case');

await ada.connect();
await bea.connect();
await ada.waitFor((m) => m.t === 'friends');
await bea.waitFor((m) => m.t === 'friends');

const added = await api('/api/friends', { username: 'Bea' }, ada.token);
check(added.status === 200, 'Ada can request Bea by username');
const note = await bea.waitFor((m) => m.t === 'notification' && m.notification.kind === 'friend_request');
const accepted = await api(`/api/friends/${note.notification.payload.requestId}/accept`, {}, bea.token);
check(accepted.status === 200, 'Bea accepts the friend request');
const friends = await ada.waitFor((m) => m.t === 'friends' && m.friends.some((f) => f.username === 'Bea'));
check(friends.friends.find((f) => f.username === 'Bea').status === 'online', 'Ada sees Bea online');

const byCode = await api('/api/friends', { friendCode: ada.user.friendCode }, bea.token);
check(byCode.status === 409, 'a second request between friends is rejected');

ada.send({ t: 'lobby.create', settings: { map: 'emberpit', turnCap: 20, onTurnCap: 'hp', hazards: false, powerups: 'off', airStrikes: 'off', planTimer: 10 } });
const lobby = await ada.waitFor((m) => m.t === 'lobby' && m.code);
check(!!lobby.code, 'Ada gets a join code');
ada.send({ t: 'lobby.seat', botId: 'volt', team: 0 });
ada.send({ t: 'invite', userId: bea.user.id });
const invite = await bea.waitFor((m) => m.t === 'notification' && m.notification.kind === 'lobby_invite');
check(invite.notification.payload.code === lobby.code, 'Bea is invited into the lobby');
bea.send({ t: 'lobby.join', code: invite.notification.payload.code });
await bea.waitFor((m) => m.t === 'lobby' && m.seats.length === 2);
bea.send({ t: 'lobby.seat', botId: 'magmaw', team: 1 });
ada.send({ t: 'lobby.ready', ready: true });
bea.send({ t: 'lobby.ready', ready: true });
ada.send({ t: 'lobby.start' });

await ada.waitFor((m) => m.t === 'match');
await bea.waitFor((m) => m.t === 'match');
check(ada.mirror.yourBotId === 0 && bea.mirror.yourBotId === 1, 'each client is seated on their own bot');

let dropped = false;
let rejoined = false;
for (let turn = 1; turn <= 24; turn++) {
  if (bea.queue.some((m) => m.t === 'phase' && m.phase === 'over')) break;
  const plan = await bea.waitFor((m) => m.t === 'phase' && ((m.phase === 'plan' && m.turn === turn) || m.phase === 'over'), 20000);
  if (plan.phase === 'over') break;
  if (ada.ws.readyState === 1) await ada.waitFor((m) => m.t === 'phase' && ((m.phase === 'plan' && m.turn === turn) || m.phase === 'over'), 20000);
  if (turn === 2 && !dropped) {
    dropped = true;
    ada.ws.close();
    await new Promise((r) => setTimeout(r, 150));
  }
  const aim = (dir) => ({ t: 'action', action: { type: 'missile', aim: { dx: dir, dy: -0.35, power: 0.9 }, locked: true } });
  if (ada.ws.readyState === 1) ada.send(aim(1));
  bea.send(aim(-1));
  await bea.waitFor((m) => m.t === 'playback' && m.turn === turn, 20000);
  if (ada.ws.readyState === 1) await ada.waitFor((m) => m.t === 'playback' && m.turn === turn, 20000);
  if (turn === 2 && !rejoined) {
    rejoined = true;
    await ada.connect();
    await ada.waitFor((m) => m.t === 'resync', 10000);
  }
  if (bea.queue.some((m) => m.t === 'phase' && m.phase === 'over')) break;
}

const overA = await ada.waitFor((m) => m.t === 'phase' && m.phase === 'over', 20000);
const overB = await bea.waitFor((m) => m.t === 'phase' && m.phase === 'over', 20000);
check(overA.winner && overA.winner.ids && overA.winner.ids.length > 0, 'the match reaches a winner');
check(JSON.stringify(overA.winner) === JSON.stringify(overB.winner), 'both clients receive the same result');
check(ada.mirror.errors.length === 0, 'Ada stays in sync with the server: ' + ada.mirror.errors.slice(0, 2).join(' | '));
check(bea.mirror.errors.length === 0, 'Bea stays in sync with the server: ' + bea.mirror.errors.slice(0, 2).join(' | '));
check(dropped && rejoined, 'a dropped player is filled by AI and can reconnect');

const me = await api('/api/me', null, ada.token);
check(me.data.user.games >= 1, 'the server records the match on the profile');

const removed = await api(`/api/friends/${bea.user.id}`, null, ada.token, 'DELETE');
check(removed.status === 200, 'Ada can remove Bea');

try { ada.ws.close(); bea.ws.close(); } catch { /* already closed */ }
app.close();
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nonline server checks passed');
process.exit(0);
