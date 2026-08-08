import { Material, Object3D, Texture, type BufferGeometry } from "three";

function materialTextures(material: Material): readonly Texture[] {
  const textures = new Set<Texture>();
  for (const value of Object.values(material)) {
    if (value instanceof Texture) textures.add(value);
  }
  return [...textures];
}

/**
 * Frees everything a subtree owns. `retainMaterial` names the materials this
 * subtree only borrowed — a shared cache's, typically — and leaves them and
 * their textures alone; every other material is disposed as before.
 */
export function disposeObjectTree(
  root: Object3D,
  retainMaterial?: (material: Material) => boolean,
): void {
  const objects: Object3D[] = [];
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();

  root.traverse((object) => {
    objects.push(object);
    const renderable = object as Object3D & {
      geometry?: BufferGeometry;
      material?: Material | Material[];
    };
    if (renderable.geometry) geometries.add(renderable.geometry);
    const objectMaterials = Array.isArray(renderable.material)
      ? renderable.material
      : renderable.material
        ? [renderable.material]
        : [];
    for (const material of objectMaterials) materials.add(material);
  });

  // A retained material keeps its textures: they are the cache's to free, and
  // disposing one out from under a live material is a blank surface next frame.
  for (const material of materials) {
    if (retainMaterial?.(material) === true) continue;
    for (const texture of materialTextures(material)) textures.add(texture);
  }

  root.removeFromParent();
  for (const object of objects.reverse()) object.clear();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) {
    if (retainMaterial?.(material) === true) continue;
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
}
