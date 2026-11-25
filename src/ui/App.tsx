import { useEffect, useRef, useState } from 'preact/hooks';
import type { FxKind, MetaState, RunState, SessionState } from '../engine/types';
import { newRun, nextBar, playCard, continueFromResult, quarterIndex } from '../engine/game';
import { newSeed } from '../engine/rng';
import { CARD_IDS } from '../engine/data/cards';
import { ALGO_IDS } from '../engine/data/algos';
import { loadMeta, loadRun, saveMeta, saveRun } from './store';
import { setSound, sfx } from './audio';
import { DeckModal, TopBar } from './common';
import { SessionScreen, type Coach } from './screens/Session';
import { Briefing, BossRewardScreen, EndScreen, ResultScreen, RewardScreen, ShopScreen } from './screens/RunScreens';
import { CodexModal, DeskSelect, HelpModal, MenuModal, TitleScreen } from './screens/MetaScreens';

export interface Toast {
  id: number;
  kind: FxKind;
  text: string;
  value?: number;
  t: number;
}

interface Step {
  text: string;
  when?: (s: SessionState) => boolean;
}

const STEPS: Step[] = [
  {
    text: 'Welcome to the desk. This quarter is 8 bars of price action. Finish it with P&L at or above the quota shown on the right.',
  },
  {
    text: 'The Lean gauge above the chart shows where the price tends to move on the next bar. It is a tendency, not a promise.',
  },
  {
    text: 'Play cards with Focus (3 per bar). Buy opens a LONG that profits when the price rises; Sell Short profits when it falls. Click a card or press its number.',
  },
  {
    when: (s) => s.trades.length > 0 || s.bar > 0,
    text: 'Your trade sits on the chart as a dashed line at its entry price, and it closes by itself when its bars run out. Press Next bar (Space) to let the market move.',
  },
  {
    when: (s) => s.bar > 0,
    text: 'Each bar your hand is discarded and you draw 5 fresh cards. Read the Tape reveals the exact direction of the next bar as an arrow on the chart.',
  },
  {
    when: (s) => s.bar > 1,
    text: 'Watch the downside too. If P&L hits the margin limit, trades are force-closed and the quarter fails. Missing a quota costs 1 Trust.',
  },
  {
    when: (s) => s.bar > 2,
    text: 'Once you are over the quota you may Ring the bell to end early, or keep trading: beating the quota by a wide margin pays bonus cash.',
  },
];

let toastId = 1;

