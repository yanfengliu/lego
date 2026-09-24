import { PROPER_ORIENTATIONS } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import { canonicalDigest } from "./canonical.ts";
import { createBuiltinTruthSnapshot, getBuiltinTruthDigestInputs } from "./factory.ts";

describe("source-frame orientation infrastructure truth boundary", () => {
  it("binds the /29 part-scoped placement policy to all 24 proper source frames", () => {
    const digestInputs = getBuiltinTruthDigestInputs();
    const truth = createBuiltinTruthSnapshot();

    expect(PROPER_ORIENTATIONS).toHaveLength(24);
    expect(digestInputs.catalog.orientations).toBe(PROPER_ORIENTATIONS);
    expect(digestInputs.transformPolicy.orientations).toBe(PROPER_ORIENTATIONS);
    expect(truth).toEqual({
      schemaVersion: "lego.truth-snapshot/1",
      // /30 moved these three and left the /29 transform policy and validator
      // set byte-identical (truth-digest-stability.test.ts has the proof).
      catalog: {
        id: "builtin.basic-parts",
        version: "builtin.basic-parts/30",
        hash: "sha256:4662bd517d807a952bda5fc3964c02e34e0ae502255f747635b6c969fb564ebc",
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/2",
        hash: "sha256:73e50f5ea9f2ce529f241dae4e04dc99aeb2b57738c228d0844e5b30af66ceb2",
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: "rectilinear-stud-clearance/4",
        hash: "sha256:369f49834d2cfe26e5ab5650272baab6af40f01add2c93f542847c5b1b2c29c0",
      },
      transformPolicy: {
        id: "part-scoped-proper-orientations-negative-y-up",
        version: "part-scoped-proper-orientations-negative-y-up/1",
        hash: "sha256:44cf428cee1487a9441c609a75fbafefd6c3b4591512af30f8903e4508285f4c",
      },
      validatorSet: {
        id: "lego.kernel-validators",
        version: "lego.kernel-validators/5",
        hash: "sha256:44233e884c474210006e4e94b82e952fd7b446768396d5b53575eb7946cba4fe",
      },
    });
    expect(canonicalDigest(truth)).toBe(
      "sha256:cf2d67907369f85551055665b6df0f849dd978d2e63330130ec2d2db8f6ccc0b",
    );
  });
});
