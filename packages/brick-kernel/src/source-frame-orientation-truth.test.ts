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
      // /31 moved the catalog and collision model and left the /30 connector
      // taxonomy, transform policy and validator set byte-identical
      // (truth-digest-stability.test.ts has the proof).
      catalog: {
        id: "builtin.basic-parts",
        version: "builtin.basic-parts/31",
        hash: "sha256:b0ec0baddbd165ef1c821097ad31388bd4515c233236f833a2364265578feaf2",
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/2",
        hash: "sha256:73e50f5ea9f2ce529f241dae4e04dc99aeb2b57738c228d0844e5b30af66ceb2",
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: "rectilinear-stud-clearance/4",
        hash: "sha256:878ed40921b671888228a13a747fa7836eaba50adab2319a2050130360e6211a",
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
      "sha256:b2ca21fb0fefefa18c17229cdcf1235475031bc2892d5d514103d45473a7d474",
    );
  });
});