export function App() {
  const [meta, setMetaState] = useState<MetaState>(loadMeta);
  const metaRef = useRef(meta);
  const runRef = useRef<RunState | null>(loadRun());
  const [screen, setScreen] = useState<'title' | 'desks' | 'game'>('title');
  const [modal, setModal] = useState<null | 'help' | 'deck' | 'menu' | 'codex'>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [version, setVersion] = useState(0);
  const [unlocks, setUnlocks] = useState<string[]>([]);
  const tut = meta.tutorialStep;

  const setMeta = (fn: (m: MetaState) => MetaState) => {
    const next = fn(metaRef.current);
    metaRef.current = next;
    saveMeta(next);
    setMetaState(next);
  };

  useEffect(() => {
    setSound(meta.sound);
  }, [meta.sound]);

  const markSeen = (run: RunState) => {
    const cards = new Set(metaRef.current.seenCards);
    const algos = new Set(metaRef.current.seenAlgos);
    const before = cards.size + algos.size;
    for (const c of run.deck) cards.add(c.id);
    for (const c of run.rewardCards) cards.add(c.id);
    for (const it of run.shop) (it.kind === 'card' ? cards : algos).add(it.id);
    for (const a of run.algos) algos.add(a);
    for (const a of run.rewardAlgos) algos.add(a);
    if (cards.size + algos.size !== before) {
      setMeta((m) => ({
        ...m,
        seenCards: CARD_IDS.filter((i) => cards.has(i)),
        seenAlgos: ALGO_IDS.filter((i) => algos.has(i)),
      }));
    }
  };

  const onPhase = (run: RunState, prev: string) => {
    if (run.phase === 'result' && prev === 'session') {
      const r = run.lastResult!;
      if (r.reason === 'margin') sfx.alarm();
      else if (r.won) sfx.win();
      else sfx.fail();
      const newly: string[] = [];
      const m = metaRef.current;
      if (r.won && r.pnl >= r.quota * 2 && !m.unlocked.includes('degen')) newly.push('degen');
      if (r.won && r.boss && r.year === 0 && !m.unlocked.includes('quant')) newly.push('quant');
      setUnlocks(newly);
      setMeta((mm) => ({
        ...mm,
        unlocked: [...mm.unlocked, ...newly],
        bestSession: Math.max(mm.bestSession, r.pnl),
        bestQuarterIndex: Math.max(mm.bestQuarterIndex, quarterIndex(run)),
        bestYear: Math.max(mm.bestYear, run.year),
      }));
    }
    if (run.phase === 'victory') {
      sfx.win();
      setMeta((mm) => ({
        ...mm,
        wins: mm.wins + 1,
        unlocked: mm.unlocked.includes('maker') ? mm.unlocked : [...mm.unlocked, 'maker'],
      }));
    }
    if (run.phase === 'gameover') sfx.fail();
    if (run.phase === 'session') setToasts([]);
    markSeen(run);
  };

  const consumeFx = (run: RunState) => {
    const list = run.fx;
    run.fx = [];
    if (!list.length) return;
    const now = Date.now();
    setToasts((ts) => [...ts, ...list.map((f) => ({ ...f, id: toastId++, t: now }))].slice(-14));
    let budget = 3;
    for (const f of list) {
      if (budget <= 0) break;
      if (f.kind === 'close' || f.kind === 'pnl') {
        if ((f.value ?? 0) > 0) sfx.profit(f.value ?? 0);
        else if ((f.value ?? 0) < 0) sfx.loss();
        budget--;
      } else if (f.kind === 'heat') {
        sfx.heat();
        budget--;
      } else if (f.kind === 'bad' && list.length === 1) {
        sfx.bad();
        budget--;
      }
    }
  };

  const act = (fn: (r: RunState) => void) => {
    const run = runRef.current;
    if (!run) return;
    const prev = run.phase;
    const prevBar = run.session?.bar ?? -1;
    const prevCards = run.session?.cardsPlayed ?? 0;
    fn(run);
    if (run.session && run.phase === 'session') {
      if (run.session.bar !== prevBar) sfx.bar((run.session.candles.at(-1)?.c ?? 0) >= (run.session.candles.at(-1)?.o ?? 0));
      else if (run.session.cardsPlayed !== prevCards) sfx.card();
    } else if (prev === run.phase) sfx.click();
    consumeFx(run);
    if (run.phase !== prev) onPhase(run, prev);
    saveRun(run);
    setVersion((v) => v + 1);
  };

  const startRun = (desk: string) => {
    runRef.current = newRun(desk, newSeed());
    setMeta((m) => ({ ...m, runs: m.runs + 1 }));
    markSeen(runRef.current);
    saveRun(runRef.current);
    setUnlocks([]);
    setToasts([]);
    setScreen('game');
    setVersion((v) => v + 1);
  };

  const toggleSound = () => setMeta((m) => ({ ...m, sound: !m.sound }));

  useEffect(() => {
    const id = window.setInterval(() => {
      const run = runRef.current;
      if (screen !== 'game' || !run || document.visibilityState !== 'visible') return;
      if (run.phase === 'gameover' || run.phase === 'victory') return;
      run.stats.playMs += 1000;
      metaRef.current = { ...metaRef.current, totalPlayMs: metaRef.current.totalPlayMs + 1000 };
      if (run.stats.playMs % 10000 === 0) {
        saveRun(run);
        saveMeta(metaRef.current);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [screen]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setToasts((ts) => (ts.some((x) => now - x.t > 9000) ? ts.filter((x) => now - x.t <= 9000) : ts));
    }, 1500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        setModal(null);
        return;
      }
      if (modal) return;
      const run = runRef.current;
      if (screen !== 'game' || !run) return;
      if (run.phase === 'session') {
        if (e.code === 'Space') {
          e.preventDefault();
          act((r) => nextBar(r));
        } else if (/^[1-9]$/.test(e.key)) {
          act((r) => playCard(r, Number(e.key) - 1));
        } else if (e.key === 'd' || e.key === 'D') setModal('deck');
      } else if (run.phase === 'result' && e.key === 'Enter') {
        e.preventDefault();
        act((r) => continueFromResult(r));
      } else if (e.key === 'd' || e.key === 'D') setModal('deck');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const run = runRef.current;
  const firstRun = metaRef.current.runs <= 1 && metaRef.current.wins === 0;

  let coach: Coach | null = null;
  if (run && run.phase === 'session' && run.session && !meta.tutorialDone && run.year === 0 && run.quarter === 0) {
    const step = STEPS[tut];
    if (step && (!step.when || step.when(run.session))) {
      coach = {
        text: step.text,
        step: tut + 1,
        total: STEPS.length,
        onNext: () => {
          setMeta((m) => ({ ...m, tutorialStep: tut + 1, tutorialDone: tut + 1 >= STEPS.length }));
        },
        onSkip: () => setMeta((m) => ({ ...m, tutorialDone: true })),
      };
    }
  }

  let body;
  if (screen === 'title' || (screen === 'game' && !run)) {
    body = (
      <TitleScreen
        hasRun={!!run && run.phase !== 'gameover' && run.phase !== 'victory'}
        meta={meta}
        onContinue={() => setScreen('game')}
        onNew={() => setScreen('desks')}
        onHelp={() => setModal('help')}
        onCodex={() => setModal('codex')}
        onSound={toggleSound}
      />
    );
  } else if (screen === 'desks') {
    body = <DeskSelect meta={meta} onStart={startRun} onBack={() => setScreen('title')} />;
  } else if (run) {
    const end = run.phase === 'gameover' || run.phase === 'victory';
    let inner;
    switch (run.phase) {
      case 'briefing':
        inner = <Briefing run={run} act={act} firstRun={firstRun} />;
        break;
      case 'session':
        inner = <SessionScreen run={run} act={act} toasts={toasts} version={version} coach={coach} />;
        break;
      case 'result':
        inner = <ResultScreen run={run} act={act} unlocks={unlocks} />;
        break;
      case 'reward':
        inner = <RewardScreen run={run} act={act} />;
        break;
      case 'bossreward':
        inner = <BossRewardScreen run={run} act={act} />;
        break;
      case 'shop':
        inner = <ShopScreen run={run} act={act} firstRun={firstRun} />;
        break;
      default:
        inner = (
          <EndScreen
            run={run}
            act={act}
            onNewRun={() => setScreen('desks')}
            onTitle={() => {
              runRef.current = null;
              saveRun(null);
              setScreen('title');
            }}
          />
        );
    }
    body = (
      <div class="game">
        {!end && <TopBar run={run} onDeck={() => setModal('deck')} onMenu={() => setModal('menu')} />}
        <main class="game-body">{inner}</main>
      </div>
    );
  }

  return (
    <>
      {body}
      {modal === 'help' && <HelpModal onClose={() => setModal(null)} />}
      {modal === 'codex' && <CodexModal meta={meta} onClose={() => setModal(null)} />}
      {modal === 'deck' && run && (
        <DeckModal
          cards={run.phase === 'session' && run.session ? [...run.session.hand, ...run.session.draw, ...run.session.discard, ...run.session.exhaust] : run.deck}
          title={`Your deck · ${run.deck.length} cards`}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'menu' && (
        <MenuModal
          meta={meta}
          onClose={() => setModal(null)}
          onSound={toggleSound}
          onHelp={() => setModal('help')}
          onTitle={() => {
            if (runRef.current) saveRun(runRef.current);
            setModal(null);
            setScreen('title');
          }}
          onAbandon={() => {
            runRef.current = null;
            saveRun(null);
            setModal(null);
            setScreen('title');
          }}
        />
      )}
    </>
  );
}
