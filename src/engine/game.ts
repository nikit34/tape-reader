import type { Candle, CardInst, NewsEvent, Rarity, ResultInfo, RunState, SessionState, ShopItem } from './types';
import { clamp, makeRng, pick, randInt, rnd, shuffle, weighted } from './rng';
import {
  BARS_PER_SESSION,
  NEWS_TITLES,
  TICKERS,
  YEARS_TO_WIN,
  bossFor,
  quotaFor,
  regimeFor,
} from './data/market';
import { CARDS, POOL_IDS, cardBaseCost, cardHeat, cardParams } from './data/cards';
import { ALGOS, ALGO_IDS } from './data/algos';
import { DESK_BY_ID } from './data/desks';
import {
  addHeat,
  closeTrade,
  drawCards,
  effMove,
  equity,
  fx,
  gainPnl,
  hasAlgo,
  openTrade,
  reveal,
  tradePnl,
} from './ops';

const LOW_TICKERS = ['BOND', 'GRNT', 'BRWX', 'PTRX'];
const HIGH_TICKERS = ['ORBT', 'SLCA', 'HYPE', 'MOON'];

export function newRun(deskId: string, seed: number): RunState {
  const d = DESK_BY_ID[deskId] ?? DESK_BY_ID.intern;
  const run: RunState = {
    version: 1,
    seed,
    rng: makeRng(seed),
    desk: d.id,
    year: 0,
    quarter: 0,
    trust: d.trust,
    maxTrust: d.trust,
    cash: d.cash,
    heat: 0,
    deck: [],
    nextUid: 1,
    algos: [...d.algos],
    algoSlots: 5,
    phase: 'briefing',
    tickerOptions: [],
    session: null,
    lastResult: null,
    rewardCards: [],
    rewardAlgos: [],
    shop: [],
    rerollCost: 2,
    removeCost: 4,
    upgradeCost: 4,
    endless: false,
    stats: {
      sessionsWon: 0,
      sessionsLost: 0,
      totalPnl: 0,
      bestSession: 0,
      bestRatio: 0,
      marginCalls: 0,
      cardsPlayed: 0,
      startedAt: Date.now(),
      playMs: 0,
    },
    fx: [],
  };
  for (const id of d.deck) addCard(run, id, false);
  prepareBriefing(run);
  return run;
}

export function addCard(run: RunState, id: string, up: boolean): void {
  run.deck.push({ uid: run.nextUid++, id, up });
}

export function isBossQuarter(run: RunState): boolean {
  return run.quarter === 3;
}

export function quarterIndex(run: RunState): number {
  return run.year * 4 + run.quarter;
}

export function prepareBriefing(run: RunState): void {
  run.phase = 'briefing';
  run.session = null;
  if (isBossQuarter(run)) {
    run.tickerOptions = [bossFor(run.year).ticker];
    return;
  }
  if (run.year === 0 && run.quarter === 0) {
    run.tickerOptions = ['GRNT', 'PTRX'];
    return;
  }
  run.tickerOptions = [pick(run.rng, LOW_TICKERS), pick(run.rng, HIGH_TICKERS)];
}

export function sessionPreview(run: RunState, tickerId: string): { quota: number; cash: number } {
  const boss = isBossQuarter(run);
  const t = TICKERS[tickerId];
  return {
    quota: quotaFor(run.year, run.quarter, boss ? 1 : t.quotaMult),
    cash: boss ? 8 : t.cash,
  };
}

export function marginFor(run: RunState, quota: number): number {
  let m = Math.max(12, Math.round(quota * 0.8));
  if (hasAlgo(run, 'risk_desk')) m = Math.round(m * 1.5);
  return m;
}

