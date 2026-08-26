import { BUILTIN_CATALOG_VERSION } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import { createBuilderFrameEvidence } from "../e2e/real-build-builder-calibration";
import { BUILDER_STEP1_DESIGN_SOURCES } from "../e2e/real-build-builder-sources";
import {
  describeRealBuildInputChain,
  REAL_BUILD_INPUT_CHAIN,
  REAL_BUILD_INPUT_CHAIN_ENTRY_POINT,
  realBuildInputChainRecovery,
} from "../e2e/real-build-input-chain";
import { sha256Digest } from "../e2e/real-build-artifacts";

/**
 * The staleness chain has to keep saying what would fix it.
 *
 * Three sessions in one day lost time to a catalog bump that left a derived
 * real-build input correct-looking and stale, and the rejection named only what
 * differed. These cases fail if a rejection stops naming the mismatch, the
 * command, or the ordering constraint — the three things that turn "somebody
 * else's problem" back into a work item.
 */

describe("real-build input chain", () => {
  it("declares a gapless order, and every stage names its artifact and its command", () => {
    expect(REAL_BUILD_INPUT_CHAIN.map(({ order }) => order)).toEqual(
      REAL_BUILD_INPUT_CHAIN.map((_, index) => index + 1),
    );
    for (const stage of REAL_BUILD_INPUT_CHAIN) {
      expect(stage.artifact.length).toBeGreaterThan(0);
      expect(stage.command.length).toBeGreaterThan(0);
      expect(stage.derivedFrom.length).toBeGreaterThan(0);
      expect(describeRealBuildInputChain()).toContain(stage.artifact);
      expect(describeRealBuildInputChain()).toContain(stage.command);
    }
    // The ledger is last: it binds the digests of everything above it.
    expect(REAL_BUILD_INPUT_CHAIN.at(-1)?.artifact).toBe("output/real-build/action-ledger.json");
    expect(REAL_BUILD_INPUT_CHAIN.at(-1)?.command).toContain("LEGO_REAL_BUILD_LAST_STEP=<1..359>");
    expect(REAL_BUILD_INPUT_CHAIN_ENTRY_POINT).toContain("LEGO_REAL_BUILD_LAST_STEP=<1..359>");
    expect(REAL_BUILD_INPUT_CHAIN[1]?.command).toContain("--last-step <1..359>");
  });

  it("recovers a later stage by naming its command, its order, and every earlier stage", () => {
    const recovery = realBuildInputChainRecovery("output/real-build/action-ledger.json");
    expect(recovery).toContain("real-build-action-ledger.spec.ts");
    expect(recovery).toContain(REAL_BUILD_INPUT_CHAIN_ENTRY_POINT);
    expect(recovery).toContain("must not be rebuilt before");
    for (const stage of REAL_BUILD_INPUT_CHAIN.filter(({ order }) => order < 4)) {
      expect(recovery).toContain(stage.artifact);
    }
  });

  it("says nothing precedes the first stage rather than inventing an ordering", () => {
    const recovery = realBuildInputChainRecovery(REAL_BUILD_INPUT_CHAIN[0]!.artifact);
    expect(recovery).toContain("nothing has to be rebuilt before it");
    expect(recovery).not.toContain("must not be rebuilt before");
  });

  it("refuses an artifact that is not a declared stage, and says what to add", () => {
    expect(() => realBuildInputChainRecovery("output/real-build/not-a-stage.json")).toThrow(
      /not a declared real-build input-chain stage.*ordinal.*exact command/su,
    );
  });
});

describe("stale pinned Builder source", () => {
  it("names the differing digests, the catalog it is stale against, and the fix", () => {
    const base = BUILDER_STEP1_DESIGN_SOURCES[0]!;
    const stale = {
      ...base,
      expectedCatalogDefinitionDigest: sha256Digest("a superseded catalog definition"),
    } as typeof base;
    let message = "";
    try {
      createBuilderFrameEvidence({
        source: stale,
        builderGeometryBundleBytes: new Uint8Array(0),
        builderGeometryBundleDigest: sha256Digest(new Uint8Array(0)),
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    // What happened, and which input caused it.
    expect(message).toContain(base.designRevision);
    expect(message).toContain(base.catalogPartId);
    expect(message).toContain(BUILTIN_CATALOG_VERSION);
    expect(message).toContain("definition");
    expect(message).toContain(sha256Digest("a superseded catalog definition"));
    // What would satisfy it, and in what order.
    expect(message).toContain("BUILDER_STEP1_DESIGN_SOURCES");
    expect(message).toContain(REAL_BUILD_INPUT_CHAIN_ENTRY_POINT);
    expect(message).toContain("nothing has to be rebuilt before it");
  });
});
