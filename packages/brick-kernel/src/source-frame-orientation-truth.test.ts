import { PROPER_ORIENTATIONS } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import { canonicalDigest } from "./canonical.ts";
import { createBuiltinTruthSnapshot, getBuiltinTruthDigestInputs } from "./factory.ts";

describe("source-frame orientation infrastructure truth boundary", () => {
  it("binds the /30 part-scoped placement policy to all 24 proper source frames", () => {
    const digestInputs = getBuiltinTruthDigestInputs();
    const truth = createBuiltinTruthSnapshot();

    expect(PROPER_ORIENTATIONS).toHaveLength(24);
    expect(digestInputs.catalog.orientations).toBe(PROPER_ORIENTATIONS);
    expect(digestInputs.transformPolicy.orientations).toBe(PROPER_ORIENTATIONS);
    expect(truth).toEqual({
      schemaVersion: "lego.truth-snapshot/1",
      catalog: {
        id: "builtin.basic-parts",
        version: "builtin.basic-parts/30",
        hash: "sha256:a030be3e20eeb1592594c43e321be64ac2f84875c40ad2445c48ca9e104ef290",
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/2",
        hash: "sha256:b83c1c675ff2f4eef185c75a98a246f6269c427f859c2a8a691fb849eb3f04a6",
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: "rectilinear-stud-clearance/4",
        hash: "sha256:c9afee2441ed98dc811143ea00223a770acff67de794f24f9dc84d626c033c64",
      },
      transformPolicy: {
        id: "part-scoped-proper-orientations-negative-y-up",
        version: "part-scoped-proper-orientations-negative-y-up/2",
        hash: "sha256:352a78b04999c0e0e8b2b322e5ce748582e7f544676e181ec41600232d85ead6",
      },
      validatorSet: {
        id: "lego.kernel-validators",
        version: "lego.kernel-validators/5",
        hash: "sha256:44233e884c474210006e4e94b82e952fd7b446768396d5b53575eb7946cba4fe",
      },
    });
    expect(canonicalDigest(truth)).toBe(
      "sha256:c304c3eb673e86d48580c6b28309f1fdf8bf4d71f7259ecc75f6f5691a336d51",
    );
  });
});