export function startSession(run: RunState, tickerId: string): void {
  const r = run.rng;
  const boss = isBossQuarter(run) ? bossFor(run.year) : null;
  const t = TICKERS[tickerId];
  const reg = regimeFor(run.year);
  const bars = BARS_PER_SESSION;
  const vol = (boss ? boss.vol : t.vol) * reg.vol;
  const flip = clamp((boss ? boss.flip : t.flip) + (reg.flip - 0.3), 0.05, 0.75);
  const drift = reg.drift;
  const { quota } = sessionPreview(run, tickerId);

  let m = clamp(reg.startTrend + randInt(r, -1, 1), -2, 2);
  const step = () => {
    if (rnd(r) < flip) {
      const upBias = 0.5 + drift * 0.6;
      m = clamp(m + (rnd(r) < upBias ? 1 : -1), -2, 2);
    }
  };
  const noise = () => {
    let n = randInt(r, -3, 3);
    if (rnd(r) < 0.15) n += randInt(r, -2, 2);
    return n;
  };
  const mv = (mm: number) => Math.round((0.7 * mm + drift + noise()) * vol);
  const wick = (): [number, number] => [Math.round(randInt(r, 0, 2) * vol), Math.round(randInt(r, 0, 2) * vol)];

  const preMoves: number[] = [];
  for (let k = 0; k < 10; k++) {
    step();
    preMoves.push(mv(m));
  }
  let p = -preMoves.reduce((a, b) => a + b, 0);
  const pre: Candle[] = [];
  for (const d of preMoves) {
    const [w1, w2] = wick();
    pre.push({ o: p, c: p + d, h: Math.max(p, p + d) + w1, l: Math.min(p, p + d) - w2 });
    p += d;
  }

  const plan: number[] = [];
  const trend: number[] = [];
  const wicks: [number, number][] = [];
  for (let i = 0; i < bars; i++) {
    if (i > 0) step();
    trend.push(m);
    plan.push(mv(m));
    wicks.push(wick());
  }

  const news: NewsEvent[] = [];
  const newsMove = () => (rnd(r) < 0.5 ? -1 : 1) * Math.round(randInt(r, 5, 8) * Math.max(1, vol * 0.9));
  if (boss?.earnings) {
    for (const b of [1, 3, 5, 7]) news.push({ bar: b, move: newsMove(), known: false, title: 'Earnings call' });
  } else {
    const count = Math.min(3, (boss ? 0 : t.news) + reg.news);
    const slots = shuffle(r, [2, 3, 4, 5, 6, 7]).slice(0, count);
    for (const b of slots) news.push({ bar: b, move: newsMove(), known: false, title: pick(r, NEWS_TITLES) });
  }
  if (boss?.swan) {
    const c = randInt(r, 3, 6);
    for (let k = news.length - 1; k >= 0; k--) if (news[k].bar === c) news.splice(k, 1);
    news.push({ bar: c, move: -randInt(r, 11, 14), known: true, title: 'BLACK SWAN', swan: true });
    for (let i = c + 1; i < bars; i++) {
      trend[i] = Math.max(trend[i], 1);
      plan[i] = mv(trend[i]);
    }
  }
  news.sort((a, b) => a.bar - b.bar);

  const s: SessionState = {
    tickerId,
    bossId: boss ? boss.id : null,
    quota,
    marginLimit: marginFor(run, quota),
    bars,
    bar: 0,
    base: randInt(r, 80, 260),
    price: 0,
    pre,
    candles: [],
    plan,
    trend,
    wicks,
    news,
    revealed: [],
    trades: [],
    nextTradeId: 1,
    realized: 0,
    focus: 0,
    hand: [],
    draw: shuffle(
      r,
      run.deck.map((c) => ({ ...c })),
    ),
    discard: [],
    exhaust: [],
    powers: {},
    nextBarBonus: 0,
    hedgePct: 0,
    leverage: 0,
    cardsThisBar: 0,
    cardsPlayed: 0,
    multBonus: 0,
    heatGained: 0,
    bestTrade: 0,
    parachuted: false,
    mods: { cap: boss?.cap, extraBars: boss?.extraBars },
    status: 'play',
    endReason: null,
  };
  if (hasAlgo(run, 'backtester')) {
    reveal(s, 0);
    reveal(s, 1);
  }
  if (hasAlgo(run, 'news_scraper')) for (const n of s.news) n.known = true;
  run.session = s;
  run.phase = 'session';
  run.fx = [];
  beginBar(run, s);
}

export function handSize(run: RunState): number {
  return 5 + (hasAlgo(run, 'overclock') ? 1 : 0);
}

function beginBar(run: RunState, s: SessionState): void {
  s.discard.push(...s.hand);
  s.hand = [];
  s.focus = 3 + (s.powers.flow ?? 0) + (s.bar === 0 && hasAlgo(run, 'coffee_sub') ? 2 : 0);
  s.cardsThisBar = 0;
  s.leverage = 0;
  drawCards(run, s, handSize(run));
}

export function isNewsVisible(s: SessionState, n: NewsEvent): boolean {
  return !n.swan || s.bar >= n.bar - 1;
}

