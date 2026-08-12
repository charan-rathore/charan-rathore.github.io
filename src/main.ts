import './styles.css';
import { GameRuntime } from './integration/game-runtime';
import { loadVisualWorld } from './load-visual-world';
import { mountSemanticUI } from './ui/semantic-ui';
import type { LivingSystemsWorld } from './world/living-world';
import type { WorldSnapshot } from './world/types';

const stage = document.querySelector<HTMLElement>('[data-world-stage]');
const status = document.querySelector<HTMLElement>('[data-world-status]');
const fallback = document.querySelector<HTMLElement>('[data-static-fallback]');
const semanticRoot = document.querySelector<HTMLElement>('[data-living-systems]');
let world: LivingSystemsWorld | undefined;
let visibility: IntersectionObserver | undefined;
let latestWorldSnapshot: WorldSnapshot | undefined;
let disposed = false;

function enterFallback(reason: string): void {
  document.body.dataset.mode = 'static';
  fallback?.removeAttribute('hidden');
  status?.replaceChildren(document.createTextNode(reason));
  runtime.setFallbackMode(true);
}

const runtime = new GameRuntime({
  onWorldSnapshot: (snapshot) => {
    latestWorldSnapshot = snapshot;
    document.body.dataset.mode = snapshot.mode;
    world?.update(snapshot);
  },
});
const unmountUI = semanticRoot ? mountSemanticUI(semanticRoot, runtime, {
  onModeChange: (mode) => runtime.setDirectMode(mode === 'direct'),
}) : undefined;
runtime.start();

if (stage) {
  void loadVisualWorld(stage, {
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    onFailure: enterFallback,
  }).then((loadedWorld) => {
    if (!loadedWorld) return;
    if (disposed) {
      loadedWorld.dispose();
      return;
    }

    world = loadedWorld;
    if (latestWorldSnapshot) world.update(latestWorldSnapshot);
    visibility = new IntersectionObserver(([entry]) => {
      const offscreen = !entry?.isIntersecting;
      world?.setOffscreen(offscreen);
      if (offscreen) runtime.suspendEnvironment();
      else runtime.resumeEnvironment();
    }, { threshold: 0.01 });
    visibility.observe(stage);
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) runtime.suspendEnvironment();
  else runtime.resumeEnvironment();
});
window.addEventListener('blur', () => runtime.suspendEnvironment());
window.addEventListener('focus', () => runtime.resumeEnvironment());
window.addEventListener('pagehide', () => {
  disposed = true;
  visibility?.disconnect();
  unmountUI?.();
  runtime.dispose();
  world?.dispose();
}, { once: true });
