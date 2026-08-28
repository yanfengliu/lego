import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { BUILTIN_CATALOG_VERSION, getPartDefinition } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import { BUILDER_PREFIX50_ACTION_SOURCE_ROWS_COMMITMENT } from "../e2e/real-build-builder-proper-world-diagnostic";
import { parseOfficialModelIndex } from "../e2e/real-build-official";
import { assertDerivedLdrawToCatalogTransforms } from "../e2e/real-build-builder-ldraw-frame-contract";
import {
  BUILDER_STEP1_DESIGN_SOURCES,
  type BuilderDesignSourcePin,
} from "../e2e/real-build-builder-sources";
import {
  PREFIX_INPUTS as INPUTS,
  actionRows,
  parseJson,
  readRepositoryFile as file,
  repositoryRoot as root,
  sha256,
  type ActionArtifact,
  type CoverageArtifact,
} from "./real-build-builder-prefix-fixture";

const EXPECTED_EXCLUSION_CENSUS = {
  "3003;S": [1, "checksum-mismatch"],
  "3069;Q": [33, "checksum-mismatch"],
  "3245;M": [7, "checksum-mismatch"],
  "3622;J": [5, "checksum-mismatch"],
  "30357;H": [1, "checksum-mismatch"],
  "41682;H": [4, "checksum-mismatch"],
  "41769;G": [1, "checksum-mismatch"],
  "41770;H": [1, "checksum-mismatch"],
  "99563;G": [4, "checksum-mismatch"],
  "10201;H": [2, "identity-contradiction"],
  "15573;L": [33, "recognized-anchor-cardinality-mismatch"],
  "3024;N": [2, "recognized-anchor-route-absent"],
  "11253;G": [4, null],
  "15254;J": [5, null],
  "2877;E": [2, null],
  "32064;I": [1, null],
  "35464;C": [1, null],
  "35787;N": [2, "authored-lattice-surface-contradiction"],
  "4519;E": [3, null],
  "49307;C": [4, null],
  "5092;N": [4, null],
  "73230;D": [2, null],
  "93273;M": [1, null],
} as const;

interface PrefixSourceReport {
  readonly schemaVersion: string;
  readonly sourceRows: number;
  readonly authority: Readonly<Record<string, boolean | string>>;
  readonly rows: readonly { readonly designRevision: string }[];
  readonly checksumMismatches: readonly {
    readonly designRevision: string;
    readonly manifestMd5: string;
    readonly actualMd5: string;
  }[];
  readonly verifiedIdentities: readonly {
    readonly designRevision: string;
    readonly nativeConnectivityBound: boolean;
    readonly declaredDesignIds: readonly string[];
    readonly eligibleTopAnchorCount: number | null;
    readonly eligibleUndersideAnchorCount: number | null;
    readonly authoredTopFieldCount: number | null;
    readonly authoredUndersideFieldCount: number | null;
  }[];
}

function runPythonSourceContract(sources: readonly BuilderDesignSourcePin[]) {
  return spawnSync(
    "python",
    ["-B", resolve(root, "scripts/builder_calibration_prefix_contract.py")],
    {
      cwd: root,
      input: JSON.stringify({ sources }),
      encoding: "utf8",
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 4 * 1_024 * 1_024,
    },
  );
}

function officialPrefixRefs(official: ReturnType<typeof parseOfficialModelIndex>): string[] {
  return official.builderOrder.phases
    .slice(0, 95)
    .flatMap((phase) =>
      phase.kind === "direct"
        ? phase.brickRefs
        : phase.copies.map(({ actualBrickRef }) => actualBrickRef),
    );
}

