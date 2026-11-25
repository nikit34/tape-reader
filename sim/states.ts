import { writeFileSync } from 'node:fs';
import { botRun } from './bot';
import type { RunState } from '../src/engine/types';

const want = new Set(['bossreward', 'shop', 'victory', 'gameover', 'briefing']);
const got: Record<string, string> = {};
for (let seed = 1; seed < 400 && Object.keys(got).length < want.size + 1; seed++) {
  botRun('maker', seed * 31, 0.9, (r: RunState) => {
    const key = r.phase === 'briefing' && r.quarter === 3 ? 'bossbrief' : r.phase;
    if ((want.has(r.phase) || key === 'bossbrief') && !got[key] && (r.phase !== 'shop' || r.algos.length >= 4)) got[key] = JSON.stringify(r);
  });
}
writeFileSync(process.argv[2] ?? 'states.json', JSON.stringify(got));
console.log(Object.keys(got));
