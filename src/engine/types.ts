export type Dir = 1 | -1;
export type Rarity = 'starter' | 'common' | 'uncommon' | 'rare';
export type CardType = 'order' | 'intel' | 'tactic' | 'shady' | 'power';

export interface Rng {
  s: number;
}

export interface CardInst {
  uid: number;
  id: string;
  up: boolean;
}

export interface Trade {
  id: number;
  dir: Dir;
  size: number;
  entry: number;
  barsLeft: number;
  kind: 'dir' | 'straddle';
  premium: number;
  source: string;
  openedAt: number;
}

export interface NewsEvent {
  bar: number;
  move: number;
  known: boolean;
  title: string;
  swan?: boolean;
}

export interface Candle {
  o: number;
  c: number;
  h: number;
  l: number;
}

export type FxKind = 'pnl' | 'open' | 'close' | 'heat' | 'info' | 'bad' | 'good';

export interface Fx {
  kind: FxKind;
  text: string;
  value?: number;
}

export interface SessionMods {
  cap?: number;
  heatMult?: number;
  extraBars?: number;
}

export interface SessionState {
  tickerId: string;
  bossId: string | null;
  quota: number;
  marginLimit: number;
  bars: number;
  bar: number;
  base: number;
  price: number;
  pre: Candle[];
  candles: Candle[];
  plan: number[];
  trend: number[];
  wicks: [number, number][];
  news: NewsEvent[];
  revealed: number[];
  trades: Trade[];
  nextTradeId: number;
  realized: number;
  focus: number;
  hand: CardInst[];
  draw: CardInst[];
  discard: CardInst[];
  exhaust: CardInst[];
  powers: Record<string, number>;
  nextBarBonus: number;
  hedgePct: number;
  leverage: number;
  cardsThisBar: number;
  cardsPlayed: number;
  multBonus: number;
  heatGained: number;
  bestTrade: number;
  parachuted: boolean;
  mods: SessionMods;
  status: 'play' | 'done';
  endReason: null | 'bell' | 'close' | 'margin';
}

export interface CashBreakdown {
  base: number;
  overshoot: number;
  interest: number;
  extra: number;
  fine: number;
  total: number;
}

export interface ResultInfo {
  won: boolean;
  pnl: number;
  quota: number;
  reason: 'bell' | 'close' | 'margin';
  cash: CashBreakdown;
  trustLost: number;
  insuranceSaved: boolean;
  audited: boolean;
  heatAfter: number;
  boss: boolean;
  bestTrade: number;
  year: number;
  quarter: number;
}

export interface ShopItem {
  kind: 'card' | 'algo';
  id: string;
  up: boolean;
  price: number;
  sold: boolean;
}

export interface RunStats {
  sessionsWon: number;
  sessionsLost: number;
  totalPnl: number;
  bestSession: number;
  bestRatio: number;
  marginCalls: number;
  cardsPlayed: number;
  startedAt: number;
  playMs: number;
}

export type Phase =
  | 'briefing'
  | 'session'
  | 'result'
  | 'reward'
  | 'bossreward'
  | 'shop'
  | 'gameover'
  | 'victory';

export interface RunState {
  version: 1;
  seed: number;
  rng: Rng;
  desk: string;
  year: number;
  quarter: number;
  trust: number;
  maxTrust: number;
  cash: number;
  heat: number;
  deck: CardInst[];
  nextUid: number;
  algos: string[];
  algoSlots: number;
  phase: Phase;
  tickerOptions: string[];
  session: SessionState | null;
  lastResult: ResultInfo | null;
  rewardCards: { id: string; up: boolean }[];
  rewardAlgos: string[];
  shop: ShopItem[];
  rerollCost: number;
  removeCost: number;
  upgradeCost: number;
  endless: boolean;
  stats: RunStats;
  fx: Fx[];
}

export interface MetaState {
  v: 1;
  unlocked: string[];
  seenCards: string[];
  seenAlgos: string[];
  runs: number;
  wins: number;
  bestYear: number;
  bestQuarterIndex: number;
  bestSession: number;
  tutorialDone: boolean;
  tutorialStep: number;
  sound: boolean;
  totalPlayMs: number;
}
