import { useEffect, useRef, useState } from 'preact/hooks';
import type { MetaState } from '../../engine/types';
import { DESKS } from '../../engine/data/desks';
import { CARDS, CARD_IDS } from '../../engine/data/cards';
import { ALGOS, ALGO_IDS } from '../../engine/data/algos';
import { AlgoChip, CardView, Modal, fmtTime } from '../common';
import { Icon } from '../icons';

function TickerBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const pts: number[] = [];
    let v = 0;
    let m = 0;
    for (let i = 0; i < 120; i++) {
      if (Math.random() < 0.15) m = Math.max(-1.5, Math.min(1.5, m + (Math.random() < 0.5 ? -0.7 : 0.7)));
      v += m + (Math.random() - 0.5) * 4;
      pts.push(v);
    }
    let off = 0;
    const draw = () => {
      const w = (cv.width = cv.clientWidth * devicePixelRatio);
      const h = (cv.height = cv.clientHeight * devicePixelRatio);
      ctx.clearRect(0, 0, w, h);
      off += 0.35;
      if (off >= 1) {
        off = 0;
        pts.shift();
        if (Math.random() < 0.15) m = Math.max(-1.5, Math.min(1.5, m + (Math.random() < 0.5 ? -0.7 : 0.7)));
        v += m + (Math.random() - 0.5) * 4;
        pts.push(v);
      }
      const min = Math.min(...pts);
      const max = Math.max(...pts);
      const step = w / (pts.length - 1);
      ctx.lineWidth = 2 * devicePixelRatio;
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(46,229,157,0)');
      grad.addColorStop(1, 'rgba(46,229,157,0.55)');
      ctx.strokeStyle = grad;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = i * step - off * step;
        const y = h * 0.2 + ((max - p) / (max - min || 1)) * h * 0.6;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas class="backdrop" ref={ref} aria-hidden="true" />;
}

export function TitleScreen({
  hasRun,
  meta,
  onContinue,
  onNew,
  onHelp,
  onCodex,
  onSound,
}: {
  hasRun: boolean;
  meta: MetaState;
  onContinue: () => void;
  onNew: () => void;
  onHelp: () => void;
  onCodex: () => void;
  onSound: () => void;
}) {
  return (
    <div class="title-screen">
      <TickerBackdrop />
      <div class="title-inner">
        <div class="logo">
          <span class="logo-mark">
            <Icon name="up" size={44} stroke={2.6} />
          </span>
          <h1>
            TAPE<span>READER</span>
          </h1>
        </div>
        <p class="tagline">A market roguelite deckbuilder. Read the tape, play your orders, beat the quota.</p>
        <div class="title-actions">
          {hasRun && (
            <button type="button" class="btn primary big" onClick={onContinue}>
              Continue run
            </button>
          )}
          <button type="button" class={`btn big ${hasRun ? '' : 'primary'}`} onClick={onNew}>
            New run
          </button>
          <div class="title-row">
            <button type="button" class="btn" onClick={onHelp}>
              <Icon name="help" size={16} /> How to play
            </button>
            <button type="button" class="btn" onClick={onCodex}>
              <Icon name="deck" size={16} /> Codex & stats
            </button>
            <button type="button" class="btn" onClick={onSound} aria-label="Toggle sound">
              <Icon name={meta.sound ? 'sound' : 'mute'} size={16} />
            </button>
          </div>
        </div>
        <p class="title-foot">
          Prototype v0.1 · runs fully in your browser · progress saves automatically
          {meta.runs > 0 && ` · ${meta.runs} run${meta.runs > 1 ? 's' : ''}, ${meta.wins} win${meta.wins === 1 ? '' : 's'}`}
        </p>
        <p class="title-docs">
          <a href="./onepager.html">One-pager (RU)</a> · <a href="./plan.html">Production plan (RU)</a>
        </p>
      </div>
    </div>
  );
}

