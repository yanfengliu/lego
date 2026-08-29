import { describe, expect, it } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";
import {
  applyBuilderCanonicalCalibrationForProperWorldDiagnostic,
  type BuilderCanonicalCalibration,
} from "../e2e/real-build-builder-calibration";
import {
  BUILDER_PREFIX50_ACTION_SOURCE_ROWS_COMMITMENT,
  createBuilderProperWorldDiagnostic,
} from "../e2e/real-build-builder-proper-world-diagnostic";
import { BUILDER_STEP1_DESIGN_SOURCES } from "../e2e/real-build-builder-sources";
import {
  applyBuilderCanonicalCalibration,
  parseOfficialModelIndex,
} from "../e2e/real-build-official";
import {
  hasBuilder2453IdentityEvidence,
  mintBuilder2453IdentityToken,
} from "./real-build-builder-2453-token-fixture";
import {
  PREFIX_INPUTS,
  actionRows,
  parseJson,
  readRepositoryFile,
  sha256,
  type ActionArtifact,
} from "./real-build-builder-prefix-fixture";
import { assertExactPrefixWorldCensus } from "./real-build-builder-prefix-world-contract";
import { consumeBuilder2453DiagnosticRegistryRoute } from "../../../scripts/part-identification-2453-builder-registry-route.mjs";

function currentInput() {
  const inputBytes = Object.fromEntries(
    (["official", "geometry", "calibration", "actionPreparation"] as const).map((name) => {
      const pin = PREFIX_INPUTS[name];
      const bytes = readRepositoryFile(pin.path);
      expect([bytes.length, sha256(bytes)], name).toEqual([pin.bytes, pin.digest]);
      return [name, bytes];
    }),
  ) as Record<"official" | "geometry" | "calibration" | "actionPreparation", Buffer>;
  const official = parseOfficialModelIndex(inputBytes.official);
  const calibrated = applyBuilderCanonicalCalibration(
    official,
    inputBytes.calibration,
    sha256Digest(inputBytes.calibration),
    inputBytes.geometry,
    sha256Digest(inputBytes.geometry),
  );
  const calibration = parseJson<BuilderCanonicalCalibration>(inputBytes.calibration);
  const rows = actionRows(parseJson<ActionArtifact>(inputBytes.actionPreparation));
  return {
    rows,
    official,
    calibrated,
    calibration,
    officialXmlBytes: inputBytes.official,
    calibrationBytes: inputBytes.calibration,
    builderGeometryBundleBytes: inputBytes.geometry,
  };
}

async function currentGatedInput(builder2453IdentityToken: object) {
  const input = currentInput();
  const diagnostic2453RouteAccess =
    await consumeBuilder2453DiagnosticRegistryRoute(builder2453IdentityToken);
  return {
    ...input,
    calibrated: applyBuilderCanonicalCalibrationForProperWorldDiagnostic(
      input.official,
      input.calibrationBytes,
      sha256Digest(input.calibrationBytes),
      input.builderGeometryBundleBytes,
      sha256Digest(input.builderGeometryBundleBytes),
      diagnostic2453RouteAccess,
    ),
  };
}

