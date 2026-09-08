// App shell: menus, lobby, settings persistence and match lifecycle.
import { BOTS, BOT_IDS, POWERUPS, POWERUP_IDS, DEFAULT_SETTINGS, PRESETS, SETTING_OPTIONS, TEAM_COLORS, TEAM_NAMES, AI_NAMES, AI_DIFFICULTY } from './core/defs.js';
import { MAPS, MAP_IDS, mapsForPlayers } from './core/maps.js';
import { Match } from './core/match.js';
import { Renderer } from './render/renderer.js';
import { drawBot } from './render/bots.js';
import { iconCanvas } from './render/icons.js';
import { GameController } from './ui/game.js';
import { audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ? { ...d, ...v } : { ...d }; } catch { return { ...d }; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

// ---------- state ----------
const settings = load('superbots.settings', { ...DEFAULT_SETTINGS });
settings.powerupPool = { ...DEFAULT_SETTINGS.powerupPool, ...(settings.powerupPool || {}) };
const prefs = load('superbots.prefs', { name: 'You', botId: 'volt', muted: false, slots: null });
let record = load('superbots.record', { wins: 0, losses: 0, games: 0 });
let slots = prefs.slots || [
  { name: prefs.name, botId: prefs.botId, team: 0, isAI: false },
  { name: AI_NAMES[0], botId: 'random', team: 1, isAI: true },
];
slots[0].isAI = false;

// ---------- engine ----------
const canvas = $('game');
const renderer = new Renderer(canvas);
window.addEventListener('resize', () => { renderer.resize(); if (renderer.world) renderer.fitMap(); });
let currentMatch = null;
let lastSetup = null;
const game = new GameController(canvas, renderer, {
  onPause: () => { paused = true; showScreen('menu-pause'); },
  onOver: (m) => onMatchOver(m),
});
let paused = false;
let lastT = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
  if (currentMatch && !paused) game.update(dt);
  else if (currentMatch) renderer.update(0, {});
  else renderer.update(dt, {});
}
requestAnimationFrame(frame);
audio.setMuted(prefs.muted);
$('btn-sound').textContent = prefs.muted ? '🔇' : '🔊';
$('btn-sound').addEventListener('click', () => { prefs.muted = !prefs.muted; audio.setMuted(prefs.muted); $('btn-sound').textContent = prefs.muted ? '🔇' : '🔊'; save('superbots.prefs', prefs); });
window.__superbots = { get match() { return currentMatch; }, game, renderer, Match, startMatch, settings, slots };

// ---------- screens ----------
const screens = ['menu-main', 'menu-lobby', 'menu-botpedia', 'menu-help', 'menu-pause', 'menu-result'];
function showScreen(id) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== id);
  $('ui').classList.toggle('hidden', !id);
  if (id === 'menu-main') renderRecord();
  if (id === 'menu-lobby') renderLobby();
}
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { audio.init(); audio.ui(); showScreen(b.dataset.go); }));

// ---------- bot portraits ----------
function portrait(def, size = 64, color) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.translate(size / 2, size / 2);
  drawBot(ctx, def, size * 0.3, { anim: 'idle', t: 0, facing: 1, grounded: true, color: color || def.color, hp: 1, id: 0 }, 0.7);
  return cv;
}
function botCard(def, small) {
  const card = document.createElement('div');
  card.className = 'card'; card.dataset.bot = def.id;
  card.style.setProperty('--card-color', def.color);
  card.innerHTML = `<h4>${def.name.toUpperCase()}</h4><div class="cls">${def.cls}</div>` +
    `<div class="stats"><span>${def.hp} HP</span><span>${def.weight}</span><span>${def.accuracy} acc</span></div>` +
    `<div class="desc">${def.desc}</div>` +
    `<div class="skill"><b>${def.s1.name}</b> (CD ${def.s1.cd}) · ${def.s1.desc}</div>` +
    `<div class="skill"><b>${def.s2.name}</b> (CD ${def.s2.cd}) · ${def.s2.desc}</div>` +
    `<div class="passive">Passive: ${def.passive}</div>`;
  card.insertBefore(portrait(def, small ? 56 : 72), card.firstChild);
  return card;
}
for (const id of BOT_IDS) $('botpedia').appendChild(botCard(BOTS[id]));
for (const id of POWERUP_IDS) {
  const p = POWERUPS[id];
  const d = document.createElement('div'); d.className = 'pu';
  d.innerHTML = `<div><b>${p.name}${p.teamsOnly ? ' (teams)' : ''}</b>${p.desc}</div>`;
  d.insertBefore(iconCanvas(id, 44), d.firstChild);
  $('powerpedia').appendChild(d);
}

