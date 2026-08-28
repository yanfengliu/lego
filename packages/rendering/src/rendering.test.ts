import type { BrickDocumentV1, PartInstance } from "@lego-studio/protocol";
import { getPartDefinition } from "@lego-studio/catalog";
import {
  createEmptyBrickDocument,
  createPartInstance,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Vector3,
} from "three";
import { describe, expect, it, vi } from "vitest";

import {
  CANONICAL_VIEW_NAMES,
  MIN_ORBIT_NEAR,
  THREE_UNITS_PER_LDU,
  createCameraForView,
  createCanonicalViewPacket,
  createPlacementGhost,
  deriveBrickScene,
  disposeObjectTree,
  lduToThreeVector,
  lduTransformToThreeMatrix,
  fitPerspectiveCameraToFrame,
  orbitCameraFrustum,
  rebuildBrickScene,
  setBrickSceneSelection,
  RENDER_LIMITS,
} from "./index.ts";

function documentWithParts(parts: readonly PartInstance[]): BrickDocumentV1 {
  const document = createEmptyBrickDocument({ id: "document-1", name: "Render fixture" });
  const partIds = parts.map(({ id }) => id);

  return {
    ...document,
    parts,
    submodels: document.submodels.map((submodel) => ({ ...submodel, partIds })),
    steps: document.steps.map((step) => ({ ...step, partIds })),
  };
}

function objectsWithRole(root: Group, renderRole: string) {
  const matches: Group["children"] = [];
  root.traverse((object) => {
    if (object.userData.renderRole === renderRole) matches.push(object);
  });
  return matches;
}

