import { PART_DEFINITIONS, UPRIGHT_ORIENTATIONS, type LduVector3 } from "@lego-studio/catalog";
import type { PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { axisAlignedStudIntersectsVerticalPrism } from "./axis-stud-collision.ts";
import {
  COLLISION_AXES,
  studIntersectsBody,
  type AxisIndex,
  type WorldBody,
  type WorldStud,
} from "./collision-prism-geometry.ts";
import { makeWorldPrimitives } from "./collision-world-primitives.ts";

function generalPrismFrameResult(stud: WorldStud, body: WorldBody): boolean {
  const remap = (vector: LduVector3): LduVector3 => [
    vector[body.sectionAxisIndices[0]],
    vector[body.prismAxisIndex],
    vector[body.sectionAxisIndices[1]],
  ];
  const worldToPrism = [
    body.sectionAxisIndices[0],
    body.prismAxisIndex,
    body.sectionAxisIndices[1],
  ] as const;
  const studWorldAxisIndex = COLLISION_AXES.indexOf(stud.axis) as AxisIndex;
  const studPrismAxisIndex = worldToPrism.indexOf(studWorldAxisIndex) as AxisIndex;
  return axisAlignedStudIntersectsVerticalPrism(
    {
      ...stud,
      center: remap(stud.center),
      min: remap(stud.min),
      max: remap(stud.max),
      axis: COLLISION_AXES[studPrismAxisIndex],
    },
    {
      min: remap(body.min),
      max: remap(body.max),
      sectionXZ: body.section,
    },
  );
}

function translatedStud(stud: WorldStud, offset: LduVector3): WorldStud {
  const translate = (vector: LduVector3): LduVector3 => [
    vector[0] + offset[0],
    vector[1] + offset[1],
    vector[2] + offset[2],
  ];
  return {
    ...stud,
    center: translate(stud.center),
    min: translate(stud.min),
    max: translate(stud.max),
  };
}

function syntheticStud(body: WorldBody, axis: WorldStud["axis"], offset: LduVector3): WorldStud {
  const center: LduVector3 = [
    (body.min[0] + body.max[0]) / 2 + offset[0],
    (body.min[1] + body.max[1]) / 2 + offset[1],
    (body.min[2] + body.max[2]) / 2 + offset[2],
  ];
  const halfLength = 6;
  const radius = 3;
  const axisIndex = COLLISION_AXES.indexOf(axis);
  const half: LduVector3 = [0, 1, 2].map((index) =>
    index === axisIndex ? halfLength : radius,
  ) as unknown as LduVector3;
  return {
    kind: "stud",
    part: body.part,
    primitiveId: `synthetic-${axis}`,
    sourceIndex: body.sourceIndex,
    center,
    radiusLdu: radius,
    axis,
    min: [center[0] - half[0], center[1] - half[1], center[2] - half[2]],
    max: [center[0] + half[0], center[1] + half[1], center[2] + half[2]],
  };
}

describe("upright collision fast path", () => {
  it("matches the general prism-frame remap over every current body and stud in all four yaws", () => {
    const mismatches: string[] = [];
    let bodyCount = 0;
    let studCount = 0;
    const offsets: readonly LduVector3[] = [
      [0, 0, 0],
      [3, -2, 4],
      [-3, 2, -4],
      [200, 0, 0],
      [0, 200, 0],
      [0, 0, 200],
    ];

    for (const definition of PART_DEFINITIONS) {
      for (const orientation of UPRIGHT_ORIENTATIONS) {
        const part: PartInstance = {
          id: `${definition.id}-${orientation.id}`,
          catalogPartId: definition.id,
          colorId: "builtin:light-bluish-gray",
          transform: { positionLdu: [0, 0, 0], orientationId: orientation.id },
          submodelId: "root",
          stepId: "step-1",
          semanticTags: [],
          provenance: { source: "manual" },
        };
        const primitives = makeWorldPrimitives([part]);
        const bodies = primitives.filter(
          (primitive): primitive is WorldBody => primitive.kind === "body",
        );
        const studs = primitives.filter(
          (primitive): primitive is WorldStud => primitive.kind === "stud",
        );
        bodyCount += bodies.length;
        studCount += studs.length;

        for (const body of bodies) {
          if (
            body.prismAxisIndex !== 1 ||
            body.sectionAxisIndices[0] !== 0 ||
            body.sectionAxisIndices[1] !== 2
          ) {
            mismatches.push(`${part.id}/${body.primitiveId}: not an upright prism frame`);
            continue;
          }
          const probes = [
            ...studs.flatMap((stud) => offsets.map((offset) => translatedStud(stud, offset))),
            ...COLLISION_AXES.flatMap((axis) =>
              offsets.map((offset) => syntheticStud(body, axis, offset)),
            ),
          ];
          for (const probe of probes) {
            const fast = studIntersectsBody(probe, body);
            const general = generalPrismFrameResult(probe, body);
            if (fast !== general) {
              mismatches.push(
                `${part.id}/${body.primitiveId}/${probe.primitiveId}: ${fast} != ${general}`,
              );
            }
          }
        }
      }
    }

    expect(bodyCount).toBeGreaterThan(0);
    expect(studCount).toBeGreaterThan(0);
    expect(mismatches).toEqual([]);
  });
});
