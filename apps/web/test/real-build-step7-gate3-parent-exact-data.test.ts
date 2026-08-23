import { describe, expect, it } from "vitest";

import { exactPlainDataBytesWithTestLimits } from "../e2e/real-build-step7-gate3-exact-plain-data";

import {
  legacyThirteenDocument,
  runGate3ParentReconstruction,
  SYNTHETIC_PARENT_MIGRATIONS,
  SYNTHETIC_PARENT_PIECES,
  type MigrationMutation,
  type MigrationReportMutation,
} from "./real-build-step7-gate3-parent-reconstruction.test-support";

describe("step-7 Gate-3 exact plain-data migration closure", () => {
  it("rejects a worst-case oversized JSON string before allocating its encoding", () => {
    expect(() =>
      exactPlainDataBytesWithTestLimits("a".repeat(11), "Small-limit string attack", {
        maximumCanonicalCharacters: 64,
        maximumTransientJsonCharacters: 64,
        maximumCanonicalUtf8Bytes: 64,
      }),
    ).toThrowError(/worst-case JSON string allocation exceeds the 64-character transient bound/u);
  });

  it("counts aggregate multibyte UTF-8 bytes before TextEncoder may allocate", () => {
    let encodeCalls = 0;
    expect(() =>
      exactPlainDataBytesWithTestLimits(["€€€", "€€€"], "Small-limit UTF-8 attack", {
        maximumCanonicalCharacters: 128,
        maximumTransientJsonCharacters: 128,
        maximumCanonicalUtf8Bytes: 16,
        beforeTextEncoderEncode: () => {
          encodeCalls += 1;
        },
      }),
    ).toThrowError(/exceeds 16 UTF-8 bytes before TextEncoder allocation/u);
    expect(encodeCalls).toBe(0);

    expect(
      exactPlainDataBytesWithTestLimits("€€€", "Small-limit UTF-8 control", {
        maximumCanonicalCharacters: 128,
        maximumTransientJsonCharacters: 128,
        maximumCanonicalUtf8Bytes: 11,
        beforeTextEncoderEncode: () => {
          encodeCalls += 1;
        },
      }),
    ).toBe('"€€€"');
    expect(encodeCalls).toBe(1);
  });

  it.each<readonly [string, MigrationMutation]>([
    [
      "undefined own key",
      (document) => {
        Object.assign(document, { unreviewed: undefined });
        return document;
      },
    ],
    [
      "boxed primitive",
      (document) => {
        Object.assign(document, { name: new String(document.name) });
        return document;
      },
    ],
    [
      "custom prototype",
      (document) => {
        Object.setPrototypeOf(document, { unreviewedPrototype: true });
        return document;
      },
    ],
    [
      "symbol key",
      (document) => {
        Object.assign(document, { [Symbol("unreviewed")]: true });
        return document;
      },
    ],
    [
      "non-enumerable key",
      (document) => {
        Object.defineProperty(document, "unreviewed", { value: true });
        return document;
      },
    ],
  ])("rejects a migrated document with a %s", (_label, mutate) => {
    expect(() => runGate3ParentReconstruction({ mutateFirstMigration: mutate })).toThrowError(
      /must be exact finite plain data/u,
    );
  });

  it("rejects an accessor without invoking it", () => {
    let getterCalls = 0;
    expect(() =>
      runGate3ParentReconstruction({
        mutateFirstMigration: (document) => {
          Object.defineProperty(document, "name", {
            enumerable: true,
            configurable: true,
            get: () => {
              getterCalls += 1;
              return "Reviewed additive legacy operation";
            },
          });
          return document;
        },
      }),
    ).toThrowError(/accessors .* forbidden/u);
    expect(getterCalls).toBe(0);
  });

  it("rejects a non-array impostor without invoking its toJSON method", () => {
    let toJsonCalls = 0;
    const mutate: MigrationReportMutation = (report) => {
      Object.assign(report, {
        addedColorIds: {
          length: 0,
          toJSON: () => {
            toJsonCalls += 1;
            return [];
          },
        },
      });
      return report;
    };
    expect(() => runGate3ParentReconstruction({ mutateFirstMigrationReport: mutate })).toThrowError(
      /function values are forbidden/u,
    );
    expect(toJsonCalls).toBe(0);
  });

  it("rejects a same-JSON array with the wrong prototype", () => {
    expect(() =>
      runGate3ParentReconstruction({
        mutateFirstMigrationReport: (report) => {
          const partIds = report.addedCatalogPartIds as string[];
          Object.setPrototypeOf(partIds, Object.prototype);
          return report;
        },
      }),
    ).toThrowError(/arrays must use the intrinsic Array prototype/u);
  });

  it("rejects a shared empty-array alias that canonical JSON cannot distinguish", () => {
    expect(() =>
      runGate3ParentReconstruction({
        mutateFirstMigrationReport: (report) => {
          Object.assign(report, { addedColorIds: report.blockingReasons });
          return report;
        },
      }),
    ).toThrowError(/shared object aliases are forbidden/u);
  });

  it("rejects sparse arrays and non-finite numbers before dependency callbacks", () => {
    const sparse = legacyThirteenDocument();
    Object.assign(sparse, { parts: new Array(1) });
    expect(() => runGate3ParentReconstruction({ baseDocument: sparse })).toThrowError(
      /sparse arrays .* forbidden/u,
    );

    const nonFinite = legacyThirteenDocument();
    Object.assign(nonFinite.constraints, { maxParts: Number.NaN });
    expect(() => runGate3ParentReconstruction({ baseDocument: nonFinite })).toThrowError(
      /non-finite numbers are forbidden/u,
    );
  });

  it.each(["first-callback", "last-callback"] as const)(
    "deep-detaches and freezes origins before caller mutation at the %s",
    (mutateCallerOriginsAt) => {
      const { result, callerOrigins } = runGate3ParentReconstruction({
        mutateCallerOriginsAt,
        attemptWitnessMutation: true,
      });
      const origin = result.parents[0]!.origin;
      expect(callerOrigins[0]!.candidateId).toBe("caller-mutated");
      expect(origin.candidateId).toBe(
        `step-006:${SYNTHETIC_PARENT_MIGRATIONS[0]!.sourceDocumentHash}`,
      );
      expect(origin.pieces[0]!.transform.positionLdu).toEqual(
        SYNTHETIC_PARENT_PIECES[0]![0]!.transform.positionLdu,
      );
      const frozenOriginValues: unknown[] = [
        origin,
        origin.pieces,
        origin.pieces[0],
        origin.pieces[0]!.transform,
        origin.pieces[0]!.transform.positionLdu,
      ];
      expect(frozenOriginValues.every((value) => Object.isFrozen(value))).toBe(true);
    },
  );

  it("rejects a base document containing hidden data before reconstruction", () => {
    const base = legacyThirteenDocument();
    Object.defineProperty(base, "hidden", { value: true });
    expect(() => runGate3ParentReconstruction({ baseDocument: base })).toThrowError(
      /non-enumerable keys are forbidden/u,
    );
  });
});
