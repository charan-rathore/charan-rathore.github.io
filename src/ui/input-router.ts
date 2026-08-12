import type { GameIntent, GameIntentType, InputSource } from './contracts';

export interface IntentRouterOptions {
  dispatch(intent: GameIntent): void;
  isActive(): boolean;
  isPaused?(): boolean;
  onExit(): void;
}

const KEY_INTENTS: Readonly<Record<string, GameIntentType>> = {
  ArrowLeft: 'moveLeft',
  ArrowRight: 'moveRight',
  ArrowDown: 'softDrop',
  ArrowUp: 'rotateClockwise',
  ' ': 'place',
  Enter: 'place',
  u: 'undo',
  U: 'undo',
  p: 'pause',
  P: 'pause',
};

export function intentFromKey(key: string): GameIntentType | null {
  return KEY_INTENTS[key] ?? null;
}

export function intentFromControl(value: string): GameIntentType | null {
  const known: readonly string[] = [
    'start', 'moveLeft', 'moveRight', 'softDrop', 'rotateClockwise', 'place', 'undo',
    'pause', 'resume', 'withholdProvenance', 'restoreProvenance',
  ];
  return known.includes(value) ? value as GameIntentType : null;
}

/** Board-control intents that enter game-control mode. Provenance experiments stay direct. */
export const GAME_CONTROL_INTENTS: ReadonlySet<GameIntentType> = new Set<GameIntentType>([
  'moveLeft', 'moveRight', 'softDrop', 'rotateClockwise', 'place', 'undo', 'pause', 'resume',
]);

export function createIntentRouter(options: IntentRouterOptions): {
  onKeyDown(event: KeyboardEvent): void;
  dispatchControl(type: string, source?: InputSource): void;
} {
  return {
    onKeyDown(event) {
      if (!options.isActive()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        options.onExit();
        return;
      }
      const type = intentFromKey(event.key);
      if (!type || shouldUseNativeKeyboardBehavior(event)) return;
      event.preventDefault();
      options.dispatch({ type: type === 'pause' && options.isPaused?.() ? 'resume' : type, source: 'keyboard' });
    },
    dispatchControl(value, source = 'control') {
      if (!options.isActive()) return;
      const type = intentFromControl(value);
      if (type) options.dispatch({ type: type === 'pause' && options.isPaused?.() ? 'resume' : type, source });
    },
  };
}

function shouldUseNativeKeyboardBehavior(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true;
  return (event.key === 'Enter' || event.key === ' ')
    && target.matches('button, a[href], summary, [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"]');
}
