import { Material, Object3D, Texture, type BufferGeometry } from "three";

function materialTextures(material: Material): readonly Texture[] {
  const textures = new Set<Texture>();
  for (const value of Object.values(material)) {
    if (value instanceof Texture) textures.add(value);
  }
  return [...textures];
}

export function disposeObjectTree(root: Object3D): void {
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
    for (const material of objectMaterials) {
      materials.add(material);
      for (const texture of materialTextures(material)) textures.add(texture);
    }
  });

  root.removeFromParent();
  for (const object of objects.reverse()) object.clear();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}
