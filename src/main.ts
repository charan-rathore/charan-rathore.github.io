import './styles.css';
import { mountSemanticUI } from './ui/semantic-ui';
import { createDemoSnapshot } from './world/demo-snapshot';
import { LivingSystemsWorld } from './world/living-world';
import type { WorldMode } from './world/types';

const stage = document.querySelector<HTMLElement>('[data-world-stage]');
const status = document.querySelector<HTMLElement>('[data-world-status]');
const fallback = document.querySelector<HTMLElement>('[data-static-fallback]');
const semanticRoot = document.querySelector<HTMLElement>('[data-living-systems]');
if (semanticRoot) mountSemanticUI(semanticRoot);
let revision = 0;
let mode: WorldMode = 'playing';
let world: LivingSystemsWorld | undefined;

function setMode(nextMode: WorldMode): void {
  mode = nextMode;
  revision += 1;
  document.body.dataset.mode = mode;
  status?.replaceChildren(document.createTextNode(
    mode === 'resolved' ? 'THE SYSTEM RESOLVED — five typed stages compiled.'
      : mode === 'provenance-failure' ? 'Citation path severed. Evaluation is now ungrounded.'
        : mode === 'static' ? 'Static semantic view active.'
          : 'Retrieval can connect to Provenance. Place the predicted edge.',
  ));
  world?.update(createDemoSnapshot(mode, revision));
}

function enterFallback(reason: string): void {
  document.body.dataset.mode = 'static';
  fallback?.removeAttribute('hidden');
  status?.replaceChildren(document.createTextNode(reason));
}

if (stage) {
  try {
    world = new LivingSystemsWorld(stage, {
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      onFailure: enterFallback,
    });
    setMode('playing');
    const visibility = new IntersectionObserver(([entry]) => world?.setOffscreen(!entry?.isIntersecting), { threshold: 0.01 });
    visibility.observe(stage);
    window.addEventListener('pagehide', () => { visibility.disconnect(); world?.dispose(); }, { once: true });
  } catch (error) {
    enterFallback(error instanceof Error ? `Visual world unavailable: ${error.message}` : 'Visual world unavailable.');
  }
}

document.querySelector('[data-action="play"]')?.addEventListener('click', () => setMode('playing'));
document.querySelector('[data-action="resolve"]')?.addEventListener('click', () => setMode('resolved'));
document.querySelector('[data-action="break"]')?.addEventListener('click', () => setMode('provenance-failure'));
document.querySelector('[data-action="static"]')?.addEventListener('click', () => setMode(mode === 'static' ? 'playing' : 'static'));