export function cardCost(run: RunState, s: SessionState, c: CardInst): number {
  let cost = cardBaseCost(c.id, c.up);
  if (hasAlgo(run, 'sentiment') && (c.id === 'read_tape' || c.id === 'backtest' || c.id === 'ta')) cost = 0;
  if (hasAlgo(run, 'latency_arb') && s.cardsThisBar === 0) cost = 0;
  return cost;
}

export function canPlay(run: RunState, i: number): string | null {
  const s = run.session;
  if (!s || s.status !== 'play') return 'Session is over';
  const c = s.hand[i];
  if (!c) return 'No card';
  if (cardCost(run, s, c) > s.focus) return 'Not enough Focus';
  if (CARDS[c.id].needsTrade && s.trades.length === 0) return 'Needs an open trade';
  return null;
}

export function playCard(run: RunState, i: number): boolean {
  const s = run.session;
  const err = canPlay(run, i);
  if (!s || err) {
    fx(run, 'bad', err ?? 'Cannot play');
    return false;
  }
  const c = s.hand.splice(i, 1)[0];
  const d = CARDS[c.id];
  const cost = cardCost(run, s, c);
  s.focus -= cost;
  s.cardsThisBar++;
  s.cardsPlayed++;
  run.stats.cardsPlayed++;
  const heat = cardHeat(c.id, c.up);
  if (heat) addHeat(run, s, heat);
  d.play({ run, s, p: cardParams(c.id, c.up), paid: cost });
  if (s.powers.make_markets) gainPnl(run, s, s.powers.make_markets, 'Make Markets');
  if (d.type === 'power' || d.exhaust) s.exhaust.push(c);
  else s.discard.push(c);
  return true;
}

export function nextBar(run: RunState): void {
  const s = run.session;
  if (!s || s.status !== 'play') return;
  const i = s.bar;
  const move = effMove(s, i);
  const o = s.price;
  const c = o + move;
  const [w1, w2] = s.wicks[i];
  s.candles.push({ o, c, h: Math.max(o, c) + w1, l: Math.min(o, c) - w2 });

  if (s.hedgePct > 0) {
    let saved = 0;
    for (const t of s.trades) {
      const d = t.kind === 'dir' ? t.dir * t.size * move : 0;
      if (d < 0) saved += (-d * s.hedgePct) / 100;
    }
    saved = Math.round(saved);
    if (saved > 0) gainPnl(run, s, saved, 'Hedge');
  }
  s.price = c;
  for (const n of s.news) if (n.bar === i) fx(run, n.move > 0 ? 'good' : 'bad', `${n.title}: ${n.move > 0 ? '+' : ''}${n.move}`);
  if (hasAlgo(run, 'whale_watcher') && Math.abs(move) >= 5) {
    const riding = s.trades.some((t) => (t.kind === 'dir' && t.dir === Math.sign(move)) || t.kind === 'straddle');
    if (riding) gainPnl(run, s, 4, 'Whale Watcher');
  }
  s.nextBarBonus = 0;
  s.hedgePct = 0;
  for (const t of s.trades) t.barsLeft--;
  if (hasAlgo(run, 'stop_daemon')) {
    for (const t of [...s.trades]) if (tradePnl(s, t) <= -4) closeTrade(run, s, t, 'Stop-Loss Daemon');
  }
  for (const t of [...s.trades]) if (t.barsLeft <= 0) closeTrade(run, s, t, 'Expired');
  s.bar++;
  if (hasAlgo(run, 'mean_reverter') && Math.abs(move) >= 4 && s.bar < s.bars) {
    openTrade(run, s, move > 0 ? -1 : 1, 2, 1, { source: 'Mean Reverter', free: true });
  }

  if (equity(s) <= -s.marginLimit) {
    if (hasAlgo(run, 'golden_parachute') && !s.parachuted) {
      run.algos = run.algos.filter((a) => a !== 'golden_parachute');
      s.parachuted = true;
      for (const t of [...s.trades]) closeTrade(run, s, t, 'Parachute');
      s.marginLimit *= 2;
      fx(run, 'good', 'Golden Parachute deployed');
    } else {
      endSession(run, 'margin');
      return;
    }
  }
  if (s.bar >= s.bars) {
    endSession(run, 'close');
    return;
  }
  beginBar(run, s);
}

export function canRingBell(run: RunState): boolean {
  const s = run.session;
  return !!s && s.status === 'play' && equity(s) >= s.quota;
}

export function ringBell(run: RunState): void {
  if (canRingBell(run)) endSession(run, 'bell');
}

