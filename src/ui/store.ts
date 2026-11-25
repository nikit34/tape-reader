import type { MetaState, RunState } from '../engine/types';

const RUN_KEY = 'tapereader.run.v1';
const META_KEY = 'tapereader.meta.v1';

export function defaultMeta(): MetaState {
  return {
    v: 1,
    unlocked: ['intern'],
    seenCards: [],
    seenAlgos: [],
    runs: 0,
    wins: 0,
    bestYear: 0,
    bestQuarterIndex: 0,
    bestSession: 0,
    tutorialDone: false,
    tutorialStep: 0,
    sound: true,
    totalPlayMs: 0,
  };
}

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    return { ...defaultMeta(), ...JSON.parse(raw) };
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(m: MetaState): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    return;
  }
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as RunState;
    if (r.version !== 1) return null;
    if (r.phase === 'gameover' || r.phase === 'victory') return null;
    return r;
  } catch {
    return null;
  }
}

export function saveRun(run: RunState | null): void {
  try {
    if (!run) localStorage.removeItem(RUN_KEY);
    else localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    return;
  }
}
