import { BOT_CLASSES, DIFFICULTY } from './config.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { audio } from './audio.js';

const $ = (id) => document.getElementById(id);

// ---------- Persistence ----------
const SETTINGS_KEY = 'superbots.settings';
const RECORD_KEY = 'superbots.record';
const load = (k, d) => { try { return { ...d, ...(JSON.parse(localStorage.getItem(k) || '{}')) }; } catch { return { ...d }; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

const settings = load(SETTINGS_KEY, { sensitivity: 1, volume: 0.7, music: true, shadows: true, playerClass: 'striker', enemyClass: 'random', difficulty: 'normal' });
let record = load(RECORD_KEY, { wins: 0, losses: 0, byDifficulty: {} });

// ---------- Setup ----------
const canvas = $('game');
let game;
try {
  const input = new Input(canvas);
  input.sensitivity = settings.sensitivity;
  game = new Game(canvas, input, {
    onPause: () => showScreen('menu-pause'),
    onMatchEnd: (r) => onMatchEnd(r),
    onRoundEnd: () => {},
  });
  game.renderer.shadowMap.enabled = settings.shadows;
  input.onEscape = () => { if (game.running && !game.paused) game.pause(); };
  input.onLockChange = (locked) => {
    if (!locked && game.running && !game.paused && game.state !== 'matchEnd') {
      // Lost pointer lock without Esc (e.g. alt-tab). Show a click-to-recapture overlay.
      game.pause();
    }
  };
  window.__superbots = { game, input }; // exposed for debugging / automated smoke tests
} catch (err) {
  console.error(err);
  $('ui').classList.add('hidden');
  $('webgl-error').classList.remove('hidden');
}

// ---------- Screens ----------
const screens = ['menu-main', 'menu-select', 'menu-help', 'menu-settings', 'menu-pause', 'menu-result', 'menu-capture'];
function showScreen(id) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== id);
  $('ui').classList.toggle('hidden', !id);
  if (id === 'menu-main') renderRecord();
}
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { audio.init(); audio.ui(); showScreen(b.dataset.go); }));