describe("brick scene derivation", () => {
  it("rejects oversized documents before scene allocation", () => {
    const part = createPartInstance({ id: "part-template" });
    const document = documentWithParts(
      Array.from({ length: RENDER_LIMITS.maxParts + 1 }, (_, index) => ({
        ...part,
        id: `part-${index}`,
      })),
    );

    expect(() => deriveBrickScene(document)).toThrowError(
      expect.objectContaining({ code: "RENDER_BUDGET_EXCEEDED" }),
    );
  });

  it.each([
    ["upright-yaw-0", [1, 0, 0]],
    ["upright-yaw-90", [0, 0, -1]],
    ["upright-yaw-180", [-1, 0, 0]],
    ["upright-yaw-270", [0, 0, 1]],
  ] as const)("projects %s with the catalog's exact quarter-turn", (orientationId, expected) => {
    const matrix = lduTransformToThreeMatrix({ positionLdu: [0, 0, 0], orientationId });
    const projected = new Vector3(1, 0, 0).applyMatrix4(matrix).toArray();

    expect(projected).toEqual(expected.map((coordinate) => expect.closeTo(coordinate)));
  });

  it("projects a non-upright proper orientation and rejects an unknown matrix label", () => {
    const matrix = lduTransformToThreeMatrix({
      positionLdu: [0, 0, 0],
      orientationId: "proper-m-p0000p0n0",
    });
    expect(new Vector3(0, 1, 0).applyMatrix4(matrix).toArray()).toEqual([0, 0, expect.closeTo(1)]);
    expect(new Vector3(0, 0, 1).applyMatrix4(matrix).toArray()).toEqual([0, expect.closeTo(-1), 0]);
    expect(() =>
      lduTransformToThreeMatrix({
        positionLdu: [0, 0, 0],
        orientationId: "hostile-unknown-orientation",
      }),
    ).toThrow(/Unknown proper orientation/u);
  });

  it("maps canonical -Y-up LDU transforms into Three.js +Y-up scene units", () => {
    const part = createPartInstance({
      id: "rotated",
      catalogPartId: "builtin:brick-1x2",
      transform: {
        positionLdu: [20, -24, 40],
        orientationId: "upright-yaw-90",
      },
    });
    const document = documentWithParts([part]);
    const before = JSON.stringify(document);
    const projection = deriveBrickScene(document);
    const partObject = projection.partObjects.get(part.id);

    expect(THREE_UNITS_PER_LDU).toBe(0.05);
    expect(lduToThreeVector([20, -24, 40]).toArray()).toEqual([1, expect.closeTo(1.2), 2]);
    expect(partObject?.position.toArray()).toEqual([1, expect.closeTo(1.2), 2]);

    partObject?.updateMatrixWorld(true);
    const transformedLocalX = new Vector3(1, 0, 0).applyMatrix4(partObject!.matrixWorld);
    expect(transformedLocalX.toArray()).toEqual([
      expect.closeTo(1),
      expect.closeTo(1.2),
      expect.closeTo(1),
    ]);
    expect(partObject?.userData).toMatchObject({
      renderRole: "part",
      partId: "rotated",
      orientationId: "upright-yaw-90",
    });
    expect(JSON.stringify(document)).toBe(before);
  });

  /**
   * A tube is the one piece of this renderer whose surface is built by hand,
   * and the first version had all 144 of its triangles wound backwards. Every
   * material here is `FrontSide`, so the tubes were in the scene, counted by
   * the tests above, and drew nothing at all: the from-below capture of a 2x4
   * plate was a flat red rectangle, exactly the picture the shell exists to
   * replace. Vertex order cannot be read; the direction each face points can be
   * measured, so it is.
   */
  it("points every face of an underside tube outward, at a camera that can see it", () => {
    const part = createPartInstance({ id: "plate", catalogPartId: "builtin:plate-2x4" });
    const projection = deriveBrickScene(documentWithParts([part]));
    const tubes = objectsWithRole(projection.partObjects.get(part.id)!, "body").filter(({ name }) =>
      name.startsWith("tube:"),
    );

    expect(tubes).toHaveLength(3);
    const position = (tubes[0] as Mesh).geometry.getAttribute("position");
    const facing = { away: 0, toward: 0, up: 0, down: 0 };
    for (let first = 0; first + 2 < position.count; first += 3) {
      const corners = [0, 1, 2].map((offset) =>
        new Vector3().fromBufferAttribute(position, first + offset),
      );
      const normal = new Vector3()
        .crossVectors(corners[1]!.clone().sub(corners[0]!), corners[2]!.clone().sub(corners[0]!))
        .normalize();
      if (Math.abs(normal.y) > 0.9) {
        // The part hangs studs-up, so a face a camera below can see points at
        // negative Y in scene space.
        facing[normal.y > 0 ? "up" : "down"] += 1;
        continue;
      }
      const centroid = corners
        .reduce((sum, corner) => sum.add(corner), new Vector3())
        .multiplyScalar(1 / 3);
      const outward = new Vector3(centroid.x, 0, centroid.z).normalize();
      facing[normal.dot(outward) > 0 ? "away" : "toward"] += 1;
    }

    // 24 facets: an outer wall and a bore of two triangles each, plus the ring
    // that caps them at the open face. The outer wall points away from the
    // axis, the bore points at it, and the ring points down.
    expect(facing).toEqual({ away: 48, toward: 48, up: 0, down: 48 });
  });

  it("builds project-authored body and stud meshes from catalog recipes", () => {
    const part = createPartInstance({
      id: "brick",
      catalogPartId: "builtin:brick-2x3",
      colorId: "builtin:red",
    });
    const projection = deriveBrickScene(documentWithParts([part]));
    const partObject = projection.partObjects.get(part.id)!;
    const bodies = objectsWithRole(partObject, "body");
    const studs = objectsWithRole(partObject, "stud");

    // A brick is a shell: the ceiling slab, four walls and the two tubes that
    // stand between its six stud cells. The one filled prism it used to be
    // would have been a body no stud could clutch into.
    expect(bodies).toHaveLength(7);
    expect(bodies.filter(({ name }) => name.startsWith("tube:"))).toHaveLength(2);
    expect(studs).toHaveLength(6);

    const boxes = bodies.filter(({ name }) => name.startsWith("body:")) as Mesh<
      BoxGeometry,
      MeshStandardMaterial
    >[];
    expect(boxes).toHaveLength(5);
    // Nothing spans the whole 1.2-unit height any more; the ceiling is the
    // 4 LDU of the brick's 24 that `s/3001s01.dat` leaves solid over its cavity.
    expect(boxes.map((box) => box.geometry.parameters.height)).not.toContain(1.2);
    const body = boxes[0]!;
    expect(body.geometry).toBeInstanceOf(BoxGeometry);
    expect(body.geometry.parameters).toMatchObject({ width: 2, depth: 3 });
    expect(body.geometry.parameters.height).toBeCloseTo(0.2);
    expect(body.material).toBeInstanceOf(MeshStandardMaterial);
    expect(body.material.color.getHex()).toBe(0xc91a09);
    expect(body.geometry.userData).toMatchObject({
      generatorId: "builtin:parametric-rectilinear-part/1",
      catalogPartId: "builtin:brick-2x3",
      provenanceSourceId: "lego-studio:parametric-rectilinear-part-generator",
    });

    for (const object of studs) {
      const stud = object as Mesh<CylinderGeometry, MeshStandardMaterial>;
      expect(stud.geometry).toBeInstanceOf(CylinderGeometry);
      expect(stud.geometry.parameters.radiusTop).toBeCloseTo(0.3);
      expect(stud.geometry.parameters.radiusBottom).toBeCloseTo(0.3);
      expect(stud.geometry.parameters.height).toBeCloseTo(0.2);
      expect(stud.material).toBe(body.material);
    }
  });

  it("renders an exact source mesh as one body with no preserved-collision seams", () => {
    const target = createPartInstance({
      id: "quarter-ring",
      catalogPartId: "builtin:corner-plate-5x5-quarter-ring",
      colorId: "builtin:red",
    });
    const projection = deriveBrickScene(documentWithParts([target]));
    const bodies = objectsWithRole(projection.partObjects.get(target.id)!, "body");

    expect(bodies).toHaveLength(1);
    expect(bodies[0]!.userData.primitiveId).toBe("mesh:ldraw:official:80015.dat");
    const geometry = (bodies[0] as Mesh<BufferGeometry>).geometry;
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.min.toArray()).toEqual([
      expect.closeTo(-1),
      expect.closeTo(-0.2),
      expect.closeTo(-4),
    ]);
    expect(geometry.boundingBox?.max.toArray()).toEqual([
      expect.closeTo(4),
      expect.closeTo(0.4),
      expect.closeTo(1),
    ]);
  });

  it("uses the exact asymmetric, hollow source body for placement ghosts", () => {
    const definition = getPartDefinition("builtin:corner-plate-5x5-quarter-ring")!;
    const ghost = createPlacementGhost(
      definition,
      { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
      "valid",
    );
    ghost.updateMatrixWorld(true);
    const body = ghost.children.find(
      (object): object is Mesh<BufferGeometry> =>
        object instanceof Mesh && object.userData.primitiveId === "mesh:ldraw:official:80015.dat",
    )!;
    body.geometry.computeBoundingBox();

    expect(ghost.userData.sourceOfTruth).toBe("catalog-derived-display");
    expect(body.geometry.boundingBox?.min.toArray()).toEqual([
      expect.closeTo(-1),
      expect.closeTo(-0.2),
      expect.closeTo(-4),
    ]);
    expect(body.geometry.boundingBox?.max.toArray()).toEqual([
      expect.closeTo(4),
      expect.closeTo(0.4),
      expect.closeTo(1),
    ]);

    const ray = (xLdu: number, zLdu: number) =>
      new Raycaster(
        new Vector3(xLdu * THREE_UNITS_PER_LDU, 10, zLdu * THREE_UNITS_PER_LDU),
        new Vector3(0, -1, 0),
      ).intersectObject(body, false);
    expect(ray(20, -20)).toEqual([]);
    expect(ray(50, -50).length).toBeGreaterThan(0);

    disposeObjectTree(ghost);
  });

  it("keeps a wedge's cut-away corner empty in its placement ghost", () => {
    const definition = getPartDefinition("builtin:wedge-plate-4x4-cut-corner")!;
    const ghost = createPlacementGhost(
      definition,
      { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
      "valid",
    );
    ghost.updateMatrixWorld(true);
    const body = ghost.children.find(
      (object): object is Mesh<BufferGeometry> =>
        object instanceof Mesh && object.userData.primitiveId === "mesh:ldraw:official:30503.dat",
    )!;
    const ray = (xLdu: number, zLdu: number) =>
      new Raycaster(
        new Vector3(xLdu * THREE_UNITS_PER_LDU, 10, zLdu * THREE_UNITS_PER_LDU),
        new Vector3(0, -1, 0),
      ).intersectObject(body, false);

    expect(ray(30, -30)).toEqual([]);
    expect(ray(-30, 30).length).toBeGreaterThan(0);
    disposeObjectTree(ghost);
  });

  it("emits no zero-area triangles for the new wedge and arc bodies", () => {
    const catalogPartIds = [
      "builtin:wedge-plate-4x4-cut-corner",
      "builtin:wedge-plate-6x6-cut-corner",
      "builtin:wedge-plate-3x6-right",
      "builtin:corner-plate-4x4-round",
      "builtin:corner-plate-5x5-quarter-ring",
    ];

    for (const catalogPartId of catalogPartIds) {
      const target = createPartInstance({ id: catalogPartId, catalogPartId });
      const projection = deriveBrickScene(documentWithParts([target]));
      const bodies = objectsWithRole(projection.partObjects.get(target.id)!, "body");
      expect([catalogPartId, bodies.length]).toEqual([catalogPartId, 1]);
      const geometry = (bodies[0] as Mesh<BufferGeometry>).geometry;
      const positions = geometry.getAttribute("position");
      const vertexIndex = (index: number): number => geometry.index?.getX(index) ?? index;
      const triangleCount = (geometry.index?.count ?? positions.count) / 3;
      expect(Number.isInteger(triangleCount)).toBe(true);
      for (let triangle = 0; triangle < triangleCount; triangle += 1) {
        const a = new Vector3().fromBufferAttribute(positions, vertexIndex(triangle * 3));
        const b = new Vector3().fromBufferAttribute(positions, vertexIndex(triangle * 3 + 1));
        const c = new Vector3().fromBufferAttribute(positions, vertexIndex(triangle * 3 + 2));
        const twiceArea = b.sub(a).cross(c.sub(a)).length();
        expect(twiceArea, `${catalogPartId} triangle ${triangle}`).toBeGreaterThan(1e-10);
      }
    }
  });

  it("adds selection and blocking-validation overlays grounded to part IDs", () => {
    const selected = createPartInstance({ id: "selected", catalogPartId: "builtin:plate-1x1" });
    const invalid = createPartInstance({
      id: "invalid",
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:not-a-color",
      transform: { positionLdu: [40, 0, 0], orientationId: "upright-yaw-0" },
    });
    const document = documentWithParts([selected, invalid]);
    const validationReport = validateBrickDocument(document);
    const projection = deriveBrickScene(document, {
      selectedPartIds: [selected.id],
      validationReport,
    });

    expect(projection.validationReport).toEqual(validationReport);
    expect(projection.validationReport).not.toBe(validationReport);
    expect(Object.isFrozen(projection.validationReport)).toBe(true);
    expect(objectsWithRole(projection.root, "selection-overlay")).toHaveLength(1);
    expect(objectsWithRole(projection.root, "validation-overlay")).toHaveLength(2);
    expect(
      objectsWithRole(projection.root, "validation-overlay").map(({ userData }) => userData.partId),
    ).toEqual(["invalid", "selected"]);
    expect(projection.partObjects.get("invalid")?.userData).toMatchObject({
      blockingIssueCodes: ["COLOR_NOT_ALLOWED"],
      invalid: true,
    });
    expect(projection.partObjects.get("selected")?.userData).toMatchObject({
      blockingIssueCodes: ["DISCONNECTED_ASSEMBLY"],
      invalid: true,
    });
  });

  it("updates selection overlays without rebuilding part geometry or camera state", () => {
    const part = createPartInstance({ id: "selectable" });
    const projection = deriveBrickScene(documentWithParts([part]));
    const partObject = projection.partObjects.get(part.id)!;
    const bodyGeometry = (objectsWithRole(partObject, "body")[0] as Mesh).geometry;

    setBrickSceneSelection(projection, [part.id]);
    const overlay = objectsWithRole(partObject, "selection-overlay")[0] as Mesh;
    const dispose = vi.spyOn(overlay.geometry, "dispose");
    expect(partObject.userData.selected).toBe(true);
    expect(objectsWithRole(partObject, "selection-overlay")).toHaveLength(1);
    expect((objectsWithRole(partObject, "body")[0] as Mesh).geometry).toBe(bodyGeometry);

    setBrickSceneSelection(projection, []);
    expect(dispose).toHaveBeenCalledOnce();
    expect(partObject.userData.selected).toBe(false);
    expect(objectsWithRole(partObject, "selection-overlay")).toHaveLength(0);
  });

  it("isolates unsupported catalog data with a diagnostic placeholder", () => {
    const unsupported = createPartInstance({
      id: "unsupported",
      catalogPartId: "custom:unknown-part",
      colorId: "custom:unknown-color",
      transform: { positionLdu: [0, 0, 0], orientationId: "custom:unknown-orientation" },
    });

    const projection = deriveBrickScene(documentWithParts([unsupported]));

    expect(projection.partObjects.get("unsupported")?.userData).toMatchObject({
      placeholder: true,
      invalid: true,
    });
    expect(projection.diagnostics.map(({ code }) => code)).toEqual([
      "UNKNOWN_CATALOG_PART",
      "UNKNOWN_ORIENTATION",
    ]);
    expect(objectsWithRole(projection.root, "placeholder")).toHaveLength(1);
    expect(projection.bounds.isEmpty()).toBe(false);
  });

  it("refuses stale validation overlays and recomputes them for the rendered document", () => {
    const prior = documentWithParts([
      createPartInstance({ id: "prior", colorId: "builtin:not-a-color" }),
    ]);
    const current = documentWithParts([createPartInstance({ id: "current" })]);
    const staleReport = validateBrickDocument(prior);

    const projection = deriveBrickScene(current, { validationReport: staleReport });

    expect(projection.validationReport.targetDocumentHash).toBe(projection.documentHash);
    expect(projection.partObjects.get("current")?.userData.invalid).toBe(false);
    expect(projection.diagnostics).toContainEqual({
      code: "STALE_VALIDATION_REPORT",
      message: "Ignored a validation report for a different document hash",
      partId: null,
    });
  });

  it("does not let a matching-hash report waive local hard validators", () => {
    const document = documentWithParts([
      createPartInstance({ id: "invalid", colorId: "builtin:not-a-color" }),
    ]);
    const computed = validateBrickDocument(document);
    const forged = {
      ...computed,
      patchValid: true,
      documentGloballyValid: true,
      issues: [],
    };

    const projection = deriveBrickScene(document, { validationReport: forged });

    expect(projection.validationReport.documentGloballyValid).toBe(false);
    expect(projection.partObjects.get("invalid")?.userData.blockingIssueCodes).toEqual([
      "COLOR_NOT_ALLOWED",
    ]);
    expect(projection.diagnostics).toContainEqual({
      code: "VALIDATION_REPORT_MISMATCH",
      message: "Ignored a validation report that disagrees with local deterministic validators",
      partId: null,
    });
  });

  it("ignores malformed external reports without aborting local scene derivation", () => {
    const document = documentWithParts([createPartInstance({ id: "safe" })]);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    const projection = deriveBrickScene(document, {
      validationReport: cyclic as unknown as ReturnType<typeof validateBrickDocument>,
    });

    expect(projection.partObjects.has("safe")).toBe(true);
    expect(projection.diagnostics).toContainEqual({
      code: "MALFORMED_VALIDATION_REPORT",
      message: "Ignored a malformed external validation report",
      partId: null,
    });
  });
});

describe("canonical views and lifecycle", () => {
  it("creates a deterministic canonical multi-view packet and Three.js cameras", () => {
    const part = createPartInstance({ id: "viewed", catalogPartId: "builtin:brick-2x4" });
    const first = deriveBrickScene(documentWithParts([part]));
    const second = deriveBrickScene(documentWithParts([part]));
    const firstPacket = createCanonicalViewPacket(first);
    const secondPacket = createCanonicalViewPacket(second);

    expect(firstPacket.schemaVersion).toBe("lego.canonical-view-packet/1");
    expect(firstPacket).toMatchObject({
      rendererVersion: "lego.rendering/1",
      cameraPolicyVersion: "lego.canonical-cameras/1",
      threeUnitsPerLdu: 0.05,
    });
    expect(firstPacket.views.map(({ name }) => name)).toEqual(CANONICAL_VIEW_NAMES);
    expect(firstPacket.views.map(({ projection }) => projection)).toEqual([
      "perspective",
      "orthographic",
      "orthographic",
      "orthographic",
      "orthographic",
      "orthographic",
      "orthographic",
    ]);
    expect(JSON.stringify(firstPacket)).toBe(JSON.stringify(secondPacket));

    const isometric = createCameraForView(firstPacket.views[0]!, 16 / 9);
    const front = createCameraForView(firstPacket.views[1]!, 16 / 9);
    expect(isometric).toBeInstanceOf(PerspectiveCamera);
    expect(front).toBeInstanceOf(OrthographicCamera);
    expect(isometric.position.toArray()).toEqual(firstPacket.views[0]!.position);
    expect(front.position.toArray()).toEqual(firstPacket.views[1]!.position);
  });

  it("uses explicit fallback framing for an empty document", () => {
    const document = createEmptyBrickDocument({ id: "empty", name: "Empty" });
    const projection = deriveBrickScene(document);
    const packet = createCanonicalViewPacket(projection);

    expect(projection.bounds.isEmpty()).toBe(true);
    expect(packet.usedFallbackBounds).toBe(true);
    expect(packet.bounds).toEqual({ min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] });
    expect(packet.views.every(({ near, far }) => near > 0 && far > near)).toBe(true);
  });

  it("moves perspective cameras back when a portrait aspect narrows horizontal FOV", () => {
    const projection = deriveBrickScene(
      documentWithParts([createPartInstance({ id: "wide", catalogPartId: "builtin:brick-2x4" })]),
    );
    const view = createCanonicalViewPacket(projection).views[0]!;
    const landscape = createCameraForView(view, 16 / 9) as PerspectiveCamera;
    const portrait = createCameraForView(view, 0.5) as PerspectiveCamera;
    const target = new Vector3(...view.target);

    expect(portrait.position.distanceTo(target)).toBeGreaterThan(
      landscape.position.distanceTo(target),
    );
    expect(portrait.near).toBeGreaterThan(0);
    expect(portrait.far).toBeGreaterThan(portrait.near);

    const resized = createCameraForView(view, 16 / 9) as PerspectiveCamera;
    fitPerspectiveCameraToFrame(resized, target, view.frameRadius, 0.5);
    expect(resized.position.distanceTo(target)).toBeCloseTo(portrait.position.distanceTo(target));
  });

  it("frames authoritative catalog bounds independently of optional display layers", () => {
    const document = documentWithParts([
      createPartInstance({ id: "framed", catalogPartId: "builtin:brick-2x2" }),
    ]);
    const detailed = deriveBrickScene(document, { includeStuds: true });
    const simplified = deriveBrickScene(document, { includeStuds: false });

    expect(simplified.bounds.min.toArray()).toEqual(detailed.bounds.min.toArray());
    expect(simplified.bounds.max.toArray()).toEqual(detailed.bounds.max.toArray());
    expect(JSON.stringify(createCanonicalViewPacket(simplified))).toBe(
      JSON.stringify(createCanonicalViewPacket(detailed)),
    );
  });

  it("disposes owned resources exactly once and supports clean rebuilds", () => {
    const firstDocument = documentWithParts([
      createPartInstance({ id: "first", catalogPartId: "builtin:brick-1x2" }),
    ]);
    const secondDocument = documentWithParts([
      createPartInstance({ id: "second", catalogPartId: "builtin:plate-2x2" }),
    ]);
    const parent = new Group();
    const first = deriveBrickScene(firstDocument, { selectedPartIds: ["first"] });
    parent.add(first.root);

    const resources = new Set<BufferGeometry | Material>();
    first.root.traverse((object) => {
      if (!(object instanceof Mesh) && !("geometry" in object)) return;
      const renderable = object as unknown as {
        geometry?: BufferGeometry;
        material?: Material | Material[];
      };
      if (renderable.geometry) resources.add(renderable.geometry);
      const materials = Array.isArray(renderable.material)
        ? renderable.material
        : renderable.material
          ? [renderable.material]
          : [];
      for (const material of materials) resources.add(material);
    });
    const disposeCounts = new Map([...resources].map((resource) => [resource, 0]));
    for (const resource of resources) {
      resource.addEventListener("dispose", () => {
        disposeCounts.set(resource, disposeCounts.get(resource)! + 1);
      });
    }

    const rebuilt = rebuildBrickScene(first, secondDocument);
    first.dispose();

    expect(first.disposed).toBe(true);
    expect(first.root.parent).toBeNull();
    expect(first.root.children).toHaveLength(0);
    expect([...disposeCounts.values()].every((count) => count === 1)).toBe(true);
    expect(rebuilt.disposed).toBe(false);
    expect(rebuilt.root).not.toBe(first.root);
    expect(rebuilt.partObjects.has("second")).toBe(true);

    rebuilt.dispose();
  });

  it("retains the previous projection when a rebuild cannot derive its replacement", () => {
    const prior = deriveBrickScene(documentWithParts([createPartInstance({ id: "retained" })]));
    const template = createPartInstance({ id: "template" });
    const oversized = documentWithParts(
      Array.from({ length: RENDER_LIMITS.maxParts + 1 }, (_, index) => ({
        ...template,
        id: `oversized-${index}`,
      })),
    );

    expect(() => rebuildBrickScene(prior, oversized)).toThrow();
    expect(prior.disposed).toBe(false);
    expect(prior.partObjects.has("retained")).toBe(true);
    prior.dispose();
  });
});

