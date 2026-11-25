import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { CardInst, RunState } from '../engine/types';
import { CARDS, cardBaseCost, cardHeat, cardText } from '../engine/data/cards';
import { ALGOS } from '../engine/data/algos';
import { bossFor, regimeFor } from '../engine/data/market';
import { Icon } from './icons';

const KEYWORDS: [RegExp, string][] = [
  [/\bLONG\b/g, 'kw-long'],
  [/\bSHORT\b/g, 'kw-short'],
  [/\bFocus\b/g, 'kw-focus'],
  [/\bHeat\b/g, 'kw-heat'],
  [/\bP&L\b/g, 'kw-pnl'],
  [/\bExhaust\b/g, 'kw-muted'],
];

export function Rich({ text }: { text: string }) {
  const parts: (string | { t: string; c: string })[] = [text];
  for (const [re, cls] of KEYWORDS) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (typeof p !== 'string') continue;
      const chunks: (string | { t: string; c: string })[] = [];
      let last = 0;
      p.replace(re, (m, off: number) => {
        if (off > last) chunks.push(p.slice(last, off));
        chunks.push({ t: m, c: cls });
        last = off + m.length;
        return m;
      });
      if (!chunks.length) continue;
      if (last < p.length) chunks.push(p.slice(last));
      parts.splice(i, 1, ...chunks);
      i += chunks.length - 1;
    }
  }
  return (
    <>
      {parts.map((p) => (typeof p === 'string' ? p : <span class={p.c}>{p.t}</span>))}
    </>
  );
}

export function Tip({ tip, children, wide }: { tip: ComponentChildren; children: ComponentChildren; wide?: boolean }) {
  return (
    <span class="tip-wrap" tabIndex={0}>
      {children}
      <span class={`tip ${wide ? 'tip-wide' : ''}`} role="tooltip">
        {tip}
      </span>
    </span>
  );
}

const TYPE_LABEL: Record<string, string> = {
  order: 'Order',
  intel: 'Intel',
  tactic: 'Tactic',
  shady: 'Shady',
  power: 'Power',
};

export function CardView({
  id,
  up,
  cost,
  disabled,
  onClick,
  hotkey,
  small,
  reason,
  extraClass,
  onHover,
}: {
  id: string;
  up: boolean;
  cost?: number;
  disabled?: boolean;
  onClick?: () => void;
  hotkey?: number;
  small?: boolean;
  reason?: string | null;
  extraClass?: string;
  onHover?: (on: boolean) => void;
}) {
  const d = CARDS[id];
  const base = cardBaseCost(id, up);
  const c = cost ?? base;
  const heat = cardHeat(id, up);
  return (
    <button
      type="button"
      class={`card type-${d.type} rarity-${d.rarity} ${up ? 'is-up' : ''} ${disabled ? 'is-disabled' : ''} ${small ? 'is-small' : ''} ${extraClass ?? ''}`}
      onClick={onClick}
      aria-disabled={disabled}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      onFocus={onHover ? () => onHover(true) : undefined}
      onBlur={onHover ? () => onHover(false) : undefined}
    >
      {disabled && reason && <span class="card-reason">{reason}</span>}
      <span class={`card-cost ${c < base ? 'cheaper' : ''}`}>{c}</span>
      {hotkey !== undefined && <span class="card-key">{hotkey}</span>}
      {(d.rarity === 'uncommon' || d.rarity === 'rare') && <span class={`card-gem gem-${d.rarity}`} title={d.rarity} />}
      <span class="card-name">
        {d.name}
        {up ? '+' : ''}
      </span>
      <span class="card-art">
        <Icon name={d.icon} size={small ? 26 : 34} />
      </span>
      <span class="card-text">
        <Rich text={cardText(id, up)} />
      </span>
      <span class="card-foot">
        <span>{TYPE_LABEL[d.type]}</span>
        {heat > 0 && <span class="kw-heat">+{heat} Heat</span>}
        {d.exhaust && !heat && <span class="kw-muted">Exhaust</span>}
      </span>
    </button>
  );
}

export function AlgoChip({ id, onClick, selected, big, dim }: { id: string; onClick?: () => void; selected?: boolean; big?: boolean; dim?: boolean }) {
  const a = ALGOS[id];
  if (!a) return null;
  if (big) {
    return (
      <button type="button" class={`algo-card rarity-${a.rarity} ${selected ? 'selected' : ''} ${dim ? 'dim' : ''}`} onClick={onClick}>
        <span class={`algo-hex rarity-${a.rarity}`}>{a.short}</span>
        <span class="algo-name">{a.name}</span>
        <span class="algo-text">
          <Rich text={a.text} />
        </span>
        <span class={`rar rar-${a.rarity}`}>{a.rarity}</span>
      </button>
    );
  }
  return (
    <Tip
      tip={
        <>
          <b>{a.name}</b>
          <br />
          <Rich text={a.text} />
        </>
      }
    >
      <span class={`algo-hex small rarity-${a.rarity} ${selected ? 'selected' : ''}`} onClick={onClick}>
        {a.short}
      </span>
    </Tip>
  );
}

