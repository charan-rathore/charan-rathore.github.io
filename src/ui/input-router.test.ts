// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createIntentRouter, GAME_CONTROL_INTENTS, intentFromControl, intentFromKey } from './input-router';

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

  it('classifies board-control intents as game controls and leaves provenance experiments direct', () => {
    expect(GAME_CONTROL_INTENTS.has('moveLeft')).toBe(true);
    expect(GAME_CONTROL_INTENTS.has('place')).toBe(true);
    expect(GAME_CONTROL_INTENTS.has('pause')).toBe(true);
    expect(GAME_CONTROL_INTENTS.has('withholdProvenance')).toBe(false);
    expect(GAME_CONTROL_INTENTS.has('restoreProvenance')).toBe(false);
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

  it('leaves Enter and Space to focused interactive controls', () => {
    const dispatch = vi.fn();
    const router = createIntentRouter({ dispatch, isActive: () => true, onExit: vi.fn() });
    const button = document.createElement('button');
    document.body.append(button);
    document.addEventListener('keydown', router.onKeyDown);
    for (const key of ['Enter', ' ']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      button.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    document.removeEventListener('keydown', router.onKeyDown);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('preserves game placement keys when the play surface is focused', () => {
    const dispatch = vi.fn();
    const router = createIntentRouter({ dispatch, isActive: () => true, onExit: vi.fn() });
    const surface = document.createElement('section');
    document.body.append(surface);
    document.addEventListener('keydown', router.onKeyDown);
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    surface.dispatchEvent(event);
    document.removeEventListener('keydown', router.onKeyDown);
    expect(event.defaultPrevented).toBe(true);
    expect(dispatch).toHaveBeenCalledWith({ type: 'place', source: 'keyboard' });
  });
});
