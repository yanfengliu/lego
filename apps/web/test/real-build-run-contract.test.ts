import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createRealBuildRunContract,
  encodeCurrentRealBuildRunContract,
  parseRealBuildRunContract,
  REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST,
  REAL_BUILD_INPUT_ROLE_BY_DIGEST,
  REAL_BUILD_PANEL_SOURCE_ROLE,
  realBuildRunBudgets,
  realBuildRunThresholds,
  verifyRealBuildRunContract,
} from "../e2e/real-build-run-contract";
import { encodeCanonicalRealBuildJson } from "../e2e/real-build-json-admission";
import { verifyLegacyRealBuildRunContractV2 } from "../e2e/real-build-run-contract-legacy-v2";
import { verifyLegacyRealBuildRunContractV3 } from "../e2e/real-build-run-contract-legacy-v3";
import { verifyLegacyRealBuildRunContractV4 } from "../e2e/real-build-run-contract-legacy-v4";
import {
  deriveLegacyMeasuredFartherOriginSourceAttestationV2,
  LEGACY_MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS_V2,
  LEGACY_MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION_V2,
} from "../e2e/real-build-farther-origin-source-attestation-legacy-v2";
import {
  REAL_BUILD_TEST_DIGEST,
  completeRealBuildTestOptions,
  realBuildTransitionPanel,
} from "./real-build-test-options";

const DIFFERENT_DIGEST = `sha256:${"b".repeat(64)}`;
const digest = (value: unknown): string =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const canonicalDigest = (value: unknown): string =>
  `sha256:${createHash("sha256").update(encodeCanonicalRealBuildJson(value)).digest("hex")}`;
const TEST_ROLE_DIGESTS = Object.fromEntries(
  [
    ...Object.values(REAL_BUILD_INPUT_ROLE_BY_DIGEST),
    REAL_BUILD_PANEL_SOURCE_ROLE,
    REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.features,
    REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.match,
    REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.distances,
    REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.elements,
    REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.pairJudged,
    REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.sourceArtRebound,
  ].map((role) => [role, REAL_BUILD_TEST_DIGEST]),
);
const LEGACY_TEST_ROLE_DIGESTS = Object.fromEntries(
  Object.entries(TEST_ROLE_DIGESTS).filter(
    ([role]) => role !== REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.sourceArtRebound,
  ),
);

const FROZEN_LEGACY_RUN_CONTRACT_V2 = {
  schemaVersion: "lego.real-build-run-contract/2",
  inputDigests: {
    pdf: REAL_BUILD_TEST_DIGEST,
    calloutManifest: REAL_BUILD_TEST_DIGEST,
    coverage: REAL_BUILD_TEST_DIGEST,
    officialModel: REAL_BUILD_TEST_DIGEST,
    actionLedger: REAL_BUILD_TEST_DIGEST,
    highlightCalibration: REAL_BUILD_TEST_DIGEST,
    builderCalibration: REAL_BUILD_TEST_DIGEST,
    builderGeometry: REAL_BUILD_TEST_DIGEST,
    transitionClassifications: REAL_BUILD_TEST_DIGEST,
  },
  identificationClosure: {
    source: "deterministic",
    features: REAL_BUILD_TEST_DIGEST,
    match: REAL_BUILD_TEST_DIGEST,
    distances: REAL_BUILD_TEST_DIGEST,
    elements: REAL_BUILD_TEST_DIGEST,
    cards: null,
    cardImages: null,
    answers: null,
    pairJudged: REAL_BUILD_TEST_DIGEST,
  },
  normalizedPanelsDigest: REAL_BUILD_TEST_DIGEST,
  actionLedger: [],
  actionLedgerDigest: DIFFERENT_DIGEST,
  budgets: {
    lastStep: 1,
    expectedPrintedSteps: 359,
    maxParts: 1_464,
    targetPartCount: 1_464,
    maxRendersPerPiece: 220,
    blindRenderBudget: 220,
    deferredCandidateBudget: 512,
    explodedGhostRenderBudget: 4_096,
    deferredNarrowingRenderBudget: 4_096,
    fartherPanelMaximumReachSteps: 2,
    fartherPanelRenderBudget: 16,
  },
  thresholds: {},
  policy: {
    searchDisagreement: "refuse",
    partialStep: "rollback",
    unboundIdentity: "refuse",
  },
  codeSnapshots: {},
  contractDigest: "sha256:7e637c389043400b959015c52b8b40859dde88f59ee5443335a1f9a48e0a1539",
} as const;

