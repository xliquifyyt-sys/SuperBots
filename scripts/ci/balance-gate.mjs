// Balance gate: fails if any bot leaves the allowed band in the 1v1 round robin.
// Band starts wide (the current spread) and is tightened by milestone M3 to the
// GDD target of 40-60%. Changing the band is a protected edit (scripts/ci/).
import { execFileSync } from 'node:child_process';
const LOW = Number(process.env.BAL_LOW || 10), HIGH = Number(process.env.BAL_HIGH || 80);
const seeds = process.argv[2] || '2';
const out = execFileSync(process.execPath, ['test/balance.mjs', seeds], { maxBuffer: 1 << 24 }).toString();
console.log(out);
let bad = 0;
for (const m of out.matchAll(/^(\w+)\s+winrate\s+(\d+)%/gm)) {
  const wr = Number(m[2]);
  if (wr < LOW || wr > HIGH) { console.log(`balance: ${m[1]} at ${wr}% is outside ${LOW}-${HIGH}%`); bad++; }
}
process.exit(bad ? 1 : 0);
