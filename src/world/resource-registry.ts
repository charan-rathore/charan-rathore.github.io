import type { Material, Texture } from 'three';
import type { BufferGeometry } from 'three';

type Disposable = BufferGeometry | Material | Texture;

interface Entry {
  refs: number;
  resource: Disposable;
}

/** Reference-counted ownership for geometry/materials shared by pooled scene views. */
export class ResourceRegistry {
  private readonly entries = new Map<string, Entry>();

  acquire<T extends Disposable>(key: string, create: () => T): T {
    const existing = this.entries.get(key);
    if (existing) {
      existing.refs += 1;
      return existing.resource as T;
    }
    const resource = create();
    this.entries.set(key, { refs: 1, resource });
    return resource;
  }

  release(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs <= 0) {
      entry.resource.dispose();
      this.entries.delete(key);
    }
  }

  dispose(): void {
    this.entries.forEach(({ resource }) => resource.dispose());
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