// ---------- Bot select ----------
const cardsEl = $('bot-cards');
function statBar(label, v, max) {
  return `<div class="stat"><span>${label}</span><i style="width:${Math.round((v / max) * 120)}px"></i></div>`;
}
for (const cls of Object.values(BOT_CLASSES)) {
  const dps = Math.round(cls.weapon.damage / cls.weapon.cooldown + (cls.weapon.splashDamage || 0) / cls.weapon.cooldown * 0.5);
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.cls = cls.id;
  card.style.setProperty('--card-color', '#' + cls.color.toString(16).padStart(6, '0'));
  card.innerHTML = `
    <h3>${cls.name.toUpperCase()}</h3>
    <div class="tag">${cls.tagline}</div>
    ${statBar('ARMOR', cls.maxHp, 180)}
    ${statBar('SPEED', cls.speed, 14)}
    ${statBar('DPS', dps, 80)}
    <div class="skill"><b>${cls.weapon.name}</b> · ${cls.weapon.damage} dmg</div>
    <div class="skill"><b>${cls.ability.name}</b> (${cls.ability.cost}⚡) · ${cls.ability.desc}</div>
    <div class="skill"><b>${cls.special.name}</b> (${cls.special.cost}⚡) · ${cls.special.desc}</div>`;
  card.addEventListener('click', () => { settings.playerClass = cls.id; save(SETTINGS_KEY, settings); refreshSelect(); audio.init(); audio.ui(); });
  cardsEl.appendChild(card);
}
function segSetup(id, attr, key) {
  $(id).querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    settings[key] = b.dataset[attr]; save(SETTINGS_KEY, settings); refreshSelect(); audio.init(); audio.ui();
  }));
}
segSetup('enemy-seg', 'enemy', 'enemyClass');
segSetup('diff-seg', 'diff', 'difficulty');
function refreshSelect() {
  cardsEl.querySelectorAll('.card').forEach((c) => c.classList.toggle('on', c.dataset.cls === settings.playerClass));
  $('enemy-seg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.enemy === settings.enemyClass));
  $('diff-seg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.diff === settings.difficulty));
}
refreshSelect();

// ---------- Match flow ----------
let lastMatch = null;
function startMatch() {
  if (!game) return;
  audio.init(); audio.resume();
  if (settings.music) audio.startMusic();
  const ids = Object.keys(BOT_CLASSES);
  const enemy = settings.enemyClass === 'random' ? ids[Math.floor(Math.random() * ids.length)] : settings.enemyClass;
  lastMatch = { player: settings.playerClass, enemy, diff: settings.difficulty };
  showScreen(null);
  game.startMatch(lastMatch.player, lastMatch.enemy, DIFFICULTY[lastMatch.diff]);
  game.input.lock();
}
$('btn-start').addEventListener('click', startMatch);
$('btn-rematch').addEventListener('click', () => { if (lastMatch) { settings.enemyClass === 'random' && (lastMatch = null); startMatch(); } else startMatch(); });

$('btn-resume').addEventListener('click', () => { showScreen(null); game.resume(); });
$('btn-quit').addEventListener('click', () => { game.quitMatch(); audio.stopMusic(); showScreen('menu-main'); });
$('menu-capture').addEventListener('click', () => { showScreen(null); game.resume(); });

function onMatchEnd(r) {
  audio.stopMusic();
  if (r.won) record.wins++; else record.losses++;
  const d = record.byDifficulty[r.difficulty] || { wins: 0, losses: 0 };
  if (r.won) d.wins++; else d.losses++;
  record.byDifficulty[r.difficulty] = d;
  save(RECORD_KEY, record);

  $('result-title').textContent = r.won ? 'VICTORY' : 'DEFEAT';
  $('result-title').className = r.won ? 'win' : 'lose';
  $('result-sub').textContent = `${r.playerClass} vs ${r.enemyClass} (${r.difficulty}) · ${r.score.p} – ${r.score.e} in ${r.rounds} rounds`;
  const stat = (k, v) => `<div><div class="v">${v}</div><div class="k">${k}</div></div>`;
  $('result-stats').innerHTML =
    stat('DAMAGE DEALT', r.damageDealt) + stat('DAMAGE TAKEN', r.damageTaken) + stat('ACCURACY', r.accuracy + '%') +
    stat('ABILITIES', r.abilities) + stat('DURATION', r.duration + 's') + stat('RECORD', `${record.wins}W ${record.losses}L`);
  showScreen('menu-result');
}

function renderRecord() {
  const el = $('record');
  if (record.wins + record.losses === 0) { el.textContent = 'No matches played yet.'; return; }
  const parts = Object.entries(record.byDifficulty).map(([k, v]) => `${k}: ${v.wins}W/${v.losses}L`);
  el.textContent = `RECORD  ${record.wins}W – ${record.losses}L   (${parts.join(' · ')})`;
}

// ---------- Settings ----------
const sens = $('sens'), vol = $('vol'), music = $('music'), shadows = $('shadows');
sens.value = settings.sensitivity; $('sens-val').textContent = Number(settings.sensitivity).toFixed(1);
vol.value = settings.volume; $('vol-val').textContent = Math.round(settings.volume * 100) + '%';
music.checked = settings.music; shadows.checked = settings.shadows;
sens.addEventListener('input', () => { settings.sensitivity = +sens.value; $('sens-val').textContent = settings.sensitivity.toFixed(1); if (game) game.input.sensitivity = settings.sensitivity; save(SETTINGS_KEY, settings); });
vol.addEventListener('input', () => { settings.volume = +vol.value; $('vol-val').textContent = Math.round(settings.volume * 100) + '%'; audio.init(); audio.setVolume(settings.volume); save(SETTINGS_KEY, settings); });
music.addEventListener('change', () => { settings.music = music.checked; save(SETTINGS_KEY, settings); });
shadows.addEventListener('change', () => { settings.shadows = shadows.checked; if (game) { game.renderer.shadowMap.enabled = settings.shadows; game.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); } save(SETTINGS_KEY, settings); });
$('btn-reset-record').addEventListener('click', () => { record = { wins: 0, losses: 0, byDifficulty: {} }; save(RECORD_KEY, record); renderRecord(); audio.ui(); });
audio.setVolume(settings.volume);

showScreen('menu-main');
