import { useEffect, useRef, useState } from 'preact/hooks';
import type { RunState } from '../../engine/types';
import { canPlay, canRingBell, cardCost, isNewsVisible, nextBar, playCard, ringBell } from '../../engine/game';
import { currentTrend, equity, tradeLabel, tradePnl, unrealized } from '../../engine/ops';
import { cardPreview } from '../../engine/preview';
import { sfx } from '../audio';
import { BOSSES, TICKERS } from '../../engine/data/market';
import { Chart } from '../Chart';
import { CardView, Tip, fmtSigned } from '../common';
import { Icon } from '../icons';
import type { Toast } from '../App';

const LEAN_TEXT: Record<string, string> = {
  '-2': 'Strong sell-off',
  '-1': 'Bearish',
  '0': 'Flat',
  '1': 'Bullish',
  '2': 'Strong rally',
};

function useTween(target: number, ms = 420): number {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / ms);
      const val = a + (target - a) * (1 - Math.pow(1 - p, 3));
      setV(val);
      from.current = val;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

export interface Coach {
  text: string;
  onNext: () => void;
  onSkip: () => void;
  step: number;
  total: number;
}

export function SessionScreen({
  run,
  act,
  toasts,
  version,
  coach,
}: {
  run: RunState;
  act: (fn: (r: RunState) => void) => void;
  toasts: Toast[];
  version: number;
  coach: Coach | null;
}) {
  const s = run.session!;
  const eq = equity(s);
  const unr = unrealized(s);
  const shown = useTween(eq);
  const trend = currentTrend(s);
  const boss = s.bossId ? BOSSES.find((b) => b.id === s.bossId) : null;
  const t = TICKERS[s.tickerId];
  const quotaPct = Math.max(0, Math.min(100, (eq / s.quota) * 100));
  const realizedPct = Math.max(0, Math.min(100, (s.realized / s.quota) * 100));
  const ddPct = eq < 0 ? Math.min(100, (-eq / s.marginLimit) * 100) : 0;
  const bell = canRingBell(run);
  const upcoming = s.news.filter((n) => n.bar >= s.bar && isNewsVisible(s, n));
  const [hover, setHover] = useState<number | null>(null);
  const hoverIdx = hover !== null ? s.hand.findIndex((c) => c.uid === hover) : -1;
  const hoverCard = hoverIdx >= 0 ? s.hand[hoverIdx] : undefined;
  const preview = hoverCard && s.status === 'play' ? cardPreview(run, s, hoverCard) : null;
  const hoverErr = hoverCard ? canPlay(run, hoverIdx) : null;
  const lastCandle = s.candles[s.candles.length - 1];
  const lastMove = lastCandle ? lastCandle.c - lastCandle.o : 0;
  const danger = eq <= -s.marginLimit * 0.6;
  const closingNext = s.trades.filter((tr) => tr.barsLeft === 1).length;

  const effects: { label: string; tip: string }[] = [];
  if (s.nextBarBonus) effects.push({ label: `Next bar ${fmtSigned(s.nextBarBonus)}`, tip: 'Pump It / Dump It will push the next bar.' });
  if (s.hedgePct) effects.push({ label: `Hedge ${s.hedgePct}%`, tip: 'Losses on the next bar are cut.' });
  if (s.leverage) effects.push({ label: `Leverage x2 (${s.leverage})`, tip: 'Your next trade this bar is double size.' });
  if (s.powers.make_markets) effects.push({ label: `Make Markets +${s.powers.make_markets}`, tip: '+P&L for every card you play.' });
  if (s.powers.momentum) effects.push({ label: `Momentum +${s.powers.momentum}`, tip: 'Trades with the trend get extra size.' });
  if (s.powers.compound) effects.push({ label: `Compound +${s.powers.compound}`, tip: 'Profitable closes pay extra.' });
  if (s.powers.flow) effects.push({ label: `Flow +${s.powers.flow}`, tip: 'Extra Focus every bar.' });
  if (s.multBonus) effects.push({ label: `Profits +${Math.round(s.multBonus * 100)}%`, tip: 'Compounder bonus on every profit.' });

  return (
    <div class="session">
      <section class="sess-main">
        <div class="chart-head">
          <div class="ticker">
            <span class="ticker-id">{s.tickerId}</span>
            <span class="ticker-name">{t.name}</span>
            {boss ? <span class="boss-pill">{boss.name}</span> : <span class="tag">{t.tag}</span>}
          </div>
          <Tip tip="Where the price leans on the next bar. It is a tendency, not a promise: noise can beat it. Read the Tape shows the exact direction.">
            <div class={`lean lean-${trend}`}>
              <span class="lean-label">Lean</span>
              <span class="lean-bars">
                {[-2, -1, 0, 1, 2].map((k) => (
                  <span class={`lb ${(trend > 0 && k > 0 && k <= trend) || (trend < 0 && k < 0 && k >= trend) || (trend === 0 && k === 0) ? 'on' : ''} ${k < 0 ? 'neg' : k > 0 ? 'pos' : 'zero'}`} />
                ))}
              </span>
              <span class="lean-text">{LEAN_TEXT[String(trend)]}</span>
            </div>
          </Tip>
          {boss && <div class="boss-note">{boss.desc}</div>}
        </div>
        {coach && (
          <div class="coach" role="note">
            <div class="coach-step">
              Tutorial {coach.step}/{coach.total}
            </div>
            <div class="coach-text">{coach.text}</div>
            <div class="coach-actions">
              <button type="button" class="btn small" onClick={coach.onNext}>
                Got it
              </button>
              <button type="button" class="link" onClick={coach.onSkip}>
                Skip tutorial
              </button>
            </div>
          </div>
        )}
        <Chart s={s} version={version} preview={preview} />
        <div class="trades-row">
          {s.trades.length === 0 && <span class="muted small">No open trades. Order cards open trades at the current price.</span>}
          {s.trades.map((tr) => {
            const v = tradePnl(s, tr);
            const delta = lastCandle && tr.openedAt < s.bar && tr.kind === 'dir' ? lastMove * tr.dir * tr.size : null;
            const hl = preview?.highlight.includes(tr.id);
            return (
              <div class={`trade-chip ${tr.kind === 'straddle' ? 'straddle' : tr.dir > 0 ? 'long' : 'short'} ${hl ? 'hl' : ''} ${tr.barsLeft === 1 ? 'expiring' : ''}`} key={tr.id}>
                <span class="tc-label">{tradeLabel(tr)}</span>
                <span class="tc-meta">
                  @{s.base + tr.entry} · {tr.barsLeft === 1 ? 'closes next bar' : `${tr.barsLeft} bars left`}
                </span>
                <span class={`tc-pnl ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}`}>{fmtSigned(v)}</span>
                {delta !== null && delta !== 0 && (
                  <span class={`tc-delta ${delta > 0 ? 'pos' : 'neg'}`} key={`${tr.id}-${s.bar}`}>
                    {fmtSigned(delta)} last bar
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {upcoming.length > 0 && (
          <div class="news-row">
            <Icon name="news" size={16} />
            {upcoming.map((n) => (
              <span class={`news-chip ${n.swan ? 'swan' : ''}`}>
                Bar {n.bar + 1}: {n.title}{' '}
                {n.known ? <b class={n.move > 0 ? 'pos' : 'neg'}>{fmtSigned(n.move)}</b> : <b class="amber">±?</b>}
              </span>
            ))}
          </div>
        )}
      </section>

      <aside class="sess-side">
        <div class={`pnl-panel ${danger ? 'danger' : ''} ${bell ? 'over' : ''}`}>
          <div class="pnl-label">Quarter P&L</div>
          <div class={`pnl-big ${eq > 0 ? 'pos' : eq < 0 ? 'neg' : ''}`}>{fmtSigned(shown)}</div>
          <div class="pnl-sub">
            booked {fmtSigned(s.realized)} · open {fmtSigned(unr)}
          </div>
          <div class="quota">
            <div class="quota-bar">
              <span class="q-open" style={{ width: `${quotaPct}%` }} />
              <span class="q-real" style={{ width: `${realizedPct}%` }} />
            </div>
            <div class="quota-text">
              <span>Quota</span>
              <b>{s.quota}</b>
            </div>
          </div>
          <Tip tip="If your P&L, open trades included, falls to this level, you get a margin call: trades are force-closed and the quarter fails.">
            <div class="margin">
              <div class="margin-bar">
                <span style={{ width: `${ddPct}%` }} />
              </div>
              <div class="quota-text">
                <span>Margin call at</span>
                <b class="neg">−{s.marginLimit}</b>
              </div>
            </div>
          </Tip>
        </div>
        <div class="bar-dots" aria-label={`Bar ${Math.min(s.bar + 1, s.bars)} of ${s.bars}`}>
          {Array.from({ length: s.bars }, (_, i) => (
            <span class={i < s.bar ? 'done' : i === s.bar ? 'now' : ''} />
          ))}
          <span class="bar-text">
            Bar {Math.min(s.bar + 1, s.bars)}/{s.bars}
          </span>
        </div>
        <button type="button" class="btn primary big next-btn" onClick={() => act((r) => nextBar(r))}>
          <span>
            {s.bar === s.bars - 1 ? 'Close the quarter' : 'Next bar'} <kbd>Space</kbd>
          </span>
          <span class="next-sub">
            {s.bar === s.bars - 1
              ? 'All open trades close at the final price'
              : s.trades.length
                ? `${s.trades.length} open${closingNext ? `, ${closingNext} close${closingNext > 1 ? '' : 's'} after this bar` : ''}${s.focus > 0 && s.hand.length ? ` · ${s.focus} Focus unspent` : ''}`
                : s.focus > 0 && s.hand.length
                  ? `No trades open · ${s.focus} Focus unspent`
                  : 'The price moves one bar'}
          </span>
        </button>
        <Tip tip="You are over the quota: end the quarter now and bank everything. Staying in can earn bonus cash, or lose it.">
          <button type="button" class={`btn bell ${bell ? 'ready' : ''}`} disabled={!bell} onClick={() => act((r) => ringBell(r))}>
            <Icon name="bell" size={16} /> Ring the bell
          </button>
        </Tip>
        {effects.length > 0 && (
          <div class="effects">
            {effects.map((e) => (
              <Tip tip={e.tip}>
                <span class="effect">{e.label}</span>
              </Tip>
            ))}
          </div>
        )}
        <div class="feed" aria-live="polite">
          {toasts.slice(-7).map((x) => (
            <div class={`feed-item k-${x.kind}`} key={x.id}>
              <span>{x.text}</span>
              {x.value !== undefined && x.kind !== 'open' && x.kind !== 'heat' && (
                <b class={x.value > 0 ? 'pos' : x.value < 0 ? 'neg' : ''}>{fmtSigned(x.value)}</b>
              )}
            </div>
          ))}
        </div>
      </aside>

      <footer class="hand-area">
        <div class={`preview-bar ${hoverErr ? 'err' : ''}`} aria-live="polite">
          {preview ? (
            <>
              <b>{hoverErr ? `Can't play: ${hoverErr}.` : 'Preview'}</b> {preview.text}
            </>
          ) : s.status === 'play' ? (
            <span class="muted">Hover a card to see exactly what it will do on the chart. Press its number to play it, Space for the next bar.</span>
          ) : null}
        </div>
        <Tip tip="Focus pays for cards. You get 3 every bar; unspent Focus does not carry over.">
          <div class="focus">
            <span class="focus-num">{s.focus}</span>
            <span class="focus-label">Focus</span>
          </div>
        </Tip>
        <div class={`hand ${s.hand.length > 6 ? 'crowded' : ''}`}>
          {s.hand.map((c, i) => {
            const err = canPlay(run, i);
            return (
              <CardView
                key={c.uid}
                id={c.id}
                up={c.up}
                cost={cardCost(run, s, c)}
                disabled={!!err}
                reason={err}
                hotkey={i < 9 ? i + 1 : undefined}
                onClick={() => act((r) => playCard(r, i))}
                onHover={(on) => {
                  setHover(on ? c.uid : null);
                  if (on) sfx.hover();
                }}
                extraClass="in-hand"
              />
            );
          })}
          {s.hand.length === 0 && <div class="muted small hand-empty">Hand empty. Press Next bar.</div>}
        </div>
        <div class="mobile-ctl">
          <span class={`mobile-pnl ${eq > 0 ? 'pos' : eq < 0 ? 'neg' : ''}`}>
            {fmtSigned(eq)} / {s.quota}
          </span>
          <button type="button" class="btn primary" onClick={() => act((r) => nextBar(r))}>
            {s.bar === s.bars - 1 ? 'Close' : 'Next bar'}
          </button>
        </div>
        <div class="piles">
          <Tip tip="Cards left in your draw pile. When it runs out, the discard pile is shuffled back in.">
            <span>
              Draw <b>{s.draw.length}</b>
            </span>
          </Tip>
          <span>
            Discard <b>{s.discard.length}</b>
          </span>
          {s.exhaust.length > 0 && (
            <span>
              Exhausted <b>{s.exhaust.length}</b>
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}
