// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { handlePageHide } from './page-lifecycle';

describe('page lifecycle', () => {
  it('suspends without disposing a page entering the back-forward cache', () => {
    const actions = { suspend: vi.fn(), dispose: vi.fn() };
    handlePageHide({ persisted: true } as PageTransitionEvent, actions);
    expect(actions.suspend).toHaveBeenCalledOnce();
    expect(actions.dispose).not.toHaveBeenCalled();
  });

  it('disposes a page that is being unloaded permanently', () => {
    const actions = { suspend: vi.fn(), dispose: vi.fn() };
    handlePageHide({ persisted: false } as PageTransitionEvent, actions);
    expect(actions.dispose).toHaveBeenCalledOnce();
    expect(actions.suspend).not.toHaveBeenCalled();
  });
});
