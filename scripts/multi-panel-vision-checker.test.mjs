import { describe, expect, it, vi } from "vitest";

import {
  canonicalJsonBytes,
  createMultiPanelRequest,
  sealMultiPanelAttempt,
  sha256,
} from "./multi-panel-vision-contract.mjs";
import {
  MultiPanelVisionRunError,
  runMultiPanelVisionCheck,
  verifyMultiPanelVisionResult,
} from "./multi-panel-vision-checker.mjs";
import {
  panel,
  response,
  rotationIconsThrough,
  step4Input,
  step5Input,
} from "./multi-panel-vision-test-fixture.mjs";

function scriptedAdapter(answers, calls = []) {
  return vi.fn(async (call) => {
    calls.push(call);
    const answer = answers[calls.length - 1];
    if (answer === undefined) throw new Error(`Unexpected model call ${calls.length}.`);
    return answer;
  });
}

describe("the conditional N/N+1/K sequence", () => {
  it("treats step 6 as unjudgeable for step 5, then accepts step 7 only as corroboration", async () => {
    const calls = [];
    const result = await runMultiPanelVisionCheck(
      step5Input(),
      scriptedAdapter(
        [response("unjudgeable", "occluded"), response("same", "stud-offset")],
        calls,
      ),
    );

    expect(calls).toHaveLength(2);
    expect(calls[0].attachments.map(({ stepNumber }) => stepNumber)).toEqual([5, 5, 6, 6]);
    expect(calls[1].attachments.map(({ stepNumber }) => stepNumber)).toEqual([5, 5, 6, 6, 7, 7]);
    expect(calls[1].attachments.at(-1).panelFace).toBe("underside");
    expect(result).toMatchObject({
      outcome: "corroborated",
      firstFartherRevealingStep: 7,
      disposition: "deterministic-validators-still-required",
      mayCertify: false,
      mayMutateDocument: false,
      mayBypassValidators: false,
    });
    expect(result.attempts.map(({ answer }) => answer)).toEqual([
      { verdict: "unjudgeable", reason: "occluded" },
      { verdict: "same", reason: "stud-offset" },
    ]);
    expect(() => verifyMultiPanelVisionResult(result)).not.toThrow();
  });

  it("never exposes K when N+1 itself decisively corroborates or contradicts", async () => {
    for (const [verdict, outcome] of [
      ["same", "corroborated"],
      ["different", "vetoed"],
    ]) {
      const calls = [];
      const result = await runMultiPanelVisionCheck(
        step5Input(),
        scriptedAdapter([response(verdict, "layer")], calls),
      );
      expect(calls).toHaveLength(1);
      expect(calls[0].attachments.some(({ stepNumber }) => stepNumber === 7)).toBe(false);
      expect(result.outcome).toBe(outcome);
      expect(result.firstFartherRevealingStep).toBeNull();
    }
  });

  it("retains not-observable when no retained panel exists beyond an occluded N+1", async () => {
    const input = step5Input({
      rotationIcons: rotationIconsThrough(6),
      laterPanels: [],
      retainedThroughStep: 6,
    });
    const result = await runMultiPanelVisionCheck(
      input,
      scriptedAdapter([response("unjudgeable", "occluded")]),
    );
    expect(result).toMatchObject({
      outcome: "not-observable",
      firstFartherRevealingStep: null,
      disposition: "refuse-not-observable",
    });
    expect(result.attempts).toHaveLength(1);
    expect(() => verifyMultiPanelVisionResult(result)).not.toThrow();
  });

  it("does not let agreement in N substitute when both N+1 and K hide the group", async () => {
    const result = await runMultiPanelVisionCheck(
      step5Input(),
      scriptedAdapter([response("unjudgeable", "occluded"), response("unjudgeable", "occluded")]),
    );
    expect(result.outcome).toBe("not-observable");
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts.every(({ answer }) => answer.verdict === "unjudgeable")).toBe(true);
    expect(() => verifyMultiPanelVisionResult(result)).not.toThrow();
  });

  it("keeps the step-4 atomic group whole even though step 5 cannot re-prove its hidden underside", async () => {
    const result = await runMultiPanelVisionCheck(
      step4Input(),
      scriptedAdapter([response("unjudgeable", "occluded")]),
    );
    expect(result.claim.atomicGroupId).toBe("atomic:step-4:black-plates");
    expect(result.claim.pieces).toHaveLength(2);
    expect(result.outcome).toBe("not-observable");
    expect(result.mayCertify).toBe(false);
  });
});

