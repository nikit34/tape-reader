import type { Rarity } from '../types';

export interface AlgoDef {
  id: string;
  name: string;
  short: string;
  rarity: Exclude<Rarity, 'starter'>;
  price: number;
  text: string;
}

const LIST: AlgoDef[] = [
  { id: 'spread_bot', name: 'Spread Bot', short: 'SB', rarity: 'common', price: 6, text: '+1 P&L every time you open a trade.' },
  { id: 'trend_follower', name: 'Trend Follower', short: 'TF', rarity: 'common', price: 6, text: 'Trades opened with the Lean get +1 size.' },
  { id: 'news_scraper', name: 'News Scraper', short: 'NS', rarity: 'common', price: 5, text: 'You always see which way a headline will move the price.' },
  { id: 'risk_desk', name: 'Risk Desk', short: 'RD', rarity: 'common', price: 5, text: 'Margin limit +50%.' },
  { id: 'coffee_sub', name: 'Coffee Subscription', short: 'CS', rarity: 'common', price: 5, text: '+2 Focus on the first bar of every session.' },
  { id: 'interest_engine', name: 'Interest Engine', short: 'IE', rarity: 'common', price: 5, text: 'Interest cap raised from $5 to $10.' },
  { id: 'stop_daemon', name: 'Stop-Loss Daemon', short: 'SL', rarity: 'common', price: 6, text: 'A trade that is losing 4 or more closes automatically.' },
  { id: 'pr_dept', name: 'PR Department', short: 'PR', rarity: 'common', price: 5, text: 'Heat you gain is halved (rounded down).' },
  { id: 'mean_reverter', name: 'Mean Reverter', short: 'MR', rarity: 'uncommon', price: 7, text: 'After a bar moves 4+ points, open a free size 2 trade against it for 1 bar.' },
  { id: 'overclock', name: 'Overclocked Server', short: 'OC', rarity: 'uncommon', price: 7, text: 'Draw 1 extra card every bar.' },
  { id: 'whale_watcher', name: 'Whale Watcher', short: 'WW', rarity: 'uncommon', price: 7, text: 'When a bar moves 5+ points and you hold a trade riding it, +4 P&L.' },
  { id: 'backtester', name: 'Backtester', short: 'BT', rarity: 'uncommon', price: 6, text: 'Each session starts with the first 2 bars revealed.' },
  { id: 'dark_pool', name: 'Dark Pool', short: 'DP', rarity: 'uncommon', price: 7, text: 'Profitable trades of size 4+ pay 25% more.' },
  { id: 'copy_trader', name: 'Copy Trader', short: 'CT', rarity: 'uncommon', price: 7, text: 'Opening a trade has a 30% chance to open a free half-size copy of it.' },
  { id: 'golden_parachute', name: 'Golden Parachute', short: 'GP', rarity: 'uncommon', price: 6, text: 'Cancels your next margin call: trades close and the margin limit moves far enough out to keep trading. Then it is gone.' },
  { id: 'sentiment', name: 'Sentiment NLP', short: 'NL', rarity: 'uncommon', price: 7, text: 'Read the Tape, Backtest and Technical Analysis cost 0.' },
  { id: 'latency_arb', name: 'Latency Arb', short: 'LA', rarity: 'rare', price: 9, text: 'The first card you play each bar costs 0.' },
  { id: 'compounder', name: 'Compounder', short: 'CP', rarity: 'rare', price: 9, text: 'Each profitable close adds +5% to every profit for the rest of the session.' },
  { id: 'insurance', name: 'Insurance Fund', short: 'IF', rarity: 'rare', price: 8, text: 'Missing a quota by less than 25% costs no Trust.' },
  { id: 'tax_haven', name: 'Offshore Account', short: 'OA', rarity: 'rare', price: 8, text: '+$3 after every session, but +1 Heat as well.' },
];

export const ALGOS: Record<string, AlgoDef> = Object.fromEntries(LIST.map((a) => [a.id, a]));
export const ALGO_IDS = LIST.map((a) => a.id);
