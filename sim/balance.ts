import { botRun, type RunOutcome } from './bot';

const N = Number(process.argv[2] ?? 400);
const desks = (process.argv[3] ?? 'intern,quant,degen,maker').split(',');
const skills = (process.argv[4] ?? '0.9,0.6').split(',').map(Number);

for (const skill of skills) {
  for (const desk of desks) {
    const outs: RunOutcome[] = [];
    for (let k = 0; k < N; k++) outs.push(botRun(desk, 1000 + k * 7919, skill));
    const wins = outs.filter((o) => o.win).length;
    const reachY2 = outs.filter((o) => o.quarters >= 4).length;
    const reachY3 = outs.filter((o) => o.quarters >= 8).length;
    const avgQ = outs.reduce((a, o) => a + o.quarters, 0) / N;
    const med = (arr: number[]) => {
      const a = [...arr].sort((x, y) => x - y);
      return a.length ? a[Math.floor(a.length / 2)].toFixed(2) : '-';
    };
    const yr = [0, 1, 2].map((y) => med(outs.flatMap((o) => o.ratios[y])));
    const perQ = Array.from({ length: 12 }, (_, q) => med(outs.map((o) => o.pnls[q]).filter((x) => x !== undefined)));
    const failQ = Array.from({ length: 12 }, (_, q) => outs.filter((o) => !o.win && o.pnls.length - 1 === q).length);
    console.log(`   medianPnL by quarter: ${perQ.join(' ')}`);
    console.log(`   avg margin calls ${(outs.reduce((a, o) => a + o.margins, 0) / N).toFixed(2)} avg sessions lost ${(outs.reduce((a, o) => a + o.lost, 0) / N).toFixed(2)}`);
    console.log(`   runs ending at quarter: ${failQ.join(' ')}`);
    console.log(
      `skill=${skill} desk=${desk.padEnd(6)} win=${((wins / N) * 100).toFixed(1)}% reachY2=${((reachY2 / N) * 100).toFixed(0)}% reachY3=${((reachY3 / N) * 100).toFixed(0)}% avgQuartersWon=${avgQ.toFixed(1)} medianPnL/quota Y1=${yr[0]} Y2=${yr[1]} Y3=${yr[2]}`,
    );
  }
}
