import type { WorldRuntimeOptions } from './types';

export interface RendererProfile {
  readonly quality: 'high' | 'low';
  readonly dprCap: number;
  readonly animateTransitions: boolean;
  readonly showCircuitDetails: boolean;
}

export function selectRendererProfile(
  requested: WorldRuntimeOptions['quality'],
  viewportWidth: number,
  reducedMotion = false,
): RendererProfile {
  const quality = requested === 'low' || (requested !== 'high' && viewportWidth <= 700) ? 'low' : 'high';
  return {
    quality,
    dprCap: quality === 'high' ? 1.75 : 1,
    animateTransitions: quality === 'high' && !reducedMotion,
    showCircuitDetails: quality === 'high',
  };
}
