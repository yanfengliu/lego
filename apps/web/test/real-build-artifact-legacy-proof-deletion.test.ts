import { describe, expect, it } from "vitest";

import { inspectFrozenLegacyBrowserOutputV2 } from "../e2e/real-build-artifact-legacy-browser-v2";
import { legacyDiagnosticReplayBrowserOutput, replayOptions } from "./real-build-replay-fixture";

function frozenLegacyFixture(): Record<string, unknown> & {
  reports: Record<string, unknown>[];
} {
  const current = legacyDiagnosticReplayBrowserOutput();
  if (current.status !== "executed") {
    throw new TypeError("Legacy proof-deletion fixture requires executed browser bytes.");
  }
  return {
    ...current,
    schemaVersion: "lego.real-build-browser-output/2",
    reports: current.reports.map(({ panelCamera: _panelCamera, ...report }) => {
      void _panelCamera;
      return structuredClone(report) as unknown as Record<string, unknown>;
    }),
  };
}

describe("frozen legacy farther proof retention", () => {
  it("does not let a completed deferred placement replace its selected decision with a refusal", () => {
    const honest = frozenLegacyFixture();
    expect(inspectFrozenLegacyBrowserOutputV2(honest, replayOptions)).toBe(honest);

    const forged = structuredClone(honest);
    const report = forged.reports[0]!;
    const farther = report.farther as Record<string, unknown>;
    const origin = farther.origin as Record<string, unknown>;
    const candidates = origin.candidates as Record<string, unknown>[];
    candidates[0]!.lookaheadAgreement = 0.5;
    candidates[1]!.lookaheadAgreement = 0.4;
    const panels = farther.panels as Record<string, unknown>[];
    const panel = panels[0]!;
    const scores = panel.scores as Record<string, unknown>[];
    scores[0]!.agreement = 0.5;
    scores[1]!.agreement = 0.4;
    panel.status = "unrevealing";
    panel.reason = "weak-agreement";
    panel.bestAgreement = 0.5;
    panel.familyMargin = 0.5 - 0.4;
    panel.descendantMargin = null;
    farther.decision = null;
    farther.refusal = {
      code: "not-observable",
      stage: "evidence",
      stepNumber: 2,
      message: "The remaining panel was relabelled as non-observable.",
    };

    expect(() => inspectFrozenLegacyBrowserOutputV2(forged, replayOptions)).toThrow(
      /must retain its selected decision for a completed deferred-lookahead outcome/u,
    );
  });
});
