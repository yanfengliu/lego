import { canonicalStringify } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  createRealBuildPrefix50Step44BlindDispositionLane,
  createRealBuildPrefix50Step44FullResolutionOutcome,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind";
import {
  blindReviewTestCriteria,
  createBlindReviewTestFullResolutionRows,
  createBlindReviewTestLaneRows,
  createBlindReviewTestPacket,
  type DeepMutable,
  recommitBlindReviewTestValue,
} from "./real-build-prefix50-subbuild-return-review-blind-test-support";

describe("prefix-50 Step-44 blinded denominator review closure", () => {
  it("requires independent exact-211 lanes and selects the sole fully observed union survivor", () => {
    const blindPacket = createBlindReviewTestPacket();
    expect(blindPacket.reference.sourcePdfArtifactPath).toBe("recipes/6651557.pdf");
    expect(canonicalStringify(blindPacket)).not.toMatch(/candidateKey|documentHash/u);
    const laneA = createRealBuildPrefix50Step44BlindDispositionLane({
      packet: blindPacket,
      lane: "lane-a",
      reviewerId: "reviewer-alpha",
      reviewSessionId: "session-alpha",
      rows: createBlindReviewTestLaneRows(["B001", "B002"]),
    });
    const laneB = createRealBuildPrefix50Step44BlindDispositionLane({
      packet: blindPacket,
      lane: "lane-b",
      reviewerId: "reviewer-beta",
      reviewSessionId: "session-beta",
      rows: createBlindReviewTestLaneRows(["B001", "B003"]),
    });
    const closure = createRealBuildPrefix50Step44FullResolutionOutcome({
      packet: blindPacket,
      lanes: [laneA, laneB],
      fullResolutionReviews: createBlindReviewTestFullResolutionRows(
        blindPacket,
        ["B001", "B002", "B003"],
        ["B001"],
      ),
      disposition: {
        kind: "selected-one",
        blindId: "B001",
        note: "B001 is the sole fully observed page-45 survivor.",
      },
    });
    expect(closure.unionShortlist).toEqual(["B001", "B002", "B003"]);
    expect(closure.disposition).toMatchObject({ kind: "selected-one", blindId: "B001" });
  });

  it("permits refusal for zero or multiple survivors and forbids unreadable winners", () => {
    const blindPacket = createBlindReviewTestPacket();
    const lanes = [
      createRealBuildPrefix50Step44BlindDispositionLane({
        packet: blindPacket,
        lane: "lane-a",
        reviewerId: "reviewer-one",
        reviewSessionId: "session-one",
        rows: createBlindReviewTestLaneRows(["B001", "B002"]),
      }),
      createRealBuildPrefix50Step44BlindDispositionLane({
        packet: blindPacket,
        lane: "lane-b",
        reviewerId: "reviewer-two",
        reviewSessionId: "session-two",
        rows: createBlindReviewTestLaneRows(["B001", "B002"]),
      }),
    ] as const;
    const multiple = createBlindReviewTestFullResolutionRows(
      blindPacket,
      ["B001", "B002"],
      ["B001", "B002"],
    );
    expect(
      createRealBuildPrefix50Step44FullResolutionOutcome({
        packet: blindPacket,
        lanes,
        fullResolutionReviews: multiple,
        disposition: {
          kind: "refused",
          reason: "Two blinded rows remain visually indistinguishable.",
        },
      }).disposition.kind,
    ).toBe("refused");
    const unreadable = multiple.map((row) => ({
      ...row,
      criteria: blindReviewTestCriteria("not-observable"),
      survives: false,
      note: "At least one closed page-45 criterion is not observable.",
    }));
    expect(
      createRealBuildPrefix50Step44FullResolutionOutcome({
        packet: blindPacket,
        lanes,
        fullResolutionReviews: unreadable,
        disposition: { kind: "refused", reason: "No blinded row is fully observable on page 45." },
      }).disposition.kind,
    ).toBe("refused");
    expect(() =>
      createRealBuildPrefix50Step44FullResolutionOutcome({
        packet: blindPacket,
        lanes,
        fullResolutionReviews: unreadable.map((row, index) => ({
          ...row,
          survives: index === 0,
        })),
        disposition: {
          kind: "selected-one",
          blindId: "B001",
          note: "Unreadable evidence must not select this row.",
        },
      }),
    ).toThrow(/survival must equal/u);
  });

  it("rejects later-step or identity leakage, non-independent lanes, and forged packet coverage", () => {
    const blindPacket = createBlindReviewTestPacket();
    expect(() =>
      createRealBuildPrefix50Step44BlindDispositionLane({
        packet: blindPacket,
        lane: "lane-a",
        reviewerId: "reviewer-a",
        reviewSessionId: "session-a",
        rows: createBlindReviewTestLaneRows([]).map((row, index) =>
          index === 0
            ? {
                ...row,
                criteria: blindReviewTestCriteria("different", "Page 46 confirms this difference."),
              }
            : row,
        ),
      }),
    ).toThrow(/page 46/u);
    expect(() =>
      createRealBuildPrefix50Step44BlindDispositionLane({
        packet: blindPacket,
        lane: "lane-a",
        reviewerId: "reviewer-a",
        reviewSessionId: "session-a",
        rows: createBlindReviewTestLaneRows([]).map((row, index) =>
          index === 0
            ? { ...row, shortlistNote: "Candidate key identity explains this result." }
            : row,
        ),
      }),
    ).toThrow(/candidate, document, roster, or operation/u);
    const forged = structuredClone(blindPacket) as DeepMutable<typeof blindPacket>;
    forged.pages[0]!.rows.pop();
    recommitBlindReviewTestValue(forged.pages[0]!);
    recommitBlindReviewTestValue(forged);
    expect(() =>
      createRealBuildPrefix50Step44BlindDispositionLane({
        packet: forged,
        lane: "lane-a",
        reviewerId: "reviewer-a",
        reviewSessionId: "session-a",
        rows: createBlindReviewTestLaneRows([]),
      }),
    ).toThrow(/packet page|self commitment|contract drifted/u);
  });
});