// ---------- lobby ----------
const SETTING_LABELS = {
  mode: { label: 'Mode', opts: { ffa: 'Free-for-all', teams: 'Teams' } },
  planTimer: { label: 'Plan timer', opts: { 10: '10s', 15: '15s', 20: '20s', 30: '30s' } },
  turnCap: { label: 'Turn cap', opts: { 0: 'Off', 20: '20', 30: '30', 40: '40' } },
  onTurnCap: { label: 'On turn cap', opts: { hp: 'Highest HP', suddenDeath: 'Sudden Death' } },
  powerups: { label: 'Power-ups', opts: { off: 'Off', low: 'Low', normal: 'Normal', high: 'High' } },
  airStrikes: { label: 'Air strikes', opts: { off: 'Off', rare: 'Rare', normal: 'Normal' } },
  hazards: { label: 'Map hazards', opts: { true: 'On', false: 'Off' }, bool: true },
  startingHp: { label: 'Starting HP', opts: { 0.75: '75%', 1: '100%', 1.5: '150%' } },
  damage: { label: 'Damage', opts: { 0.75: '75%', 1: '100%', 1.5: '150%' } },
  cooldowns: { label: 'Cooldowns', opts: { normal: 'Normal', fast: 'Fast' } },
  restriction: { label: 'Bot restriction', opts: { none: 'None', mirror: 'Mirror', random: 'Random' } },
  friendlyFire: { label: 'Friendly fire', opts: { false: 'Off', true: 'On' }, bool: true },
  aiDifficulty: { label: 'AI difficulty', opts: { easy: 'Rookie', normal: 'Veteran', hard: 'Elite' } },
};
function renderSettings() {
  const grid = $('settings-grid'); grid.innerHTML = '';
  for (const [key, meta] of Object.entries(SETTING_LABELS)) {
    const d = document.createElement('div'); d.className = 'setting';
    const seg = document.createElement('div'); seg.className = 'seg';
    for (const [val, label] of Object.entries(meta.opts)) {
      const b = document.createElement('button'); b.textContent = label;
      const v = meta.bool ? val === 'true' : (isNaN(Number(val)) ? val : Number(val));
      b.classList.toggle('on', settings[key] === v);
      b.addEventListener('click', () => { settings[key] = v; save('superbots.settings', settings); audio.ui(); renderSettings(); renderLobby(); });
      seg.appendChild(b);
    }
    d.innerHTML = `<label>${meta.label}</label>`; d.appendChild(seg); grid.appendChild(d);
  }
  const pre = $('presets'); pre.innerHTML = '';
  for (const [id, p] of Object.entries(PRESETS)) {
    const b = document.createElement('button'); b.className = 'btn small'; b.textContent = p.name;
    b.addEventListener('click', () => { Object.assign(settings, p.patch); save('superbots.settings', settings); audio.ui(); renderSettings(); renderLobby(); });
    pre.appendChild(b);
  }
  const pool = $('pool-grid'); pool.innerHTML = '';
  for (const id of POWERUP_IDS) {
    const l = document.createElement('label');
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = settings.powerupPool[id] !== false;
    cb.addEventListener('change', () => { settings.powerupPool[id] = cb.checked; save('superbots.settings', settings); });
    l.appendChild(cb); l.appendChild(document.createTextNode(POWERUPS[id].name)); pool.appendChild(l);
  }
}
function renderLobby() {
  // slots
  const box = $('slots'); box.innerHTML = '';
  const teams = settings.mode === 'teams';
  slots.forEach((s, i) => {
    const d = document.createElement('div'); d.className = 'slot' + (s.isAI ? '' : ' me');
    d.innerHTML = `<span class="num">${i + 1}</span>`;
    const name = document.createElement('input'); name.value = s.name; name.maxLength = 12; name.placeholder = 'Name';
    name.addEventListener('change', () => { s.name = name.value.trim() || (s.isAI ? AI_NAMES[i] : 'You'); persistSlots(); });
    d.appendChild(name);
    if (s.isAI) {
      const sel = document.createElement('select');
      sel.innerHTML = `<option value="random">Random bot</option>` + BOT_IDS.map((id) => `<option value="${id}" ${s.botId === id ? 'selected' : ''}>${BOTS[id].name}</option>`).join('');
      sel.value = s.botId || 'random';
      sel.addEventListener('change', () => { s.botId = sel.value; persistSlots(); });
      d.appendChild(sel);
    } else {
      const span = document.createElement('span'); span.style.flex = '1'; span.style.fontSize = '13px'; span.innerHTML = `plays <b style="color:${BOTS[s.botId].color}">${BOTS[s.botId].name}</b>`;
      d.appendChild(span);
    }
    if (teams) {
      const t = document.createElement('button'); t.className = 'team'; t.style.background = TEAM_COLORS[s.team % 4]; t.textContent = String((s.team % 4) + 1); t.title = TEAM_NAMES[s.team % 4];
      t.addEventListener('click', () => { s.team = (s.team + 1) % Math.min(4, Math.max(2, Math.floor(slots.length / 2))); persistSlots(); renderLobby(); });
      d.appendChild(t);
    }
    if (s.isAI) { const rm = document.createElement('button'); rm.className = 'rm'; rm.textContent = '✕'; rm.addEventListener('click', () => { slots.splice(i, 1); persistSlots(); renderLobby(); }); d.appendChild(rm); }
    box.appendChild(d);
  });
  $('btn-add-ai').disabled = slots.length >= 8;
  // your bot cards
  const cards = $('bot-cards'); cards.innerHTML = '';
  for (const id of BOT_IDS) {
    const c = botCard(BOTS[id], true);
    c.classList.toggle('on', slots[0].botId === id);
    c.addEventListener('click', () => { slots[0].botId = id; prefs.botId = id; save('superbots.prefs', prefs); persistSlots(); audio.init(); audio.ui(); renderLobby(); });
    cards.appendChild(c);
  }
  // maps
  const ml = $('map-list'); ml.innerHTML = '';
  const ok = mapsForPlayers(slots.length);
  const mk = (id, label, sub, enabled) => { const b = document.createElement('button'); b.innerHTML = `${label}<small>${sub}</small>`; b.disabled = !enabled; b.classList.toggle('on', settings.map === id); b.addEventListener('click', () => { settings.map = id; save('superbots.settings', settings); audio.ui(); renderLobby(); }); ml.appendChild(b); };
  mk('random', 'Random', 'any eligible', true);
  for (const id of MAP_IDS) { const m = MAPS[id]; mk(id, m.name, `${m.size === 'battle' ? 'Battle' : 'Standard'} · ${m.theme} · ${m.minPlayers}-${m.maxPlayers}p`, ok.includes(id)); }
  if (settings.map !== 'random' && !ok.includes(settings.map)) settings.map = 'random';
  $('map-blurb').textContent = settings.map === 'random' ? 'A random map that fits the player count.' : MAPS[settings.map].blurb;
}
function persistSlots() { prefs.slots = slots; prefs.name = slots[0].name; save('superbots.prefs', prefs); }
$('btn-add-ai').addEventListener('click', () => { if (slots.length < 8) { slots.push({ name: AI_NAMES[slots.length % AI_NAMES.length], botId: 'random', team: slots.length % 2, isAI: true }); persistSlots(); renderLobby(); audio.ui(); } });
$('btn-fill').addEventListener('click', () => { while (slots.length < 8) slots.push({ name: AI_NAMES[slots.length % AI_NAMES.length], botId: 'random', team: slots.length % 2, isAI: true }); persistSlots(); renderLobby(); audio.ui(); });
renderSettings();

