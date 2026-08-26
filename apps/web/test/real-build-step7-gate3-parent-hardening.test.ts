import { canonicalDigest, migrateDocumentTruth } from "@lego-studio/brick-kernel";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  isStep7Gate3PrivatePinResult,
  reconstructStep7Gate3Parents,
  reconstructStep7Gate3ParentsAgainstCallerPins,
  type Step7Gate3ParentMigrationPin,
  type Step7Gate3ParentOrigin,
  type Step7Gate3ParentReconstructionDependencies,
  type Step7Gate3ParentReconstructionResult,
} from "../e2e/real-build-step7-gate3-parent-reconstruction";
import { projectExactCurrentMigrationToFrozenV26 } from "../e2e/real-build-step7-gate3-parent-migration-contract";
import {
  STEP7_GATE3_CALLER_PIN_AUTHORITY,
  STEP7_GATE3_PRIVATE_PIN_AUTHORITY,
} from "../e2e/real-build-step7-gate3-parent-reconstruction-types";
import {
  gate3Origins,
  legacyThirteenDocument,
  mutateMaxParts,
  runGate3ParentReconstruction,
  SYNTHETIC_PARENT_MIGRATIONS,
  SYNTHETIC_PARENT_PIECES,
} from "./real-build-step7-gate3-parent-reconstruction.test-support";

const REAL_PARENT_MIGRATIONS = [
  {
    sourceDocumentHash: "sha256:a806c6e4db60f71f1193cf7f28aa99189f7666278b64bff6beb075d2646d27e4",
    currentDocumentHash: "sha256:349f031229e98f9869f218849b9a7a84dd337cd74edc534639fb5753530cf6f7",
  },
  {
    sourceDocumentHash: "sha256:e637dbcdbad7994ae642f3ab8e3d9c366864730b0d957e2ac75836e150edf1bf",
    currentDocumentHash: "sha256:aafbd400b179b22aa052b528338489e44ef3ba2d05dbe15d7e514648d64d1006",
  },
  {
    sourceDocumentHash: "sha256:d3c69d1704953033eeca63f5702d237cf8a066fc83d3a46e12d1eea23a2f5898",
    currentDocumentHash: "sha256:b67a24885463d1613f513112dbad1e9c080df09cb57177c7f4f9598098ab8046",
  },
  {
    sourceDocumentHash: "sha256:0ecf6da53de325a283cc64d5c317583d831c82ab707d64b8b21eb6765169f1c1",
    currentDocumentHash: "sha256:191b67add0491ab084e4216bef1cdf607f6d8b3eb1da25791c5a4b96ac1c624f",
  },
] as const satisfies readonly Step7Gate3ParentMigrationPin[];

function realIdOrigins(): Step7Gate3ParentOrigin[] {
  return REAL_PARENT_MIGRATIONS.map(({ sourceDocumentHash }, parentIndex) => ({
    candidateId: `step-006:${sourceDocumentHash}`,
    documentHash: sourceDocumentHash,
    pieces: structuredClone(SYNTHETIC_PARENT_PIECES[parentIndex]!),
  }));
}

