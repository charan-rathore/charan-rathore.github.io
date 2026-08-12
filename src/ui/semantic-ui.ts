import type { GameIntent, InputSource, LivingSystemsAdapter, LivingSystemsSnapshot } from './contracts';
import { INITIAL_SEMANTIC_SNAPSHOT } from './contracts';
import { createIntentRouter, GAME_CONTROL_INTENTS, intentFromControl } from './input-router';
import { createLiveAnnouncer } from './live-announcer';
import { pointerGesture } from './pointer-gesture';

export interface SemanticUIOptions {
  readonly onModeChange?: (mode: 'visual' | 'direct') => void;
}

export function mountSemanticUI(root: HTMLElement, adapter?: LivingSystemsAdapter, options: SemanticUIOptions = {}): () => void {
  let snapshot = adapter?.getSnapshot?.() ?? INITIAL_SEMANTIC_SNAPSHOT;
  let controlsActive = false;
  let lastFocus: HTMLElement | null = null;
  const playButton = root.querySelector<HTMLButtonElement>('[data-action="play"]');
  const announcer = root.querySelector<HTMLElement>('[data-live-status]');
  const gameRegion = root.querySelector<HTMLElement>('[data-game-region]');
  const inspection = root.querySelector<HTMLDialogElement>('[data-inspection]');
  const directPanel = root.querySelector<HTMLElement>('[data-direct-panel]');

  const liveAnnouncer = createLiveAnnouncer(announcer);
  const announce = (message: string): void => liveAnnouncer.announce(message);

  const dispatch = (intent: GameIntent): void => {
    adapter?.dispatch(intent);
    root.dispatchEvent(new CustomEvent<GameIntent>('living-systems:intent', { bubbles: true, detail: intent }));
  };

  const leaveControls = (): void => {
    controlsActive = false;
    gameRegion?.setAttribute('data-control-active', 'false');
    playButton?.setAttribute('aria-pressed', 'false');
    announce('Game controls exited. Ordinary page navigation restored.');
    playButton?.focus();
  };

  const activateControls = (): void => {
    controlsActive = true;
    gameRegion?.setAttribute('data-control-active', 'true');
    playButton?.setAttribute('aria-pressed', 'true');
  };

  const router = createIntentRouter({ dispatch, isActive: () => controlsActive, isPaused: () => snapshot.phase === 'paused', onExit: leaveControls });

  const onClick = (event: MouseEvent): void => {
    const target = (event.target as Element | null)?.closest<HTMLElement>('[data-action], [data-intent]');
    if (!target) return;
    const action = target.dataset.action;
    const intent = target.dataset.intent;
    if (intent) {
      const type = intentFromControl(intent);
      if (type) {
        const pointerType = 'pointerType' in event ? event.pointerType : '';
        const source: InputSource = pointerType === 'touch' ? 'touch' : 'control';
        if (GAME_CONTROL_INTENTS.has(type) && !controlsActive) activateControls();
        dispatch({ type, source });
      }
    }
    if (action === 'play') {
      activateControls();
      dispatch({ type: 'start', source: 'control' });
      gameRegion?.focus();
      announce('Game controls active. Use arrow keys to move, up to rotate, Space to place, U to undo, P to pause or resume, and Escape to exit.');
      return;
    }
    if (action === 'direct') {
      root.dataset.mode = 'direct';
      directPanel?.removeAttribute('hidden');
      controlsActive = true;
      options.onModeChange?.('direct');
      directPanel?.focus({ preventScroll: true });
      directPanel?.scrollIntoView({ block: 'start' });
      announce('Direct mode. The same reducer state is available as labeled, step-based controls and text.');
      return;
    }
    if (action === 'visual') {
      root.dataset.mode = 'visual';
      directPanel?.setAttribute('hidden', '');
      controlsActive = true;
      options.onModeChange?.('visual');
      playButton?.focus();
      announce('Visual play mode.');
      return;
    }
    if (action === 'inspect') {
      lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (inspection?.showModal) inspection.showModal(); else inspection?.setAttribute('open', '');
      inspection?.querySelector<HTMLElement>('[data-dialog-start]')?.focus();
      announce('IntelliRAG inspection opened.');
      return;
    }
    if (action === 'close-inspection') {
      inspection?.close?.();
      inspection?.removeAttribute('open');
      lastFocus?.focus();
      announce('Inspection closed. Returning to the system.');
    }
  };

  const onPointerDown = (event: PointerEvent): void => {
    const surface = (event.target as Element | null)?.closest<HTMLElement>('[data-intent-surface]');
    if (!surface || !controlsActive) return;
    surface.dataset.startX = String(event.clientX);
    surface.dataset.startY = String(event.clientY);
    surface.setPointerCapture?.(event.pointerId);
  };

  const onPointerUp = (event: PointerEvent): void => {
    const surface = (event.target as Element | null)?.closest<HTMLElement>('[data-intent-surface]');
    if (!surface || !controlsActive) return;
    const startX = Number(surface.dataset.startX ?? event.clientX);
    const startY = Number(surface.dataset.startY ?? event.clientY);
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    const source = event.pointerType === 'touch' ? 'touch' : 'pointer';
    const intent = pointerGesture(deltaX, deltaY);
    if (intent) router.dispatchControl(intent, source);
  };

  const render = (next: LivingSystemsSnapshot): void => {
    snapshot = next;
    root.dataset.phase = snapshot.phase;
    root.querySelectorAll<HTMLElement>('[data-current-piece]').forEach((node) => { node.textContent = snapshot.currentPiece?.name ?? 'No active piece'; });
    root.querySelectorAll<HTMLElement>('[data-orientation]').forEach((node) => { node.textContent = snapshot.currentPiece?.orientation ?? 'none'; });
    root.querySelectorAll<HTMLElement>('[data-ports]').forEach((node) => { node.textContent = snapshot.currentPiece?.ports.join('; ') ?? 'No open ports'; });
    root.querySelectorAll<HTMLElement>('[data-phase]').forEach((node) => { node.textContent = snapshot.phase; });
    root.querySelectorAll<HTMLElement>('[data-queue]').forEach((node) => {
      if (node instanceof HTMLOListElement || node instanceof HTMLUListElement) {
        node.replaceChildren(...snapshot.queue.map((label) => {
          const item = document.createElement('li');
          item.textContent = label;
          return item;
        }));
        if (!snapshot.queue.length) {
          const item = document.createElement('li');
          item.textContent = 'Queue complete';
          node.append(item);
        }
      } else {
        node.textContent = snapshot.queue.join(', ') || 'Queue complete';
      }
    });
    root.querySelectorAll<HTMLElement>('[data-connections]').forEach((node) => { node.textContent = snapshot.connections.join('; ') || 'No typed connections yet'; });
    const completed = snapshot.recipe.completed.length;
    const required = snapshot.recipe.required.length;
    root.querySelectorAll<HTMLProgressElement>('[data-recipe-progress]').forEach((node) => { node.max = required; node.value = completed; });
    root.querySelectorAll<HTMLElement>('[data-recipe-count]').forEach((node) => { node.textContent = `${completed} of ${required} roles placed`; });
    root.querySelectorAll<HTMLElement>('[data-ghost-copy]').forEach((ghost) => {
      if (!snapshot.ghost) { ghost.textContent = snapshot.phase === 'counterfactualPrompt' ? 'System resolved. Withhold Provenance to test the evidence path.' : 'No active placement preview.'; return; }
      ghost.dataset.state = snapshot.ghost.state;
      ghost.textContent = [snapshot.ghost.message, snapshot.ghost.consequence].filter(Boolean).join(' ');
    });
    root.querySelectorAll<HTMLButtonElement>('[data-intent="pause"]').forEach((button) => {
      const paused = snapshot.phase === 'paused';
      button.textContent = paused ? 'Resume' : 'Pause';
      button.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
    });
    if (snapshot.announcement) announce(snapshot.announcement);
  };

  render(snapshot);
  root.addEventListener('click', onClick);
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointerup', onPointerUp);
  document.addEventListener('keydown', router.onKeyDown);
  const unsubscribe = adapter?.subscribe?.(render);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('keydown', router.onKeyDown);
    liveAnnouncer.dispose();
    unsubscribe?.();
  };
}
