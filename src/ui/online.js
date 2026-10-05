// Online menus: guest / Google / Apple sign-in, friends, lobby invites, and the
// websocket that drives an authoritative match.

import { BOTS, BOT_IDS } from '../core/defs.js';
import { Mirror } from '../net/sync.js';

const $ = (id) => document.getElementById(id);

const SETTING_FIELDS = [
  ['mode', 'Mode', { ffa: 'Free-for-all', teams: 'Teams' }],
  ['planTimer', 'Plan timer', { 10: '10s', 15: '15s', 20: '20s', 30: '30s' }],
  ['turnCap', 'Turn cap', { 0: 'Off', 20: '20', 30: '30', 40: '40' }],
  ['onTurnCap', 'On turn cap', { hp: 'Highest HP', suddenDeath: 'Sudden Death' }],
  ['powerups', 'Power-ups', { off: 'Off', low: 'Low', normal: 'Normal', high: 'High' }],
  ['airStrikes', 'Air strikes', { off: 'Off', rare: 'Rare', normal: 'Normal' }],
  ['hazards', 'Map hazards', { true: 'On', false: 'Off' }, true],
  ['aiDifficulty', 'AI difficulty', { easy: 'Rookie', normal: 'Veteran', hard: 'Elite' }],
  ['map', 'Map', { random: 'Random', emberpit: 'Ember Pit', magmaworks: 'Magma Works', frozenkeel: 'Frost Hollow', glacierfort: 'Glacier Fort', canopyruins: 'Canopy Ruins', templecrossing: 'Temple Crossing', cloudsteps: 'Cloud Steps', nimbus: 'Nimbus Reach', neonalley: 'Neon Alley', skylinegrid: 'Skyline Grid' }],
];

export function mountOnline(hooks) {
  const online = new Online(hooks);
  online.bind();
  online.boot();
  return online;
}

class Online {
  constructor(hooks) {
    this.hooks = hooks;
    this.token = localStorage.getItem('superbots.token') || '';
    this.user = null;
    this.ws = null;
    this.mirror = new Mirror();
    this.lobby = null;
    this.social = { friends: [], incoming: [], outgoing: [] };
    this.ready = false;
    this.config = { guest: true, google: false, apple: false };
    this.reconnectTimer = 0;
  }

  get deadline() { return this.mirror.deadline; }
  get yourBotId() { return this.mirror.yourBotId; }