// ---------- match lifecycle ----------
function startMatch(players, sets, seed) {
  audio.init(); audio.resume();
  lastSetup = { players: players.map((p) => ({ ...p })), sets: { ...sets }, seed };
  const roster = players.map((p) => ({ ...p, botId: p.botId === 'random' ? undefined : p.botId }));
  currentMatch = new Match(roster, sets, seed ?? Date.now());
  paused = false;
  showScreen(null);
  game.startMatch(currentMatch);
  return currentMatch;
}
$('btn-start').addEventListener('click', () => {
  if (settings.mode === 'teams' && new Set(slots.map((s) => s.team)).size < 2) { alert('Teams mode needs at least two different teams.'); return; }
  startMatch(slots, settings);
});
$('btn-quick').addEventListener('click', () => {
  const enemy = BOT_IDS[Math.floor(Math.random() * BOT_IDS.length)];
  const std = MAP_IDS.filter((id) => MAPS[id].size === 'standard');
  startMatch([{ name: prefs.name || 'You', botId: prefs.botId || 'volt', team: 0, isAI: false }, { name: AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)], botId: enemy, team: 1, isAI: true }],
    { ...settings, mode: 'ffa', map: std[Math.floor(Math.random() * std.length)] });
});
$('btn-rematch').addEventListener('click', () => { if (lastSetup) startMatch(lastSetup.players, lastSetup.sets); });
$('btn-resume').addEventListener('click', () => { paused = false; showScreen(null); audio.ui(); });
$('btn-quit').addEventListener('click', () => { game.stop(); currentMatch = null; paused = false; showScreen('menu-main'); });

