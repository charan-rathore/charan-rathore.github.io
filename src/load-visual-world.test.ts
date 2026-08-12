import { describe, expect, it, vi } from 'vitest';
import { loadVisualWorld } from './load-visual-world';

describe('loadVisualWorld', () => {
  it('constructs the visual world after its module resolves', async () => {
    const host = {} as HTMLElement;
    const instance = { dispose: vi.fn() };
    const World = vi.fn(function World() { return instance; });

    const result = await loadVisualWorld(host, {}, async () => ({ LivingSystemsWorld: World }) as never);

    expect(World).toHaveBeenCalledWith(host, {});
    expect(result).toBe(instance);
  });

  it('keeps the semantic fallback available when the visual chunk fails', async () => {
    const onFailure = vi.fn();

    const result = await loadVisualWorld(
      {} as HTMLElement,
      { onFailure },
      async () => { throw new Error('chunk offline'); },
    );

    expect(result).toBeUndefined();
    expect(onFailure).toHaveBeenCalledWith('Visual world unavailable: chunk offline');
  });
});