  bind() {
    $('btn-guest').addEventListener('click', () => this.guest());
    $('btn-google').addEventListener('click', () => this.provider('google'));
    $('btn-apple').addEventListener('click', () => this.provider('apple'));
    $('btn-sign-out').addEventListener('click', () => this.signOut());
    $('btn-online-create').addEventListener('click', () => this.send({ t: 'lobby.create', settings: {} }));
    $('btn-online-join').addEventListener('click', () => this.send({ t: 'lobby.join', code: $('join-code').value.trim() }));
    $('btn-online-back').addEventListener('click', () => {
      if (this.lobby) this.send({ t: 'lobby.leave' });
      this.hooks.showScreen('menu-main');
    });
    $('btn-online-ready').addEventListener('click', () => { this.ready = !this.ready; this.send({ t: 'lobby.ready', ready: this.ready }); });
    $('btn-online-start').addEventListener('click', () => this.send({ t: 'lobby.start' }));
    $('btn-online-add-ai').addEventListener('click', () => this.send({ t: 'lobby.addAi' }));
    $('btn-friend-add').addEventListener('click', () => this.addFriend($('friend-search').value.trim()));
    $('friend-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addFriend($('friend-search').value.trim()); });
  }

  async boot() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) this.config = await res.json();
    } catch { /* offline static server */ }
    $('auth-note').textContent = this.config.google || this.config.apple
      ? 'Google or Apple is configured on this server.'
      : 'Google and Apple buttons need GOOGLE_CLIENT_ID / APPLE_CLIENT_ID on the server. Guest login works now.';
    if (this.token) {
      const me = await this.api('/api/me');
      if (me && me.user) { this.user = me.user; this.connect(); }
    }
    this.renderAccount();
  }

  async guest() {
    const username = $('auth-username').value.trim();
    const res = await this.api('/api/auth/guest', { username }, false);
    if (!res || res.error) { this.note(res?.error || 'Cannot reach the game server. Start it with npm start.'); return; }
    this.token = res.token;
    localStorage.setItem('superbots.token', res.token);
    this.user = res.user;
    this.connect();
    this.renderAccount();
  }

  async provider(kind) {
    if (kind === 'google' && !this.config.google) { this.note('Set GOOGLE_CLIENT_ID on the server, then the app posts a Google ID token to /api/auth/google.'); return; }
    if (kind === 'apple' && !this.config.apple) { this.note('Set APPLE_CLIENT_ID on the server. A Capacitor build posts the Apple identity token to /api/auth/apple.'); return; }
    this.note(kind === 'google' ? 'Waiting for Google…' : 'Waiting for Apple…');
    const token = kind === 'google' ? await this.googleToken() : await this.appleToken();
    if (!token) { this.note('Sign-in was cancelled or the provider script is not on the page.'); return; }
    const path = kind === 'google' ? '/api/auth/google' : '/api/auth/apple';
    const body = kind === 'google' ? { idToken: token } : { identityToken: token };
    const res = await this.api(path, body, false);
    if (!res || res.error) { this.note(res?.error || 'Sign-in failed.'); return; }
    this.token = res.token;
    localStorage.setItem('superbots.token', res.token);
    this.user = res.user;
    this.connect();
    this.renderAccount();
  }

  googleToken() {
    return new Promise((resolve) => {
      const gis = window.google && window.google.accounts && window.google.accounts.id;
      if (!gis || !this.config.googleClientId) { resolve(null); return; }
      gis.initialize({ client_id: this.config.googleClientId, callback: (r) => resolve(r && r.credential) });
      gis.prompt((n) => { if (n && n.isDismissedMoment && n.isDismissedMoment()) resolve(null); });
    });
  }

  appleToken() {
    const apple = window.AppleID;
    if (!apple || !this.config.appleClientId) return Promise.resolve(null);
    apple.auth.init({ clientId: this.config.appleClientId, scope: 'name email', redirectURI: location.origin, usePopup: true });
    return apple.auth.signIn().then((r) => r && r.authorization && r.authorization.id_token).catch(() => null);
  }

  signOut() {
    this.token = '';
    this.user = null;
    localStorage.removeItem('superbots.token');
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.lobby = null;
    this.renderAccount();
    this.hooks.showScreen('menu-main');
  }

  connect() {
    if (!this.token || this.ws) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(this.token)}`);
    this.ws = ws;
    ws.onmessage = (ev) => { try { this.onMessage(JSON.parse(ev.data)); } catch (err) { console.error(err); } };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      clearTimeout(this.reconnectTimer);
      if (this.token) this.reconnectTimer = setTimeout(() => this.connect(), 1000);
    };
  }

  send(msg) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); }

  sendAction(action) { this.send({ t: 'action', action }); }
  playbackDone(turn) { this.send({ t: 'playbackDone', turn }); }
  leaveMatch() { this.send({ t: 'lobby.leave' }); }

  onMessage(msg) {
    if (msg.t === 'friends') { this.social = msg; this.renderFriends(); this.renderInviteList(); return; }
    if (msg.t === 'presence') { this.applyPresence(msg); return; }
    if (msg.t === 'notification') { this.toast(msg.notification); return; }
    if (msg.t === 'error') { this.note(msg.message); const el = $('online-error'); if (el) el.textContent = msg.message; return; }
    if (msg.t === 'lobby') {
      if (msg.closed) { this.lobby = null; this.renderLobby(); return; }
      this.lobby = msg;
      const mine = (msg.seats || []).find((s) => s.userId === this.user?.id);
      if (mine) this.ready = !!mine.ready;
      this.renderLobby();
      const resultsUp = !$('menu-result').classList.contains('hidden');
      if (!msg.inMatch && !resultsUp && $('hud').classList.contains('hidden')) this.hooks.showScreen('menu-online');
      return;
    }
    if (msg.t === 'match') { this.beginMatch(msg, false); return; }
    if (msg.t === 'resync') { this.beginMatch(msg, true); return; }
    if (msg.t === 'phase' || msg.t === 'playback') {
      if (!this.mirror.match) return;
      this.mirror.handle(msg);
      if (this.mirror.errors.length) console.warn(this.mirror.errors[this.mirror.errors.length - 1]);
      if (msg.t === 'phase' && msg.phase === 'over') this.hooks.showScreen(null);
    }
  }

  beginMatch(msg, rebuild) {
    const match = rebuild ? this.mirror.rebuild(msg) : this.mirror.start(msg);
    this.hooks.beginOnlineMatch(match, this);
  }

  applyPresence(msg) {
    for (const list of [this.social.friends, this.social.incoming, this.social.outgoing]) {
      const row = list.find((f) => f.id === msg.userId);
      if (row) { row.status = msg.status; row.lobbyCode = msg.lobbyCode; }
    }
    this.renderFriends();
    this.renderInviteList();
  }

  toast(note) {
    const box = document.createElement('div');
    box.className = 'toast';
    const text = document.createElement('span');
    if (note.kind === 'lobby_invite') text.textContent = `${note.payload.fromName} invited you to a game (${note.payload.code}).`;
    else if (note.kind === 'friend_request') text.textContent = `${note.payload.fromName} wants to be friends.`;
    else text.textContent = note.kind;
    box.appendChild(text);
    if (note.kind === 'lobby_invite') {
      const join = document.createElement('button');
      join.className = 'btn small primary';
      join.textContent = 'JOIN';
      join.addEventListener('click', () => { this.send({ t: 'lobby.join', code: note.payload.code }); box.remove(); this.api(`/api/notifications/${note.id}/read`, {}, true); });
      box.appendChild(join);
    }
    if (note.kind === 'friend_request') {
      const ok = document.createElement('button');
      ok.className = 'btn small primary';
      ok.textContent = 'ACCEPT';
      ok.addEventListener('click', () => { this.api(`/api/friends/${note.payload.requestId}/accept`, {}, true); box.remove(); });
      box.appendChild(ok);
    }
    const no = document.createElement('button');
    no.className = 'btn small';
    no.textContent = 'DISMISS';
    no.addEventListener('click', () => { box.remove(); this.api(`/api/notifications/${note.id}/read`, {}, true); });
    box.appendChild(no);
    $('toasts').appendChild(box);
  }

  async addFriend(q) {
    if (!q) return;
    const payload = /^[A-Z0-9]{8,12}$/.test(q) ? { friendCode: q } : { username: q };
    const res = await this.api('/api/friends', payload, true);
    if (res && res.error) this.note(res.error);
    else $('friend-search').value = '';
  }

  renderAccount() {
    const chip = $('account-chip');
    if (!this.user) { chip.textContent = 'Not signed in'; $('auth-box').classList.remove('hidden'); $('online-home').classList.add('hidden'); }
    else {
      chip.textContent = `${this.user.username} · ${this.user.wins}W–${this.user.losses}L`;
      $('auth-box').classList.add('hidden');
      $('online-home').classList.remove('hidden');
      $('profile-line').textContent = `${this.user.username} · ${this.user.wins} wins, ${this.user.losses} losses`;
      $('profile-code').textContent = this.user.friendCode;
    }
    this.renderLobby();
  }

  renderLobby() {
    const box = $('online-lobby');
    if (!this.lobby) { box.classList.add('hidden'); if (this.user) $('online-home').classList.remove('hidden'); return; }
    $('online-home').classList.add('hidden');
    box.classList.remove('hidden');
    $('online-code').textContent = this.lobby.code;
    const host = this.user && this.lobby.hostId === this.user.id;
    $('btn-online-start').classList.toggle('hidden', !host);
    $('btn-online-add-ai').classList.toggle('hidden', !host);
    $('btn-online-ready').textContent = this.ready ? 'READY ✓' : 'READY';
    const slots = $('online-slots');
    slots.innerHTML = '';
    for (const s of this.lobby.seats) {
      const row = document.createElement('div');
      row.className = 'person' + (s.userId === this.user?.id ? ' me' : '');
      row.innerHTML = `<span class="who"><b>${s.name}</b> · ${s.kind === 'ai' ? 'Bot' : (s.ready ? 'Ready' : 'Not ready')}${s.connected ? '' : ' · disconnected'}</span><span>${BOTS[s.botId] ? BOTS[s.botId].name : 'Random'}</span>`;
      if (host && s.kind === 'ai') {
        const kick = document.createElement('button');
        kick.className = 'btn small';
        kick.textContent = '✕';
        kick.addEventListener('click', () => this.send({ t: 'lobby.kick', index: s.index }));
        row.appendChild(kick);
      }
      slots.appendChild(row);
    }
    const cards = $('online-bots');
    cards.innerHTML = '';
    const mine = this.lobby.seats.find((s) => s.userId === this.user?.id);
    for (const id of BOT_IDS) {
      const b = document.createElement('button');
      b.className = 'btn small' + (mine && mine.botId === id ? ' on' : '');
      b.dataset.bot = id;
      b.textContent = BOTS[id].name;
      b.style.borderColor = BOTS[id].color;
      b.addEventListener('click', () => this.send({ t: 'lobby.seat', botId: id, team: mine ? mine.team : 0 }));
      cards.appendChild(b);
    }
    this.renderSettings(host);
    this.renderInviteList();
  }

  renderSettings(host) {
    const grid = $('online-settings');
    grid.innerHTML = '';
    const settings = this.lobby.settings;
    for (const [key, label, opts, isBool] of SETTING_FIELDS) {
      const d = document.createElement('div');
      d.className = 'setting';
      d.innerHTML = `<label>${label}</label>`;
      const seg = document.createElement('div');
      seg.className = 'seg';
      for (const [val, text] of Object.entries(opts)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        const v = isBool ? val === 'true' : (isNaN(Number(val)) ? val : Number(val));
        b.classList.toggle('on', settings[key] === v);
        b.disabled = !host || this.lobby.inMatch;
        b.addEventListener('click', () => this.send({ t: 'lobby.settings', settings: { [key]: v } }));
        seg.appendChild(b);
      }
      d.appendChild(seg);
      grid.appendChild(d);
    }
  }

  renderFriends() {
    const list = $('friend-list');
    const incoming = $('friend-incoming');
    if (!list) return;
    list.innerHTML = '';
    incoming.innerHTML = '';
    if (!this.social.incoming.length) incoming.innerHTML = '<p class="hint">No pending requests.</p>';
    for (const req of this.social.incoming) {
      const row = document.createElement('div');
      row.className = 'person';
      row.innerHTML = `<span class="who">${req.username}</span>`;
      const ok = document.createElement('button');
      ok.className = 'btn small primary';
      ok.textContent = 'ACCEPT';
      ok.addEventListener('click', () => this.api(`/api/friends/${req.requestId}/accept`, {}, true));
      const no = document.createElement('button');
      no.className = 'btn small';
      no.textContent = 'DECLINE';
      no.addEventListener('click', () => this.api(`/api/friends/${req.requestId}/decline`, {}, true));
      row.append(ok, no);
      incoming.appendChild(row);
    }
    if (!this.social.friends.length) list.innerHTML = '<p class="hint">No friends yet. Search a username or friend code.</p>';
    for (const f of this.social.friends) {
      const row = document.createElement('div');
      row.className = 'person';
      row.dataset.friend = f.username;
      const status = f.status || 'offline';
      row.innerHTML = `<i class="dot ${status}"></i><span class="who"><b>${f.username}</b><br><span class="hint">${status === 'playing' ? 'In a match' : status === 'lobby' ? 'In a lobby' : status === 'online' ? 'Online' : 'Offline'}</span></span>`;
      if (this.lobby && status !== 'offline') {
        const inv = document.createElement('button');
        inv.className = 'btn small primary';
        inv.textContent = 'INVITE';
        inv.addEventListener('click', () => this.send({ t: 'invite', userId: f.id }));
        row.appendChild(inv);
      }
      const rm = document.createElement('button');
      rm.className = 'btn small';
      rm.textContent = 'REMOVE';
      rm.addEventListener('click', () => this.api(`/api/friends/${f.id}`, null, true, 'DELETE'));
      row.appendChild(rm);
      list.appendChild(row);
    }
  }

  renderInviteList() {
    const box = $('online-invites');
    if (!box) return;
    box.innerHTML = '';
    const friends = this.social.friends || [];
    if (!friends.length) { box.innerHTML = '<p class="hint">Add friends first, then invite them here.</p>'; return; }
    for (const f of friends) {
      const row = document.createElement('div');
      row.className = 'person';
      const status = f.status || 'offline';
      row.innerHTML = `<i class="dot ${status}"></i><span class="who">${f.username} · ${status}</span>`;
      const inv = document.createElement('button');
      inv.className = 'btn small';
      inv.dataset.invite = f.username;
      inv.textContent = 'INVITE';
      inv.disabled = status === 'offline';
      inv.addEventListener('click', () => this.send({ t: 'invite', userId: f.id }));
      row.appendChild(inv);
      box.appendChild(row);
    }
  }

  note(text) { const el = $('auth-note'); if (el) el.textContent = text || ''; }

  async api(path, body, auth = true, method) {
    try {
      const res = await fetch(path, {
        method: method || (body ? 'POST' : 'GET'),
        headers: { 'content-type': 'application/json', ...(auth && this.token ? { authorization: `Bearer ${this.token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && auth) this.signOut();
      return data;
    } catch {
      return null;
    }
  }
}
