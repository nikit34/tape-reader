import type { CardType, Dir, Rarity, RunState, SessionState } from '../types';
import {
  closeTrade,
  currentTrend,
  drawCards,
  shownMove,
  fx,
  gainPnl,
  lastMoveDir,
  openTrade,
  reveal,
  tradePnl,
} from '../ops';

export type Params = Record<string, number>;

export interface PlayCtx {
  run: RunState;
  s: SessionState;
  p: Params;
  paid: number;
}

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  rarity: Rarity;
  cost: number;
  costUp?: number;
  heat?: number;
  heatUp?: number;
  exhaust?: boolean;
  needsTrade?: boolean;
  p: Params;
  pUp: Params;
  icon: string;
  text: (p: Params) => string;
  play: (c: PlayCtx) => void;
}

function dirOrder(id: string, name: string, dir: Dir, rarity: Rarity, cost: number, p: Params, pUp: Params, icon: string, extra: Partial<CardDef> = {}): CardDef {
  const side = dir > 0 ? 'LONG' : 'SHORT';
  return {
    id,
    name,
    type: 'order',
    rarity,
    cost,
    p,
    pUp,
    icon,
    text: (q) => `Open a ${side} trade: size ${q.size}, ${q.bars} bar${q.bars > 1 ? 's' : ''}.`,
    play: ({ run, s, p: q }) => {
      openTrade(run, s, dir, q.size, q.bars, { source: name });
    },
    ...extra,
  };
}

