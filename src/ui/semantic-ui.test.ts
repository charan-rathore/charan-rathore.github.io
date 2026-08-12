// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { GameRuntime } from '../integration/game-runtime';
import { mountSemanticUI } from './semantic-ui';

const markup = (): string => `
  <div data-living-systems data-mode="visual" data-phase="intro">
    <button class="primary" data-action="play" aria-pressed="false">Play the system</button>
    <div class="play-shell" data-game-region data-control-active="false" tabindex="-1">
      <button data-intent="moveLeft" aria-label="Move left">←</button>
      <button data-intent="place">Place</button>
      <button data-intent="pause" aria-label="Pause game">Pause</button>
    </div>
    <div class="sr-only" aria-live="polite" aria-atomic="true" data-live-status></div>
  </div>`;

const createRuntime = (callbacks: FrameRequestCallback[]): GameRuntime => new GameRuntime({
  requestFrame: (callback) => { callbacks.push(callback); return callbacks.length; },
  cancelFrame: vi.fn(),
});

describe('semantic UI control wiring', () => {
  it('starts gravity on Play without moving the active piece', () => {
    const callbacks: FrameRequestCallback[] = [];
    const runtime = createRuntime(callbacks);
    document.body.innerHTML = markup();
    const root = document.querySelector('[data-living-systems]') as HTMLElement;
    const unmount = mountSemanticUI(root, runtime);

    (document.querySelector('[data-action="play"]') as HTMLButtonElement).click();

    expect(runtime.getGameState().started).toBe(true);
    expect(runtime.getGameState().active?.transform.x).toBe(4);
    expect(callbacks.length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector('[data-game-region]')?.getAttribute('data-control-active')).toBe('true');
    expect(document.querySelector('[data-action="play"]')?.getAttribute('aria-pressed')).toBe('true');

    unmount();
    runtime.dispose();
  });

  it('activates controls and moves the piece when a control button is clicked before Play', () => {
    const callbacks: FrameRequestCallback[] = [];
    const runtime = createRuntime(callbacks);
    document.body.innerHTML = markup();
    const root = document.querySelector('[data-living-systems]') as HTMLElement;
    const unmount = mountSemanticUI(root, runtime);

    (document.querySelector('[data-intent="moveLeft"]') as HTMLButtonElement).click();

    expect(runtime.getGameState().active?.transform.x).toBe(3);
    expect(runtime.getGameState().started).toBe(true);
    expect(callbacks.length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector('[data-game-region]')?.getAttribute('data-control-active')).toBe('true');

    unmount();
    runtime.dispose();
  });
});
