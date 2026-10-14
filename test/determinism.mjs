// Determinism gate. Online play depends on every client and the server producing the
// same match from the same seed and action list, so this must never fail.
//  1. The same seed run twice in one process produces an identical event log.
//  2. The same seed run in two fresh Node processes produces the same hash
//     (catches module-level state and iteration-order leaks).
//  3. src/core and src/ai never read the wall clock or Math.random.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Match } from '../src/core/match.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAP_IDS } from '../src/core/maps.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] || 12);

export function matchHash(i) {
  const n = 2 + (i % 7);
  const players = Array.from({ length: n }, (_, k) => ({ name: 'P' + k, botId: BOT_IDS[(i * 5 + k * 3) % BOT_IDS.length], team: k % 2, isAI: true }));
  const settings = { mode: i % 2 && n % 2 === 0 ? 'teams' : 'ffa', map: MAP_IDS[i % MAP_IDS.length], aiDifficulty: ['easy', 'normal', 'hard'][i % 3], powerups: 'high', airStrikes: 'normal' };
  const r = Match.simulateHeadless(players, settings, 777 + i * 31);
  return createHash('sha256').update(JSON.stringify({ w: r.winner, t: r.turns, b: r.bots, l: r.log })).digest('hex').slice(0, 16);
}

if (process.argv[2] === '--child') {
  const hashes = [];
  for (let i = 0; i < Number(process.argv[3]); i++) hashes.push(matchHash(i));
  process.stdout.write(hashes.join(','));
  process.exit(0);
}

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };

const a = [], b = [];
for (let i = 0; i < N; i++) { a.push(matchHash(i)); b.push(matchHash(i)); }
ok(a.join() === b.join(), `same process: ${N} matches replay identically`);

const self = fileURLToPath(import.meta.url);
const p1 = execFileSync(process.execPath, [self, '--child', String(N)]).toString();
const p2 = execFileSync(process.execPath, [self, '--child', String(N)]).toString();
ok(p1 === p2 && p1 === a.join(','), `fresh processes: ${N} matches hash identically`);

const banned = /\bMath\.random\s*\(|\bDate\.now\s*\(|\bperformance\.now\s*\(|\bnew Date\s*\(/;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
const offenders = [];
for (const f of [...walk(join(root, 'src/core')), ...walk(join(root, 'src/ai'))]) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    // Match's constructor may default its seed from the clock; every caller that matters passes a seed.
    if (banned.test(line) && !/seed\s*=\s*Date\.now\(\)/.test(line) && !/determinism-ok/.test(line)) offenders.push(`${f.replace(root + '/', '')}:${i + 1}: ${line.trim()}`);
  });
}
ok(!offenders.length, 'src/core and src/ai never read the clock or Math.random' + (offenders.length ? '\n     ' + offenders.join('\n     ') : ''));

if (fail) { console.log(`\n${fail} determinism check(s) failed`); process.exit(1); }
console.log('\nall determinism checks passed');
