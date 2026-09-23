import { PART_DEFINITIONS } from "../packages/catalog/src/index.ts";
import { describe, expect, it } from "vitest";

import { PART_VISUAL_ADMISSION_EXPLICIT_TARGET_IDS } from "./part-visual-admission-targets.mjs";

describe("explicit part visual-admission targets", () => {
  it("names every current exact LDraw mesh target once, including 15573", () => {
    expect(new Set(PART_VISUAL_ADMISSION_EXPLICIT_TARGET_IDS).size).toBe(
      PART_VISUAL_ADMISSION_EXPLICIT_TARGET_IDS.length,
    );
    expect(PART_VISUAL_ADMISSION_EXPLICIT_TARGET_IDS.at(-1)).toBe("builtin:jumper-plate-1x2");

    const currentExactLDrawMeshIds = PART_DEFINITIONS.filter(
      ({ geometry }) =>
        geometry.generatorId === "builtin:preloaded-mesh-reference/1" &&
        /^ldraw:(?:official|unofficial):[a-z0-9._-]+$/u.test(geometry.provenance.sourceId),
    ).map(({ id }) => id);
    expect([...PART_VISUAL_ADMISSION_EXPLICIT_TARGET_IDS].sort()).toEqual(
      currentExactLDrawMeshIds.sort(),
    );
  });

  it("does not turn a plausible future promotion into capture authority", () => {
    expect(PART_VISUAL_ADMISSION_EXPLICIT_TARGET_IDS).not.toContain(
      "builtin:future-measured-promotion",
    );
  });
});
