import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from './game-runtime';

describe('GameRuntime', () => {
  it('waits for first input, then runs bounded gravity and stops while paused', () => {
    const callbacks: FrameRequestCallback[] = [];
    const cancel = vi.fn();
    let now = 0;
    const runtime = new GameRuntime({
      gravityIntervalMs: 10,
      maxTicksPerFrame: 2,
      now: () => now,
      requestFrame: (callback) => { callbacks.push(callback); return callbacks.length; },
      cancelFrame: cancel,
    });
    runtime.start();
    expect(callbacks).toHaveLength(0);
    runtime.dispatch({ type: 'moveLeft', source: 'keyboard' });
    expect(callbacks).toHaveLength(1);
    now = 100;
    callbacks[0]?.(now);
    expect(runtime.getGameState().tick).toBe(2);
    runtime.dispatch({ type: 'pause', source: 'keyboard' });
    expect(runtime.getGameState().phase).toBe('paused');
    expect(cancel).toHaveBeenCalled();
    runtime.dispatch({ type: 'resume', source: 'keyboard' });
    expect(runtime.getGameState().phase).toBe('playing');
    runtime.dispose();
  });

  it('keeps direct mode step-based while preserving the same game state', () => {
    const callbacks: FrameRequestCallback[] = [];
    const runtime = new GameRuntime({ requestFrame: (callback) => { callbacks.push(callback); return callbacks.length; }, cancelFrame: vi.fn() });
    runtime.dispatch({ type: 'moveRight', source: 'control' });
    const before = runtime.getGameState();
    runtime.setStaticMode(true);
    expect(runtime.getGameState()).toBe(before);
    expect(runtime.getSnapshot().currentPiece?.name).toBe('Ingestion');
    runtime.dispatch({ type: 'rotateClockwise', source: 'control' });
    expect(runtime.getGameState().active?.transform.rotation).toBe(1);
    runtime.dispose();
  });
});