describe("sequence and evidence refusals", () => {
  it("refuses a missing farther panel before making any model call", async () => {
    const invoke = scriptedAdapter([]);
    await expect(
      runMultiPanelVisionCheck(
        step5Input({
          rotationIcons: rotationIconsThrough(8),
          laterPanels: [panel(7)],
          retainedThroughStep: 8,
        }),
        invoke,
      ),
    ).rejects.toThrow(/requires 2 farther panel/u);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("refuses a missing N+1 panel and a skipped K", async () => {
    await expect(
      runMultiPanelVisionCheck(step5Input({ panelNPlusOne: null }), scriptedAdapter([])),
    ).rejects.toThrow(/requires exact panel N and N\+1/u);
    await expect(
      runMultiPanelVisionCheck(
        step5Input({
          rotationIcons: rotationIconsThrough(8),
          laterPanels: [panel(8), panel(7)],
          retainedThroughStep: 8,
        }),
        scriptedAdapter([]),
      ),
    ).rejects.toThrow(/must be printed step 7/u);
  });

  it("refuses rather than making an unbounded ambiguity call", async () => {
    const invoke = scriptedAdapter([response("unjudgeable", "occluded")]);
    await expect(
      runMultiPanelVisionCheck(step5Input({ budgets: { maxModelCalls: 1 } }), invoke),
    ).rejects.toThrow(/complete ambiguity scan needs 2 model calls/u);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("refuses an immutable attempt-id collision", async () => {
    await expect(
      runMultiPanelVisionCheck(
        step5Input({ nextAttemptId: () => "attempt:reused" }),
        scriptedAdapter([response("unjudgeable", "occluded"), response("same", "layer")]),
      ),
    ).rejects.toThrow(/was reused/u);
  });

  it("preflights every farther image before transmitting N or N+1", async () => {
    const invoke = scriptedAdapter([]);
    const later = panel(7);
    later.sourcePngBytes = later.sourcePngBytes.subarray(0, later.sourcePngBytes.length - 1);
    await expect(
      runMultiPanelVisionCheck(step5Input({ laterPanels: [later] }), invoke),
    ).rejects.toThrow(/PNG/u);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("preflights the printed-step and retained-request bounds before transmission", async () => {
    const invoke = scriptedAdapter([]);
    const highStep = step5Input({
      claim: { ...step5Input().claim, stepNumber: 4_096 },
      panelN: panel(4_096),
      panelNPlusOne: panel(4_097),
      laterPanels: [],
      retainedThroughStep: 4_097,
      rotationIcons: rotationIconsThrough(4_097),
    });
    await expect(runMultiPanelVisionCheck(highStep, invoke)).rejects.toThrow(/inside 1..4096/u);
    await expect(
      runMultiPanelVisionCheck(step4Input({ budgets: { maxRetainedBytes: 1 } }), invoke),
    ).rejects.toThrow(/bound requests alone need/u);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("exposes every sealed prior attempt when a farther invocation fails", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(response("unjudgeable", "occluded"))
      .mockRejectedValueOnce(new Error("provider sentinel"));
    let failure;
    try {
      await runMultiPanelVisionCheck(step5Input(), invoke);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(MultiPanelVisionRunError);
    expect(failure.completedAttempts).toHaveLength(1);
    expect(Object.isFrozen(failure.completedAttempts)).toBe(true);
    expect(failure.completedAttempts[0].answer).toEqual({
      verdict: "unjudgeable",
      reason: "occluded",
    });
    expect(failure.failedRequest.panels.map(({ role }) => role)).toEqual(["N", "N+1", "K"]);
    expect(failure.message).toContain("provider sentinel");
  });

  it("refuses result tampering even if a consumer sees otherwise plausible fields", async () => {
    const result = await runMultiPanelVisionCheck(
      step4Input(),
      scriptedAdapter([response("different", "missing-or-extra")]),
    );
    const held = JSON.parse(JSON.stringify(result));
    held.outcome = "corroborated";
    expect(() => verifyMultiPanelVisionResult(held)).toThrow(/content digest/u);

    const body = { ...held };
    delete body.resultDigest;
    held.resultDigest = sha256(canonicalJsonBytes(body));
    expect(() => verifyMultiPanelVisionResult(held)).toThrow(/does not consume final verdict/u);
  });

  it("refuses a rehashed K lineage that swaps the already-bound N source bytes", async () => {
    const result = await runMultiPanelVisionCheck(
      step5Input(),
      scriptedAdapter([response("unjudgeable", "occluded"), response("same", "layer")]),
    );
    const changedInput = step5Input({ panelN: panel(5, "changed-N-source") });
    const changedRequest = createMultiPanelRequest({
      ...changedInput,
      attemptId: result.attempts[1].request.attemptId,
      panelK: panel(7),
      budgets: result.attempts[1].request.budgets,
    });
    const changedAttempt = sealMultiPanelAttempt(changedRequest, response("same", "layer"));
    const held = JSON.parse(JSON.stringify(result));
    held.attempts[1] = changedAttempt;
    const body = { ...held };
    delete body.resultDigest;
    held.resultDigest = sha256(canonicalJsonBytes(body));
    expect(() => verifyMultiPanelVisionResult(held)).toThrow(/changed the exact N\/N\+1/u);
  });
});