function endSession(run: RunState, reason: 'bell' | 'close' | 'margin'): void {
  const s = run.session;
  if (!s) return;
  for (const t of [...s.trades]) closeTrade(run, s, t, reason === 'margin' ? 'Margin call' : 'Session close');
  s.status = 'done';
  s.endReason = reason;
  s.discard.push(...s.hand);
  s.hand = [];
  run.lastResult = computeResult(run, s, reason);
  run.phase = 'result';
}

function computeResult(run: RunState, s: SessionState, reason: 'bell' | 'close' | 'margin'): ResultInfo {
  const pnl = s.realized;
  const boss = !!s.bossId;
  const won = reason !== 'margin' && pnl >= s.quota;
  const baseCash = boss ? 8 : TICKERS[s.tickerId].cash;
  const base = won ? baseCash : Math.floor(baseCash / 2);
  const overshoot = won ? Math.min(5, Math.floor((pnl - s.quota) / Math.max(1, s.quota * 0.25))) : 0;
  const cap = hasAlgo(run, 'interest_engine') ? 10 : 5;
  const interest = Math.min(cap, Math.floor(Math.max(0, run.cash) / 5));
  const extra = hasAlgo(run, 'tax_haven') ? 3 : 0;
  if (hasAlgo(run, 'tax_haven')) run.heat += 1;
  let trustLost = 0;
  let insuranceSaved = false;
  if (!won) {
    if (reason !== 'margin' && hasAlgo(run, 'insurance') && pnl >= s.quota * 0.75) insuranceSaved = true;
    else trustLost = 1;
  }
  let fine = 0;
  let audited = false;
  if (run.heat >= 10) {
    audited = true;
    fine = 5 + (run.heat - 10);
    run.heat = 4;
  } else {
    run.heat = Math.max(0, run.heat - 1);
  }
  const total = base + overshoot + interest + extra - fine;
  run.cash += total;
  if (run.cash < 0) {
    run.cash = 0;
    trustLost += 1;
  }
  run.trust -= trustLost;
  const st = run.stats;
  if (won) st.sessionsWon++;
  else st.sessionsLost++;
  if (reason === 'margin') st.marginCalls++;
  st.totalPnl += pnl;
  st.bestSession = Math.max(st.bestSession, pnl);
  st.bestRatio = Math.max(st.bestRatio, s.quota > 0 ? pnl / s.quota : 0);
  return {
    won,
    pnl,
    quota: s.quota,
    reason,
    cash: { base, overshoot, interest, extra, fine, total },
    trustLost,
    insuranceSaved,
    audited,
    heatAfter: run.heat,
    boss,
    bestTrade: s.bestTrade,
    year: run.year,
    quarter: run.quarter,
  };
}

const RARITY_PRICE: Record<Rarity, number> = { starter: 2, common: 3, uncommon: 5, rare: 7 };

function rollCardId(run: RunState, weights: Partial<Record<Rarity, number>>, exclude: string[]): string {
  const rar = weighted(run.rng, ['common', 'uncommon', 'rare'] as Rarity[], (x) => weights[x] ?? 0);
  let pool = POOL_IDS.filter((id) => CARDS[id].rarity === rar && !exclude.includes(id));
  if (!pool.length) pool = POOL_IDS.filter((id) => !exclude.includes(id));
  return pick(run.rng, pool);
}

function rollAlgoId(run: RunState, weights: Partial<Record<Rarity, number>>, exclude: string[]): string | null {
  const avail = ALGO_IDS.filter((id) => !run.algos.includes(id) && !exclude.includes(id));
  if (!avail.length) return null;
  const rar = weighted(run.rng, ['common', 'uncommon', 'rare'] as Rarity[], (x) => weights[x] ?? 0);
  const pool = avail.filter((id) => ALGOS[id].rarity === rar);
  return pick(run.rng, pool.length ? pool : avail);
}

export function continueFromResult(run: RunState): void {
  if (run.phase !== 'result') return;
  if (run.trust <= 0) {
    run.phase = 'gameover';
    return;
  }
  const boss = !!run.lastResult?.boss;
  const weights = boss ? { uncommon: 65, rare: 35 } : { common: 58, uncommon: 34, rare: 8 };
  const ids: string[] = [];
  for (let k = 0; k < 3; k++) ids.push(rollCardId(run, weights, ids));
  const upChance = Math.min(0.4, 0.08 * (run.year + 1));
  run.rewardCards = ids.map((id) => ({ id, up: rnd(run.rng) < upChance }));
  run.phase = 'reward';
}

