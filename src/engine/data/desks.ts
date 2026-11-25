export interface DeskDef {
  id: string;
  name: string;
  role: string;
  desc: string;
  deck: string[];
  algos: string[];
  trust: number;
  cash: number;
  unlock: string | null;
  unlockText: string;
}

const rep = (id: string, n: number) => Array.from({ length: n }, () => id);

export const DESKS: DeskDef[] = [
  {
    id: 'intern',
    name: 'The Intern',
    role: 'Balanced',
    desc: 'Plain buys and shorts, one look at the tape. The best desk to learn the market.',
    deck: [...rep('buy', 4), ...rep('sell', 4), 'read_tape', 'take_profit'],
    algos: [],
    trust: 3,
    cash: 4,
    unlock: null,
    unlockText: 'Available from the start',
  },
  {
    id: 'quant',
    name: 'The Quant',
    role: 'Information',
    desc: 'Starts with Backtester and extra intel. Sees the future, trades smaller.',
    deck: [...rep('buy', 3), ...rep('sell', 3), 'read_tape', 'read_tape', 'ta', 'take_profit'],
    algos: ['backtester'],
    trust: 3,
    cash: 2,
    unlock: 'quant',
    unlockText: 'Clear Year 1 with any desk',
  },
  {
    id: 'degen',
    name: 'The Degen',
    role: 'High risk',
    desc: 'YOLO Calls, Doom Puts and Leverage from day one. Huge swings, frequent margin calls, $8 to start.',
    deck: [...rep('buy', 3), ...rep('sell', 3), 'yolo', 'doom', 'leverage', 'take_profit', 'cut_losses'],
    algos: [],
    trust: 3,
    cash: 8,
    unlock: 'degen',
    unlockText: 'Finish a session at 2x its quota',
  },
  {
    id: 'maker',
    name: 'The Market Maker',
    role: 'Volume',
    desc: 'Spread Bot and a hand full of scalps. Wins by trading often, not by being right.',
    deck: [...rep('scalp_long', 3), ...rep('scalp_short', 3), 'buy', 'sell', 'take_profit', 'research'],
    algos: ['spread_bot'],
    trust: 3,
    cash: 4,
    unlock: 'maker',
    unlockText: 'Win a run (survive 3 years)',
  },
];

export const DESK_BY_ID: Record<string, DeskDef> = Object.fromEntries(DESKS.map((d) => [d.id, d]));
