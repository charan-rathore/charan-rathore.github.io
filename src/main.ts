import './styles.css';
import { GameRuntime } from './integration/game-runtime';
import { mountSemanticUI } from './ui/semantic-ui';
import { LivingSystemsWorld } from './world/living-world';

const stage = document.querySelector<HTMLElement>('[data-world-stage]');
const status = document.querySelector<HTMLElement>('[data-world-status]');
const fallback = document.querySelector<HTMLElement>('[data-static-fallback]');
const semanticRoot = document.querySelector<HTMLElement>('[data-living-systems]');
let world: LivingSystemsWorld | undefined;

function enterFallback(reason: string): void {
  document.body.dataset.mode = 'static';
  fallback?.removeAttribute('hidden');
  status?.replaceChildren(document.createTextNode(reason));
  runtime.setStaticMode(true);
}

if (stage) {
  try {
    world = new LivingSystemsWorld(stage, {
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      onFailure: enterFallback,
    });
  } catch (error) {
    enterFallback(error instanceof Error ? `Visual world unavailable: ${error.message}` : 'Visual world unavailable.');
  }
}

const runtime = new GameRuntime({
  onWorldSnapshot: (snapshot) => {
    document.body.dataset.mode = snapshot.mode;
    world?.update(snapshot);
  },
});
const unmountUI = semanticRoot ? mountSemanticUI(semanticRoot, runtime, {
  onModeChange: (mode) => runtime.setStaticMode(mode === 'direct'),
}) : undefined;
runtime.start();

const visibility = stage && world
  ? new IntersectionObserver(([entry]) => {
    const offscreen = !entry?.isIntersecting;
    world?.setOffscreen(offscreen);
    if (offscreen) runtime.pauseForEnvironment();
  }, { threshold: 0.01 })
  : undefined;
if (stage) visibility?.observe(stage);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) runtime.pauseForEnvironment();
});
window.addEventListener('blur', () => runtime.pauseForEnvironment());
window.addEventListener('pagehide', () => {
  visibility?.disconnect();
  unmountUI?.();
  runtime.dispose();
  world?.dispose();
}, { once: true });