describe("step-7 Gate-3 parent reconstruction hardening", () => {
  it.each(["result", "nested-report"] as const)(
    "refuses a transparent reentrant Proxy that remains in the migration %s",
    (attack) => {
      let proxyTraps = 0;
      let accepted: unknown;

      expect(() => {
        accepted = runGate3ParentReconstruction({
          ...(attack === "result"
            ? { proxyMigrationResultIndex: 0 }
            : { proxyMigrationReportIndex: 1 }),
          onTransparentProxyTrap: () => {
            proxyTraps += 1;
          },
        }).result;
      }).toThrow();
      expect(proxyTraps).toBeGreaterThan(0);
      expect(accepted).toBeUndefined();
    },
  );

  it("accepts only the detached plain equivalent when a nested Proxy removes itself", () => {
    let proxyTraps = 0;
    const { result, currentAuthorities, migrationReports } = runGate3ParentReconstruction({
      selfRemovingProxyMigrationReportIndex: 0,
      onTransparentProxyTrap: () => {
        proxyTraps += 1;
      },
    });
    const retainedMaxParts = result.parents[0]!.document.constraints.maxParts;

    expect(proxyTraps).toBeGreaterThan(0);
    expect(result.pinAuthority).toBe(STEP7_GATE3_CALLER_PIN_AUTHORITY);
    expect(result.parents[0]!.document).not.toBe(currentAuthorities[0]);
    expect(result.migrationReport).not.toBe(migrationReports[0]);
    mutateMaxParts(currentAuthorities[0]!);
    Object.assign(migrationReports[0]!, { migrated: false });
    expect(result.parents[0]!.document.constraints.maxParts).toBe(retainedMaxParts);
    expect(result.migrationReport.migrated).toBe(true);
    expect(Object.isFrozen(result.parents[0]!.document)).toBe(true);
    expect(Object.isFrozen(result.migrationReport)).toBe(true);
    expect(isStep7Gate3PrivatePinResult(result)).toBe(false);
  });

  it("uses captured operations after a callback poisons Array entries and map", () => {
    const { result } = runGate3ParentReconstruction({
      poisonArrayPrimordialsAtLastCallback: true,
    });

    expect(result.pinAuthority).toBe(STEP7_GATE3_CALLER_PIN_AUTHORITY);
    expect(result.parents.map(({ documentHash }) => documentHash)).toEqual(
      SYNTHETIC_PARENT_MIGRATIONS.map(({ currentDocumentHash }) => currentDocumentHash),
    );
    expect(result.parents).toHaveLength(4);
    expect(result.migrationReport.migrated).toBe(true);
  });

  it("keeps caller-pinned synthetic results distinct from private production-pin output", () => {
    const callerPinned = runGate3ParentReconstruction().result;
    expect(callerPinned.pinAuthority).toBe(STEP7_GATE3_CALLER_PIN_AUTHORITY);
    expectTypeOf(callerPinned).not.toMatchTypeOf<Step7Gate3ParentReconstructionResult>();
    expect(isStep7Gate3PrivatePinResult(callerPinned)).toBe(false);
    expect(
      isStep7Gate3PrivatePinResult({
        ...callerPinned,
        pinAuthority: STEP7_GATE3_PRIVATE_PIN_AUTHORITY,
      }),
    ).toBe(false);

    expect(() =>
      reconstructStep7Gate3Parents({
        baseDocument: legacyThirteenDocument(),
        origins: gate3Origins(),
      }),
    ).toThrowError(/four exact ordered retained origins/u);
    expect(STEP7_GATE3_PRIVATE_PIN_AUTHORITY).not.toBe(STEP7_GATE3_CALLER_PIN_AUTHORITY);
  });

  it("never grants private authority to forged callbacks using the four real origin ids", () => {
    let sourceHashIndex = 0;
    let currentHashIndex = 0;
    let forgedDependencyCalls = 0;
    const forgedDependencies: Step7Gate3ParentReconstructionDependencies = {
      truthDigest: (truth) => {
        forgedDependencyCalls += 1;
        return canonicalDigest(truth);
      },
      sourcePlace: (document) => {
        forgedDependencyCalls += 1;
        return { document, stepId: "forged-step" };
      },
      migrateDocumentTruth: (document) => {
        forgedDependencyCalls += 1;
        return projectExactCurrentMigrationToFrozenV26(document, migrateDocumentTruth(document));
      },
      documentStructuralHash: (document) => {
        forgedDependencyCalls += 1;
        if (document.truth.catalog.version === "builtin.basic-parts/13") {
          return REAL_PARENT_MIGRATIONS[sourceHashIndex++]!.sourceDocumentHash;
        }
        return REAL_PARENT_MIGRATIONS[currentHashIndex++]!.currentDocumentHash;
      },
    };
    const hostileInput = {
      baseDocument: legacyThirteenDocument(),
      origins: realIdOrigins(),
      dependencies: forgedDependencies,
    };
    const callerPinned = reconstructStep7Gate3ParentsAgainstCallerPins(
      hostileInput,
      REAL_PARENT_MIGRATIONS,
    );

    expect(callerPinned.parents).toHaveLength(4);
    expect(callerPinned.pinAuthority).toBe(STEP7_GATE3_CALLER_PIN_AUTHORITY);
    expect(isStep7Gate3PrivatePinResult(callerPinned)).toBe(false);
    expect(
      isStep7Gate3PrivatePinResult({
        ...callerPinned,
        pinAuthority: STEP7_GATE3_PRIVATE_PIN_AUTHORITY,
      }),
    ).toBe(false);
    const forgedCallsBeforePrivateWrapper = forgedDependencyCalls;
    expect(() => reconstructStep7Gate3Parents(hostileInput)).toThrowError(
      /reconstructed as .*required retained structural hash/u,
    );
    expect(forgedDependencyCalls).toBe(forgedCallsBeforePrivateWrapper);
  });
});