function onMatchOver(m) {
  const me = m.world.bots.find((b) => b.human);
  const won = me && m.winner && m.winner.ids.includes(me.id);
  record.games++; if (me) { if (won) record.wins++; else record.losses++; }
  save('superbots.record', record);
  $('result-title').textContent = m.winner.type === 'draw' ? 'DRAW' : (won ? 'VICTORY' : (me ? 'DEFEAT' : 'GAME OVER'));
  $('result-title').className = won ? 'win' : 'lose';
  const winnerNames = m.winner.ids.map((id) => m.world.bots[id].name).join(', ');
  $('result-sub').textContent = `${m.winner.type === 'team' ? TEAM_NAMES[m.winner.team % 4] + ' team' : winnerNames} · ${m.map.name} · ${m.turn} turns${m.winner.byCap ? ' · turn cap' : ''}`;
  const rows = m.world.bots.map((b) => `<tr class="${m.winner.ids.includes(b.id) ? 'winner' : ''}"><td>${b.name}${b.human ? ' (you)' : ''}</td><td>${b.def.name}</td><td>${Math.ceil(b.hp)}</td><td>${b.stats.dealt}</td><td>${b.stats.taken}</td><td>${b.stats.kills}</td><td>${b.stats.specials}</td><td>${b.alive ? '—' : b.diedTurn}</td></tr>`).join('');
  $('result-table').innerHTML = `<table><tr><th>Player</th><th>Bot</th><th>HP</th><th>Dealt</th><th>Taken</th><th>KOs</th><th>Specials</th><th>Died</th></tr>${rows}</table>`;
  game.stop(); currentMatch = null;
  showScreen('menu-result');
}
function renderRecord() {
  $('record').textContent = record.games ? `RECORD ${record.wins}W – ${record.losses}L over ${record.games} games` : 'No matches played yet.';
}

// PWA service worker (optional; ignored when unsupported or on file://)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
showScreen('menu-main');
