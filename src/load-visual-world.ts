import type { LivingSystemsWorld } from './world/living-world';
import type { WorldRuntimeOptions } from './world/types';

type VisualWorldModule = typeof import('./world/living-world');
type VisualWorldImporter = () => Promise<VisualWorldModule>;

export async function loadVisualWorld(
  host: HTMLElement,
  options: WorldRuntimeOptions,
  importer: VisualWorldImporter = () => import('./world/living-world'),
): Promise<LivingSystemsWorld | undefined> {
  try {
    const { LivingSystemsWorld: World } = await importer();
    return new World(host, options);
  } catch (error) {
    options.onFailure?.(
      error instanceof Error
        ? `Visual world unavailable: ${error.message}`
        : 'Visual world unavailable.',
    );
    return undefined;
  }
}
