import { beforeAll, describe, expect, it } from "vitest";

import { bytesFromVerifiedPrefix50ActionPreparation } from "./part-identification-prefix50-action-preparation.mjs";
import {
  bytesFromVerifiedPrefix50OfficialWorldReconciliation,
  verifyPrefix50OfficialWorldReconciliation,
} from "./part-identification-prefix50-official-world-reconciliation.mjs";
import { reproduceCurrentPrefix50OfficialWorldReconciliation } from "./part-identification-prefix50-official-world-reconciliation-current.mjs";
import { verifyCurrentPrefix50StructuralEvents } from "./part-identification-prefix50-structural-events-current.mjs";
import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";
import { realEvidencePresent } from "./part-identification-prefix50-verified-projection-test-support.mjs";
import { createRealBuildPrefix50VerifiedProjectionReader } from "./part-identification-prefix50-verified-projection.mjs";

const projectionModuleUrl = new URL(
  "../apps/web/e2e/real-build-prefix50-projection.ts",
  import.meta.url,
).href;

describe.runIf(realEvidencePresent)("current prefix-50 structural projection boundary", () => {
  let action;
  let reconciliation;
  let structural;
  let projection;
  let readProjection;

  beforeAll(async () => {
    const reproduced = await reproduceCurrentPrefix50OfficialWorldReconciliation();
    const verifiedReconciliation = await verifyPrefix50OfficialWorldReconciliation({
      ...reproduced.input,
      artifactBytes: reproduced.bytes,
    });
    action = {
      bytes: bytesFromVerifiedPrefix50ActionPreparation(reproduced.input.actionPreparation),
      verified: reproduced.input.actionPreparation,
    };
    reconciliation = {
      bytes: bytesFromVerifiedPrefix50OfficialWorldReconciliation(verifiedReconciliation),
      verified: verifiedReconciliation,
    };
    structural = await verifyCurrentPrefix50StructuralEvents();
    ({ readRealBuildPrefix50VerifiedProjection: readProjection } =
      await importRepositoryTypeScript(projectionModuleUrl));
    projection = readProjection(
      createRealBuildPrefix50VerifiedProjectionReader({
        actionPreparation: action,
        officialWorldReconciliation: reconciliation,
        structuralEvents: { bytes: structural.bytes, verified: structural.verified },
      }),
    );
  }, 240_000);

  it("carries every action phase/member/path and the one source-bound child return window", () => {
    expect(projection.schemaVersion).toBe("lego.real-build-prefix50-verified-projection/2");
    expect(projection.occurrences[257]).toMatchObject({
      ordinal: 258,
      printedStepNumber: 38,
      phaseSequence: 64,
      phaseMemberOrdinal: 1,
      subBuildPath: [
        "7004cf0d-d97f-4b0d-8572-970e23815c05",
        "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
      ],
    });
    expect(projection.occurrences[258]).toMatchObject({
      ordinal: 259,
      phaseSequence: 64,
      phaseMemberOrdinal: 2,
    });
    expect(
      projection.occurrences.every(
        ({ phaseSequence, phaseMemberOrdinal, subBuildPath }) =>
          Number.isSafeInteger(phaseSequence) &&
          Number.isSafeInteger(phaseMemberOrdinal) &&
          subBuildPath.length > 0,
      ),
    ).toBe(true);
    expect(projection.childSubBuildWindow).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-child-subbuild-window/1",
      childSubBuildUuid: "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
      entryPrintedStepNumber: 38,
      lastPhysicalPrintedStepNumber: 43,
      returnPrintedStepNumber: 44,
      firstOccurrenceOrdinal: 258,
      lastOccurrenceOrdinal: 280,
      precedingPhaseSequence: 71,
      followingPhaseSequence: 72,
      memberCommitment: {
        rows: 23,
        bytes: 2141,
        digest: "sha256:4944f0b5ef959fc73471c1dc9bcad76ed7b47aec0f74b76cf2d55a85f7cd725c",
      },
    });
    expect(projection.childSubBuildWindow.sourceBuilderIdentityOrdinals).toEqual(
      Array.from({ length: 23 }, (_, index) => index + 258),
    );
    expect(Object.isFrozen(projection.childSubBuildWindow)).toBe(true);
  });

  it("refuses mutated bytes and caller-shaped structural artifact fields", () => {
    const changedBytes = Buffer.from(structural.bytes);
    changedBytes[0] ^= 1;
    expect(() =>
      createRealBuildPrefix50VerifiedProjectionReader({
        actionPreparation: action,
        officialWorldReconciliation: reconciliation,
        structuralEvents: { bytes: changedBytes, verified: structural.verified },
      }),
    ).toThrow(/must exactly equal the fresh bytes/u);
    expect(() =>
      createRealBuildPrefix50VerifiedProjectionReader({
        actionPreparation: action,
        officialWorldReconciliation: reconciliation,
        structuralEvents: {
          bytes: structural.bytes,
          verified: JSON.parse(structural.bytes.toString("utf8")),
        },
      }),
    ).toThrow(/opaque independent-verifier result/u);
  });
});
