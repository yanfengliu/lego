import type { Material } from "three";

/**
 * Shared part materials, keyed by what actually decides one: the display colour
 * and the finish. A part material is not part-specific truth — two red 2x4
 * bricks want the same plastic — but the renderer used to mint one per part per
 * scene derivation and dispose it on the next.
 *
 * That is expensive for a reason that is invisible from here. Three.js shares a
 * compiled GL program between every material with the same shader cache key and
 * refcounts it; disposing the last material holding a key calls `releaseProgram`
 * and deletes the program, so the next frame has to compile and link three fresh
 * ones, and the link blocks the main thread. Keeping one material per colour
 * alive across rebuilds keeps that refcount above zero.
 *
 * The cache is a view-side object with a view-side lifetime: it belongs to the
 * viewport that owns the renderer, not to any document, and it outlives the
 * derived scenes that borrow from it.
 */
export interface PartMaterialCache {
  /** The shared material for a key, created once on first request. */
  acquire(key: string, create: () => Material): Material;
  /**
   * True when this cache owns the material, so tearing a scene down must leave
   * it alone. Disposal of a cached material is the cache's decision only.
   */
  owns(material: Material): boolean;
  readonly size: number;
  readonly disposed: boolean;
  dispose(): void;
}

export function createPartMaterialCache(): PartMaterialCache {
  const byKey = new Map<string, Material>();
  const owned = new Set<Material>();
  let disposed = false;

  return {
    acquire(key, create) {
      if (disposed) {
        throw new Error(`Cannot acquire material ${key} from a disposed part material cache`);
      }
      const existing = byKey.get(key);
      if (existing) return existing;
      const material = create();
      byKey.set(key, material);
      owned.add(material);
      return material;
    },
    owns: (material) => owned.has(material),
    get size() {
      return byKey.size;
    },
    get disposed() {
      return disposed;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const material of byKey.values()) material.dispose();
      byKey.clear();
      owned.clear();
    },
  };
}
