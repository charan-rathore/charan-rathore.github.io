// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { bootstrapLivingSystems } from './bootstrap';

describe('bootstrapLivingSystems', () => {
  it('mounts the semantic runtime before a WebGL constructor failure and keeps controls usable', () => {
    document.body.innerHTML = `
      <main data-living-systems>
        <button data-action="play">Play</button>
        <div data-game-region tabindex="-1"><button data-intent="moveLeft">Move</button></div>
        <ol data-queue><li>Stale queue item</li></ol>
        <div data-direct-panel hidden></div>
        <div data-live-status></div>
      </main>
      <div data-world-stage></div>
      <div data-static-fallback hidden></div>
      <p data-world-status></p>`;
    const app = bootstrapLivingSystems({
      stage: document.querySelector('[data-world-stage]'),
      status: document.querySelector('[data-world-status]'),
      fallback: document.querySelector('[data-static-fallback]'),
      semanticRoot: document.querySelector('[data-living-systems]'),
    }, {
      createWorld: () => { throw new Error('WebGL unavailable'); },
    });
    expect(document.querySelector('[data-static-fallback]')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('[data-world-status]')?.textContent).toContain('WebGL unavailable');
    expect(app.runtime.getGameState().phase).toBe('playing');
    expect([...document.querySelectorAll('[data-queue] li')].map((item) => item.textContent)).toEqual([
      'Chunking', 'Retrieval', 'Provenance', 'Evaluation',
    ]);
    (document.querySelector('[data-action="play"]') as HTMLButtonElement).click();
    (document.querySelector('[data-intent="moveLeft"]') as HTMLButtonElement).click();
    expect(app.runtime.getGameState().active?.transform.x).toBe(3);
    app.dispose();
  });

  it('environment suspension stops gravity without changing reducer phase', () => {
    let visibilityCallback: IntersectionObserverCallback | undefined;
    const world = { update: vi.fn(), setOffscreen: vi.fn(), dispose: vi.fn() };
    document.body.innerHTML = '<div data-world-stage></div>';
    const app = bootstrapLivingSystems({
      stage: document.querySelector('[data-world-stage]'), status: null, fallback: null, semanticRoot: null,
    }, {
      createWorld: () => world as never,
      createVisibilityObserver: (callback) => { visibilityCallback = callback; return { observe: vi.fn(), disconnect: vi.fn() }; },
    });
    visibilityCallback?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(app.runtime.getGameState().phase).toBe('playing');
    app.dispose();
  });
});