const LIST: CardDef[] = [
  dirOrder('buy', 'Buy', 1, 'starter', 1, { size: 1, bars: 3 }, { size: 2, bars: 3 }, 'up'),
  dirOrder('sell', 'Sell Short', -1, 'starter', 1, { size: 1, bars: 3 }, { size: 2, bars: 3 }, 'down'),
  dirOrder('scalp_long', 'Scalp Long', 1, 'common', 0, { size: 1, bars: 1 }, { size: 2, bars: 1 }, 'upfast'),
  dirOrder('scalp_short', 'Scalp Short', -1, 'common', 0, { size: 1, bars: 1 }, { size: 2, bars: 1 }, 'downfast'),
  dirOrder('swing_long', 'Swing Long', 1, 'common', 2, { size: 3, bars: 5 }, { size: 4, bars: 5 }, 'uplong'),
  dirOrder('swing_short', 'Swing Short', -1, 'common', 2, { size: 3, bars: 5 }, { size: 4, bars: 5 }, 'downlong'),
  dirOrder('yolo', 'YOLO Calls', 1, 'rare', 1, { size: 5, bars: 2 }, { size: 7, bars: 2 }, 'rocket', { type: 'shady', heat: 3 }),
  dirOrder('doom', 'Doom Puts', -1, 'rare', 1, { size: 5, bars: 2 }, { size: 7, bars: 2 }, 'skull', { type: 'shady', heat: 3 }),
  {
    id: 'ride',
    name: 'Ride the Trend',
    type: 'order',
    rarity: 'common',
    cost: 1,
    p: { size: 2, bars: 3 },
    pUp: { size: 3, bars: 3 },
    icon: 'wave',
    text: (q) => `Open a trade with the Lean: size ${q.size}, ${q.bars} bars. Flat Lean: refund Focus.`,
    play: ({ run, s, p, paid }) => {
      const tr = currentTrend(s);
      if (tr === 0) {
        s.focus += paid;
        fx(run, 'info', 'Flat trend: Focus refunded');
        return;
      }
      openTrade(run, s, tr > 0 ? 1 : -1, p.size, p.bars, { source: 'Ride the Trend' });
    },
  },
  {
    id: 'fade',
    name: 'Fade the Move',
    type: 'order',
    rarity: 'common',
    cost: 1,
    p: { size: 2, bars: 2 },
    pUp: { size: 3, bars: 2 },
    icon: 'fade',
    text: (q) => `Open a trade against the last bar: size ${q.size}, ${q.bars} bars. Flat bar: refund Focus.`,
    play: ({ run, s, p, paid }) => {
      const d = lastMoveDir(s);
      if (d === 0) {
        s.focus += paid;
        fx(run, 'info', 'Last bar was flat: Focus refunded');
        return;
      }
      openTrade(run, s, d > 0 ? -1 : 1, p.size, p.bars, { source: 'Fade the Move' });
    },
  },
  {
    id: 'straddle',
    name: 'Straddle',
    type: 'order',
    rarity: 'uncommon',
    cost: 1,
    p: { size: 2, bars: 2, prem: 3 },
    pUp: { size: 3, bars: 2, prem: 3 },
    icon: 'straddle',
    text: (q) => `Profit from a big move either way: ${q.size} per point, minus ${q.prem}. ${q.bars} bars.`,
    play: ({ run, s, p }) => {
      openTrade(run, s, 1, p.size, p.bars, { source: 'Straddle', kind: 'straddle', premium: p.prem });
    },
  },
  {
    id: 'arbitrage',
    name: 'Arbitrage',
    type: 'order',
    rarity: 'uncommon',
    cost: 1,
    p: { gain: 3 },
    pUp: { gain: 5 },
    icon: 'arb',
    text: (q) => `Gain ${q.gain} P&L. No market view needed.`,
    play: ({ run, s, p }) => gainPnl(run, s, p.gain, 'Arbitrage'),
  },
  {
    id: 'read_tape',
    name: 'Read the Tape',
    type: 'intel',
    rarity: 'starter',
    cost: 1,
    costUp: 0,
    p: { draw: 1 },
    pUp: { draw: 1 },
    icon: 'eye',
    text: (q) => `Reveal the market direction of the next bar. Headlines stay hidden. Draw ${q.draw}.`,
    play: ({ run, s, p }) => {
      reveal(s, s.bar);
      drawCards(run, s, p.draw);
    },
  },
  {
    id: 'ta',
    name: 'Technical Analysis',
    type: 'intel',
    rarity: 'uncommon',
    cost: 1,
    p: { n: 3 },
    pUp: { n: 5 },
    icon: 'chart',
    text: (q) => `Reveal the market direction of the next ${q.n} bars. Headlines stay hidden.`,
    play: ({ s, p }) => {
      for (let k = 0; k < p.n; k++) reveal(s, s.bar + k);
    },
  },
  {
    id: 'backtest',
    name: 'Backtest',
    type: 'intel',
    rarity: 'uncommon',
    cost: 1,
    p: { size: 1 },
    pUp: { size: 2 },
    icon: 'replay',
    text: (q) => `Reveal the next bar and open a size ${q.size} trade its way for 1 bar.`,
    play: ({ run, s, p }) => {
      reveal(s, s.bar);
      const m = shownMove(s, s.bar);
      if (m === 0) {
        fx(run, 'info', 'Backtest: the market is flat next bar');
        return;
      }
      openTrade(run, s, m > 0 ? 1 : -1, p.size, 1, { source: 'Backtest' });
    },
  },
  {
    id: 'insider',
    name: 'Insider Whisper',
    type: 'shady',
    rarity: 'uncommon',
    cost: 0,
    heat: 2,
    heatUp: 1,
    exhaust: true,
    p: { draw: 1 },
    pUp: { draw: 2 },
    icon: 'whisper',
    text: (q) => `Reveal every headline's direction. Draw ${q.draw}. Exhaust.`,
    play: ({ run, s, p }) => {
      for (const n of s.news) n.known = true;
      drawCards(run, s, p.draw);
    },
  },
  {
    id: 'research',
    name: 'Research Note',
    type: 'intel',
    rarity: 'common',
    cost: 1,
    costUp: 0,
    p: { draw: 2 },
    pUp: { draw: 2 },
    icon: 'doc',
    text: (q) => `Draw ${q.draw} cards.`,
    play: ({ run, s, p }) => drawCards(run, s, p.draw),
  },
  {
    id: 'espresso',
    name: 'Double Espresso',
    type: 'tactic',
    rarity: 'common',
    cost: 0,
    exhaust: true,
    p: { f: 1 },
    pUp: { f: 2 },
    icon: 'cup',
    text: (q) => `+${q.f} Focus. Exhaust.`,
    play: ({ s, p }) => {
      s.focus += p.f;
    },
  },
  {
    id: 'take_profit',
    name: 'Take Profit',
    type: 'tactic',
    rarity: 'starter',
    cost: 0,
    needsTrade: true,
    p: { pct: 50 },
    pUp: { pct: 100 },
    icon: 'coins',
    text: (q) => `Close your best trade. In profit: +${q.pct}% bonus.`,
    play: ({ run, s, p }) => {
      let best = s.trades[0];
      for (const t of s.trades) if (tradePnl(s, t) > tradePnl(s, best)) best = t;
      if (!best) return;
      const inProfit = tradePnl(s, best) > 0;
      closeTrade(run, s, best, 'Take Profit', inProfit ? 1 + p.pct / 100 : 1);
    },
  },
  {
    id: 'cut_losses',
    name: 'Cut Losses',
    type: 'tactic',
    rarity: 'common',
    cost: 0,
    needsTrade: true,
    p: { pct: 50, draw: 1 },
    pUp: { pct: 75, draw: 1 },
    icon: 'scissors',
    text: (q) => `Close all losing trades, refund ${q.pct}% of the loss. Draw ${q.draw}.`,
    play: ({ run, s, p }) => {
      const losers = s.trades.filter((t) => tradePnl(s, t) < 0);
      let refund = 0;
      for (const t of losers) refund += -closeTrade(run, s, t, 'Cut Losses');
      gainPnl(run, s, Math.round((refund * p.pct) / 100), 'Loss refund');
      drawCards(run, s, p.draw);
    },
  },
  {
    id: 'lock_gains',
    name: 'Lock Gains',
    type: 'tactic',
    rarity: 'uncommon',
    cost: 1,
    needsTrade: true,
    p: { draw: 1 },
    pUp: { draw: 2 },
    icon: 'lock',
    text: (q) => `Close all trades in profit. Draw ${q.draw}.`,
    play: ({ run, s, p }) => {
      for (const t of s.trades.filter((x) => tradePnl(s, x) > 0)) closeTrade(run, s, t, 'Lock Gains');
      drawCards(run, s, p.draw);
    },
  },
  {
    id: 'roll',
    name: 'Roll Over',
    type: 'tactic',
    rarity: 'common',
    cost: 1,
    costUp: 0,
    needsTrade: true,
    p: { n: 2 },
    pUp: { n: 2 },
    icon: 'cycle',
    text: (q) => `All open trades last ${q.n} more bars.`,
    play: ({ s, p }) => {
      for (const t of s.trades) t.barsLeft += p.n;
    },
  },
  {
    id: 'double_down',
    name: 'Double Down',
    type: 'tactic',
    rarity: 'uncommon',
    cost: 1,
    costUp: 0,
    needsTrade: true,
    p: {},
    pUp: {},
    icon: 'double',
    text: () => 'Open a copy of your newest trade at the current price.',
    play: ({ run, s }) => {
      const t = s.trades[s.trades.length - 1];
      if (!t) return;
      openTrade(run, s, t.dir, t.size, Math.max(1, t.barsLeft - (s.mods.extraBars ?? 0)), {
        source: 'Double Down',
        kind: t.kind,
        premium: t.premium,
        exact: true,
      });
    },
  },
  {
    id: 'pyramid',
    name: 'Pyramid',
    type: 'tactic',
    rarity: 'uncommon',
    cost: 1,
    needsTrade: true,
    p: { size: 1 },
    pUp: { size: 2 },
    icon: 'pyramid',
    text: (q) => `Each trade in profit gets a size ${q.size} add-on until it expires.`,
    play: ({ run, s, p }) => {
      const winners = s.trades.filter((t) => t.kind === 'dir' && tradePnl(s, t) > 0);
      for (const t of winners) {
        openTrade(run, s, t.dir, p.size, Math.max(1, t.barsLeft - (s.mods.extraBars ?? 0)), { source: 'Pyramid', free: true, exact: true });
      }
      if (!winners.length) fx(run, 'info', 'Pyramid: no trade in profit');
    },
  },
  {
    id: 'hedge',
    name: 'Hedge',
    type: 'tactic',
    rarity: 'common',
    cost: 1,
    p: { pct: 50 },
    pUp: { pct: 100 },
    icon: 'shield',
    text: (q) => `Next bar, trade losses are cut by ${q.pct}%.`,
    play: ({ s, p }) => {
      s.hedgePct = Math.max(s.hedgePct, p.pct);
    },
  },
  {
    id: 'flip',
    name: 'Flip the Book',
    type: 'tactic',
    rarity: 'uncommon',
    cost: 1,
    costUp: 0,
    needsTrade: true,
    p: { bars: 2 },
    pUp: { bars: 3 },
    icon: 'flip',
    text: (q) => `Reverse every LONG and SHORT. New trades last ${q.bars} bars.`,
    play: ({ run, s, p }) => {
      const dirs = s.trades.filter((t) => t.kind === 'dir');
      for (const t of dirs) {
        closeTrade(run, s, t, 'Flip');
        openTrade(run, s, (t.dir * -1) as Dir, t.size, p.bars, { source: 'Flip', free: true, exact: true });
      }
    },
  },
  {
    id: 'leverage',
    name: 'Leverage',
    type: 'shady',
    rarity: 'common',
    cost: 0,
    heat: 1,
    p: { n: 1 },
    pUp: { n: 2 },
    icon: 'bolt',
    text: (q) => (q.n > 1 ? `Next ${q.n} trades this bar are double size.` : 'Next trade this bar is double size.'),
    play: ({ s, p }) => {
      s.leverage += p.n;
    },
  },
  {
    id: 'pump',
    name: 'Pump It',
    type: 'shady',
    rarity: 'common',
    cost: 1,
    heat: 2,
    p: { m: 3 },
    pUp: { m: 5 },
    icon: 'pump',
    text: (q) => `Next bar moves ${q.m} points higher.`,
    play: ({ s, p }) => {
      s.nextBarBonus += p.m;
    },
  },
  {
    id: 'dump',
    name: 'Dump It',
    type: 'shady',
    rarity: 'common',
    cost: 1,
    heat: 2,
    p: { m: 3 },
    pUp: { m: 5 },
    icon: 'dump',
    text: (q) => `Next bar moves ${q.m} points lower.`,
    play: ({ s, p }) => {
      s.nextBarBonus -= p.m;
    },
  },
  {
    id: 'lobbyist',
    name: 'Lobbyist',
    type: 'tactic',
    rarity: 'uncommon',
    cost: 1,
    exhaust: true,
    p: { h: 4 },
    pUp: { h: 7 },
    icon: 'handshake',
    text: (q) => `Lose ${q.h} Heat. Exhaust.`,
    play: ({ run, p }) => {
      run.heat = Math.max(0, run.heat - p.h);
      fx(run, 'good', `-${p.h} Heat`);
    },
  },
  {
    id: 'make_markets',
    name: 'Make Markets',
    type: 'power',
    rarity: 'uncommon',
    cost: 1,
    costUp: 0,
    p: { n: 1 },
    pUp: { n: 1 },
    icon: 'book',
    text: (q) => `This session: +${q.n} P&L per card played.`,
    play: ({ s, p }) => {
      s.powers.make_markets = (s.powers.make_markets ?? 0) + p.n;
    },
  },
  {
    id: 'momentum',
    name: 'Momentum Mindset',
    type: 'power',
    rarity: 'uncommon',
    cost: 1,
    p: { n: 1 },
    pUp: { n: 2 },
    icon: 'arrowstack',
    text: (q) => `This session: trades with the Lean get +${q.n} size.`,
    play: ({ s, p }) => {
      s.powers.momentum = (s.powers.momentum ?? 0) + p.n;
    },
  },
  {
    id: 'compound',
    name: 'Compound Interest',
    type: 'power',
    rarity: 'rare',
    cost: 2,
    costUp: 1,
    p: { n: 2 },
    pUp: { n: 2 },
    icon: 'spiral',
    text: (q) => `This session: profitable closes pay +${q.n} P&L extra.`,
    play: ({ s, p }) => {
      s.powers.compound = (s.powers.compound ?? 0) + p.n;
    },
  },
  {
    id: 'flow',
    name: 'Flow State',
    type: 'power',
    rarity: 'rare',
    cost: 2,
    costUp: 1,
    p: { n: 1 },
    pUp: { n: 1 },
    icon: 'brain',
    text: (q) => `This session: +${q.n} Focus each bar from next bar.`,
    play: ({ s, p }) => {
      s.powers.flow = (s.powers.flow ?? 0) + p.n;
    },
  },
  {
    id: 'iron_stomach',
    name: 'Iron Stomach',
    type: 'power',
    rarity: 'common',
    cost: 1,
    p: { n: 15 },
    pUp: { n: 25 },
    icon: 'anchor',
    text: (q) => `This session: margin limit +${q.n}.`,
    play: ({ s, p }) => {
      s.marginLimit += p.n;
    },
  },
];

export const CARDS: Record<string, CardDef> = Object.fromEntries(LIST.map((c) => [c.id, c]));
export const CARD_IDS = LIST.map((c) => c.id);
export const POOL_IDS = LIST.filter((c) => c.rarity !== 'starter').map((c) => c.id);

export function cardParams(id: string, up: boolean): Params {
  const d = CARDS[id];
  return up ? d.pUp : d.p;
}

export function cardText(id: string, up: boolean): string {
  return CARDS[id].text(cardParams(id, up));
}

export function cardBaseCost(id: string, up: boolean): number {
  const d = CARDS[id];
  return up && d.costUp !== undefined ? d.costUp : d.cost;
}

export function cardHeat(id: string, up: boolean): number {
  const d = CARDS[id];
  return (up && d.heatUp !== undefined ? d.heatUp : d.heat) ?? 0;
}
