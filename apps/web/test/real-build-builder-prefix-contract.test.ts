import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { BUILTIN_CATALOG_VERSION, getPartDefinition } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";
import type { BuilderCanonicalCalibration } from "../e2e/real-build-builder-calibration";
import {
  applyBuilderCanonicalCalibration,
  parseOfficialModelIndex,
} from "../e2e/real-build-official";
import { assertDerivedLdrawToCatalogTransforms } from "../e2e/real-build-builder-ldraw-frame-contract";
import {
  BUILDER_STEP1_DESIGN_SOURCES,
  type BuilderDesignSourcePin,
} from "../e2e/real-build-builder-sources";
import { assertExactPrefixWorldCensus } from "./real-build-builder-prefix-world-contract";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const file = (path: string): Buffer => readFileSync(resolve(root, path));
const sha256 = (bytes: Uint8Array): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const INPUTS = {
  official: {
    path: "output/official-model/vx1087034_21066_a.xml",
    bytes: 1_903_169,
    digest: "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922",
  },
  geometry: {
    path: "output/real-build/builder-shell-geometry.bin",
    bytes: 1_814_364,
    digest: "sha256:d3636d02dca8a5bec1b1c759cd38cae705547cf0af9f57e6377325cb57d86d0f",
  },
  calibration: {
    path: "output/real-build/builder-canonical-calibration.json",
    bytes: 53_743,
    digest: "sha256:5946b95a61ddde56ff5627b8c054627a78e436f7404a48a8e485e00efc94c219",
  },
  coverage: {
    path: "output/real-build/catalog-coverage.json",
    bytes: 588_467,
    digest: "sha256:a12d5744f3f4417628e53227aaa4c35d9aee0eba5fdce7b865087e6f97dfbfad",
  },
  actionPreparation: {
    path: "output/real-build/action-preparation.json",
    bytes: 317_116,
    digest: "sha256:edd2096efe55e6e68385dc7f5b735222a9cdf01ae5625528dae2d1edde0fcbbc",
  },
} as const;

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
  "2453;I": [5, "identity-route-unconsumed"],
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

interface ActionMember {
  readonly sourceBuilderIdentityOrdinal: number;
  readonly builderBrickRef: string;
  readonly designRevision: string;
  readonly calloutIdentity: string;
}

interface ActionCallout {
  readonly identity: string;
  readonly catalogPartId: string;
  readonly preparedBuilderBrickRefs: readonly string[];
}

interface ActionPhase {
  readonly sequence: number;
  readonly members: readonly ActionMember[];
}

interface ActionStep {
  readonly stepNumber: number;
  readonly callouts: readonly ActionCallout[];
  readonly phases: readonly ActionPhase[];
}

interface ActionArtifact {
  readonly schemaVersion: string;
  readonly authority: Readonly<Record<string, boolean | string>>;
  readonly steps: readonly ActionStep[];
}

interface CoverageArtifact {
  readonly schemaVersion: string;
  readonly byCallout: Readonly<
    Record<
      string,
      {
        readonly resolution: {
          readonly catalogPartId: string;
          readonly partNum: string;
        };
        readonly semanticEvidence: {
          readonly officialDesignId: string;
          readonly publishedPartNum: string;
          readonly publishedMatchesOfficialDesignId: boolean;
        } | null;
      }
    >
  >;
}

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

const parseJson = <T>(bytes: Uint8Array): T => JSON.parse(bytes.toString()) as T;

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

function actionRows(artifact: ActionArtifact) {
  return artifact.steps.flatMap((step) =>
    step.phases.flatMap((phase) =>
      phase.members.map((member) => ({ ...member, stepNumber: step.stepNumber })),
    ),
  );
}

describe("first-50 Builder source and frame census contract", () => {
  it("derives the exact 42/192 local subset and the distinct 177-world-transform subset", () => {
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
    expect(sourceReport.sourceRows).toBe(42);
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
      42,
    );
    expect(
      [...revisionCounts].reduce(
        (total, [revision, count]) => total + (sourceByRevision.has(revision) ? count : 0),
        0,
      ),
    ).toBe(192);
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
              : revision === "2453;I"
                ? "identity-route-unconsumed"
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
    ).toBe(128);
    expect([...sourceByRevision.keys(), ...Object.keys(EXPECTED_EXCLUSION_CENSUS)].sort()).toEqual(
      [...revisionCounts.keys()].sort(),
    );

    const calibrated = applyBuilderCanonicalCalibration(
      official,
      inputBytes.calibration,
      sha256Digest(inputBytes.calibration),
      inputBytes.geometry,
      sha256Digest(inputBytes.geometry),
    );
    assertExactPrefixWorldCensus({
      rows,
      localRevisions: new Set(sourceByRevision.keys()),
      official,
      calibrated,
      calibration: parseJson<BuilderCanonicalCalibration>(inputBytes.calibration),
    });
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
