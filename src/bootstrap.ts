import { GameRuntime } from './integration/game-runtime';
import { mountSemanticUI } from './ui/semantic-ui';
import type { LivingSystemsWorld } from './world/living-world';
import type { WorldRuntimeOptions } from './world/types';

export interface BootstrapElements {
  readonly stage: HTMLElement | null;
  readonly status: HTMLElement | null;
  readonly fallback: HTMLElement | null;
  readonly semanticRoot: HTMLElement | null;
}
export interface BootstrapDependencies {
  readonly createWorld: (host: HTMLElement, options: WorldRuntimeOptions) => LivingSystemsWorld;
  readonly reducedMotion?: boolean;
  readonly createVisibilityObserver?: (callback: IntersectionObserverCallback) => Pick<IntersectionObserver, 'observe' | 'disconnect'>;
}
export interface BootstrappedLivingSystems { readonly runtime: GameRuntime; readonly world?: LivingSystemsWorld; dispose(): void }

export function bootstrapLivingSystems(elements: BootstrapElements, dependencies: BootstrapDependencies): BootstrappedLivingSystems {
  let world: LivingSystemsWorld | undefined;
  let fallbackActive = false;
  const runtime = new GameRuntime({ onWorldSnapshot: (snapshot) => {
    document.body.dataset.mode = fallbackActive ? 'static' : snapshot.mode;
    world?.update(snapshot);
  } });
  const enterFallback = (reason: string): void => {
    fallbackActive = true;
    document.body.dataset.mode = 'static';
    elements.fallback?.removeAttribute('hidden');
    elements.status?.replaceChildren(document.createTextNode(reason));
    runtime.setFallbackMode(true);
  };
  const unmountUI = elements.semanticRoot ? mountSemanticUI(elements.semanticRoot, runtime, {
    onModeChange: (mode) => runtime.setDirectMode(mode === 'direct'),
  }) : undefined;
  runtime.start();

  if (elements.stage) {
    try {
      world = dependencies.createWorld(elements.stage, { reducedMotion: dependencies.reducedMotion ?? false, onFailure: enterFallback, onIntent: (intent) => runtime.dispatch({ type: intent, source: 'pointer' }) });
      runtime.start();
    } catch (error) {
      enterFallback(error instanceof Error ? `Visual world unavailable: ${error.message}` : 'Visual world unavailable.');
    }
  }

  const visibility = elements.stage && world && dependencies.createVisibilityObserver
    ? dependencies.createVisibilityObserver(([entry]) => {
      const offscreen = !entry?.isIntersecting;
      world?.setOffscreen(offscreen);
      if (offscreen) runtime.suspendEnvironment(); else runtime.resumeEnvironment();
    }) : undefined;
  if (elements.stage) visibility?.observe(elements.stage);
  const onVisibility = (): void => document.hidden ? runtime.suspendEnvironment() : runtime.resumeEnvironment();
  const onBlur = (): void => runtime.suspendEnvironment();
  const onFocus = (): void => runtime.resumeEnvironment();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  return { runtime, world, dispose() {
    visibility?.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
    unmountUI?.(); runtime.dispose(); world?.dispose();
  } };
}