describe("first-50 Builder source and frame census contract", () => {
  it("derives the exact 43/197 local subset and the distinct 182-world-transform subset", () => {
    const inputBytes = Object.fromEntries(
      Object.entries(INPUTS).map(([name, pin]) => {
        const bytes = file(pin.path);
        expect([bytes.length, sha256(bytes)], name).toEqual([pin.bytes, pin.digest]);
        return [name, bytes];
      }),
    ) as Record<keyof typeof INPUTS, Buffer>;
    expect(BUILTIN_CATALOG_VERSION).toBe("builtin.basic-parts/28");

    const python = runPythonSourceContract(BUILDER_STEP1_DESIGN_SOURCES);
    expect(python.status, python.stderr).toBe(0);
    const sourceReport = parseJson<PrefixSourceReport>(Buffer.from(python.stdout));
    expect(sourceReport.schemaVersion).toBe("lego.builder-prefix-source-contract/1");
    expect(sourceReport.sourceRows).toBe(43);
    expect(sourceReport.rows.map(({ designRevision }) => designRevision)).toEqual(
      BUILDER_STEP1_DESIGN_SOURCES.map(({ designRevision }) => designRevision),
    );
    expect(sourceReport.authority).toMatchObject({
      physicalFrame: false,
      placement: false,
      sourceExecution: false,
      preparedRun: false,
      completion: false,
    });
    assertDerivedLdrawToCatalogTransforms(BUILDER_STEP1_DESIGN_SOURCES, inputBytes.geometry);

    const official = parseOfficialModelIndex(inputBytes.official);
    const prefixRefs = officialPrefixRefs(official);
    expect(official.builderOrder.phases.slice(0, 95)).toHaveLength(95);
    expect(prefixRefs).toHaveLength(320);
    const action = parseJson<ActionArtifact>(inputBytes.actionPreparation);
    const coverage = parseJson<CoverageArtifact>(inputBytes.coverage);
    expect(action.schemaVersion).toBe("lego.real-build-action-preparation/1");
    expect(coverage.schemaVersion).toBe("lego.real-build-catalog-coverage/4");
    const rows = actionRows(action);
    expect(action.steps.map(({ stepNumber }) => stepNumber)).toEqual(
      Array.from({ length: 50 }, (_, index) => index + 1),
    );
    const officialRows = [...rows].sort(
      (left, right) => left.sourceBuilderIdentityOrdinal - right.sourceBuilderIdentityOrdinal,
    );
    expect(
      officialRows.map(({ sourceBuilderIdentityOrdinal }) => sourceBuilderIdentityOrdinal),
    ).toEqual(Array.from({ length: 320 }, (_, index) => index + 1));
    expect(officialRows.map(({ builderBrickRef }) => builderBrickRef)).toEqual(prefixRefs);
    const committedSourceRowsBytes = Buffer.from(
      JSON.stringify(
        officialRows.map(
          ({ stepNumber, sourceBuilderIdentityOrdinal, builderBrickRef, designRevision }) => ({
            stepNumber,
            sourceBuilderIdentityOrdinal,
            builderBrickRef,
            designRevision,
          }),
        ),
      ),
    );
    expect([committedSourceRowsBytes.length, sha256(committedSourceRowsBytes)]).toEqual([
      43_528,
      BUILDER_PREFIX50_ACTION_SOURCE_ROWS_COMMITMENT,
    ]);

    const semanticCatalogByBrick = new Map<string, string>();
    for (const step of action.steps) {
      for (const callout of step.callouts) {
        expect(coverage.byCallout[callout.identity]?.resolution.catalogPartId).toBe(
          callout.catalogPartId,
        );
        expect(getPartDefinition(callout.catalogPartId)).toBeDefined();
        for (const brickRef of callout.preparedBuilderBrickRefs) {
          expect(semanticCatalogByBrick.has(brickRef)).toBe(false);
          semanticCatalogByBrick.set(brickRef, callout.catalogPartId);
        }
      }
    }
    expect(semanticCatalogByBrick.size).toBe(320);

    const sourceByRevision = new Map<string, BuilderDesignSourcePin>(
      BUILDER_STEP1_DESIGN_SOURCES.map((source) => [source.designRevision, source]),
    );
    const revisionCounts = new Map<string, number>();
    for (const row of rows) {
      const brick = official.bricks[row.builderBrickRef]!;
      expect(brick.designRevision).toBe(row.designRevision);
      revisionCounts.set(row.designRevision, (revisionCounts.get(row.designRevision) ?? 0) + 1);
      const source = sourceByRevision.get(row.designRevision);
      if (source !== undefined) {
        expect(semanticCatalogByBrick.get(row.builderBrickRef)).toBe(source.catalogPartId);
      }
    }
    expect(revisionCounts.size).toBe(66);
    expect([...revisionCounts].filter(([revision]) => sourceByRevision.has(revision))).toHaveLength(
      43,
    );
    expect(
      [...revisionCounts].reduce(
        (total, [revision, count]) => total + (sourceByRevision.has(revision) ? count : 0),
        0,
      ),
    ).toBe(197);
    const checksumMismatches = new Set(
      sourceReport.checksumMismatches
        .map(({ designRevision }) => designRevision)
        .filter((designRevision) => revisionCounts.has(designRevision)),
    );
    expect([...checksumMismatches].sort()).toEqual(
      Object.entries(EXPECTED_EXCLUSION_CENSUS)
        .filter(([, [, evidenceClass]]) => evidenceClass === "checksum-mismatch")
        .map(([revision]) => revision)
        .sort(),
    );
    const identityByRevision = new Map(
      sourceReport.verifiedIdentities.map((identity) => [identity.designRevision, identity]),
    );
    const semanticCoverage = (designRevision: string) =>
      [
        ...new Set(
          rows
            .filter((row) => row.designRevision === designRevision)
            .map((row) => row.calloutIdentity),
        ),
      ].map((identity) => coverage.byCallout[identity]!);
    const semanticRows = (designRevision: string) =>
      semanticCoverage(designRevision).map(({ resolution, semanticEvidence }) => [
        resolution.catalogPartId,
        resolution.partNum,
        semanticEvidence?.officialDesignId,
        semanticEvidence?.publishedPartNum,
        semanticEvidence?.publishedMatchesOfficialDesignId,
      ]);
    expect(identityByRevision.get("10201;H")).toMatchObject({
      nativeConnectivityBound: true,
      declaredDesignIds: ["10201"],
    });
    expect(semanticRows("10201;H")).toEqual([
      ["builtin:bracket-1x2-1x4-rounded-bottom", "28802", "10201", "28802", false],
    ]);
    expect(identityByRevision.get("2453;I")).toMatchObject({
      nativeConnectivityBound: true,
      declaredDesignIds: ["2453"],
    });
    expect(semanticRows("2453;I")).toEqual([
      ["builtin:brick-1x1x5-solid-stud", "2453b", "2453", "2453b", false],
      ["builtin:brick-1x1x5-solid-stud", "2453b", "2453", "2453b", false],
    ]);
    expect(sourceByRevision.get("2453;I")).toMatchObject({
      catalogPartId: "builtin:brick-1x1x5-solid-stud",
      opaqueIdentityRoute: {
        routeId: "builder-2453-I-6595205-to-2453b/1",
        itemNo: "6595205",
        exactLdrawId: "2453b.dat",
        builderToCatalogLocalMatrix: [25, 0, 0, 0, -25, 0, 0, 0, -25],
        builderToCatalogLocalTranslationLdu: [0, 60, 0],
      },
      ldrawToCatalogLocalTransform: {
        positionLdu: [0, -60, 0],
        orientationId: "upright-yaw-0",
      },
    });
    expect(
      rows
        .filter(({ designRevision }) => designRevision === "2453;I")
        .map(({ builderBrickRef }) => official.bricks[builderBrickRef]!.itemNos),
    ).toEqual(Array.from({ length: 5 }, () => ["6595205"]));
    expect(identityByRevision.get("35787;N")).toMatchObject({
      nativeConnectivityBound: true,
      declaredDesignIds: ["35787"],
      eligibleTopAnchorCount: 0,
      eligibleUndersideAnchorCount: 1,
      authoredTopFieldCount: 0,
      authoredUndersideFieldCount: 1,
    });
    expect(identityByRevision.get("3024;N")).toMatchObject({
      nativeConnectivityBound: false,
      declaredDesignIds: ["30008", "3024", "63326"],
      eligibleTopAnchorCount: 0,
      eligibleUndersideAnchorCount: 0,
      authoredTopFieldCount: 1,
      authoredUndersideFieldCount: 1,
    });
    expect([
      ...new Set(semanticCoverage("3024;N").map(({ resolution }) => resolution.catalogPartId)),
    ]).toEqual(["builtin:plate-1x1"]);
    expect(identityByRevision.get("15573;L")).toMatchObject({
      nativeConnectivityBound: false,
      declaredDesignIds: ["15573"],
      eligibleTopAnchorCount: 0,
      eligibleUndersideAnchorCount: 3,
      authoredTopFieldCount: 1,
      authoredUndersideFieldCount: 3,
    });
    expect(
      getPartDefinition("builtin:jumper-plate-1x2")!.connectors.filter(
        ({ kind }) => kind === "undersideClutch",
      ),
    ).toHaveLength(2);
    expect([
      ...new Set(semanticCoverage("15573;L").map(({ resolution }) => resolution.catalogPartId)),
    ]).toEqual(["builtin:jumper-plate-1x2"]);
    expect(identityByRevision.get("87580;P")).toMatchObject({
      nativeConnectivityBound: false,
      declaredDesignIds: ["23893", "87580"],
      eligibleTopAnchorCount: 0,
      eligibleUndersideAnchorCount: 4,
      authoredTopFieldCount: 1,
      authoredUndersideFieldCount: 5,
    });
    expect(sourceByRevision.get("87580;P")).toMatchObject({
      catalogPartId: "builtin:jumper-plate-2x2",
      builderAnchorRole: "underside-field-to-catalog-clutch",
      builderAnchorCentersLdu: [
        [0, 0, 0],
        [0, 0, 20],
        [20, 0, 0],
        [20, 0, 20],
      ],
    });
    expect(
      getPartDefinition("builtin:jumper-plate-2x2")!.connectors.filter(
        ({ kind }) => kind === "undersideClutch",
      ),
    ).toHaveLength(4);
    const actualExclusions = Object.fromEntries(
      [...revisionCounts]
        .filter(([revision]) => !sourceByRevision.has(revision))
        .map(([revision, count]) => {
          const executedEvidenceClass = checksumMismatches.has(revision)
            ? "checksum-mismatch"
            : revision === "10201;H"
              ? "identity-contradiction"
              : revision === "35787;N"
                ? "authored-lattice-surface-contradiction"
                : revision === "3024;N"
                  ? "recognized-anchor-route-absent"
                  : revision === "15573;L"
                    ? "recognized-anchor-cardinality-mismatch"
                    : null;
          return [revision, [count, executedEvidenceClass]];
        }),
    );
    expect(actualExclusions).toEqual(EXPECTED_EXCLUSION_CENSUS);
    expect(
      Object.entries(actualExclusions)
        .filter(([, [, executedEvidenceClass]]) => executedEvidenceClass === null)
        .map(([revision]) => revision)
        .sort(),
    ).toEqual(
      Object.entries(EXPECTED_EXCLUSION_CENSUS)
        .filter(([, [, executedEvidenceClass]]) => executedEvidenceClass === null)
        .map(([revision]) => revision)
        .sort(),
    );
    expect(
      [...revisionCounts].reduce(
        (total, [revision, count]) => total + (sourceByRevision.has(revision) ? 0 : count),
        0,
      ),
    ).toBe(123);
    expect([...sourceByRevision.keys(), ...Object.keys(EXPECTED_EXCLUSION_CENSUS)].sort()).toEqual(
      [...revisionCounts.keys()].sort(),
    );

    expect(action.authority).toMatchObject({
      physicalFrame: false,
      placement: false,
      sourceExecution: false,
      preparedRun: false,
      completion: false,
    });
  });

  it("refuses anchor, manifest, and LDraw-to-catalog transform drift", () => {
    const geometry = file(INPUTS.geometry.path);
    const anchorDrift = (BUILDER_STEP1_DESIGN_SOURCES as readonly BuilderDesignSourcePin[]).map(
      (source, index) =>
        index !== 0
          ? source
          : {
              ...source,
              builderStudCentersLdu: source.builderStudCentersLdu?.map((point, pointIndex) =>
                pointIndex === 0 ? [point[0] + 1, point[1], point[2]] : point,
              ),
            },
    ) as unknown as readonly BuilderDesignSourcePin[];
    const anchor = runPythonSourceContract(anchorDrift);
    expect(anchor.status).not.toBe(0);
    expect(anchor.stderr).toMatch(/recomputes .* centers/u);

    const manifestDrift = BUILDER_STEP1_DESIGN_SOURCES.map((source, index) =>
      index === 0
        ? {
            ...source,
            sourceIdentity: { ...source.sourceIdentity, manifestMd5: `md5:${"0".repeat(32)}` },
          }
        : source,
    ) as readonly BuilderDesignSourcePin[];
    const manifest = runPythonSourceContract(manifestDrift);
    expect(manifest.status).not.toBe(0);
    expect(manifest.stderr).toMatch(/manifest\/cache\/audit identity join/u);

    const frameDrift = BUILDER_STEP1_DESIGN_SOURCES.map((source, index) =>
      index === 0
        ? {
            ...source,
            ldrawToCatalogLocalTransform: {
              ...source.ldrawToCatalogLocalTransform,
              orientationId: "upright-yaw-90",
            },
          }
        : source,
    );
    expect(() => assertDerivedLdrawToCatalogTransforms(frameDrift, geometry)).toThrow(
      /static LDraw-to-catalog pin .* does not equal independently derived/u,
    );
  });
});
