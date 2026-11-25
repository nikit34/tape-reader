**Tape Reader**

A market roguelite deckbuilder that runs in the browser. You run a small trading fund: each quarter you trade one stock for 8 bars, play order, intel and tactic cards, and must finish above the quota. Survive 3 years of 4 quarters, with a boss every fourth quarter, and your fund goes public.

- Play: https://nikit34.github.io/tape-reader/
- One-pager (RU): https://nikit34.github.io/tape-reader/onepager.html
- Production plan (RU): https://nikit34.github.io/tape-reader/plan.html

**Run locally**

```bash
npm install
npm run dev
```

**Build**

```bash
npm run build
```

The static site lands in `dist/`.

**Balance simulator**

The game logic in `src/engine` has no UI dependencies, so a heuristic bot can play thousands of runs headless:

```bash
npm run sim -- 500 intern,quant,degen,maker 0.9,0.6
```

It prints the win rate, how far runs get, and the median P&L to quota ratio per year for every starting desk.

**Stack**

TypeScript, Preact, Canvas 2D, Web Audio, Vite. No external assets: the chart, icons and sounds are generated in code.