describe("real-build run contract", () => {
  it("binds prepared options to every raw role and exact source/action bytes", () => {
    const options = completeRealBuildTestOptions(1);
    const sourceFiles = [
      {
        path: "apps/web/e2e/real-build-finalize.ts",
        digest: REAL_BUILD_TEST_DIGEST,
        bytes: 1,
      },
      { path: "inputs/booklet.pdf", digest: REAL_BUILD_TEST_DIGEST, bytes: 1 },
    ];
    const contract = createRealBuildRunContract({
      inputDigests: options.inputDigests,
      identificationClosure: {
        source: "deterministic",
        features: REAL_BUILD_TEST_DIGEST,
        match: REAL_BUILD_TEST_DIGEST,
        distances: REAL_BUILD_TEST_DIGEST,
        elements: REAL_BUILD_TEST_DIGEST,
        cards: null,
        cardImages: null,
        answers: null,
        pairJudged: REAL_BUILD_TEST_DIGEST,
        sourceArtRebound: REAL_BUILD_TEST_DIGEST,
      },
      panelSourceDigest: REAL_BUILD_TEST_DIGEST,
      panels: options.panels,
      passivePanels: options.passivePanels,
      budgets: realBuildRunBudgets(options),
      thresholds: realBuildRunThresholds(options),
      codeSnapshots: Object.fromEntries(sourceFiles.map(({ path, digest }) => [path, digest])),
    });
    const roleDigests = TEST_ROLE_DIGESTS;
    const verify = (
      candidateOptions = options,
      candidateRoles = roleDigests,
      candidateSources = sourceFiles,
    ) =>
      verifyRealBuildRunContract({
        contract,
        options: candidateOptions,
        roleDigests: candidateRoles,
        sourceFiles: candidateSources,
      });

    expect(verify).not.toThrow();
    expect(contract.schemaVersion).toBe("lego.real-build-run-contract/5");
    expect(contract.budgets).toMatchObject({
      panelCameraBranchBudget: 8_192,
      fartherPanelMaximumReachSteps: 2,
      fartherPanelRenderBudget: 16,
    });
    expect(() => verify({ ...options, panelCameraBranchBudget: 8_200 })).toThrow(
      /do not exactly reproduce/u,
    );
    expect(() => verify({ ...options, fartherPanelRenderBudget: 15 })).toThrow(
      /do not exactly reproduce/u,
    );
    expect(() =>
      verify(
        {
          ...options,
          panels: options.panels.map((panel, index) =>
            index === 0
              ? {
                  ...panel,
                  action: { ...panel.action, evidenceDigest: DIFFERENT_DIGEST },
                }
              : panel,
          ),
        },
        roleDigests,
        sourceFiles,
      ),
    ).toThrow(/do not exactly reproduce/u);
    expect(() =>
      verify({
        ...options,
        panels: options.panels.map((panel, index) =>
          index === 0
            ? {
                ...panel,
                panelFace: panel.panelFace === "underside" ? "studs-up" : "underside",
              }
            : panel,
        ),
      }),
    ).toThrow(/do not exactly reproduce/u);
    const firstPassive = options.passivePanels[0]!;
    const secondPassive = options.passivePanels[1]!;
    const passiveMutations = [
      [{ ...firstPassive, pageNumber: firstPassive.pageNumber + 1 }, secondPassive],
      [
        {
          ...firstPassive,
          panelFace: firstPassive.panelFace === "underside" ? "studs-up" : "underside",
        },
        secondPassive,
      ],
      [{ ...firstPassive, minXPt: firstPassive.minXPt + 0.25 }, secondPassive],
      [
        {
          ...firstPassive,
          calloutBoxes: [
            ...firstPassive.calloutBoxes,
            { minXPt: 1, maxXPt: 2, minYPt: 3, maxYPt: 4 },
          ],
        },
        secondPassive,
      ],
      [firstPassive],
      [secondPassive, firstPassive],
    ] as const;
    for (const passivePanels of passiveMutations) {
      expect(() => verify({ ...options, passivePanels })).toThrow(/do not exactly reproduce/u);
    }
    expect(contract.normalizedPassivePanelsDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(() => verify(options, { ...roleDigests, pdf: DIFFERENT_DIGEST }, sourceFiles)).toThrow(
      /raw role pdf/u,
    );
    expect(() =>
      verify(
        options,
        {
          ...roleDigests,
          [REAL_BUILD_IDENTIFICATION_ROLE_BY_DIGEST.cards]: REAL_BUILD_TEST_DIGEST,
        },
        sourceFiles,
      ),
    ).toThrow(/Deterministic run contract must omit/u);
    expect(() =>
      verify(options, roleDigests, [
        { ...sourceFiles[0]!, digest: DIFFERENT_DIGEST },
        ...sourceFiles.slice(1),
      ]),
    ).toThrow(/do not exactly reproduce/u);
    expect(() => verify(options, roleDigests, sourceFiles.slice(0, 1))).toThrow(
      /inputs\/booklet\.pdf/u,
    );
    const packageSource = {
      path: "packages/demo/src/index.ts",
      digest: REAL_BUILD_TEST_DIGEST,
      bytes: 1,
    };
    expect(() => verify(options, roleDigests, [...sourceFiles, packageSource])).toThrow(
      /workspace\/alias counterpart/u,
    );

    const encoded = encodeCurrentRealBuildRunContract(contract);
    expect(parseRealBuildRunContract(encoded)).toEqual(contract);
    const encodedText = new TextDecoder().decode(encoded);
    for (const duplicate of [
      encodedText.replace('"actionLedger":', '"actionLedger":[],"actionLedger":'),
      encodedText.replace(
        '"schemaVersion":',
        '"schemaVersion":"lego.real-build-run-contract/2","schemaVersion":',
      ),
    ]) {
      expect(() => parseRealBuildRunContract(Buffer.from(duplicate))).toThrow(/duplicate-free/u);
    }
    expect(() =>
      parseRealBuildRunContract(Buffer.from(encodedText.replace('"lastStep":1', '"lastStep":1e0'))),
    ).toThrow(/exact canonical compact encoding/u);
    const tampered = encodeCanonicalRealBuildJson({
      ...contract,
      normalizedPanelsDigest: DIFFERENT_DIGEST,
    });
    expect(() => parseRealBuildRunContract(tampered)).toThrow(/content digest/u);
    const extraBudget = JSON.parse(JSON.stringify(contract)) as Record<string, unknown> & {
      budgets: Record<string, unknown>;
      contractDigest: string;
    };
    extraBudget.budgets.unboundedFartherRenders = 1;
    const extraBudgetBase: Record<string, unknown> = { ...extraBudget };
    delete extraBudgetBase.contractDigest;
    extraBudget.contractDigest = canonicalDigest(extraBudgetBase);
    expect(() => parseRealBuildRunContract(encodeCanonicalRealBuildJson(extraBudget))).toThrow(
      /malformed schema/u,
    );
    const oversizedFartherBudget = JSON.parse(JSON.stringify(contract)) as Record<
      string,
      unknown
    > & {
      budgets: Record<string, unknown>;
      contractDigest: string;
    };
    oversizedFartherBudget.budgets.fartherPanelRenderBudget = 17;
    const oversizedBudgetBase: Record<string, unknown> = { ...oversizedFartherBudget };
    delete oversizedBudgetBase.contractDigest;
    oversizedFartherBudget.contractDigest = canonicalDigest(oversizedBudgetBase);
    expect(() =>
      parseRealBuildRunContract(encodeCanonicalRealBuildJson(oversizedFartherBudget)),
    ).toThrow(/malformed schema/u);
  });

  it("parses frozen /2 bytes for inspection but refuses mixed current verification", () => {
    const parsed = parseRealBuildRunContract(
      new TextEncoder().encode(JSON.stringify(FROZEN_LEGACY_RUN_CONTRACT_V2)),
    );

    expect(parsed).toEqual(FROZEN_LEGACY_RUN_CONTRACT_V2);
    expect(parsed.schemaVersion).toBe("lego.real-build-run-contract/2");
    expect(parsed.budgets).not.toHaveProperty("panelCameraBranchBudget");
    for (const mismatchedGeneration of [
      "lego.real-build-run-contract/3",
      "lego.real-build-run-contract/4",
      "lego.real-build-run-contract/5",
    ]) {
      expect(() =>
        parseRealBuildRunContract(
          new TextEncoder().encode(
            JSON.stringify({
              ...FROZEN_LEGACY_RUN_CONTRACT_V2,
              schemaVersion: mismatchedGeneration,
            }),
          ),
        ),
      ).toThrow(/malformed schema|unsupported run-contract/u);
    }
    expect(() =>
      verifyRealBuildRunContract({
        contract: parsed,
        options: completeRealBuildTestOptions(1),
        roleDigests: {},
        sourceFiles: [],
      }),
    ).toThrow(/run-contract \/2, \/3, or \/4 bytes/u);
  });

  it("reproduces frozen generation-3 all-panel semantics for inspection only", () => {
    const options = completeRealBuildTestOptions(1);
    const sourceFiles = [{ path: "inputs/booklet.pdf", digest: REAL_BUILD_TEST_DIGEST, bytes: 1 }];
    const normalizedPanels = [
      {
        stepNumber: 1,
        pageNumber: 1,
        panelFace: "studs-up",
        bounds: [0, 1, 0, 1],
        calloutBoxes: [],
        mappedCalloutKeys: [],
        calloutPieces: 0,
        classifiedPhysicalCalloutPieces: 0,
        semanticMultiplierQuantity: 0,
        omittedPhysicalPieces: 0,
      },
    ];
    const actionLedger = [
      {
        stepNumber: 1,
        panelFace: "studs-up",
        action: {
          kind: "transition",
          assembledPieces: 0,
          transition: "rotation",
          panelEvidenceDigest: REAL_BUILD_TEST_DIGEST,
          classificationEvidenceDigest: DIFFERENT_DIGEST,
          evidenceDigest: REAL_BUILD_TEST_DIGEST,
        },
        directIdentities: [],
        omittedIdentities: [],
      },
    ];
    const base = {
      schemaVersion: "lego.real-build-run-contract/3" as const,
      inputDigests: options.inputDigests,
      identificationClosure: FROZEN_LEGACY_RUN_CONTRACT_V2.identificationClosure,
      normalizedPanelsDigest: digest(normalizedPanels),
      actionLedger,
      actionLedgerDigest: digest(actionLedger),
      budgets: realBuildRunBudgets(options),
      thresholds: realBuildRunThresholds(options),
      policy: FROZEN_LEGACY_RUN_CONTRACT_V2.policy,
      codeSnapshots: { "inputs/booklet.pdf": REAL_BUILD_TEST_DIGEST },
    };
    const frozenContract = { ...base, contractDigest: digest(base) };
    const parsed = parseRealBuildRunContract(
      new TextEncoder().encode(JSON.stringify(frozenContract)),
    );
    if (parsed.schemaVersion !== "lego.real-build-run-contract/3") throw new Error("unreachable");
    const inspect = (candidateOptions = options) =>
      verifyLegacyRealBuildRunContractV3({
        contract: parsed,
        options: candidateOptions,
        roleDigests: LEGACY_TEST_ROLE_DIGESTS,
        sourceFiles,
      });
    expect(inspect).not.toThrow();
    expect(() =>
      inspect({ ...options, panels: [...options.panels, realBuildTransitionPanel(2)] }),
    ).toThrow(/historical all-panel/u);
    expect(() =>
      inspect({
        ...options,
        panels: options.panels.map((panel) => ({ ...panel, panelFace: "underside" })),
      }),
    ).toThrow(/historical all-panel/u);
    expect(() =>
      verifyRealBuildRunContract({
        contract: parsed,
        options,
        roleDigests: LEGACY_TEST_ROLE_DIGESTS,
        sourceFiles,
      }),
    ).toThrow(/run-contract \/2, \/3, or \/4 bytes/u);
  });

  it("reproduces frozen generation-4 bounded-prefix semantics without rebound authority", () => {
    const options = completeRealBuildTestOptions(1);
    const sourceFiles = [{ path: "inputs/booklet.pdf", digest: REAL_BUILD_TEST_DIGEST, bytes: 1 }];
    const current = createRealBuildRunContract({
      inputDigests: options.inputDigests,
      identificationClosure: {
        source: "deterministic",
        features: REAL_BUILD_TEST_DIGEST,
        match: REAL_BUILD_TEST_DIGEST,
        distances: REAL_BUILD_TEST_DIGEST,
        elements: REAL_BUILD_TEST_DIGEST,
        cards: null,
        cardImages: null,
        answers: null,
        pairJudged: REAL_BUILD_TEST_DIGEST,
        sourceArtRebound: REAL_BUILD_TEST_DIGEST,
      },
      panelSourceDigest: REAL_BUILD_TEST_DIGEST,
      panels: options.panels,
      passivePanels: options.passivePanels,
      budgets: realBuildRunBudgets(options),
      thresholds: realBuildRunThresholds(options),
      codeSnapshots: { "inputs/booklet.pdf": REAL_BUILD_TEST_DIGEST },
    });
    const { sourceArtRebound: _futureRole, ...legacyIdentificationClosure } =
      current.identificationClosure;
    const { contractDigest: _currentDigest, ...currentBase } = current;
    expect(_futureRole).toBe(REAL_BUILD_TEST_DIGEST);
    expect(_currentDigest).toBe(current.contractDigest);
    const base = {
      ...currentBase,
      schemaVersion: "lego.real-build-run-contract/4" as const,
      identificationClosure: legacyIdentificationClosure,
    };
    const frozenContract = { ...base, contractDigest: canonicalDigest(base) };
    const parsed = parseRealBuildRunContract(encodeCanonicalRealBuildJson(frozenContract));
    if (parsed.schemaVersion !== "lego.real-build-run-contract/4") throw new Error("unreachable");

    expect(() =>
      verifyLegacyRealBuildRunContractV4({
        contract: parsed,
        options,
        roleDigests: LEGACY_TEST_ROLE_DIGESTS,
        sourceFiles,
      }),
    ).not.toThrow();
    expect(() =>
      verifyRealBuildRunContract({
        contract: parsed,
        options,
        roleDigests: LEGACY_TEST_ROLE_DIGESTS,
        sourceFiles,
      }),
    ).toThrow(/run-contract \/2, \/3, or \/4 bytes/u);
    expect(() =>
      verifyLegacyRealBuildRunContractV4({
        contract: parsed,
        options,
        roleDigests: TEST_ROLE_DIGESTS,
        sourceFiles,
      }),
    ).toThrow(/future retained raw role source-art-rebound/u);
  });

  it("reproduces exact generation-2 options without synthesizing the new camera budget", () => {
    const current = completeRealBuildTestOptions(1);
    const { panelCameraBranchBudget, ...legacyOptions } = {
      ...current,
      panels: [],
    };
    expect(panelCameraBranchBudget).toBe(8_192);
    const sourceFiles = [{ path: "inputs/booklet.pdf", digest: REAL_BUILD_TEST_DIGEST, bytes: 1 }];
    const budgets = Object.fromEntries(
      Object.entries(realBuildRunBudgets(current)).filter(
        ([key]) => key !== "panelCameraBranchBudget",
      ),
    );
    const base = {
      schemaVersion: "lego.real-build-run-contract/2" as const,
      inputDigests: legacyOptions.inputDigests,
      identificationClosure: FROZEN_LEGACY_RUN_CONTRACT_V2.identificationClosure,
      normalizedPanelsDigest: digest([]),
      actionLedger: [],
      actionLedgerDigest: digest([]),
      budgets,
      thresholds: realBuildRunThresholds(current),
      policy: FROZEN_LEGACY_RUN_CONTRACT_V2.policy,
      codeSnapshots: { "inputs/booklet.pdf": REAL_BUILD_TEST_DIGEST },
    };
    const contract = { ...base, contractDigest: digest(base) };
    const roleDigests = LEGACY_TEST_ROLE_DIGESTS;

    expect(() =>
      verifyLegacyRealBuildRunContractV2({
        contract,
        options: legacyOptions,
        roleDigests,
        sourceFiles,
      }),
    ).not.toThrow();
    expect(() =>
      verifyLegacyRealBuildRunContractV2({
        contract,
        options: current,
        roleDigests,
        sourceFiles,
      }),
    ).toThrow(/without panelCameraBranchBudget/u);
  });

  it("keeps generation-2 source-attestation derivation frozen as current anchors expand", () => {
    const snapshots = Object.fromEntries(
      LEGACY_MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS_V2.map((path) => [
        path,
        REAL_BUILD_TEST_DIGEST,
      ]),
    );
    const first = deriveLegacyMeasuredFartherOriginSourceAttestationV2(snapshots);
    const changed = deriveLegacyMeasuredFartherOriginSourceAttestationV2({
      ...snapshots,
      [LEGACY_MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS_V2[0]!]: DIFFERENT_DIGEST,
    });

    expect(first).toMatchObject({
      schemaVersion: "lego.real-build-source-attestation/1",
      fileCount: LEGACY_MEASURED_FARTHER_ORIGIN_REQUIRED_SOURCE_PATHS_V2.length,
    });
    expect(changed.digest).not.toBe(first.digest);
    expect(LEGACY_MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION_V2).toEqual({
      schemaVersion: "lego.real-build-source-attestation/1",
      fileCount: 3_064,
      digest: "sha256:17bda111319a9054b0613050850e83c4737ff720d725b16cdaa3b931b8cf87b5",
    });
    expect(snapshots).not.toHaveProperty("apps/web/e2e/real-build-panel-camera-registration.ts");
  });

  it("requires one exact bounded panel-camera branch budget in /5", () => {
    const options = completeRealBuildTestOptions(1);
    const current = createRealBuildRunContract({
      inputDigests: options.inputDigests,
      identificationClosure: {
        source: "deterministic",
        features: REAL_BUILD_TEST_DIGEST,
        match: REAL_BUILD_TEST_DIGEST,
        distances: REAL_BUILD_TEST_DIGEST,
        elements: REAL_BUILD_TEST_DIGEST,
        cards: null,
        cardImages: null,
        answers: null,
        pairJudged: REAL_BUILD_TEST_DIGEST,
        sourceArtRebound: REAL_BUILD_TEST_DIGEST,
      },
      panelSourceDigest: REAL_BUILD_TEST_DIGEST,
      panels: options.panels,
      passivePanels: options.passivePanels,
      budgets: realBuildRunBudgets(options),
      thresholds: realBuildRunThresholds(options),
      codeSnapshots: {},
    });
    const withoutCameraBudget = { ...current.budgets } as Record<string, unknown>;
    delete withoutCameraBudget.panelCameraBranchBudget;
    expect(() =>
      createRealBuildRunContract({
        inputDigests: options.inputDigests,
        identificationClosure: current.identificationClosure,
        panelSourceDigest: REAL_BUILD_TEST_DIGEST,
        panels: options.panels,
        passivePanels: options.passivePanels,
        budgets: withoutCameraBudget as Readonly<Record<string, number>>,
        thresholds: current.thresholds,
        codeSnapshots: {},
      }),
    ).toThrow(/Missing keys: panelCameraBranchBudget/u);

    expect(() =>
      createRealBuildRunContract({
        inputDigests: options.inputDigests,
        identificationClosure: current.identificationClosure,
        panelSourceDigest: REAL_BUILD_TEST_DIGEST,
        panels: options.panels,
        passivePanels: options.passivePanels,
        budgets: { ...current.budgets, panelCameraBranchBudget: 10 },
        thresholds: current.thresholds,
        codeSnapshots: {},
      }),
    ).toThrow(/panelCameraBranchBudget is 10; required a multiple of 8/u);

    const malformedValues: readonly unknown[] = [7, 10, 800_008, 8.5, "8192"];
    for (const panelCameraBranchBudget of malformedValues) {
      const candidate = JSON.parse(JSON.stringify(current)) as Record<string, unknown> & {
        budgets: Record<string, unknown>;
        contractDigest: string;
      };
      candidate.budgets.panelCameraBranchBudget = panelCameraBranchBudget;
      const base: Record<string, unknown> = { ...candidate };
      delete base.contractDigest;
      candidate.contractDigest = canonicalDigest(base);
      expect(() => parseRealBuildRunContract(encodeCanonicalRealBuildJson(candidate))).toThrow(
        /malformed schema/u,
      );
    }

    const extra = JSON.parse(JSON.stringify(current)) as Record<string, unknown> & {
      budgets: Record<string, unknown>;
      contractDigest: string;
    };
    extra.budgets.panelCameraRenderBudget = 8_192;
    const extraBase: Record<string, unknown> = { ...extra };
    delete extraBase.contractDigest;
    extra.contractDigest = canonicalDigest(extraBase);
    expect(() => parseRealBuildRunContract(encodeCanonicalRealBuildJson(extra))).toThrow(
      /malformed schema/u,
    );
  });
});
