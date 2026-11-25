import { useState } from 'preact/hooks';
import type { RunState } from '../../engine/types';
import {
  buyItem,
  continueFromResult,
  goEndless,
  leaveShop,
  marginFor,
  pickBossAlgo,
  pickReward,
  removeCard,
  reroll,
  sellAlgo,
  sessionPreview,
  startSession,
  upgradeCard,
} from '../../engine/game';
import { TICKERS, bossFor, regimeFor } from '../../engine/data/market';
import { ALGOS } from '../../engine/data/algos';
import { DESK_BY_ID } from '../../engine/data/desks';
import { AlgoChip, CardView, DeckModal, Rich, Tip, fmtSigned, fmtTime } from '../common';

type Act = (fn: (r: RunState) => void) => void;

function VolBars({ v }: { v: number }) {
  const n = Math.max(1, Math.min(5, Math.round(v * 3)));
  return (
    <span class="volbars" aria-label={`Volatility ${n} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span class={i < n ? 'on' : ''} />
      ))}
    </span>
  );
}

export function Briefing({ run, act, firstRun }: { run: RunState; act: Act; firstRun: boolean }) {
  const reg = regimeFor(run.year);
  const isBoss = run.quarter === 3;
  const boss = isBoss ? bossFor(run.year) : null;
  return (
    <div class="screen briefing">
      <div class="screen-head">
        <div class="eyebrow">
          Year {run.year + 1} · Quarter {run.quarter + 1}
          {isBoss ? ' · Boss quarter' : ''}
        </div>
        <h1>{isBoss ? boss!.name : 'Pick your market'}</h1>
        <p class="lead">
          <span class={`regime regime-${reg.id}`}>{reg.name}</span> <Rich text={reg.desc} />
        </p>
        {firstRun && run.year === 0 && run.quarter === 0 && (
          <p class="hint">
            Each quarter you trade one stock for 8 bars. Calm stocks have lower quotas; volatile ones pay more cash but swing hard. Clear 4 quarters a year,
            survive 3 years, and your fund goes public.
          </p>
        )}
      </div>
      <div class="ticker-choices">
        {run.tickerOptions.map((id) => {
          const t = TICKERS[id];
          const pv = sessionPreview(run, id);
          return (
            <div class={`ticker-card ${isBoss ? 'boss' : ''}`}>
              <div class="tk-top">
                <span class="tk-id">{id}</span>
                <span class="tag">{isBoss ? 'Boss' : t.tag}</span>
              </div>
              <div class="tk-name">{t.name}</div>
              <div class="tk-desc">{isBoss ? boss!.desc : t.desc}</div>
              <dl class="tk-stats">
                <dt>Quota</dt>
                <dd>{pv.quota}</dd>
                <dt>Payout</dt>
                <dd>${pv.cash}</dd>
                <dt>Margin call</dt>
                <dd>−{marginFor(run, pv.quota)}</dd>
                <dt>Volatility</dt>
                <dd>
                  <VolBars v={(isBoss ? boss!.vol : t.vol) * reg.vol} />
                </dd>
                <dt>Headlines</dt>
                <dd>{isBoss ? (boss!.earnings ? 4 : boss!.swan ? '1 crash' : reg.news) : Math.min(3, t.news + reg.news)}</dd>
              </dl>
              <button type="button" class="btn primary" onClick={() => act((r) => startSession(r, id))}>
                Trade {id}
              </button>
            </div>
          );
        })}
      </div>
      {isBoss && <p class="muted center">Beat the boss to earn a free algorithm and a better card reward.</p>}
    </div>
  );
}

export function ResultScreen({ run, act, unlocks }: { run: RunState; act: Act; unlocks: string[] }) {
  const r = run.lastResult!;
  const title = r.reason === 'margin' ? 'Margin call' : r.won ? 'Quota met' : 'Quota missed';
  const dead = run.trust <= 0;
  return (
    <div class="screen result">
      <div class={`result-card ${r.won ? 'won' : 'lost'}`}>
        <div class="eyebrow">
          Year {r.year + 1} · Quarter {r.quarter + 1}
          {r.boss ? ' · Boss' : ''}
        </div>
        <h1>{title}</h1>
        <div class="result-pnl">
          <span class={r.pnl >= 0 ? 'pos' : 'neg'}>{fmtSigned(r.pnl)}</span>
          <span class="muted"> / {r.quota}</span>
        </div>
        {r.bestTrade > 0 && <div class="muted small">Best trade {fmtSigned(r.bestTrade)}</div>}
        <ul class="ledger">
          <li>
            <span>{r.won ? 'Payout' : 'Consolation payout'}</span>
            <b>${r.cash.base}</b>
          </li>
          {r.cash.overshoot > 0 && (
            <li>
              <span>Beat the quota by a wide margin</span>
              <b>+${r.cash.overshoot}</b>
            </li>
          )}
          <li>
            <span>Interest</span>
            <b>+${r.cash.interest}</b>
          </li>
          {r.cash.extra > 0 && (
            <li>
              <span>Offshore Account</span>
              <b>+${r.cash.extra}</b>
            </li>
          )}
          {r.audited && (
            <li class="neg">
              <span>Commission audit fine (Heat 10+)</span>
              <b>−${r.cash.fine}</b>
            </li>
          )}
          <li class="total">
            <span>Cash now</span>
            <b>${run.cash}</b>
          </li>
        </ul>
        {r.insuranceSaved && <p class="good">Insurance Fund covered the miss: no Trust lost.</p>}
        {r.trustLost > 0 && <p class="neg">Investors lose faith: −{r.trustLost} Trust.</p>}
        {unlocks.map((u) => (
          <p class="unlock">
            New desk unlocked: <b>{DESK_BY_ID[u]?.name ?? u}</b>
          </p>
        ))}
        <button type="button" class="btn primary big" onClick={() => act((x) => continueFromResult(x))}>
          {dead ? 'See the damage' : 'Continue'} <kbd>Enter</kbd>
        </button>
      </div>
    </div>
  );
}

export function RewardScreen({ run, act }: { run: RunState; act: Act }) {
  return (
    <div class="screen reward">
      <div class="screen-head">
        <div class="eyebrow">Reward</div>
        <h1>Add a card to your deck</h1>
        <p class="lead">Every card you add is drawn in future quarters. A tight deck draws your best cards more often.</p>
      </div>
      <div class="card-row">
        {run.rewardCards.map((c, i) => (
          <CardView id={c.id} up={c.up} onClick={() => act((r) => pickReward(r, i))} extraClass="pickable" />
        ))}
      </div>
      <button type="button" class="btn ghost" onClick={() => act((r) => pickReward(r, null))}>
        Skip and take $2
      </button>
    </div>
  );
}

export function BossRewardScreen({ run, act }: { run: RunState; act: Act }) {
  const [sel, setSel] = useState<string | null>(null);
  const full = run.algos.length >= run.algoSlots;
  return (
    <div class="screen reward">
      <div class="screen-head">
        <div class="eyebrow">Boss beaten</div>
        <h1>Pick an algorithm</h1>
        <p class="lead">Algorithms are passive bots that work every quarter for the rest of the run. You have {run.algoSlots} slots.</p>
      </div>
      <div class="algo-row">
        {run.rewardAlgos.map((id) => (
          <AlgoChip id={id} big selected={sel === id} onClick={() => (full ? setSel(id) : act((r) => pickBossAlgo(r, id)))} />
        ))}
      </div>
      {full && sel && (
        <div class="replace">
          <p>Slots full. Replace which algorithm?</p>
          <div class="algo-row">
            {run.algos.map((a) => (
              <AlgoChip id={a} big onClick={() => act((r) => pickBossAlgo(r, sel, a))} />
            ))}
          </div>
        </div>
      )}
      <button type="button" class="btn ghost" onClick={() => act((r) => pickBossAlgo(r, null))}>
        Skip
      </button>
    </div>
  );
}

export function ShopScreen({ run, act, firstRun }: { run: RunState; act: Act; firstRun: boolean }) {
  const [mode, setMode] = useState<null | 'remove' | 'upgrade'>(null);
  const [replaceFor, setReplaceFor] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const doAct = (fn: (r: RunState) => string | null) =>
    act((r) => {
      const err = fn(r);
      setMsg(err);
    });
  const nextQ = run.quarter === 3 ? `Year ${run.year + 2} · Q1` : `Year ${run.year + 1} · Q${run.quarter + 2}`;
  const bossNext = run.quarter === 2;
  return (
    <div class="screen shop">
      <div class="screen-head">
        <div class="eyebrow">Between quarters</div>
        <h1>The Desk Shop</h1>
        {firstRun && run.year === 0 && run.quarter === 0 && (
          <p class="hint">Spend cash on new cards and algorithms, trim weak cards, or upgrade your best ones. Unspent cash earns $1 interest per $5.</p>
        )}
        {msg && <p class="neg">{msg}</p>}
      </div>
      <div class="shop-grid">
        <section>
          <h3>Cards</h3>
          <div class="card-row">
            {run.shop.map((it, i) =>
              it.kind === 'card' ? (
                <div class={`shop-item ${it.sold ? 'sold' : ''}`}>
                  <CardView
                    id={it.id}
                    up={it.up}
                    small
                    disabled={it.sold || run.cash < it.price}
                    onClick={() => !it.sold && doAct((r) => buyItem(r, i))}
                  />
                  <span class="price">{it.sold ? 'Sold' : `$${it.price}`}</span>
                </div>
              ) : null,
            )}
          </div>
        </section>
        <section>
          <h3>Algorithms</h3>
          <div class="algo-row">
            {run.shop.map((it, i) =>
              it.kind === 'algo' ? (
                <div class={`shop-item ${it.sold ? 'sold' : ''}`}>
                  <AlgoChip
                    id={it.id}
                    big
                    dim={it.sold || run.cash < it.price}
                    selected={replaceFor === i}
                    onClick={() => {
                      if (it.sold) return;
                      if (run.algos.length >= run.algoSlots) setReplaceFor(i);
                      else doAct((r) => buyItem(r, i));
                    }}
                  />
                  <span class="price">{it.sold ? 'Sold' : `$${it.price}`}</span>
                </div>
              ) : null,
            )}
          </div>
          {replaceFor !== null && (
            <div class="replace">
              <p>Slots full. Replace which algorithm? (the old one is gone)</p>
              <div class="algo-row">
                {run.algos.map((a) => (
                  <AlgoChip
                    id={a}
                    big
                    onClick={() => {
                      const idx = replaceFor;
                      setReplaceFor(null);
                      doAct((r) => buyItem(r, idx, a));
                    }}
                  />
                ))}
              </div>
              <button type="button" class="link" onClick={() => setReplaceFor(null)}>
                Cancel
              </button>
            </div>
          )}
          <h3>Services</h3>
          <div class="services">
            <button type="button" class="btn" disabled={run.cash < run.removeCost || run.deck.length <= 6} onClick={() => setMode('remove')}>
              Remove a card · ${run.removeCost}
            </button>
            <button type="button" class="btn" disabled={run.cash < run.upgradeCost} onClick={() => setMode('upgrade')}>
              Upgrade a card · ${run.upgradeCost}
            </button>
            <button type="button" class="btn" disabled={run.cash < run.rerollCost} onClick={() => doAct((r) => reroll(r))}>
              Reroll stock · ${run.rerollCost}
            </button>
          </div>
          <h3>Your algorithms</h3>
          <div class="owned-algos">
            {run.algos.length === 0 && <span class="muted small">None yet.</span>}
            {run.algos.map((a) => (
              <div class="owned">
                <AlgoChip id={a} />
                <span>{ALGOS[a].name}</span>
                <button type="button" class="link" onClick={() => act((r) => sellAlgo(r, a))}>
                  Sell ${Math.floor(ALGOS[a].price / 2)}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div class="shop-foot">
        <span class="muted">
          Next: {nextQ}
          {bossNext ? ` · Boss: ${bossFor(run.year).name}` : ''}
        </span>
        <button type="button" class="btn primary big" onClick={() => act((r) => leaveShop(r))}>
          Next quarter
        </button>
      </div>
      {mode && (
        <DeckModal
          cards={run.deck}
          title={mode === 'remove' ? `Remove a card · $${run.removeCost}` : `Upgrade a card · $${run.upgradeCost}`}
          pickLabel={mode === 'remove' ? 'Click a card to remove it from your deck for good.' : 'Hover to preview the upgrade, click to buy it.'}
          filter={mode === 'upgrade' ? (c) => !c.up : undefined}
          showUpgrade={mode === 'upgrade'}
          onClose={() => setMode(null)}
          onPick={(uid) => {
            const m = mode;
            setMode(null);
            doAct((r) => (m === 'remove' ? removeCard(r, uid) : upgradeCard(r, uid)));
          }}
        />
      )}
    </div>
  );
}

export function EndScreen({
  run,
  act,
  onNewRun,
  onTitle,
}: {
  run: RunState;
  act: Act;
  onNewRun: () => void;
  onTitle: () => void;
}) {
  const win = run.phase === 'victory';
  const st = run.stats;
  const quarters = run.year * 4 + run.quarter + (win ? 1 : 0);
  return (
    <div class="screen end">
      <div class={`result-card ${win ? 'won' : 'lost'}`}>
        <div class="eyebrow">{DESK_BY_ID[run.desk]?.name}</div>
        <h1>{win ? 'Your fund goes public' : 'Fund closed'}</h1>
        <p class="lead">
          {win
            ? 'Three years, twelve quarters, and the investors are cheering. The IPO bell is yours.'
            : `Investors pulled out in Year ${run.year + 1}, Quarter ${run.quarter + 1}.`}
        </p>
        <ul class="ledger">
          <li>
            <span>Quarters cleared</span>
            <b>{st.sessionsWon}</b>
          </li>
          <li>
            <span>Quarters played</span>
            <b>{Math.max(quarters, st.sessionsWon + st.sessionsLost)}</b>
          </li>
          <li>
            <span>Total P&L</span>
            <b>{fmtSigned(st.totalPnl)}</b>
          </li>
          <li>
            <span>Best quarter</span>
            <b>{fmtSigned(st.bestSession)}</b>
          </li>
          <li>
            <span>Cards played</span>
            <b>{st.cardsPlayed}</b>
          </li>
          <li>
            <span>Margin calls</span>
            <b>{st.marginCalls}</b>
          </li>
          <li>
            <span>Run time</span>
            <b>{fmtTime(st.playMs)}</b>
          </li>
        </ul>
        <div class="end-algos">
          {run.algos.map((a) => (
            <AlgoChip id={a} />
          ))}
        </div>
        <div class="end-actions">
          {win && (
            <Tip tip="Keep the same deck and algorithms. Quotas grow 35% every year, bosses repeat. How far can you go?">
              <button type="button" class="btn" onClick={() => act((r) => goEndless(r))}>
                Keep trading (Endless)
              </button>
            </Tip>
          )}
          <button type="button" class="btn primary big" onClick={onNewRun}>
            New run
          </button>
          <button type="button" class="btn ghost" onClick={onTitle}>
            Title screen
          </button>
        </div>
      </div>
    </div>
  );
}

