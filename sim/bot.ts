import {
  buyItem,
  canPlay,
  continueFromResult,
  leaveShop,
  newRun,
  nextBar,
  pickBossAlgo,
  pickReward,
  playCard,
  startSession,
  upgradeCard,
} from '../src/engine/game';
import { CARDS } from '../src/engine/data/cards';
import { currentTrend, effMove, tradePnl } from '../src/engine/ops';
import type { RunState, SessionState } from '../src/engine/types';

const CARD_RANK: Record<string, number> = {
  backtest: 9,
  flow: 9,
  ta: 8,
  ride: 8,
  compound: 8,
  arbitrage: 7,
  momentum: 7,
  swing_long: 6,
  swing_short: 6,
  make_markets: 6,
  straddle: 5,
  research: 5,
  lock_gains: 5,
  pyramid: 5,
  espresso: 4,
  scalp_long: 4,
  scalp_short: 4,
  cut_losses: 4,
  yolo: 4,
  doom: 4,
  double_down: 4,
  iron_stomach: 3,
  hedge: 3,
  roll: 3,
  flip: 3,
  leverage: 3,
  insider: 3,
  pump: 2,
  dump: 2,
  lobbyist: 2,
  fade: 3,
};

const ALGO_RANK = [
  'trend_follower',
  'backtester',
  'latency_arb',
  'spread_bot',
  'overclock',
  'compounder',
  'insurance',
  'news_scraper',
  'whale_watcher',
  'dark_pool',
  'copy_trader',
  'sentiment',
  'risk_desk',
  'coffee_sub',
  'mean_reverter',
  'stop_daemon',
  'golden_parachute',
  'interest_engine',
  'tax_haven',
  'pr_dept',
];

function predictedDir(s: SessionState): number {
  if (s.revealed.includes(s.bar)) return Math.sign(effMove(s, s.bar));
  const n = s.news.find((x) => x.bar === s.bar && x.known);
  if (n) return Math.sign(n.move + s.trend[s.bar]);
  return Math.sign(currentTrend(s));
}

function chooseCard(run: RunState, s: SessionState, skill: number): number {
  const hand = s.hand;
  const playable = hand.map((_, i) => i).filter((i) => canPlay(run, i) === null);
  if (!playable.length) return -1;
  const by = (id: string) => playable.find((i) => hand[i].id === id) ?? -1;
  const first = (ids: string[]) => {
    for (const id of ids) {
      const i = by(id);
      if (i >= 0) return i;
    }
    return -1;
  };
  if (s.bar <= 3) {
    const i = first(['flow', 'compound', 'make_markets', 'momentum']);
    if (i >= 0) return i;
  }
  if (!s.revealed.includes(s.bar)) {
    const i = first(['backtest', 'ta', 'read_tape']);
    if (i >= 0) return i;
  } else {
    const i = by('backtest');
    if (i >= 0) return i;
  }
  let dir = predictedDir(s);
  if (Math.random() > skill && dir !== 0 && !s.revealed.includes(s.bar)) dir = Math.random() < 0.5 ? 1 : -1;
  let best = s.trades[0];
  for (const t of s.trades) if (tradePnl(s, t) > tradePnl(s, best)) best = t;
  if (best && tradePnl(s, best) >= 4) {
    const i = first(['take_profit', 'lock_gains']);
    if (i >= 0) return i;
  }
  if (s.trades.some((t) => t.kind === 'dir' && tradePnl(s, t) <= -3 && t.dir !== dir && dir !== 0)) {
    const i = first(['cut_losses', 'flip']);
    if (i >= 0) return i;
  }
  const newsNext = s.news.some((n) => n.bar === s.bar && !n.known);
  if (newsNext) {
    const i = first(['straddle', 'insider']);
    if (i >= 0) return i;
  }
  if (dir !== 0) {
    const ids =
      dir > 0
        ? ['yolo', 'swing_long', 'ride', 'buy', 'scalp_long']
        : ['doom', 'swing_short', 'ride', 'sell', 'scalp_short'];
    if (s.focus >= 2) {
      const lev = by('leverage');
      if (lev >= 0 && run.heat < 7) return lev;
    }
    for (const id of ids) {
      if (CARDS[id].type === 'shady' && run.heat >= 7) continue;
      const i = by(id);
      if (i >= 0) return i;
    }
  }
  return first(['arbitrage', 'research', 'espresso', 'pyramid', 'double_down', 'iron_stomach']);
}

