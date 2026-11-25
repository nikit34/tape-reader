import type { CardInst, Dir, RunState, SessionState } from './types';
import { CARDS, cardParams } from './data/cards';
import { currentTrend, effectiveSize, isNewsVisibleAt, lastMoveDir, tradeLabel, tradePnl } from './ops';

export interface Ghost {
  dir: Dir;
  size: number;
  bars: number;
  kind: 'dir' | 'straddle';
}

export interface Preview {
  text: string;
  ghosts: Ghost[];
  reveal: number[];
  highlight: number[];
  extend: number;
  nudge: number;
}

const sign = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0');

function closesAfter(s: SessionState, bars: number): string {
  const last = s.bar + bars;
  if (last >= s.bars) return 'closes when the quarter ends';
  return `closes after bar ${last}`;
}

export function cardPreview(run: RunState, s: SessionState, c: CardInst): Preview {
  const d = CARDS[c.id];
  const p = cardParams(c.id, c.up);
  const out: Preview = { text: '', ghosts: [], reveal: [], highlight: [], extend: 0, nudge: 0 };
  const extra = s.mods.extraBars ?? 0;
  const price = s.base + s.price;
  const nextBar = s.bar + 1;

  const order = (dir: Dir, size: number, bars: number) => {
    const sz = effectiveSize(run, s, dir, size, 'dir', s.leverage > 0);
    const b = bars + extra;
    out.ghosts.push({ dir, size: sz, bars: b, kind: 'dir' });
    const side = dir > 0 ? 'LONG' : 'SHORT';
    const good = dir > 0 ? 'rises' : 'falls';
    out.text = `${side} ${sz} at ${price}, ${closesAfter(s, b)}. Earns ${sz} per point the price ${good}, loses ${sz} per point the other way.`;
  };

  switch (c.id) {
    case 'buy':
    case 'scalp_long':
    case 'swing_long':
    case 'yolo':
      order(1, p.size, p.bars);
      break;
    case 'sell':
    case 'scalp_short':
    case 'swing_short':
    case 'doom':
      order(-1, p.size, p.bars);
      break;
    case 'ride': {
      const tr = currentTrend(s);
      if (tr === 0) out.text = 'The Lean is flat right now, so nothing opens and the Focus comes back.';
      else order(tr > 0 ? 1 : -1, p.size, p.bars);
      break;
    }
    case 'fade': {
      const last = lastMoveDir(s);
      if (last === 0) out.text = 'The last bar was flat, so nothing opens and the Focus comes back.';
      else order(last > 0 ? -1 : 1, p.size, p.bars);
      break;
    }
    case 'straddle': {
      const sz = effectiveSize(run, s, 1, p.size, 'straddle', s.leverage > 0);
      const b = p.bars + extra;
      out.ghosts.push({ dir: 1, size: sz, bars: b, kind: 'straddle' });
      const need = Math.floor(p.prem / sz) + 1;
      out.text = `Pays ${sz} per point the price moves in either direction minus ${p.prem}, ${closesAfter(s, b)}. Profitable after a ${need}-point move.`;
      break;
    }
    case 'arbitrage':
      out.text = `+${p.gain} P&L right now, no matter what the market does.`;
      break;
    case 'read_tape':
      out.reveal = [s.bar];
      out.text = `Shows which way the market pushes bar ${nextBar}, then draws ${p.draw} card. A hidden headline on that bar can still flip it.`;
      break;
    case 'ta': {
      for (let k = 0; k < p.n && s.bar + k < s.bars; k++) out.reveal.push(s.bar + k);
      out.text = `Shows the market direction of bars ${nextBar}-${s.bar + out.reveal.length}. Hidden headlines are not included.`;
      break;
    }
    case 'backtest':
      out.reveal = [s.bar];
      out.text = `Shows bar ${nextBar}, then opens a size ${p.size} trade in its direction for that one bar. A safe small win unless the bar is flat.`;
      break;
    case 'insider': {
      const hidden = s.news.filter((n) => !n.known && n.bar >= s.bar && isNewsVisibleAt(s, n)).length;
      out.text = hidden ? `Shows which way ${hidden} upcoming headline${hidden > 1 ? 's' : ''} will move the price. Draws ${p.draw}.` : `No hidden headlines left this quarter. Still draws ${p.draw}.`;
      break;
    }
    case 'research':
      out.text = `Draws ${p.draw} more cards this bar.`;
      break;
    case 'espresso':
      out.text = `+${p.f} Focus for this bar, then the card is gone for the quarter.`;
      break;
    case 'take_profit': {
      let best = s.trades[0];
      for (const t of s.trades) if (tradePnl(s, t) > tradePnl(s, best)) best = t;
      if (!best) break;
      const v = tradePnl(s, best);
      out.highlight = [best.id];
      out.text =
        v > 0
          ? `Closes ${tradeLabel(best)} now: ${sign(v)} plus ${p.pct}% bonus, about ${sign(Math.round(v * (1 + p.pct / 100 + s.multBonus)) + (s.powers.compound ?? 0))}.`
          : `Your best trade ${tradeLabel(best)} is at ${sign(v)}, so it closes with no bonus.`;
      break;
    }
    case 'cut_losses': {
      const losers = s.trades.filter((t) => tradePnl(s, t) < 0);
      const loss = losers.reduce((a, t) => a + tradePnl(s, t), 0);
      out.highlight = losers.map((t) => t.id);
      out.text = losers.length
        ? `Closes ${losers.length} losing trade${losers.length > 1 ? 's' : ''} at ${sign(loss)} and refunds ${sign(Math.round((-loss * p.pct) / 100))}. Draws ${p.draw}.`
        : `No losing trades now, it only draws ${p.draw}.`;
      break;
    }
    case 'lock_gains': {
      const win = s.trades.filter((t) => tradePnl(s, t) > 0);
      const gain = win.reduce((a, t) => a + tradePnl(s, t), 0);
      out.highlight = win.map((t) => t.id);
      out.text = win.length ? `Banks ${sign(gain)} from ${win.length} trade${win.length > 1 ? 's' : ''} in profit. Draws ${p.draw}.` : `No trades in profit now, it only draws ${p.draw}.`;
      break;
    }
    case 'roll':
      out.extend = p.n;
      out.highlight = s.trades.map((t) => t.id);
      out.text = `Every open trade stays ${p.n} bars longer.`;
      break;
    case 'double_down': {
      const t = s.trades[s.trades.length - 1];
      if (!t) break;
      out.highlight = [t.id];
      out.ghosts.push({ dir: t.dir, size: t.size, bars: t.barsLeft, kind: t.kind });
      out.text = `Opens another ${tradeLabel(t)} at ${price}, closing with the original.`;
      break;
    }
    case 'pyramid': {
      const win = s.trades.filter((t) => t.kind === 'dir' && tradePnl(s, t) > 0);
      out.highlight = win.map((t) => t.id);
      for (const t of win) out.ghosts.push({ dir: t.dir, size: p.size, bars: t.barsLeft, kind: 'dir' });
      out.text = win.length ? `Adds ${win.length} size ${p.size} trade${win.length > 1 ? 's' : ''} next to your winners.` : 'No trade in profit right now, nothing happens.';
      break;
    }
    case 'hedge':
      out.highlight = s.trades.map((t) => t.id);
      out.text = `On bar ${nextBar}, every loss on your trades is cut by ${p.pct}%. Gains are untouched.`;
      break;
    case 'flip': {
      const dirs = s.trades.filter((t) => t.kind === 'dir');
      const v = dirs.reduce((a, t) => a + tradePnl(s, t), 0);
      out.highlight = dirs.map((t) => t.id);
      for (const t of dirs) out.ghosts.push({ dir: (t.dir * -1) as Dir, size: t.size, bars: p.bars, kind: 'dir' });
      out.text = `Books ${sign(v)} now and reopens every trade the other way for ${p.bars} bars.`;
      break;
    }
    case 'leverage':
      out.text = `The next ${p.n > 1 ? `${p.n} trades` : 'trade'} you open this bar ${p.n > 1 ? 'are' : 'is'} double size. Risky both ways.`;
      break;
    case 'pump':
      out.nudge = p.m;
      out.text = `Bar ${nextBar} moves ${p.m} points higher than it would. Helps LONGs, hurts SHORTs.`;
      break;
    case 'dump':
      out.nudge = -p.m;
      out.text = `Bar ${nextBar} moves ${p.m} points lower than it would. Helps SHORTs, hurts LONGs.`;
      break;
    case 'lobbyist':
      out.text = `Heat ${run.heat} → ${Math.max(0, run.heat - p.h)}.`;
      break;
    case 'iron_stomach':
      out.text = `Margin call moves from −${s.marginLimit} to −${s.marginLimit + p.n}.`;
      break;
    default:
      out.text = d.text(p);
  }
  if (!out.text) out.text = d.text(p);
  const heat = (c.up && d.heatUp !== undefined ? d.heatUp : d.heat) ?? 0;
  if (heat) out.text += ` Adds Heat.`;
  return out;
}
