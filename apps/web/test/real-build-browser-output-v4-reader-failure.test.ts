import { describe, expect, it } from "vitest";

import type { RealBuildBrowserBranchDetailedStepInspection } from "../e2e/real-build-browser-output-v4-semantic";
import {
  deriveRealBuildBrowserOutputV4MissingRoleFailure,
  deriveRealBuildBrowserOutputV4TerminalPlacementFailure,
  realBuildBrowserOutputV4HasCleanPrerequisites,
} from "../e2e/real-build-browser-output-v4-reader-failure";
import type { RealBuildBrowserOutputV4PlacementAdvance } from "../e2e/real-build-browser-output-v4-reader-frontier";
import {
  inspectRealBuildPreparedPanelFromRunInput,
  inspectRealBuildPreparedRunInput,
} from "../e2e/real-build-prepared-step-authority";
import type { RealBuildStepReport } from "../e2e/real-build-safety";
import { SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS } from "./real-build-browser-output-v4-source-evidence-fixture";

const DIGEST_A = `sha256:${"a".repeat(64)}`;
const DIGEST_B = `sha256:${"b".repeat(64)}`;
const DIGEST_C = `sha256:${"c".repeat(64)}`;

type Terminal = Extract<RealBuildBrowserOutputV4PlacementAdvance, { status: "terminal" }>;

function terminal(reason: Terminal["reason"]): Terminal {
  return { status: "terminal", reason, frontier: null } as unknown as Terminal;
}

function step(input: {
  readonly status: "failed" | "budget-refused" | "unresolved";
  readonly selection?: "unresolved" | "unverified-failure";
  readonly failedObservations?: number;
}): RealBuildBrowserBranchDetailedStepInspection {
  const selection = input.selection;
  return {
    stepNumber: 5,
    index: {
      observationClosure: selection === undefined ? null : { digest: DIGEST_B },
      observations: selection === undefined ? null : { digest: DIGEST_C },
    },
    lineageInspection: {
      compiledLineageBytesDigest: DIGEST_A,
      evidence: {
        status: input.status,
        terminalFailure:
          input.status === "failed"
            ? {
                code: "automatic-compilation-failed",
                phase: "compilation",
                issue: { code: "BAD_PROPOSAL", path: "operations[0]", reason: "refused" },
                failureDigest: DIGEST_C,
              }
            : null,
        searchReservation: {
          admitted: input.status !== "budget-refused",
          refusal: input.status === "budget-refused" ? "budget-exceeded" : null,
          reservationNumber: 4,
          reservedBefore: 6,
          requested: 5,
          budget: 10,
          terminalFailure:
            input.status === "budget-refused" ? { preflightIdentity: DIGEST_B } : null,
        },
      },
    },
    closure: selection === undefined ? null : {},
    observation:
      selection === undefined
        ? null
        : {
            failedObservationIds: Array.from(
              { length: input.failedObservations ?? 0 },
              (_, index) => `compiled-observation:sha256:${String(index).padStart(64, "0")}`,
            ),
            closure: {
              selection: {
                status: selection,
                bestScore: 0.7,
                runnerUpScore: 0.69,
                margin: 0.01,
              },
            },
          },
  } as unknown as RealBuildBrowserBranchDetailedStepInspection;
}

describe("browser-output /4 terminal failure projection", () => {
  it("refuses missing-role projection when prepared placement prerequisites remain unresolved", () => {
    const stepIndex = SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS.panels.findIndex(
      ({ action }) => action.kind === "place-callouts",
    );
    expect(stepIndex).toBeGreaterThanOrEqual(0);
    for (const prerequisitePatch of [
      { unresolvedCallouts: ["callout:unresolved"] },
      { missingDesigns: ["design:missing"] },
    ]) {
      const panels = [...SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS.panels];
      panels[stepIndex] = { ...panels[stepIndex]!, ...prerequisitePatch };
      const preparedRun = inspectRealBuildPreparedRunInput(
        new TextEncoder().encode(
          JSON.stringify({ ...SOURCE_EVIDENCE_TEST_PREPARED_OPTIONS, panels }),
        ),
      );
      const preparedPanel = inspectRealBuildPreparedPanelFromRunInput(preparedRun, stepIndex + 1);

      expect(preparedPanel.actionKind).toBe("place-callouts");
      expect(() => deriveRealBuildBrowserOutputV4MissingRoleFailure(preparedPanel)).toThrow(
        /cannot erase or advance unresolved prepared prerequisites/iu,
      );
    }
  });

  it("uses assembled rather than raw callout quantity for clean multiplier prerequisites", () => {
    const report = {
      calloutPieces: 2,
      expectedAssembledPieces: 4,
      prerequisites: {
        blockingStep: null,
        coverageFailures: [],
        unresolvedCallouts: [],
        missingDesigns: [],
        calloutPieces: 2,
        expectedAssembledPieces: 4,
        resolvedPieces: 4,
        localFailure: null,
      },
    } as unknown as RealBuildStepReport;

    expect(realBuildBrowserOutputV4HasCleanPrerequisites(report)).toBe(true);
    expect(
      realBuildBrowserOutputV4HasCleanPrerequisites({
        ...report,
        prerequisites: { ...report.prerequisites, resolvedPieces: report.calloutPieces },
      }),
    ).toBe(false);
  });

  it("projects all five terminal reasons into distinct evidence-bound failures", () => {
    const cases = [
      ["failed", step({ status: "failed" })],
      ["budget-refused", step({ status: "budget-refused" })],
      ["closure-absent", step({ status: "unresolved" })],
      ["unresolved", step({ status: "unresolved", selection: "unresolved" })],
      [
        "unverified-failure",
        step({
          status: "unresolved",
          selection: "unverified-failure",
          failedObservations: 1,
        }),
      ],
    ] as const;
    const projections = cases.map(([reason, evidence]) =>
      deriveRealBuildBrowserOutputV4TerminalPlacementFailure(evidence, terminal(reason)),
    );

    expect(projections.map(({ failure }) => failure.inputKey)).toHaveLength(5);
    expect(new Set(projections.map(({ failure }) => failure.inputKey)).size).toBe(5);
    expect(projections.map(({ failure }) => failure.code)).toEqual([
      "run-incomplete",
      "resource-budget-exhausted",
      "visual-evidence-unverified",
      "visual-evidence-unverified",
      "visual-evidence-unverified",
    ]);
    expect(projections.map(({ attemptedMechanism }) => attemptedMechanism)).toEqual([
      "compiled-observation",
      null,
      "compiled-observation",
      "compiled-observation",
      "compiled-observation",
    ]);
  });

  it("does not promote a failed observation row into a trusted rendering failure", () => {
    const projection = deriveRealBuildBrowserOutputV4TerminalPlacementFailure(
      step({
        status: "unresolved",
        selection: "unverified-failure",
        failedObservations: 2,
      }),
      terminal("unverified-failure"),
    );
    expect(projection.failure).toMatchObject({
      code: "visual-evidence-unverified",
      stage: "evidence",
    });
  });
});
