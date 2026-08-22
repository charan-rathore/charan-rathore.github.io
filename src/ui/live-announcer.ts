export interface LiveTextTarget { textContent: string | null }

export interface LiveAnnouncer {
  announce(message: string): void;
  dispose(): void;
}

export function createLiveAnnouncer(
  target: LiveTextTarget | null,
  delay = 50,
  timers: Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'> = globalThis,
): LiveAnnouncer {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sequence = 0;

  return {
    announce(message) {
      if (!target) return;
      sequence += 1;
      const current = sequence;
      if (timer !== undefined) timers.clearTimeout(timer);
      target.textContent = '';
      timer = timers.setTimeout(() => {
        if (current === sequence) target.textContent = message;
        timer = undefined;
      }, delay);
    },
    dispose() {
      sequence += 1;
      if (timer !== undefined) timers.clearTimeout(timer);
      timer = undefined;
    },
  };
}