describe("interactive orbit frustums", () => {
  const projection = deriveBrickScene(
    documentWithParts([createPartInstance({ id: "orbit-subject" })]),
  );
  const view = createCanonicalViewPacket(projection).views[0]!;
  const authoredDistance = new Vector3(...view.position).distanceTo(new Vector3(...view.target));

  it("keeps the model inside the frustum at any dolly distance", () => {
    for (const multiplier of [0, 0.05, 0.5, 1, 4, 40, 400]) {
      const distance = authoredDistance * multiplier;
      const { near, far } = orbitCameraFrustum(distance, view.frameRadius);

      expect(near).toBeGreaterThanOrEqual(MIN_ORBIT_NEAR);
      // The whole framed sphere sits between the planes, so nothing is clipped away.
      expect(near).toBeLessThanOrEqual(Math.max(MIN_ORBIT_NEAR, distance - view.frameRadius));
      expect(far).toBeGreaterThan(distance + view.frameRadius);
    }
  });

  it("covers display layers wider than the model when asked to", () => {
    const gridRadius = view.frameRadius * 60;
    const { near, far } = orbitCameraFrustum(authoredDistance, gridRadius);

    expect(near).toBe(MIN_ORBIT_NEAR);
    expect(far).toBeGreaterThan(authoredDistance + gridRadius);
  });

  it("reproduces the canonical frustum clipping it replaces for interactive use", () => {
    // Regression: the authored packet far plane hides the model once the user
    // dollies past it, which is exactly what orbitCameraFrustum exists to fix.
    const dollyOut = authoredDistance * 8;

    expect(view.far).toBeLessThan(dollyOut - view.frameRadius);
    expect(orbitCameraFrustum(dollyOut, view.frameRadius).far).toBeGreaterThan(
      dollyOut + view.frameRadius,
    );
  });

  it("rejects distances and radii it cannot build a frustum from", () => {
    expect(() => orbitCameraFrustum(-1, 1)).toThrow(
      /orbit distance must be a non-negative finite number, received -1/,
    );
    expect(() => orbitCameraFrustum(Number.NaN, 1)).toThrow(/received NaN/);
    expect(() => orbitCameraFrustum(1, 0)).toThrow(/sceneRadius must be a positive finite number/);
  });
});

