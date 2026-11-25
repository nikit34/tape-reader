import type { Dir, FxKind, RunState, SessionState, Trade } from './types';
import { clamp, rnd, shuffle } from './rng';

export function hasAlgo(run: RunState, id: string): boolean {
  return run.algos.includes(id);
}

export function fx(run: RunState, kind: FxKind, text: string, value?: number): void {
  run.fx.push({ kind, text, value });
  if (run.fx.length > 80) run.fx.splice(0, run.fx.length - 80);
}

export function effMove(s: SessionState, i: number): number {
  let m = s.plan[i] ?? 0;
  for (const n of s.news) if (n.bar === i) m += n.move;
  if (i === s.bar) m += s.nextBarBonus;
  if (s.mods.cap) m = clamp(m, -s.mods.cap, s.mods.cap);
  return m;
}

export function shownMove(s: SessionState, i: number): number {
  let m = s.plan[i] ?? 0;
  for (const n of s.news) if (n.bar === i && n.known && isNewsVisibleAt(s, n)) m += n.move;
  if (i === s.bar) m += s.nextBarBonus;
  if (s.mods.cap) m = clamp(m, -s.mods.cap, s.mods.cap);
  return m;
}

export function hiddenHeadline(s: SessionState, i: number): boolean {
  return s.news.some((n) => n.bar === i && (!n.known || !isNewsVisibleAt(s, n)));
}

export function isNewsVisibleAt(s: SessionState, n: { bar: number; swan?: boolean }): boolean {
  return !n.swan || s.bar >= n.bar - 1;
}

export function currentTrend(s: SessionState): number {
  return s.bar < s.bars ? s.trend[s.bar] : 0;
}

export function lastMoveDir(s: SessionState): number {
  const c = s.candles.length ? s.candles[s.candles.length - 1] : s.pre[s.pre.length - 1];
  return c ? Math.sign(c.c - c.o) : 0;
}

export function tradePnl(s: SessionState, t: Trade): number {
  if (t.kind === 'straddle') return Math.abs(s.price - t.entry) * t.size - t.premium;
  return (s.price - t.entry) * t.dir * t.size;
}

export function unrealized(s: SessionState): number {
  let sum = 0;
  for (const t of s.trades) sum += tradePnl(s, t);
  return sum;
}

export function equity(s: SessionState): number {
  return s.realized + unrealized(s);
}

export function tradeLabel(t: Trade): string {
  if (t.kind === 'straddle') return `STRADDLE ${t.size}`;
  return `${t.dir > 0 ? 'LONG' : 'SHORT'} ${t.size}`;
}

export function gainPnl(run: RunState, s: SessionState, v: number, why: string): void {
  if (!v) return;
  s.realized += v;
  fx(run, 'pnl', why, v);
}

export function addHeat(run: RunState, s: SessionState, h: number): void {
  let v = h;
  if (s.mods.heatMult) v *= s.mods.heatMult;
  if (hasAlgo(run, 'pr_dept')) v = Math.floor(v / 2);
  if (v <= 0) return;
  run.heat += v;
  s.heatGained += v;
  fx(run, 'heat', `+${v} Heat`, v);
}

export interface OpenOpts {
  source: string;
  kind?: 'dir' | 'straddle';
  premium?: number;
  free?: boolean;
  exact?: boolean;
}

export function effectiveSize(run: RunState, s: SessionState, dir: Dir, size: number, kind: 'dir' | 'straddle', leveraged: boolean): number {
  let sz = leveraged ? size * 2 : size;
  const tr = currentTrend(s);
  if (kind === 'dir' && tr !== 0 && Math.sign(tr) === dir) {
    if (hasAlgo(run, 'trend_follower')) sz += 1;
    if (s.powers.momentum) sz += s.powers.momentum;
  }
  return sz;
}

export function openTrade(run: RunState, s: SessionState, dir: Dir, size: number, bars: number, opt: OpenOpts): Trade {
  const kind = opt.kind ?? 'dir';
  const leveraged = !opt.free && !opt.exact && s.leverage > 0;
  if (leveraged) s.leverage -= 1;
  const sz = opt.exact ? size : effectiveSize(run, s, dir, size, kind, leveraged);
  const t: Trade = {
    id: s.nextTradeId++,
    dir,
    size: sz,
    entry: s.price,
    barsLeft: bars + (s.mods.extraBars ?? 0),
    kind,
    premium: opt.premium ?? 0,
    source: opt.source,
    openedAt: s.bar,
  };
  s.trades.push(t);
  fx(run, 'open', `${tradeLabel(t)} opened`, kind === 'straddle' ? 0 : dir * sz);
  if (!opt.free) {
    if (hasAlgo(run, 'spread_bot')) gainPnl(run, s, 1, 'Spread Bot');
    if (hasAlgo(run, 'copy_trader') && rnd(run.rng) < 0.3) {
      openTrade(run, s, dir, Math.ceil(sz / 2), bars, { ...opt, source: 'Copy Trader', free: true, exact: true });
    }
  }
  return t;
}

export function closeTrade(run: RunState, s: SessionState, t: Trade, reason: string, mult = 1): number {
  let pnl = tradePnl(s, t);
  if (pnl > 0) {
    let m = mult + s.multBonus;
    if (hasAlgo(run, 'dark_pool') && t.size >= 4) m += 0.25;
    pnl = Math.round(pnl * m) + (s.powers.compound ?? 0);
    if (hasAlgo(run, 'compounder')) s.multBonus += 0.05;
  }
  s.realized += pnl;
  const idx = s.trades.indexOf(t);
  if (idx >= 0) s.trades.splice(idx, 1);
  if (pnl > s.bestTrade) s.bestTrade = pnl;
  fx(run, 'close', `${tradeLabel(t)} closed: ${reason}`, pnl);
  return pnl;
}

export function reveal(s: SessionState, i: number): void {
  if (i >= 0 && i < s.bars && !s.revealed.includes(i)) s.revealed.push(i);
}

export function drawCards(run: RunState, s: SessionState, n: number): void {
  for (let k = 0; k < n; k++) {
    if (s.hand.length >= 10) break;
    if (!s.draw.length) {
      if (!s.discard.length) break;
      s.draw = shuffle(run.rng, s.discard);
      s.discard = [];
    }
    const c = s.draw.pop();
    if (c) s.hand.push(c);
  }
}
