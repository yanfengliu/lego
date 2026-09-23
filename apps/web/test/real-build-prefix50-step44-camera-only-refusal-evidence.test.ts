import { canonicalDigest } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE,
  assertRealBuildPrefix50Step44CameraOnlyOutputEntries,
} from "../e2e/real-build-prefix50-step44-camera-only-gate-contract.ts";
import { RealBuildPrefix50Step44CameraSearchRefusalError } from "../e2e/real-build-prefix50-subbuild-return-review-camera-search.ts";

const attemptCommitment = canonicalDigest({ fixture: "refused-camera-attempt" });

function refusalFiles() {
  const beauty = Array.from(
    { length: 16 },
    (_, index) =>
      `real-build-prefix50-step44-page45-camera-branch-${index
        .toString()
        .padStart(2, "0")}-seed.png`,
  );
  const semantic = Array.from(
    { length: 16 },
    (_, index) =>
      `real-build-prefix50-step44-page45-camera-branch-${index
        .toString()
        .padStart(2, "0")}-semantic-blue-cyan.png`,
  );
  return [
    "camera-only-static-app.log",
    "real-build-prefix50-step44-page45-camera-attempt.json",
    "real-build-prefix50-step44-page45-camera-beauty-restoration-control.png",
    REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE,
    ...beauty,
    ...semantic,
  ];
}

describe("Step-44 camera-only verified refusal evidence", () => {
  it("carries an immutable typed attempt commitment and exact refusal reasons", () => {
    const error = new RealBuildPrefix50Step44CameraSearchRefusalError({
      attemptCommitment,
      refusalReasons: ["blue-cyan-f1-floor-not-met"],
      diagnostic: "synthetic post-sink refusal",
    });

    expect(error).toBeInstanceOf(TypeError);
    expect(error.code).toBe("STEP44_CAMERA_SEARCH_REFUSED");
    expect(error.attemptCommitment).toBe(attemptCommitment);
    expect(error.refusalReasons).toEqual(["blue-cyan-f1-floor-not-met"]);
    expect(Object.isFrozen(error.refusalReasons)).toBe(true);
  });

  it("admits exactly the flat refused tree and rejects success-only or missing evidence", () => {
    const files = refusalFiles();
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyOutputEntries({
        files,
        directories: [],
        complete: false,
        status: "refused",
        expectedRefusalFiles: files,
      }),
    ).not.toThrow();
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyOutputEntries({
        files: [...files, "real-build-prefix50-step44-page45-camera-source-crop.png"],
        directories: [],
        complete: false,
        status: "refused",
        expectedRefusalFiles: files,
      }),
    ).toThrow("exactly its persisted beauty passes");
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyOutputEntries({
        files: files.filter((file) => !file.includes("branch-15-semantic")),
        directories: [],
        complete: false,
        status: "refused",
        expectedRefusalFiles: files,
      }),
    ).toThrow("exactly its persisted beauty passes");
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyOutputEntries({
        files: [...files, "real-build-prefix50-step44-page45-camera-branch-99-confirmation.png"],
        directories: [],
        complete: false,
        status: "refused",
        expectedRefusalFiles: files,
      }),
    ).toThrow("exactly its persisted beauty passes");
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyOutputEntries({
        files: files.map((file) =>
          file.includes("branch-15-seed")
            ? "real-build-prefix50-step44-page45-camera-branch-99-seed.png"
            : file,
        ),
        directories: [],
        complete: false,
        status: "refused",
        expectedRefusalFiles: files,
      }),
    ).toThrow("exactly its persisted beauty passes");
  });
});
