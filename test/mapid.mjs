// M0-08: a map id missing from MAPS is an error, not a silent random map.
// Known maps and 'random' behave as before, including the battle-map fallback
// for a known map that cannot seat the roster. The server never forwards a bad id.
// Usage: node test/mapid.mjs

import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Match } from '../src/core/match.js';
import { MAPS, MAP_IDS } from '../src/core/maps.js';
import { sanitizeSettings } from '../server/hub.js';

let fails = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails++; };
const duel = [{ name: 'A', botId: 'phantom', team: 0, isAI: true }, { name: 'B', botId: 'volt', team: 1, isAI: true }];
const eight = Array.from({ length: 8 }, (_, i) => ({ name: `P${i}`, botId: 'volt', team: i % 2, isAI: true }));
const throwsFor = (map, players = duel) => { try { new Match(players, { map }, 7); return null; } catch (e) { return e; } };

// 1. Unknown ids throw, and the message lists every valid id.
for (const bad of ['nosuchmap', 'frosthollow', 'constructor', '__proto__', 'toString', '', 'Emberpit', 42, null]) {
  const e = throwsFor(bad);
  ok(e instanceof Error, `Match throws for map ${JSON.stringify(bad)}`);
  if (e) ok(MAP_IDS.every((id) => e.message.includes(id)) && e.message.includes('random'), `  message lists valid ids: ${e.message}`);
}

// 2. Known ids and 'random' still construct; a known map is used when it seats the roster.
for (const id of MAP_IDS) {
  const e = throwsFor(id);
  ok(!e, `Match accepts known map ${id}`);
  if (!e) ok(new Match(duel, { map: id }, 7).map.id === id, `  duel plays on ${id}`);
}
ok(!throwsFor('random'), "Match accepts 'random'");
ok(MAP_IDS.includes(new Match(duel, { map: 'random' }, 7).map.id), "'random' picks a real map");
ok(new Match(duel, {}, 7).map && MAP_IDS.includes(new Match(duel, {}, 7).map.id), 'default settings (map random) still construct');

// 3. A known map that cannot seat the roster keeps falling back to an eligible map (bughunt/headless rely on this).
for (const id of MAP_IDS.filter((m) => MAPS[m].maxPlayers < 8)) {
  const e = throwsFor(id, eight);
  ok(!e, `8 players on ${id} do not throw`);
  if (!e) { const m = new Match(eight, { map: id }, 7); ok(m.map.id !== id && m.map.maxPlayers >= 8, `  8 players on ${id} fall back to ${m.map.id}`); }
}

// 4. 'random' is still deterministic for a seed (no extra rng draw was added).
ok(new Match(duel, { map: 'random' }, 123).map.id === new Match(duel, { map: 'random' }, 123).map.id, "'random' is seed-stable");

// 5. trace.mjs exits non-zero for an unknown id and prints the valid ids.
const trace = join(dirname(fileURLToPath(import.meta.url)), 'trace.mjs');
const r = spawnSync(process.execPath, [trace, 'phantom', 'volt', 'nosuchmap', '7', 'hard'], { encoding: 'utf8' });
const out = (r.stdout || '') + (r.stderr || '');
ok(r.status !== 0, `trace.mjs nosuchmap exits non-zero (status ${r.status})`);
ok(MAP_IDS.every((id) => out.includes(id)), 'trace.mjs nosuchmap output lists the valid map ids');
ok(!out.includes('WINNER'), 'trace.mjs nosuchmap does not play a match');
const good = spawnSync(process.execPath, [trace, 'phantom', 'volt', 'frozenkeel', '7', 'hard'], { encoding: 'utf8' });
ok(good.status === 0 && good.stdout.includes('WINNER'), 'trace.mjs frozenkeel still runs to a winner');

// 6. The server sanitizer never lets an unknown id reach Match.
for (const bad of ['nosuchmap', 'frosthollow', 'constructor', '__proto__', 42, null, {}]) {
  const s = sanitizeSettings({ map: bad });
  ok(s.map === 'random', `sanitizeSettings(map ${JSON.stringify(bad)}) -> ${JSON.stringify(s.map)}`);
  ok(!throwsFor(s.map), '  sanitized settings construct a Match');
}
for (const id of ['random', ...MAP_IDS]) ok(sanitizeSettings({ map: id }).map === id, `sanitizeSettings keeps ${id}`);
ok(sanitizeSettings({ ...sanitizeSettings({ map: 'nimbus' }), map: 'nosuchmap' }).map === 'random', 'a bad lobby.settings update resets the map to random');

console.log(fails ? `\n${fails} FAILED` : '\nall map-id checks passed');
process.exit(fails ? 1 : 0);