export function pickReward(run: RunState, idx: number | null): void {
  if (run.phase !== 'reward') return;
  if (idx === null) run.cash += 2;
  else {
    const c = run.rewardCards[idx];
    if (c) addCard(run, c.id, c.up);
  }
  run.rewardCards = [];
  if (run.lastResult?.boss) {
    const ids: string[] = [];
    for (let k = 0; k < 3; k++) {
      const id = rollAlgoId(run, { common: 30, uncommon: 45, rare: 25 }, ids);
      if (id) ids.push(id);
    }
    run.rewardAlgos = ids;
    run.phase = 'bossreward';
    return;
  }
  openShop(run);
}

export function pickBossAlgo(run: RunState, id: string | null, replace?: string): void {
  if (run.phase !== 'bossreward') return;
  if (id) {
    if (run.algos.length >= run.algoSlots) {
      if (!replace) return;
      run.algos = run.algos.filter((a) => a !== replace);
    }
    run.algos.push(id);
  }
  run.rewardAlgos = [];
  if (run.year === YEARS_TO_WIN - 1 && !run.endless) {
    run.phase = 'victory';
    return;
  }
  openShop(run);
}

export function goEndless(run: RunState): void {
  if (run.phase !== 'victory') return;
  run.endless = true;
  openShop(run);
}

function genShop(run: RunState): ShopItem[] {
  const items: ShopItem[] = [];
  const cardIds: string[] = [];
  for (let k = 0; k < 3; k++) {
    const id = rollCardId(run, { common: 55, uncommon: 35, rare: 10 }, cardIds);
    cardIds.push(id);
    const up = rnd(run.rng) < 0.15;
    items.push({ kind: 'card', id, up, price: RARITY_PRICE[CARDS[id].rarity] + (up ? 2 : 0) + randInt(run.rng, 0, 1), sold: false });
  }
  const algoIds: string[] = [];
  for (let k = 0; k < 2; k++) {
    const id = rollAlgoId(run, { common: 50, uncommon: 35, rare: 15 }, algoIds);
    if (!id) break;
    algoIds.push(id);
    items.push({ kind: 'algo', id, up: false, price: ALGOS[id].price + randInt(run.rng, -1, 1), sold: false });
  }
  return items;
}

export function openShop(run: RunState): void {
  run.phase = 'shop';
  run.rerollCost = 2;
  run.shop = genShop(run);
}

export function buyItem(run: RunState, idx: number, replaceAlgo?: string): string | null {
  const it = run.shop[idx];
  if (!it || it.sold) return 'Sold out';
  if (run.cash < it.price) return 'Not enough cash';
  if (it.kind === 'algo') {
    if (run.algos.length >= run.algoSlots) {
      if (!replaceAlgo) return 'Algorithm slots full';
      run.algos = run.algos.filter((a) => a !== replaceAlgo);
    }
    run.algos.push(it.id);
  } else {
    addCard(run, it.id, it.up);
  }
  run.cash -= it.price;
  it.sold = true;
  return null;
}

export function reroll(run: RunState): string | null {
  if (run.cash < run.rerollCost) return 'Not enough cash';
  run.cash -= run.rerollCost;
  run.rerollCost += 1;
  run.shop = genShop(run);
  return null;
}

export function removeCard(run: RunState, uid: number): string | null {
  if (run.deck.length <= 6) return 'Deck needs at least 6 cards';
  if (run.cash < run.removeCost) return 'Not enough cash';
  const i = run.deck.findIndex((c) => c.uid === uid);
  if (i < 0) return 'No such card';
  run.deck.splice(i, 1);
  run.cash -= run.removeCost;
  run.removeCost += 2;
  return null;
}

export function upgradeCard(run: RunState, uid: number): string | null {
  const c = run.deck.find((x) => x.uid === uid);
  if (!c) return 'No such card';
  if (c.up) return 'Already upgraded';
  if (run.cash < run.upgradeCost) return 'Not enough cash';
  c.up = true;
  run.cash -= run.upgradeCost;
  run.upgradeCost += 1;
  return null;
}

export function sellAlgo(run: RunState, id: string): void {
  if (!run.algos.includes(id)) return;
  run.algos = run.algos.filter((a) => a !== id);
  run.cash += Math.floor(ALGOS[id].price / 2);
}

export function leaveShop(run: RunState): void {
  if (run.phase !== 'shop') return;
  run.quarter++;
  if (run.quarter > 3) {
    run.quarter = 0;
    run.year++;
  }
  prepareBriefing(run);
}

export { equity, effMove, tradePnl };