describe("presentation finish", () => {
  function bodyOf(scene: ReturnType<typeof deriveBrickScene>) {
    const part = [...scene.partObjects.values()][0]!;
    const content = part.children.find(
      (child) => child.userData.renderRole !== "selection-overlay",
    )!;
    return (content as Group).children.find(
      (child) => child.userData.renderRole === "body",
    ) as Mesh;
  }

  const document = documentWithParts([createPartInstance({ id: "finish-subject" })]);

  it("defaults to the exact box canonical captures are pinned to", () => {
    const scene = deriveBrickScene(document);
    const body = bodyOf(scene);

    expect(body.geometry.constructor.name).toBe("BoxGeometry");
    expect((body.material as MeshStandardMaterial).type).toBe("MeshStandardMaterial");
    scene.dispose();
  });

  it("bevels the body and adds a clearcoat only when asked", () => {
    const scene = deriveBrickScene(document, { finish: "presentation" });
    const body = bodyOf(scene);

    const flat = deriveBrickScene(document);
    // RoundedBoxGeometry extends BoxGeometry, so identity is the vertex count:
    // a chamfered body carries many more than a six-sided box.
    expect(body.geometry.constructor.name).toBe("RoundedBoxGeometry");
    expect(body.geometry.attributes.position!.count).toBeGreaterThan(
      bodyOf(flat).geometry.attributes.position!.count,
    );
    expect((body.material as MeshStandardMaterial).type).toBe("MeshPhysicalMaterial");
    flat.dispose();
    scene.dispose();
  });

  it("keeps the same authoritative bounds in either finish, so framing is unchanged", () => {
    const flat = deriveBrickScene(document);
    const presentation = deriveBrickScene(document, { finish: "presentation" });

    expect(presentation.bounds.min.toArray()).toEqual(flat.bounds.min.toArray());
    expect(presentation.bounds.max.toArray()).toEqual(flat.bounds.max.toArray());
    flat.dispose();
    presentation.dispose();
  });

  it("disposes a bevelled scene as cleanly as a flat one", () => {
    const scene = deriveBrickScene(document, { finish: "presentation" });
    const body = bodyOf(scene);
    const disposeGeometry = vi.spyOn(body.geometry, "dispose");

    scene.dispose();
    expect(disposeGeometry).toHaveBeenCalled();
    expect(scene.disposed).toBe(true);
  });
});
