import { getPartDefinition } from "@lego-studio/catalog";
import {
  createCollisionWorld,
  createEmptyBrickDocument,
  createPartInstance,
} from "@lego-studio/brick-kernel";
import type { ConnectionEdge } from "@lego-studio/protocol";
import { expect, it } from "vitest";

import { diagnosePlacementTransform, enumeratePlacements } from "./enumerate-placements";

it("reports the exact 41682 to 35480 pair roster", () => {
  const empty = createEmptyBrickDocument({ id: "step41-pair", name: "Step 41 pair" });
  const bracket = createPartInstance({
    id: "occurrence-267",
    catalogPartId: "builtin:bracket-2x2-1x2-vertical-studs",
    colorId: "builtin:black",
    transform: {
      positionLdu: [-120, -76, 90],
      orientationId: "proper-m-p0000n0p0",
    },
    submodelId: empty.submodels[0]!.id,
    stepId: empty.steps[0]!.id,
  });
  const document = {
    ...empty,
    parts: [bracket],
    submodels: [{ ...empty.submodels[0]!, partIds: [bracket.id] }],
    steps: [{ ...empty.steps[0]!, partIds: [bracket.id] }],
  };
  const officialTarget = {
    positionLdu: [-120, -86, 92] as const,
    orientationId: "proper-m-00nn000p0",
  };
  const enumeration = enumeratePlacements(document, "builtin:plate-1x2-round-end", {
    orientationIds: [officialTarget.orientationId],
    includeBuildPlate: false,
    allowDetached: false,
    maxDistinctTransforms: 200_000,
  });
  const sideways = ["proper-m-00n0n0n00", "proper-m-00p0n0p00"].map(
    (orientationId, orientationIndex) => {
      const candidate = createPartInstance({
        id: `sideways-${orientationIndex}`,
        catalogPartId: "builtin:plate-1x2-round-end",
        colorId: "builtin:medium-azure",
        transform: { positionLdu: [-120, -68, 86], orientationId },
      });
      const edges: ConnectionEdge[] = [0, 1].map((portIndex) => ({
        id: `${candidate.id}-seat-${portIndex}`,
        kind: "stud-tube",
        a: { partId: bracket.id, portId: `stud:${portIndex}` },
        b: {
          partId: candidate.id,
          portId: `undersideClutch:${orientationIndex === 0 ? 1 - portIndex : portIndex}`,
        },
        provenance: { source: "manual" },
      }));
      return {
        orientationId,
        unconnected: createCollisionWorld([bracket]).findCollisionsWith(candidate, []),
        connected: createCollisionWorld([bracket]).findCollisionsWith(candidate, edges),
      };
    },
  );
  console.log(
    JSON.stringify(
      {
        bracketConnectors: getPartDefinition(bracket.catalogPartId)!.connectors,
        plateConnectors: getPartDefinition("builtin:plate-1x2-round-end")!.connectors,
        officialDiagnosis: diagnosePlacementTransform(
          document,
          "builtin:plate-1x2-round-end",
          officialTarget,
        ),
        counts: enumeration.counts,
        sideways,
        candidates: enumeration.candidates.map(({ transform, connections }) => ({
          transform,
          connections,
        })),
      },
      null,
      2,
    ),
  );
  expect(enumeration.counts.accepted).toBe(6);
  expect(sideways.every(({ connected }) => connected.length === 0)).toBe(true);
});