export function Hearts({ n, max }: { n: number; max: number }) {
  return (
    <Tip tip="Investor Trust. Missing a quota costs 1. At 0 the fund closes and the run ends.">
      <span class="hearts" aria-label={`Trust ${n} of ${max}`}>
        {Array.from({ length: Math.max(max, n) }, (_, i) => (
          <span class={i < n ? 'heart on' : 'heart'}>
            <Icon name="heart" size={18} />
          </span>
        ))}
      </span>
    </Tip>
  );
}

export function HeatMeter({ heat }: { heat: number }) {
  const pct = Math.min(100, (heat / 10) * 100);
  return (
    <Tip tip="Heat from shady plays. At 10+ after a quarter, the Commission audits you: a cash fine and Heat drops to 4. Heat cools by 1 each quarter.">
      <span class={`heat ${heat >= 7 ? 'hot' : ''}`}>
        <Icon name="flame" size={16} />
        <span class="heat-bar">
          <span style={{ width: `${pct}%` }} />
        </span>
        <span class="heat-num">{heat}/10</span>
      </span>
    </Tip>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ComponentChildren; wide?: boolean }) {
  return (
    <div class="modal-back" onClick={onClose}>
      <div class={`modal ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div class="modal-head">
          <h2>{title}</h2>
          <button type="button" class="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div class="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function sortDeck(cards: CardInst[]): CardInst[] {
  const order = ['order', 'intel', 'tactic', 'shady', 'power'];
  return [...cards].sort(
    (a, b) =>
      order.indexOf(CARDS[a.id].type) - order.indexOf(CARDS[b.id].type) ||
      CARDS[a.id].name.localeCompare(CARDS[b.id].name) ||
      Number(b.up) - Number(a.up),
  );
}

export function DeckModal({
  cards,
  title,
  onClose,
  onPick,
  pickLabel,
  filter,
  showUpgrade,
}: {
  cards: CardInst[];
  title: string;
  onClose: () => void;
  onPick?: (uid: number) => void;
  pickLabel?: string;
  filter?: (c: CardInst) => boolean;
  showUpgrade?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const list = sortDeck(cards);
  return (
    <Modal title={title} onClose={onClose} wide>
      {pickLabel && <p class="muted">{pickLabel}</p>}
      <div class="deck-grid">
        {list.map((c) => {
          const ok = !filter || filter(c);
          const preview = showUpgrade && hover === c.uid && !c.up;
          return (
            <div class="deck-cell" onMouseEnter={() => setHover(c.uid)} onMouseLeave={() => setHover(null)}>
              <CardView
                id={c.id}
                up={preview ? true : c.up}
                small
                disabled={!ok}
                onClick={onPick && ok ? () => onPick(c.uid) : undefined}
                extraClass={preview ? 'preview-up' : ''}
              />
            </div>
          );
        })}
      </div>
      {!list.length && <p class="muted">No cards.</p>}
    </Modal>
  );
}

export function TopBar({
  run,
  onDeck,
  onMenu,
  center,
}: {
  run: RunState;
  onDeck: () => void;
  onMenu: () => void;
  center?: ComponentChildren;
}) {
  const reg = regimeFor(run.year);
  const isBoss = run.quarter === 3;
  return (
    <header class="topbar">
      <div class="tb-left">
        <span class="tb-when">
          Y{run.year + 1} <span class="muted">·</span> Q{run.quarter + 1}
        </span>
        <Tip tip={reg.desc}>
          <span class={`regime regime-${reg.id}`}>{reg.name}</span>
        </Tip>
        {isBoss && <span class="boss-pill">{bossFor(run.year).name}</span>}
        {run.endless && <span class="boss-pill endless">Endless</span>}
      </div>
      <div class="tb-center">{center}</div>
      <div class="tb-right">
        <Hearts n={run.trust} max={run.maxTrust} />
        <Tip tip="Cash for the shop. Earned after each quarter, plus $1 interest per $5 held (max $5).">
          <span class="cash">${run.cash}</span>
        </Tip>
        <HeatMeter heat={run.heat} />
        <span class="algos-row">
          {run.algos.map((a) => (
            <AlgoChip id={a} />
          ))}
          {Array.from({ length: Math.max(0, run.algoSlots - run.algos.length) }, () => (
            <Tip tip="Empty algorithm slot. Algorithms are passive bots bought in the shop or won from bosses.">
              <span class="algo-hex small empty" />
            </Tip>
          ))}
        </span>
        <button type="button" class="tb-btn" onClick={onDeck} aria-label="View deck">
          <Icon name="deck" size={18} />
          <span>{run.deck.length}</span>
        </button>
        <button type="button" class="tb-btn" onClick={onMenu} aria-label="Menu">
          <Icon name="gear" size={18} />
        </button>
      </div>
    </header>
  );
}

export function fmtSigned(v: number): string {
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v))}`;
}

export function fmtTime(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}