describe("first-50 Builder proper-world diagnostic contract", () => {
  it("fails before the census when the opaque 2453 evidence token is absent or caller-shaped", async () => {
    const input = currentInput();
    const genericPrefix = input.rows.map(
      ({ builderBrickRef }) => input.calibrated.bricks[builderBrickRef]!,
    );
    const genericRevisions = new Set<string>(
      BUILDER_STEP1_DESIGN_SOURCES.filter((source) => !("opaqueIdentityRoute" in source)).map(
        ({ designRevision }) => designRevision,
      ),
    );
    expect(genericRevisions).toHaveLength(42);
    expect(
      input.rows.filter(({ designRevision }) => genericRevisions.has(designRevision)),
    ).toHaveLength(192);
    expect(
      genericPrefix.filter(({ canonicalTransform }) => canonicalTransform !== null),
    ).toHaveLength(177);
    const generic2453 = input.rows
      .filter(({ designRevision }) => designRevision === "2453;I")
      .map(({ builderBrickRef }) => input.calibrated.bricks[builderBrickRef]!);
    expect(generic2453).toHaveLength(5);
    expect(
      generic2453.every(
        ({ calibratedCatalogPartId, canonicalTransform }) =>
          calibratedCatalogPartId === null && canonicalTransform === null,
      ),
    ).toBe(true);
    for (const builder2453IdentityToken of [
      undefined,
      {},
      { routeId: "builder-2453-I-6595205-to-2453b/1" },
      { designRevision: "2453;I", itemNo: "4210690" },
      { designRevision: "2453b;I", itemNo: "6595205" },
      { designRevision: "2453;I", itemNo: "6595205", suffix: "2453b" },
    ]) {
      await expect(
        createBuilderProperWorldDiagnostic({ ...input, builder2453IdentityToken }),
      ).rejects.toThrow(/opaque token from exact evidence compilation/u);
    }
  });

  it.skipIf(!hasBuilder2453IdentityEvidence)(
    "retains the exact 43/197 census only through a freshly minted and consumed 2453 token",
    async () => {
      const builder2453IdentityToken = await mintBuilder2453IdentityToken();
      const input = await currentGatedInput(builder2453IdentityToken);
      const localRevisions = new Set(
        BUILDER_STEP1_DESIGN_SOURCES.map(({ designRevision }) => designRevision),
      );
      const properWorldDiagnostic = await assertExactPrefixWorldCensus({
        ...input,
        localRevisions,
        builder2453IdentityToken,
      });
      const properWorldDiagnosticBytes = Buffer.from(JSON.stringify(properWorldDiagnostic));

      expect(properWorldDiagnostic.sourceRowsCommitment).toBe(
        BUILDER_PREFIX50_ACTION_SOURCE_ROWS_COMMITMENT,
      );
      expect([properWorldDiagnosticBytes.length, sha256(properWorldDiagnosticBytes)]).toEqual([
        78_884,
        "sha256:6a26f70df0aa6faac4361a195bd2d95931f8f46acd2e56ecc7c7f052ea0aa940",
      ]);
      for (const hostileToken of [
        structuredClone(builder2453IdentityToken),
        JSON.parse(JSON.stringify(builder2453IdentityToken)) as unknown,
      ]) {
        await expect(
          createBuilderProperWorldDiagnostic({
            ...input,
            builder2453IdentityToken: hostileToken,
          }),
        ).rejects.toThrow(/opaque token from exact evidence compilation/u);
      }

      const firstRosterRow = input.rows.find(
        ({ sourceBuilderIdentityOrdinal }) => sourceBuilderIdentityOrdinal === 1,
      );
      const thirdRosterRow = input.rows.find(
        ({ sourceBuilderIdentityOrdinal }) => sourceBuilderIdentityOrdinal === 3,
      );
      if (firstRosterRow === undefined || thirdRosterRow === undefined) {
        throw new TypeError("Hostile roster-relabel control rows 1 and 3 are absent.");
      }
      const relabeledRows = input.rows.map((row) => {
        if (row.sourceBuilderIdentityOrdinal === firstRosterRow.sourceBuilderIdentityOrdinal) {
          return {
            ...row,
            stepNumber: thirdRosterRow.stepNumber,
            builderBrickRef: thirdRosterRow.builderBrickRef,
            designRevision: thirdRosterRow.designRevision,
          };
        }
        if (row.sourceBuilderIdentityOrdinal === thirdRosterRow.sourceBuilderIdentityOrdinal) {
          return {
            ...row,
            stepNumber: firstRosterRow.stepNumber,
            builderBrickRef: firstRosterRow.builderBrickRef,
            designRevision: firstRosterRow.designRevision,
          };
        }
        return row;
      });
      await expect(
        createBuilderProperWorldDiagnostic({
          ...input,
          rows: relabeledRows,
          builder2453IdentityToken,
        }),
      ).rejects.toThrow(/exact current 320-row action\/source roster commitment/u);

      const callerFieldInjectedDiagnostic = await createBuilderProperWorldDiagnostic({
        ...input,
        rows: input.rows.map((row) =>
          row.sourceBuilderIdentityOrdinal === 1
            ? { ...row, placementAuthority: true, authority: { placement: true } }
            : row,
        ),
        builder2453IdentityToken,
      });
      expect(callerFieldInjectedDiagnostic.rows[0]).not.toHaveProperty("placementAuthority");
      expect(callerFieldInjectedDiagnostic.rows[0]).not.toHaveProperty("authority");
      expect(Buffer.from(JSON.stringify(callerFieldInjectedDiagnostic))).toEqual(
        properWorldDiagnosticBytes,
      );

      const uniformlyShifted = {
        ...input.calibrated,
        bricks: Object.fromEntries(
          Object.entries(input.calibrated.bricks).map(([brickRef, brick]) => [
            brickRef,
            brick.canonicalTransform === null
              ? brick
              : {
                  ...brick,
                  canonicalTransform: {
                    ...brick.canonicalTransform,
                    positionLdu: [
                      brick.canonicalTransform.positionLdu[0] + 20,
                      brick.canonicalTransform.positionLdu[1],
                      brick.canonicalTransform.positionLdu[2],
                    ] as const,
                  },
                },
          ]),
        ),
      } satisfies typeof input.calibrated;
      await expect(
        createBuilderProperWorldDiagnostic({
          ...input,
          calibrated: uniformlyShifted,
          builder2453IdentityToken,
        }),
      ).rejects.toThrow(/independently derived digest-bound calibration output/u);

      const shiftedBrickRef = "21288f64-b9d5-4efb-92b9-427a17832a45";
      const sourceBrick = input.official.bricks[shiftedBrickRef]!;
      const calibratedBrick = input.calibrated.bricks[shiftedBrickRef]!;
      if (sourceBrick.builderTransform === null || calibratedBrick.canonicalTransform === null) {
        throw new TypeError(`Joint-shift control Brick ${shiftedBrickRef} is not calibrated.`);
      }
      const jointlyShiftedOfficial = {
        ...input.official,
        bricks: {
          ...input.official.bricks,
          [shiftedBrickRef]: {
            ...sourceBrick,
            builderTransform: {
              ...sourceBrick.builderTransform,
              position: [
                sourceBrick.builderTransform.position[0] + 0.8,
                sourceBrick.builderTransform.position[1],
                sourceBrick.builderTransform.position[2],
              ] as const,
            },
          },
        },
      } satisfies typeof input.official;
      const jointlyShiftedCalibrated = {
        ...input.calibrated,
        bricks: {
          ...input.calibrated.bricks,
          [shiftedBrickRef]: {
            ...calibratedBrick,
            canonicalTransform: {
              ...calibratedBrick.canonicalTransform,
              positionLdu: [
                calibratedBrick.canonicalTransform.positionLdu[0] + 20,
                calibratedBrick.canonicalTransform.positionLdu[1],
                calibratedBrick.canonicalTransform.positionLdu[2],
              ] as const,
            },
          },
        },
      } satisfies typeof input.calibrated;
      await expect(
        createBuilderProperWorldDiagnostic({
          ...input,
          official: jointlyShiftedOfficial,
          calibrated: jointlyShiftedCalibrated,
          builder2453IdentityToken,
        }),
      ).rejects.toThrow(/independently reparsed official XML/u);
    },
    120_000,
  );
});
