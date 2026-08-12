import { describe, expect, it, vi } from 'vitest';
import { createLiveAnnouncer } from './live-announcer';

describe('live announcer', () => {
  it('cancels stale announcements and publishes only the latest message', () => {
    vi.useFakeTimers();
    const target = { textContent: 'old' };
    const announcer = createLiveAnnouncer(target);
    announcer.announce('first');
    announcer.announce('second');
    vi.advanceTimersByTime(49);
    expect(target.textContent).toBe('');
    vi.advanceTimersByTime(1);
    expect(target.textContent).toBe('second');
    vi.useRealTimers();
  });

  it('does not publish pending text after disposal', () => {
    vi.useFakeTimers();
    const target = { textContent: '' };
    const announcer = createLiveAnnouncer(target);
    announcer.announce('late');
    announcer.dispose();
    vi.runAllTimers();
    expect(target.textContent).toBe('');
    vi.useRealTimers();
  });
});
