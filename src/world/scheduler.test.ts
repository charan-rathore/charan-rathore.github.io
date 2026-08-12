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

  it('wraps native-like frame methods so they retain the window receiver', () => {
    const receiver = { callbacks: [] as FrameRequestCallback[], cancelled: [] as number[] };
    function nativeLikeRequest(this: typeof receiver, callback: FrameRequestCallback): number {
      if (this !== receiver) throw new TypeError('Illegal invocation');
      this.callbacks.push(callback);
      return this.callbacks.length;
    }
    function nativeLikeCancel(this: typeof receiver, handle: number): void {
      if (this !== receiver) throw new TypeError('Illegal invocation');
      this.cancelled.push(handle);
    }
    const fakeWindow = {
      requestAnimationFrame: nativeLikeRequest.bind(receiver),
      cancelAnimationFrame: nativeLikeCancel.bind(receiver),
    };
    const previousWindow = globalThis.window;
    Object.assign(globalThis, { window: fakeWindow });
    try {
      const scheduler = new FrameScheduler({ render: () => false });
      scheduler.invalidate();
      expect(receiver.callbacks).toHaveLength(1);
      scheduler.dispose();
      expect(receiver.cancelled).toEqual([1]);
    } finally {
      if (previousWindow === undefined) Reflect.deleteProperty(globalThis, 'window');
      else Object.assign(globalThis, { window: previousWindow });
    }
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
