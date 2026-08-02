import type { BrickDocumentV1, PartInstance } from "@lego-studio/protocol";
import { createEmptyBrickDocument, createPartInstance } from "@lego-studio/brick-kernel";
import { COLOR_DEFINITIONS, getColorDefinition } from "@lego-studio/catalog";
import {
  Color,
  Group,
  LineSegments,
  Material,
  Matrix3,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";
import { describe, expect, it, vi } from "vitest";

import {
  INSTRUCTION_BACKGROUND_HEX,
  deriveBrickScene,
  instructionEdgeHex,
  instructionBoxOutline,
  instructionFaceTones,
  instructionLuminance,
  instructionTone,
  setBrickSceneSelection,
  setInstructionSilhouetteMode,
  type InstructionBox,
} from "./index.ts";

/** What createPartInstance colours a part unless a test says otherwise. */
const RED_PART_COLOR_ID = "builtin:red";

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

describe("instruction finish", () => {
  const document = documentWithParts([createPartInstance({ id: "instruction-subject" })]);

  it("shades by face without lighting the scene, and offsets no polygons", () => {
    const scene = deriveBrickScene(document, { finish: "instruction" });
    const bodies = objectsWithRole(scene.root, "body");

    expect(bodies).toHaveLength(1);
    const material = (bodies[0] as Mesh).material as MeshBasicMaterial;
    // Unlit still: the tone rides in the geometry, so an instruction scene
    // needs no lights and cannot pick up a gradient from one.
    expect(material.type).toBe("MeshBasicMaterial");
    expect(material.vertexColors).toBe(true);
    // The fill's depth is left honest so it can still hide the lines behind it;
    // the outline is the thing that moves. Offsetting the fill instead lost the
    // z-fight on most of a silhouette and leaked hidden lines through faces.
    expect(material.polygonOffset).toBe(false);
    scene.dispose();
  });

  it("leaves the seams between one part's boxes uninked, and keeps its real corners", () => {
    // A staircase of two: a tall step and a short one side by side. Their
    // bottoms, fronts and backs are coplanar, so the plane where they meet is
    // three flat seams and one real corner — the step's inner crease. Inking
    // all four is what makes a cheese slope read as separate fins.
    const boxes: InstructionBox[] = [
      { min: [0, 0, 0], max: [1, 2, 1] },
      { min: [1, 0, 0], max: [2, 1, 1] },
    ];
    const segmentsOnPlane = (index: number): [number, number][] => {
      const position = instructionBoxOutline(boxes, index).getAttribute("position");
      const found: [number, number][] = [];
      for (let vertex = 0; vertex + 1 < position.count; vertex += 2) {
        if (position.getX(vertex) !== 1 || position.getX(vertex + 1) !== 1) continue;
        found.push([position.getY(vertex), position.getY(vertex + 1)]);
      }
      return found;
    };
    const lone = instructionBoxOutline([boxes[0]!], 0).getAttribute("position");

    // On its own the tall box draws all twelve of its edges.
    expect(lone.count / 2).toBe(12);
    // Beside its neighbour, nothing is inked on the buried half of the shared
    // face, and each end of the step's own riser is: two verticals from the
    // neighbour's top to its own, plus its top edge running across.
    expect(segmentsOnPlane(0)).toEqual([
      [1, 2],
      [1, 2],
      [2, 2],
    ]);
    // The short box keeps exactly one edge on that plane: the inner corner
    // where its top face meets the tall box's side. Its own bottom, front and
    // back seams run on flat into the neighbour and are dropped.
    expect(segmentsOnPlane(1)).toEqual([[1, 1]]);
  });

  it("gives a box a distinct tone per face, and a stud a light cap on a dark wall", () => {
    const scene = deriveBrickScene(document, { finish: "instruction" });
    const displayHex = Number.parseInt(
      getColorDefinition(RED_PART_COLOR_ID)!.displayHex.slice(1),
      16,
    );
    const body = objectsWithRole(scene.root, "body")[0] as Mesh;
    const stud = objectsWithRole(scene.root, "stud")[0] as Mesh;
    const tonesOf = (mesh: Mesh): Set<number> => {
      const color = mesh.geometry.getAttribute("color");
      const tones = new Set<number>();
      const sample = new Color();
      for (let index = 0; index < color.count; index += 1) {
        sample.setRGB(color.getX(index), color.getY(index), color.getZ(index));
        tones.add(sample.getHex());
      }
      return tones;
    };

    // Six faces, six tones: shading a box in its own frame would give a brick
    // at a quarter turn a different light from the one beside it.
    expect(tonesOf(body).size).toBe(6);
    expect(tonesOf(body)).toContain(instructionTone(displayHex, 0, 1, 0));
    expect(tonesOf(body)).toContain(instructionTone(displayHex, 1, 0, 0));
    expect(tonesOf(body)).toContain(instructionTone(displayHex, 0, 0, 1));
    // A stud is a cap and a wall, and nothing between them.
    expect(tonesOf(stud)).toEqual(
      new Set([
        instructionTone(displayHex, 0, 1, 0, "stud-cap"),
        instructionTone(displayHex, 0, -1, 0, "stud-wall"),
      ]),
    );
    scene.dispose();
  });

  it("lights a face by where it points in the world, not in the part's own frame", () => {
    // A yaw rotation permutes the six axis normals among themselves, so the set
    // of tones on a brick is the same whichever frame it was shaded in. What
    // separates them is which tone lands on which world-facing side: shade in
    // the part's own frame and a brick at a quarter turn takes its neighbour's
    // light, which no printed page does. So every triangle is checked against
    // the tone its own world normal calls for.
    const displayHex = Number.parseInt(
      getColorDefinition(RED_PART_COLOR_ID)!.displayHex.slice(1),
      16,
    );
    for (const orientationId of [
      "upright-yaw-0",
      "upright-yaw-90",
      "upright-yaw-180",
      "upright-yaw-270",
    ] as const) {
      const part = createPartInstance({
        id: `turned-${orientationId}`,
        catalogPartId: "builtin:brick-2x4",
        transform: { positionLdu: [0, 0, 0], orientationId },
      });
      const scene = deriveBrickScene(documentWithParts([part]), { finish: "instruction" });
      const partObject = scene.partObjects.get(part.id)!;
      const body = objectsWithRole(partObject, "body")[0] as Mesh;
      const toWorld = new Matrix3().setFromMatrix4(partObject.matrix);
      const position = body.geometry.getAttribute("position");
      const color = body.geometry.getAttribute("color");
      const corner = new Vector3();
      const normal = new Vector3();
      const drawn = new Color();
      const seen = new Set<number>();

      for (let first = 0; first + 2 < position.count; first += 3) {
        corner.fromBufferAttribute(position, first);
        normal
          .crossVectors(
            new Vector3().fromBufferAttribute(position, first + 1).sub(corner),
            new Vector3().fromBufferAttribute(position, first + 2).sub(corner),
          )
          .normalize()
          .applyMatrix3(toWorld)
          .normalize();
        drawn.setRGB(color.getX(first), color.getY(first), color.getZ(first));
        expect(drawn.getHex(), `${orientationId} face ${normal.toArray().join()}`).toBe(
          instructionTone(displayHex, normal.x, normal.y, normal.z),
        );
        seen.add(drawn.getHex());
      }
      // All six sides present, so the check above covered every direction.
      expect(seen.size).toBe(6);
      scene.dispose();
    }
  });

  it("inks a dark part lighter than its fill and a light part darker", () => {
    // One fixed near-black ink left a black part with no visible edges at all:
    // 0x1a1a1a against a #05131D fill is nine levels of contrast, which prints
    // as nothing. LDraw's own palette inks black at #808080 for this reason.
    const black = instructionEdgeHex(0x05131d);
    const white = instructionEdgeHex(0xffffff);

    expect(instructionLuminance(black)).toBeGreaterThan(instructionLuminance(0x05131d));
    expect(instructionLuminance(white)).toBeLessThan(instructionLuminance(0xffffff));
    // Both land near the measured booklet ink, which sits around 110 whichever
    // side of the split the part's colour falls on.
    expect((black >> 8) & 0xff).toBeGreaterThan(90);
    expect((white >> 8) & 0xff).toBeLessThan(140);
  });

  it("keeps every tone clear of the page colour by more than a keyer's tolerance", () => {
    // Every silhouette in this repo is keyed by "not the page grey", so a face
    // tone near it punches a hole in the model rather than shading it, and the
    // keyers work to a tolerance rather than to equality: `panelDelta` compares
    // summed channel distance against a default of 8, and `buildStudTextureField`
    // compares per channel against a default of 8.
    //
    // Shading narrows this a lot. A flat fill of light gray (#9BA19D) sat 45
    // from the page summed; its darkest shaded face sits 10. That is still
    // outside both defaults, but it is the number to watch: dim the model
    // further and a light gray part starts dissolving into the paper.
    const page = [
      (INSTRUCTION_BACKGROUND_HEX >> 16) & 0xff,
      (INSTRUCTION_BACKGROUND_HEX >> 8) & 0xff,
      INSTRUCTION_BACKGROUND_HEX & 0xff,
    ];
    let closest = { colorId: "", toneHex: 0, summed: Number.POSITIVE_INFINITY };
    for (const color of COLOR_DEFINITIONS) {
      const displayHex = Number.parseInt(color.displayHex.slice(1), 16);
      for (const toneHex of instructionFaceTones(displayHex)) {
        const summed =
          Math.abs(((toneHex >> 16) & 0xff) - page[0]!) +
          Math.abs(((toneHex >> 8) & 0xff) - page[1]!) +
          Math.abs((toneHex & 0xff) - page[2]!);
        if (summed < closest.summed) closest = { colorId: color.id, toneHex, summed };
      }
    }

    expect(
      closest.summed,
      `${closest.colorId} prints #${closest.toneHex.toString(16).padStart(6, "0")} against the page`,
    ).toBeGreaterThan(8);
  });

  it("switches to a silhouette key that is one flat pass of the display hex", () => {
    const scene = deriveBrickScene(document, { finish: "instruction" });
    const material = (objectsWithRole(scene.root, "body")[0] as Mesh).material as MeshBasicMaterial;
    const outline = objectsWithRole(scene.root, "instruction-outline")[0]!;

    setInstructionSilhouetteMode(scene.root, true);
    expect(material.vertexColors).toBe(false);
    expect(material.color.getHex()).toBe(
      Number.parseInt(getColorDefinition(RED_PART_COLOR_ID)!.displayHex.slice(1), 16),
    );
    expect(outline.visible).toBe(false);

    setInstructionSilhouetteMode(scene.root, false);
    expect(material.vertexColors).toBe(true);
    expect(outline.visible).toBe(true);
    scene.dispose();
  });

  it("refuses a silhouette switch on a scene that draws no instruction fills", () => {
    const scene = deriveBrickScene(document);

    expect(() => setInstructionSilhouetteMode(scene.root, true)).toThrowError(
      /Cannot set silhouette mode on a "flat" scene root/,
    );
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
