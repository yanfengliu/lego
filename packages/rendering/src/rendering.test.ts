import type { BrickDocumentV1, PartInstance } from "@lego-studio/protocol";
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
  LineSegments,
  Material,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Vector3,
} from "three";
import { describe, expect, it, vi } from "vitest";

import {
  CANONICAL_VIEW_NAMES,
  MIN_ORBIT_NEAR,
  THREE_UNITS_PER_LDU,
  createCameraForView,
  createCanonicalViewPacket,
  deriveBrickScene,
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

    expect(bodies).toHaveLength(1);
    expect(studs).toHaveLength(6);

    const body = bodies[0] as Mesh<BoxGeometry, MeshStandardMaterial>;
    expect(body.geometry).toBeInstanceOf(BoxGeometry);
    expect(body.geometry.parameters).toMatchObject({ width: 2, depth: 3 });
    expect(body.geometry.parameters.height).toBeCloseTo(1.2);
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

describe("instruction finish", () => {
  const document = documentWithParts([createPartInstance({ id: "instruction-subject" })]);

  it("fills flat and unlit, because booklet art carries no lighting", () => {
    const scene = deriveBrickScene(document, { finish: "instruction" });
    const bodies = objectsWithRole(scene.root, "body");

    expect(bodies).toHaveLength(1);
    const material = (bodies[0] as Mesh).material as Material;
    expect(material.type).toBe("MeshBasicMaterial");
    // A slope-scaled offset grows without bound on faces seen edge-on and
    // pushed fills behind their own hidden edges; only the constant term is safe.
    expect(material.polygonOffsetFactor).toBe(0);
    expect(material.polygonOffsetUnits).toBeGreaterThan(0);
    scene.dispose();
  });

  it("outlines the body and every stud, and casts no shadow", () => {
    const scene = deriveBrickScene(document, { finish: "instruction" });
    const studs = objectsWithRole(scene.root, "stud");
    const outlines = objectsWithRole(scene.root, "instruction-outline");

    expect(studs.length).toBeGreaterThan(0);
    expect(outlines).toHaveLength(studs.length + 1);
    for (const object of [...studs, ...objectsWithRole(scene.root, "body")]) {
      expect(object.castShadow).toBe(false);
      expect(object.receiveShadow).toBe(false);
    }
    scene.dispose();
  });

  it("shares one ink material across a part's outlines", () => {
    const scene = deriveBrickScene(document, { finish: "instruction" });
    const materials = new Set(
      objectsWithRole(scene.root, "instruction-outline").map(
        (outline) => (outline as LineSegments).material as Material,
      ),
    );

    expect(materials.size).toBe(1);
    scene.dispose();
  });

  it("draws no outlines in any other finish", () => {
    for (const finish of ["flat", "presentation"] as const) {
      const scene = deriveBrickScene(document, { finish });
      expect(objectsWithRole(scene.root, "instruction-outline")).toHaveLength(0);
      scene.dispose();
    }
  });

  it("omits the overlays a booklet never prints", () => {
    // Two bricks in the same place: a blocking collision on both, so the
    // editor scene has something to paint red.
    const invalid = documentWithParts([
      createPartInstance({ id: "overlapping-a" }),
      createPartInstance({ id: "overlapping-b" }),
    ]);
    const editor = deriveBrickScene(invalid, { selectedPartIds: ["overlapping-a"] });
    const instruction = deriveBrickScene(invalid, {
      finish: "instruction",
      selectedPartIds: ["overlapping-a"],
    });

    expect(editor.validationReport.documentGloballyValid).toBe(false);
    expect(objectsWithRole(editor.root, "validation-overlay").length).toBeGreaterThan(0);
    expect(objectsWithRole(editor.root, "selection-overlay")).toHaveLength(1);
    expect(objectsWithRole(instruction.root, "validation-overlay")).toHaveLength(0);
    expect(objectsWithRole(instruction.root, "selection-overlay")).toHaveLength(0);
    editor.dispose();
    instruction.dispose();
  });

  it("refuses a selection it could not draw, rather than silently dropping it", () => {
    const scene = deriveBrickScene(document, { finish: "instruction" });

    expect(() => setBrickSceneSelection(scene, ["instruction-subject"])).toThrowError(
      /instruction scene: it draws no overlays/,
    );
    scene.dispose();
  });

  it("keeps the same authoritative bounds as the flat finish, so framing is unchanged", () => {
    const flat = deriveBrickScene(document);
    const instruction = deriveBrickScene(document, { finish: "instruction" });

    expect(instruction.bounds.min.toArray()).toEqual(flat.bounds.min.toArray());
    expect(instruction.bounds.max.toArray()).toEqual(flat.bounds.max.toArray());
    flat.dispose();
    instruction.dispose();
  });

  it("disposes its outline geometry and ink", () => {
    const scene = deriveBrickScene(document, { finish: "instruction" });
    const outline = objectsWithRole(scene.root, "instruction-outline")[0] as LineSegments;
    const disposeGeometry = vi.spyOn(outline.geometry, "dispose");
    const disposeMaterial = vi.spyOn(outline.material as Material, "dispose");

    scene.dispose();
    expect(disposeGeometry).toHaveBeenCalled();
    expect(disposeMaterial).toHaveBeenCalled();
  });
});
