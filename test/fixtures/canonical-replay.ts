import type { ReplayCommand } from '../../src/game';

export const CANONICAL_REPLAY_SEED = 'intellirag-phase1-v1';
export const CANONICAL_REPLAY_HASH = '07334c498b723c1f';
export const CANONICAL_REPLAY_COMMANDS: readonly ReplayCommand[] = [
  { tick: 0, intent: { type: 'move', dx: -1 } },
  { tick: 0, intent: { type: 'move', dx: -1 } },
  { tick: 0, intent: { type: 'hard-drop' } },
  { tick: 0, intent: { type: 'move', dx: -1 } },
  { tick: 0, intent: { type: 'hard-drop' } },
  { tick: 0, intent: { type: 'hard-drop' } },
  { tick: 0, intent: { type: 'move', dx: 1 } },
  { tick: 0, intent: { type: 'hard-drop' } },
  { tick: 0, intent: { type: 'move', dx: 1 } },
  { tick: 0, intent: { type: 'move', dx: 1 } },
  { tick: 0, intent: { type: 'hard-drop' } },
];
