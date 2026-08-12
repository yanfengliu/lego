import { LEGACY_MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION_V2 } from "./real-build-farther-origin-source-attestation-legacy-v2";
import type { RealBuildOptions, RealBuildPanelSpec } from "./real-build-safety";
import {
  legacyDenseArray,
  legacyExactKeys,
  legacyPng,
  legacyRecord,
  legacySameJson,
} from "./real-build-artifact-legacy-browser-v2-values";

const MAXIMUM_CAPTURES = 18;
const PINNED_INPUT_DIGESTS = {
  pdf: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
  calloutManifest: "sha256:e64a38507306d60d68d40cbd7f9e19158581faf1dc75fb77077d76850a33a0c3",
  coverage: "sha256:0ed8fb0225057ba6d36ae00f45d37921a0b590ff6de42fa96774545d62a4c3c6",
  officialModel: "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922",
  actionLedger: "sha256:e88688b23310b9ae16039c57f0ffbf2c5cbf36385e81af6e4824ac9faf64a377",
  highlightCalibration: "sha256:f18939b8b9b98123868c437561113f81c44142b4004aa206dfaf7d4b954ffadf",
  builderCalibration: "sha256:da326b44897eec7d0a3a7049c0d06cb8ae8c0fbcbcda2e3f7423d7017abd241b",
  builderGeometry: "sha256:da8260f77540db459bd745d75ebb072d1b08d357d1628569a06c58d6aed77c55",
  transitionClassifications:
    "sha256:80efaa9573d3611e820f9a5108fe89f48e22139164fa7f56c297aa13350670ab",
};

const PINNED_ORIGINS = [
  {
    candidateId: "step-005:sha256:2a70e4720046a4437c623546b4e78b8df9922e62846686db84ae1cd0003ab1b8",
    documentHash: "sha256:2a70e4720046a4437c623546b4e78b8df9922e62846686db84ae1cd0003ab1b8",
    lookaheadAgreement: 0.6006833844906468,
    pieces: [
      {
        catalogPartId: "builtin:plate-2x4",
        colorId: "builtin:green",
        transform: { positionLdu: [60, 8, 0], orientationId: "upright-yaw-270" },
      },
      {
        catalogPartId: "builtin:plate-2x14",
        colorId: "builtin:black",
        transform: { positionLdu: [160, -8, 40], orientationId: "upright-yaw-270" },
      },
    ],
  },
  {
    candidateId: "step-005:sha256:47ae3d353885f5de11b685a4bec4ca1132554a19e1f1e30454281252f7d64c93",
    documentHash: "sha256:47ae3d353885f5de11b685a4bec4ca1132554a19e1f1e30454281252f7d64c93",
    lookaheadAgreement: 0.7635021804763502,
    pieces: [
      {
        catalogPartId: "builtin:plate-2x4",
        colorId: "builtin:green",
        transform: { positionLdu: [60, 8, 0], orientationId: "upright-yaw-270" },
      },
      {
        catalogPartId: "builtin:plate-2x14",
        colorId: "builtin:black",
        transform: { positionLdu: [160, 8, 100], orientationId: "upright-yaw-270" },
      },
    ],
  },
];

const PINNED_K_SCORES = [
  { candidateId: PINNED_ORIGINS[0]!.candidateId, agreement: 0.81657223796034 },
  { candidateId: PINNED_ORIGINS[1]!.candidateId, agreement: 0.9367520589707421 },
];

