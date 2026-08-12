import { describe, expect, it, vi } from 'vitest';
import { createIntentRouter, intentFromControl, intentFromKey } from './input-router';

describe('input intent normalization', () => {
  it('maps keyboard controls to typed intents', () => {
    expect(intentFromKey('ArrowLeft')).toBe('moveLeft');
    expect(intentFromKey('ArrowUp')).toBe('rotateClockwise');
    expect(intentFromKey(' ')).toBe('place');
    expect(intentFromKey('Tab')).toBeNull();
  });

  it('rejects unknown control values', () => {
    expect(intentFromControl('undo')).toBe('undo');
    expect(intentFromControl('explode')).toBeNull();
  });

  it('routes active controls through a shared dispatch contract', () => {
    const dispatch = vi.fn();
    const router = createIntentRouter({ dispatch, isActive: () => true, isPaused: () => false, onExit: vi.fn() });
    router.dispatchControl('place', 'touch');
    expect(dispatch).toHaveBeenCalledWith({ type: 'place', source: 'touch' });
  });

  it('toggles a pause command to resume while paused', () => {
    const dispatch = vi.fn();
    const router = createIntentRouter({ dispatch, isActive: () => true, isPaused: () => true, onExit: vi.fn() });
    router.dispatchControl('pause');
    expect(dispatch).toHaveBeenCalledWith({ type: 'resume', source: 'control' });
  });

  it('does not dispatch game commands before control mode is active', () => {
    const dispatch = vi.fn();
    const router = createIntentRouter({ dispatch, isActive: () => false, isPaused: () => false, onExit: vi.fn() });
    router.dispatchControl('place');
    expect(dispatch).not.toHaveBeenCalled();
  });
});
