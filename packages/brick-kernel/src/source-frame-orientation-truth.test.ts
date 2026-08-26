import { PROPER_ORIENTATIONS, UPRIGHT_ORIENTATIONS } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import { canonicalDigest } from "./canonical.ts";
import { createBuiltinTruthSnapshot, getBuiltinTruthDigestInputs } from "./factory.ts";

describe("source-frame orientation infrastructure truth boundary", () => {
  it("keeps placement truth upright while /27 exposes 24 source frames", () => {
    const digestInputs = getBuiltinTruthDigestInputs();
    const truth = createBuiltinTruthSnapshot();

    expect(PROPER_ORIENTATIONS).toHaveLength(24);
    expect(digestInputs.catalog.orientations).toBe(UPRIGHT_ORIENTATIONS);
    expect(digestInputs.transformPolicy.orientations).toBe(UPRIGHT_ORIENTATIONS);
    expect(truth).toEqual({
      schemaVersion: "lego.truth-snapshot/1",
      catalog: {
        id: "builtin.basic-parts",
        version: "builtin.basic-parts/27",
        hash: "sha256:ffb0eb6e68edcb91298b04a3c899a11417b70b07aac062c42f4c1051c20f50ee",
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/1",
        hash: "sha256:5153c1c3d58db63962698768885c0630b1c2c926a220e5895e7d55442ebbc7f1",
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: "rectilinear-stud-clearance/3",
        hash: "sha256:1e727bf61b482bcaf8587f44175e46238926126de241ae0248a5e23b942118bd",
      },
      transformPolicy: {
        id: "upright-quarter-turns-negative-y-up",
        version: "upright-quarter-turns-negative-y-up/1",
        hash: "sha256:ec8ce034cb7f39169783692259ec25bb028b95bce6d456917f88bd9bebebb03d",
      },
      validatorSet: {
        id: "lego.kernel-validators",
        version: "lego.kernel-validators/4",
        hash: "sha256:ac785c8f5ac9f2d642bf53c8ef51764b7954c981355b1d7d508a2228a5f1bf55",
      },
    });
    expect(canonicalDigest(truth)).toBe(
      "sha256:614c61787b6c45d645e3e84c71dd931a15c258535a1959ee4b3aa1906303b70f",
    );
  });
});