export function exactPinnedLegacyDirectK(input: {
  originStep: number;
  origins: readonly Record<string, unknown>[];
  panels: readonly Record<string, unknown>[];
  decision: unknown;
  options: RealBuildOptions;
}): boolean {
  const claimsK = input.panels.some(({ stepNumber }) => stepNumber === input.originStep + 2);
  if (!claimsK) return true;
  const originProjection = input.origins.map(
    ({ candidateId, documentHash, lookaheadAgreement, pieces }) => ({
      candidateId,
      documentHash,
      lookaheadAgreement,
      pieces,
    }),
  );
  const kPanel = input.panels.find(({ stepNumber }) => stepNumber === input.originStep + 2)!;
  const decision = legacyRecord(input.decision) ? input.decision : null;
  return (
    input.originStep === 5 &&
    legacySameJson(
      input.options.measuredFartherOriginSourceAttestation,
      LEGACY_MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION_V2,
    ) &&
    legacySameJson(input.options.inputDigests, PINNED_INPUT_DIGESTS) &&
    input.options.minimumDeferredAgreement === 0.85 &&
    input.options.minimumDeferredAgreementMargin === 0.02 &&
    input.options.renderScale === 6 &&
    input.options.panelWidth === 1_000 &&
    input.options.workFactor === 2 &&
    input.options.deferredNarrowingRenderBudget === 8_192 &&
    input.options.fartherPanelMaximumReachSteps === 2 &&
    input.options.fartherPanelRenderBudget === 16 &&
    legacySameJson(originProjection, PINNED_ORIGINS) &&
    legacySameJson(kPanel.scores, PINNED_K_SCORES) &&
    decision !== null &&
    decision.originCandidateId === PINNED_ORIGINS[1]!.candidateId &&
    decision.revealingStepNumber === 7 &&
    legacySameJson(decision.survivingCandidateIds, [PINNED_ORIGINS[1]!.candidateId]) &&
    legacySameJson(decision.rejectedCandidateIds, [PINNED_ORIGINS[0]!.candidateId])
  );
}

export function frozenLegacyFartherCaptures(
  value: unknown,
  evidence: Record<string, unknown> | null,
): boolean {
  if (!legacyDenseArray(value, MAXIMUM_CAPTURES)) return false;
  if (evidence === null) return value.length === 0;
  const expected = (evidence.panels as readonly Record<string, unknown>[]).flatMap((panel) => [
    { role: "source-panel", panelStepNumber: panel.stepNumber, candidateId: null },
    ...(panel.scores as readonly Record<string, unknown>[]).map(({ candidateId }) => ({
      role: "candidate-render",
      panelStepNumber: panel.stepNumber,
      candidateId,
    })),
  ]);
  return (
    value.length === expected.length &&
    value.every((capture, index) => {
      const descriptor = expected[index]!;
      return (
        legacyRecord(capture) &&
        legacyExactKeys(capture, ["captureId", "role", "panelStepNumber", "candidateId", "png"]) &&
        capture.captureId === index &&
        capture.role === descriptor.role &&
        capture.panelStepNumber === descriptor.panelStepNumber &&
        capture.candidateId === descriptor.candidateId &&
        legacyPng(capture.png)
      );
    })
  );
}

export function frozenLegacyDecisionPieces(
  evidence: Record<string, unknown>,
  report: Record<string, unknown>,
  panel: RealBuildPanelSpec,
): boolean {
  if (evidence.decision === null) return true;
  const decision = evidence.decision as Record<string, unknown>;
  const selected = (evidence.origin as Record<string, unknown>).candidates as readonly Record<
    string,
    unknown
  >[];
  const origin = selected.find(({ candidateId }) => candidateId === decision.originCandidateId);
  const pieces = report.pieces as readonly Record<string, unknown>[];
  const witnesses = origin?.pieces as readonly Record<string, unknown>[] | undefined;
  return (
    witnesses !== undefined &&
    witnesses.length === panel.pieces.length &&
    pieces.length >= panel.pieces.length &&
    witnesses.every(
      (witness, index) =>
        witness.catalogPartId === panel.pieces[index]!.catalogPartId &&
        witness.colorId === panel.pieces[index]!.colorId &&
        pieces[index]!.catalogPartId === witness.catalogPartId &&
        pieces[index]!.placed === true &&
        pieces[index]!.failure === null &&
        pieces[index]!.orientationId ===
          (witness.transform as Record<string, unknown>).orientationId &&
        legacySameJson(
          pieces[index]!.positionLdu,
          (witness.transform as Record<string, unknown>).positionLdu,
        ),
    )
  );
}