function botSession(run: RunState, skill: number): void {
  let guardBars = 0;
  while (run.phase === 'session' && guardBars++ < 20) {
    const s = run.session as SessionState;
    let guard = 0;
    while (guard++ < 30) {
      const i = chooseCard(run, s, skill);
      if (i < 0) break;
      playCard(run, i);
      if (s.status !== 'play') break;
    }
    if (run.phase !== 'session') break;
    nextBar(run);
  }
}

export interface RunOutcome {
  quarters: number;
  win: boolean;
  ratios: number[][];
  pnls: number[];
  margins: number;
  lost: number;
  cash: number;
  deck: number;
  algos: number;
}

export function botRun(desk: string, seed: number, skill: number, onPhase?: (r: RunState) => void): RunOutcome {
  const run = newRun(desk, seed);
  const ratios: number[][] = [[], [], []];
  const pnls: number[] = [];
  let quarters = 0;
  let guard = 0;
  while (guard++ < 200) {
    if (onPhase) onPhase(run);
    if (run.phase === 'briefing') {
      const opts = run.tickerOptions;
      const t = opts.length > 1 && run.trust > 1 && Math.random() < 0.5 ? opts[1] : opts[0];
      startSession(run, t);
    } else if (run.phase === 'session') {
      botSession(run, skill);
    } else if (run.phase === 'result') {
      const r = run.lastResult!;
      if (r.year < 3) ratios[r.year].push(r.pnl / r.quota);
      pnls[r.year * 4 + r.quarter] = r.pnl;
      if (r.won) quarters++;
      continueFromResult(run);
    } else if (run.phase === 'reward') {
      let bi = -1;
      let br = 2.5;
      run.rewardCards.forEach((c, i) => {
        const rk = (CARD_RANK[c.id] ?? 3) + (c.up ? 1 : 0);
        if (rk > br) {
          br = rk;
          bi = i;
        }
      });
      pickReward(run, bi >= 0 ? bi : null);
    } else if (run.phase === 'bossreward') {
      const sorted = [...run.rewardAlgos].sort((a, b) => ALGO_RANK.indexOf(a) - ALGO_RANK.indexOf(b));
      const id = sorted[0] ?? null;
      const worst = [...run.algos].sort((a, b) => ALGO_RANK.indexOf(b) - ALGO_RANK.indexOf(a))[0];
      pickBossAlgo(run, id, worst);
    } else if (run.phase === 'shop') {
      const algoIdx = run.shop
        .map((it, i) => ({ it, i }))
        .filter((x) => x.it.kind === 'algo' && !x.it.sold)
        .sort((a, b) => ALGO_RANK.indexOf(a.it.id) - ALGO_RANK.indexOf(b.it.id));
      for (const x of algoIdx) {
        if (run.cash >= x.it.price && run.algos.length < run.algoSlots && ALGO_RANK.indexOf(x.it.id) < 14) buyItem(run, x.i);
      }
      run.shop.forEach((it, i) => {
        if (it.kind === 'card' && !it.sold && (CARD_RANK[it.id] ?? 3) >= 6 && run.cash >= it.price + 3) buyItem(run, i);
      });
      const target = run.deck.find((c) => !c.up && (c.id === 'buy' || c.id === 'sell' || c.id === 'ride'));
      if (target && run.cash >= run.upgradeCost + 6) upgradeCard(run, target.uid);
      leaveShop(run);
    } else if (run.phase === 'victory') {
      return { quarters, win: true, ratios, pnls, margins: run.stats.marginCalls, lost: run.stats.sessionsLost, cash: run.cash, deck: run.deck.length, algos: run.algos.length };
    } else if (run.phase === 'gameover') {
      return { quarters, win: false, ratios, pnls, margins: run.stats.marginCalls, lost: run.stats.sessionsLost, cash: run.cash, deck: run.deck.length, algos: run.algos.length };
    }
  }
  return { quarters, win: false, ratios, pnls, margins: run.stats.marginCalls, lost: run.stats.sessionsLost, cash: run.cash, deck: run.deck.length, algos: run.algos.length };
}

