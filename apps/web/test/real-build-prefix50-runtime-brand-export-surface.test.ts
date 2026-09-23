import { describe, expect, it } from "vitest";

describe("prefix-50 runtime brand export surface", () => {
  it("exports verification but no raw registration function from each sole producer", async () => {
    const [
      step44Producer,
      step45Producer,
      exactCompiler,
      selectedReturn,
      promotion,
      camera,
      realDomainQualification,
    ] = await Promise.all([
      import("../e2e/real-build-prefix50-exact-loop-step44"),
      import("../e2e/real-build-prefix50-step45-relational-resolver"),
      import("../e2e/real-build-prefix50-exact-compiler"),
      import("../e2e/real-build-prefix50-subbuild-return"),
      import("../e2e/real-build-prefix50-subbuild-return-review-blind-promotion"),
      import("../e2e/real-build-prefix50-subbuild-return-review-camera"),
      import("../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence"),
    ]);

    expect(step44Producer).toHaveProperty("requireRealBuildPrefix50Step44SelectionEvidence");
    expect(step45Producer).toHaveProperty("requireRealBuildPrefix50Step45RelationalResolution");
    expect(exactCompiler).toHaveProperty("requireRealBuildPrefix50ExactCompilation");
    expect(selectedReturn).toHaveProperty(
      "selectPersistedBlindReviewedRealBuildPrefix50SubBuildReturn",
    );
    expect(promotion).toHaveProperty("reopenRealBuildPrefix50Step44PersistedBlindPromotion");
    expect(camera).toHaveProperty("deriveRealBuildPrefix50Step44Page45CameraInstrument");
    expect(camera).not.toHaveProperty("deriveReceipt");
    expect(camera).not.toHaveProperty("persistDerivedCamera");
    expect(camera).not.toHaveProperty("instrumentFromDerived");
    expect(camera).not.toHaveProperty("realBuildPrefix50Step44CameraTestOnlyBridge");
    expect(realDomainQualification).not.toHaveProperty(
      "realBuildPrefix50Step44RealDomainQualificationTestOnly",
    );
    expect(Object.keys(camera).filter((key) => /test.*bridge|raw.*camera/iu.test(key))).toEqual([]);
    expect(
      Object.keys(realDomainQualification).filter((key) => /test.*qualification/iu.test(key)),
    ).toEqual([]);
    expect(Object.keys(step44Producer).filter((key) => /brand/u.test(key))).toEqual([]);
    expect(Object.keys(step45Producer).filter((key) => /brand/u.test(key))).toEqual([]);
    expect(Object.keys(exactCompiler).filter((key) => /brand/u.test(key))).toEqual([]);
    expect(Object.keys(selectedReturn).filter((key) => /brand/u.test(key))).toEqual([]);
    expect(Object.keys(promotion).filter((key) => /brand/u.test(key))).toEqual([]);
  }, 60_000);
});
