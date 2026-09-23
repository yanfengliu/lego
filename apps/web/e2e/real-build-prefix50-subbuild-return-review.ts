import { deepFreeze } from "@lego-studio/brick-kernel";

import type {
  RealBuildPrefix50ReviewedVisualBinding,
  RealBuildPrefix50SubBuildReturnResult,
  RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope,
} from "./real-build-prefix50-subbuild-return-contract";
import { REAL_BUILD_PREFIX50_STEP44_RETURN_REVIEW_FIXTURE } from "./real-build-prefix50-subbuild-return-review-fixture";

function legacyFixtureRouteDisabled(): never {
  throw new TypeError(
    "Prefix-50 Step 44 legacy reviewed-fixture promotion is disabled; reviewStatus and caller-provided artifacts cannot replace the persisted blind closure, exact unblinding map, and runtime promotion receipt.",
  );
}

/** The repository fixture remains fail-closed until a blind promotion receipt is deliberately promoted. */
export function deriveRepositoryReviewedRealBuildPrefix50ReturnBinding(
  _result: RealBuildPrefix50SubBuildReturnResult,
  _envelope: RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope,
): RealBuildPrefix50ReviewedVisualBinding {
  void _result;
  void _envelope;
  const fixture = REAL_BUILD_PREFIX50_STEP44_RETURN_REVIEW_FIXTURE;
  if (fixture.reviewStatus !== "reviewed")
    throw new TypeError(
      `Prefix-50 Step 44 repository review remains unreviewed: ${fixture.reason}`,
    );
  return legacyFixtureRouteDisabled();
}

interface RealBuildPrefix50Step44ReviewTestOnly {
  readonly derivePromotedWithFixture: typeof legacyFixtureRouteDisabled;
  readonly verifyAndDeriveWithFixture: typeof legacyFixtureRouteDisabled;
}

const TEST_MODE = typeof process !== "undefined" && process.env.NODE_ENV === "test";

export const __testOnlyReview: Readonly<Partial<RealBuildPrefix50Step44ReviewTestOnly>> = TEST_MODE
  ? deepFreeze({
      derivePromotedWithFixture: legacyFixtureRouteDisabled,
      verifyAndDeriveWithFixture: legacyFixtureRouteDisabled,
    })
  : deepFreeze({});
