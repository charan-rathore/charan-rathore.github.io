import { describe, expect, it } from 'vitest';
import { GAME_INTENTS } from './contracts';
import { toModelCommand } from './command-translation';

describe('UI intent to game command translation', () => {
  it('translates directional and semantic UI intents', () => {
    expect(toModelCommand({ type: 'start', source: 'control' })).toEqual({ type: 'start' });
    expect(toModelCommand({ type: 'moveLeft', source: 'keyboard' })).toEqual({ type: 'move', dx: -1 });
    expect(toModelCommand({ type: 'rotateClockwise', source: 'touch' })).toEqual({ type: 'rotate', direction: 1 });
    expect(toModelCommand({ type: 'place', source: 'keyboard' })).toEqual({ type: 'hard-drop' });
    expect(toModelCommand({ type: 'place', source: 'keyboard' })).toEqual({ type: 'hard-drop' });
    expect(toModelCommand({ type: 'withholdProvenance', source: 'control' })).toEqual({ type: 'remove-provenance' });
  });

  it('toggles pause against authoritative model phase', () => {
    expect(toModelCommand({ type: 'pause', source: 'keyboard' }, { phase: 'playing' })).toEqual({ type: 'pause' });
    expect(toModelCommand({ type: 'pause', source: 'keyboard' }, { phase: 'paused' })).toEqual({ type: 'resume' });
  });

  it('has a model command for every declared UI intent', () => {
    expect(GAME_INTENTS.map((type) => toModelCommand({ type, source: 'control' }))).toHaveLength(GAME_INTENTS.length);
  });
});
