import { describe, expect, it, vi } from 'vitest';
import { ResourceRegistry } from './resource-registry';

describe('ResourceRegistry', () => {
  it('shares resources and disposes after the final release', () => {
    const dispose = vi.fn();
    const resource = { dispose };
    const registry = new ResourceRegistry();
    const first = registry.acquire('shared', () => resource as never);
    const second = registry.acquire('shared', () => { throw new Error('must reuse'); });
    expect(first).toBe(second);
    registry.release('shared');
    expect(dispose).not.toHaveBeenCalled();
    registry.release('shared');
    expect(dispose).toHaveBeenCalledOnce();
    expect(registry.size).toBe(0);
  });

  it('disposes all retained resources idempotently', () => {
    const dispose = vi.fn();
    const registry = new ResourceRegistry();
    registry.acquire('one', () => ({ dispose }) as never);
    registry.dispose();
    registry.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
