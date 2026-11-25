export interface Regime {
  id: string;
  name: string;
  drift: number;
  vol: number;
  flip: number;
  news: number;
  startTrend: number;
  desc: string;
}

export const REGIMES: Regime[] = [
  {
    id: 'bull',
    name: 'Bull Market',
    drift: 0.4,
    vol: 1.0,
    flip: 0.3,
    news: 0,
    startTrend: 1,
    desc: 'Prices drift upward. Longs are rewarded, dips get bought.',
  },
  {
    id: 'chop',
    name: 'Sideways Chop',
    drift: 0,
    vol: 1.1,
    flip: 0.5,
    news: 0,
    startTrend: 0,
    desc: 'Trends flip often. Short holds, fades and scalps shine.',
  },
  {
    id: 'bear',
    name: 'Bear Market',
    drift: -0.4,
    vol: 1.25,
    flip: 0.35,
    news: 1,
    startTrend: -1,
    desc: 'Prices bleed lower with violent relief rallies.',
  },
];

export function regimeFor(year: number): Regime {
  return REGIMES[year % REGIMES.length];
}

export interface TickerDef {
  id: string;
  name: string;
  vol: number;
  quotaMult: number;
  cash: number;
  flip: number;
  news: number;
  tag: string;
  desc: string;
}

export const TICKERS: Record<string, TickerDef> = {
  BOND: {
    id: 'BOND',
    name: 'Treasury Ladder',
    vol: 0.55,
    quotaMult: 0.65,
    cash: 2,
    flip: 0.2,
    news: 0,
    tag: 'Sleepy',
    desc: 'Barely moves. Small quota, small pay.',
  },
  GRNT: {
    id: 'GRNT',
    name: 'Granite Utilities',
    vol: 0.75,
    quotaMult: 0.8,
    cash: 3,
    flip: 0.25,
    news: 0,
    tag: 'Calm',
    desc: 'Steady and readable. A safe quarter.',
  },
  BRWX: {
    id: 'BRWX',
    name: 'Brewix Beverages',
    vol: 0.95,
    quotaMult: 0.9,
    cash: 4,
    flip: 0.55,
    news: 0,
    tag: 'Choppy',
    desc: 'Trend flips constantly. Fades and scalps work.',
  },
  PTRX: {
    id: 'PTRX',
    name: 'Petrolux Energy',
    vol: 1.0,
    quotaMult: 1.0,
    cash: 4,
    flip: 0.12,
    news: 0,
    tag: 'Trending',
    desc: 'Trends last. Swing trades and rolls pay off.',
  },
  ORBT: {
    id: 'ORBT',
    name: 'Orbital Freight',
    vol: 1.15,
    quotaMult: 1.1,
    cash: 5,
    flip: 0.25,
    news: 1,
    tag: 'Lively',
    desc: 'Bigger swings and one headline.',
  },
  SLCA: {
    id: 'SLCA',
    name: 'Silica Semis',
    vol: 1.1,
    quotaMult: 1.1,
    cash: 5,
    flip: 0.3,
    news: 1,
    tag: 'Newsy',
    desc: 'Headline-driven. Straddles love it.',
  },
  HYPE: {
    id: 'HYPE',
    name: 'Hypeloop AI',
    vol: 1.4,
    quotaMult: 1.2,
    cash: 6,
    flip: 0.3,
    news: 2,
    tag: 'Volatile',
    desc: 'Huge moves and two headlines. High quota, high pay.',
  },
  MOON: {
    id: 'MOON',
    name: 'Moonshot Pets',
    vol: 1.7,
    quotaMult: 1.35,
    cash: 8,
    flip: 0.4,
    news: 2,
    tag: 'Chaos',
    desc: 'Pure chaos. The biggest payout on the board.',
  },
};

export const TICKER_IDS = Object.keys(TICKERS);

export interface BossDef {
  id: string;
  name: string;
  ticker: string;
  desc: string;
  vol: number;
  flip: number;
  cap?: number;
  extraBars?: number;
  earnings?: boolean;
  swan?: boolean;
}

export const BOSSES: BossDef[] = [
  {
    id: 'earnings',
    name: 'Earnings Week',
    ticker: 'SLCA',
    desc: 'A headline hits every other bar. Big moves, direction unknown until it lands.',
    vol: 1.0,
    flip: 0.3,
    earnings: true,
  },
  {
    id: 'circuit',
    name: 'Circuit Breaker',
    ticker: 'PTRX',
    desc: 'Every bar is capped at 3 points. Trends are sticky and trades last 1 bar longer.',
    vol: 1.3,
    flip: 0.1,
    cap: 3,
    extraBars: 1,
  },
  {
    id: 'swan',
    name: 'Black Swan',
    ticker: 'HYPE',
    desc: 'A crash is coming this session. You will see it one bar before it hits.',
    vol: 1.2,
    flip: 0.35,
    swan: true,
  },
];

export function bossFor(year: number): BossDef {
  return BOSSES[year % BOSSES.length];
}

const BASE_QUOTA = [
  [16, 26, 36, 52],
  [55, 70, 82, 95],
  [125, 150, 165, 230],
];

export function quotaFor(year: number, quarter: number, mult: number): number {
  const base =
    year < 3 ? BASE_QUOTA[year][quarter] : Math.round(BASE_QUOTA[2][quarter] * Math.pow(1.35, year - 2));
  return Math.max(5, Math.round(base * mult));
}

export const NEWS_TITLES = [
  'Earnings call',
  'Rate decision',
  'Merger rumor',
  'CEO interview',
  'Regulator statement',
  'Product event',
  'Analyst day',
  'Index rebalance',
  'Lawsuit ruling',
  'Guidance update',
  'Supply report',
  'Jobs data',
];

export const BARS_PER_SESSION = 8;
export const YEARS_TO_WIN = 3;
