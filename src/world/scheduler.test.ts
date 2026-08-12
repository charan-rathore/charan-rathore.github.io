import { describe, expect, it, vi } from 'vitest';
import { FrameScheduler } from './scheduler';

describe('FrameScheduler', () => {
  it('coalesces invalidations and stops when rendering is stable', () => {
    const callbacks: FrameRequestCallback[] = [];
    const render = vi.fn(() => false);
    const scheduler = new FrameScheduler({
      render,
      requestFrame: (callback) => { callbacks.push(callback); return callbacks.length; },
      cancelFrame: vi.fn(),
    });
    scheduler.invalidate();
    scheduler.invalidate();
    expect(callbacks).toHaveLength(1);
    callbacks[0]?.(100);
    expect(render).toHaveBeenCalledOnce();
    expect(scheduler.isScheduled).toBe(false);
  });

  it('continues only while render reports bounded motion', () => {
    const callbacks: FrameRequestCallback[] = [];
    const render = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    const scheduler = new FrameScheduler({
      render,
      requestFrame: (callback) => { callbacks.push(callback); return callbacks.length; },
      cancelFrame: vi.fn(),
    });
    scheduler.invalidate();
    callbacks[0]?.(10);
    expect(callbacks).toHaveLength(2);
    callbacks[1]?.(20);
    expect(render).toHaveBeenCalledTimes(2);
    expect(scheduler.isScheduled).toBe(false);
  });
});