export function DeskSelect({ meta, onStart, onBack }: { meta: MetaState; onStart: (desk: string) => void; onBack: () => void }) {
  const [sel, setSel] = useState('intern');
  return (
    <div class="screen desks">
      <div class="screen-head">
        <div class="eyebrow">New run</div>
        <h1>Choose your desk</h1>
        <p class="lead">Each desk starts with its own deck. Unlock more by playing.</p>
      </div>
      <div class="desk-grid">
        {DESKS.map((d) => {
          const locked = !!d.unlock && !meta.unlocked.includes(d.unlock);
          return (
            <button
              type="button"
              class={`desk-card ${sel === d.id ? 'selected' : ''} ${locked ? 'locked' : ''}`}
              onClick={() => !locked && setSel(d.id)}
              aria-disabled={locked}
            >
              <span class="desk-role">{d.role}</span>
              <span class="desk-name">{d.name}</span>
              <span class="desk-desc">{locked ? `Locked. ${d.unlockText}.` : d.desc}</span>
              {!locked && (
                <span class="desk-meta">
                  {d.deck.length} cards · Trust {d.trust} · ${d.cash}
                  {d.algos.length ? ` · ${d.algos.map((a) => ALGOS[a].name).join(', ')}` : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div class="shop-foot">
        <button type="button" class="btn ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" class="btn primary big" onClick={() => onStart(sel)}>
          Open the desk
        </button>
      </div>
    </div>
  );
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to play" onClose={onClose} wide>
      <div class="help">
        <section>
          <h3>The goal</h3>
          <p>
            You run a tiny trading fund. A run is 3 years of 4 quarters. Each quarter you trade one stock for 8 bars and must finish with P&L at or above the
            quota. Every 4th quarter is a boss with a twist. Survive all 12 quarters and your fund goes public.
          </p>
        </section>
        <section>
          <h3>A bar</h3>
          <p>
            You get 3 Focus and 5 cards. Play order cards to open trades at the current price, then press Next bar (Space). The price moves, open trades gain or
            lose, and trades whose bars run out close and book their P&L. Unplayed cards are discarded and you draw a fresh hand.
          </p>
        </section>
        <section>
          <h3>Reading the market</h3>
          <p>
            The Lean gauge shows where the price tends to go next bar. It is a tendency: random noise can beat it. Intel cards like Read the Tape reveal exact
            directions as arrows on the chart. Headlines (N) hit on a known bar with a big move; their direction is hidden unless you have intel.
          </p>
        </section>
        <section>
          <h3>Risk</h3>
          <p>
            If P&L with open trades included drops to the margin limit, you get a margin call and the quarter fails. Missing a quota costs 1 Trust; at 0 the fund
            closes. Shady cards add Heat; at 10 Heat after a quarter the Commission fines you.
          </p>
        </section>
        <section>
          <h3>Between quarters</h3>
          <p>
            Earn cash, pick a new card, and visit the shop for cards, algorithms (passive bots, up to 5), card removal and upgrades. Beating a boss also gives a
            free algorithm.
          </p>
        </section>
        <section>
          <h3>Keys</h3>
          <p>
            <kbd>1</kbd>-<kbd>9</kbd> play a card, <kbd>Space</kbd> next bar, <kbd>Enter</kbd> continue, <kbd>D</kbd> deck, <kbd>Esc</kbd> close.
          </p>
        </section>
      </div>
    </Modal>
  );
}

export function CodexModal({ meta, onClose }: { meta: MetaState; onClose: () => void }) {
  const [tab, setTab] = useState<'cards' | 'algos' | 'stats'>('cards');
  const seenC = new Set(meta.seenCards);
  const seenA = new Set(meta.seenAlgos);
  return (
    <Modal title="Codex & stats" onClose={onClose} wide>
      <div class="tabs">
        <button type="button" class={tab === 'cards' ? 'on' : ''} onClick={() => setTab('cards')}>
          Cards {CARD_IDS.filter((i) => seenC.has(i)).length}/{CARD_IDS.length}
        </button>
        <button type="button" class={tab === 'algos' ? 'on' : ''} onClick={() => setTab('algos')}>
          Algorithms {ALGO_IDS.filter((i) => seenA.has(i)).length}/{ALGO_IDS.length}
        </button>
        <button type="button" class={tab === 'stats' ? 'on' : ''} onClick={() => setTab('stats')}>
          Stats
        </button>
      </div>
      {tab === 'cards' && (
        <div class="deck-grid">
          {CARD_IDS.map((id) =>
            seenC.has(id) ? (
              <CardView id={id} up={false} small />
            ) : (
              <div class="card is-small unknown">
                <span class="card-name">???</span>
                <span class="card-text muted">{CARDS[id].rarity}</span>
              </div>
            ),
          )}
        </div>
      )}
      {tab === 'algos' && (
        <div class="algo-row wrap">
          {ALGO_IDS.map((id) =>
            seenA.has(id) ? (
              <AlgoChip id={id} big />
            ) : (
              <div class="algo-card unknown">
                <span class="algo-hex">?</span>
                <span class="algo-name">???</span>
              </div>
            ),
          )}
        </div>
      )}
      {tab === 'stats' && (
        <ul class="ledger">
          <li>
            <span>Runs started</span>
            <b>{meta.runs}</b>
          </li>
          <li>
            <span>Wins</span>
            <b>{meta.wins}</b>
          </li>
          <li>
            <span>Furthest quarter</span>
            <b>
              Y{Math.floor(meta.bestQuarterIndex / 4) + 1} Q{(meta.bestQuarterIndex % 4) + 1}
            </b>
          </li>
          <li>
            <span>Best quarter P&L</span>
            <b>{meta.bestSession}</b>
          </li>
          <li>
            <span>Desks unlocked</span>
            <b>
              {meta.unlocked.length}/{DESKS.length}
            </b>
          </li>
          <li>
            <span>Total play time</span>
            <b>{fmtTime(meta.totalPlayMs)}</b>
          </li>
        </ul>
      )}
    </Modal>
  );
}

export function MenuModal({
  meta,
  onClose,
  onSound,
  onHelp,
  onAbandon,
  onTitle,
}: {
  meta: MetaState;
  onClose: () => void;
  onSound: () => void;
  onHelp: () => void;
  onAbandon: () => void;
  onTitle: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <Modal title="Menu" onClose={onClose}>
      <div class="menu-list">
        <button type="button" class="btn" onClick={onClose}>
          Resume
        </button>
        <button type="button" class="btn" onClick={onHelp}>
          How to play
        </button>
        <button type="button" class="btn" onClick={onSound}>
          Sound: {meta.sound ? 'on' : 'off'}
        </button>
        <button type="button" class="btn" onClick={onTitle}>
          Save and go to title
        </button>
        {!confirm ? (
          <button type="button" class="btn danger" onClick={() => setConfirm(true)}>
            Abandon run
          </button>
        ) : (
          <button type="button" class="btn danger" onClick={onAbandon}>
            Really abandon? This run is lost
          </button>
        )}
      </div>
    </Modal>
  );
}
