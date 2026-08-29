import { describe, expect, it } from "vitest";

import { PROPER_ORIENTATIONS } from "../packages/catalog/src/constants.ts";
import { prefix50ActionOccurrenceMap } from "./part-identification-prefix50-official-world-reconciliation-action.mjs";
import {
  assertPrefix50ReconciliationAuthorityState,
  prefix50WorldProjection,
  reconcilePrefix50WorldTransform,
  transformPrefix50Vector,
  transposePrefix50Matrix,
} from "./part-identification-prefix50-official-world-reconciliation-math.mjs";
import { PREFIX50_OFFICIAL_WORLD_RECONCILIATION_AUTHORITY } from "./part-identification-prefix50-official-world-reconciliation-source.mjs";

const catalog = { PROPER_ORIENTATIONS };

function orientation(id) {
  const row = PROPER_ORIENTATIONS.find((candidate) => candidate.id === id);
  expect(row).toBeDefined();
  return row;
}

describe("prefix-50 official-world reconciliation semantics", () => {
  it("derives direct and MultiBuild provenance from action phases without a static occurrence table", () => {
    const directMembers = Array.from({ length: 309 }, (_, index) => ({
      sourceBuilderIdentityOrdinal: index + 1,
      builderBrickRef: `direct-${index + 1}`,
    }));
    const copyMembers = Array.from({ length: 11 }, (_, index) => ({
      sourceBuilderIdentityOrdinal: 310 + index,
      builderBrickRef: `copy-${index + 1}`,
      sourceBuilderBrickRef: `direct-${index + 1}`,
    }));
    const action = {
      steps: [
        {
          stepNumber: 1,
          phases: [
            { kind: "direct", sequence: 1, members: directMembers },
            {
              kind: "multi-build-copy",
              sequence: 2,
              masterSubBuildRef: "master-subbuild",
              members: copyMembers,
            },
          ],
        },
      ],
    };

    const rows = prefix50ActionOccurrenceMap(action);
    expect(rows.size).toBe(320);
    expect(rows.get(1)).toMatchObject({
      actionKind: "direct",
      builderBrickRef: "direct-1",
      sourceBuilderBrickRef: null,
      masterSubBuildRef: null,
    });
    expect(rows.get(310)).toMatchObject({
      actionKind: "multi-build-copy",
      builderBrickRef: "copy-1",
      sourceBuilderBrickRef: "direct-1",
      masterSubBuildRef: "master-subbuild",
    });
    expect(() =>
      prefix50ActionOccurrenceMap({
        ...action,
        steps: [
          {
            ...action.steps[0],
            phases: [
              action.steps[0].phases[0],
              {
                ...action.steps[0].phases[1],
                members: [
                  { ...copyMembers[0], builderBrickRef: copyMembers[0].sourceBuilderBrickRef },
                  ...copyMembers.slice(1),
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow(/invalid direct\/MultiBuild provenance/);
  });

  it("rotates a nonzero frame translation and exactly round-trips through the inverse frame", () => {
    const sourceWorld = {
      orientationId: "upright-yaw-90",
      positionLdu: [100.5, 20, -30],
    };
    const frame = {
      orientationId: "upright-yaw-270",
      translationLdu: [7, -12, 3],
    };

    const reconciled = reconcilePrefix50WorldTransform(sourceWorld, frame, catalog);
    expect(reconciled).toEqual({
      orientationId: "upright-yaw-180",
      positionLdu: [107.5, 32, -27],
    });

    const frameMatrix = orientation(frame.orientationId).matrix;
    const inverseMatrix = transposePrefix50Matrix(frameMatrix);
    const inverseOrientation = PROPER_ORIENTATIONS.find(
      ({ matrix }) => matrix.join(",") === inverseMatrix.join(","),
    );
    expect(inverseOrientation).toBeDefined();
    const inverseTranslation = transformPrefix50Vector(inverseMatrix, frame.translationLdu).map(
      (coordinate) => -coordinate,
    );
    expect(
      reconcilePrefix50WorldTransform(
        reconciled,
        {
          orientationId: inverseOrientation.id,
          translationLdu: inverseTranslation,
        },
        catalog,
      ),
    ).toEqual(sourceWorld);
  });

  it("keeps quarantine rows null and grants neither identity nor legality authority", () => {
    const row = {
      sourceBuilderIdentityOrdinal: 7,
      status: "quarantined-unchanged",
      quarantineBasis: "exact-variant-unresolved",
      frameKey: null,
      catalogFrameEvidence: null,
      catalogIdentityProof: null,
      frameApplied: false,
      identityEquivalenceClaimed: false,
      sourceWorldProposal: {
        orientationId: "upright-yaw-0",
        positionLdu: [1, 2, 3],
      },
      catalogWorldTransform: null,
      documentLegalityClaimed: false,
    };

    expect(assertPrefix50ReconciliationAuthorityState(row)).toBe(row);
    expect(prefix50WorldProjection(row)).toEqual({
      sourceBuilderIdentityOrdinal: 7,
      status: "quarantined-unchanged",
      frameKey: null,
      frameApplied: false,
      identityEquivalenceClaimed: false,
      sourceWorldProposal: row.sourceWorldProposal,
      catalogIdentityProof: null,
      catalogWorldTransform: null,
      documentLegalityClaimed: false,
    });
    expect(PREFIX50_OFFICIAL_WORLD_RECONCILIATION_AUTHORITY).toMatchObject({
      documentLegality: false,
      placement: false,
      documentMutation: false,
      completion: false,
    });

    expect(() =>
      prefix50WorldProjection({
        ...row,
        frameApplied: true,
        frameKey: "hostile-alias",
        catalogFrameEvidence: {},
        catalogWorldTransform: row.sourceWorldProposal,
      }),
    ).toThrow(/every frame and world-transform field stays null and unapplied/);
    expect(() => prefix50WorldProjection({ ...row, documentLegalityClaimed: true })).toThrow(
      /may not claim identity equivalence or document legality/,
    );
  });
});
