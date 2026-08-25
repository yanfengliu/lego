import { CONNECTOR_PAIR_RULES, PART_DEFINITIONS } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import {
  connectionEndpointKey,
  projectConnectionSemantics,
} from "./connection-semantics-projection.ts";
import {
  CURRENT_CONNECTION_SEMANTICS_AUTHORITY,
  REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH,
  historicalConnectionSemanticsBlockingReasons,
} from "./historical-connection-semantics.ts";
import { REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS } from "./migration.ts";
import {
  REVIEWED_TRUTH_V1,
  documentAtReviewedTruth,
} from "./migration-historical-fixtures.test-support.ts";

describe("reviewed historical connection semantics", () => {
  it("binds all 27 reviewed truths to immutable exhaustive authority rows", () => {
    const truthHashes = REVIEWED_HISTORICAL_TRUTH_SNAPSHOTS.map(({ truthHash }) => truthHash);
    const rows = Object.entries(REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH);

    expect(rows.map(([truthHash]) => truthHash)).toEqual(truthHashes);
    expect(Object.isFrozen(REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH)).toBe(true);
    expect(rows.every(([, row]) => Object.isFrozen(row))).toBe(true);
    expect(rows.reduce((count, [, row]) => count + row.endpointDeltas.length, 0)).toBe(22);
    expect(rows.flatMap(([, row]) => row.pairDeltas)).toEqual([]);
    for (const [, row] of rows) {
      const keys = row.endpointDeltas.map(({ partId, portId }) =>
        connectionEndpointKey(partId, portId),
      );
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("pins the complete /19 connector authority that /20 extends additively", () => {
    expect(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:e34fcc8ac627f0dcfdb1d779246a723101d765f931830a4c06514d9daff75c26"
      ],
    ).toEqual({
      sourceCommit: "a49137131566247daeb01d80ff88302b41bcf538",
      sourceEndpointCount: 2262,
      sourceEndpointMapDigest:
        "sha256:4224f8ca202557d357bd4c7a94707fc9d3e58617e2d87a8e8e16059d516a58ba",
      sourcePairCount: 3,
      sourcePairMapDigest:
        "sha256:7431a242907aa9829ead6a279d0b530fe5f5d00ee31e6ddc1576fe66a8a07add",
      endpointDeltas: [],
      pairDeltas: [],
    });
  });

  it("pins the complete /20 connector authority that /21 extends additively", () => {
    expect(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:9c4c32efcaf9bc5f2a251e77188134075f58ca536c6da6148e34b93419d84ad2"
      ],
    ).toEqual({
      sourceCommit: "e037b7e60e1240ddf196d381850ae49bc8c80e9b",
      sourceEndpointCount: 2266,
      sourceEndpointMapDigest:
        "sha256:863b65218ceb2522510b7bf2e52f4cd9749c7b87fc5979499b9ef191523f6799",
      sourcePairCount: 3,
      sourcePairMapDigest:
        "sha256:7431a242907aa9829ead6a279d0b530fe5f5d00ee31e6ddc1576fe66a8a07add",
      endpointDeltas: [],
      pairDeltas: [],
    });
  });

  it("pins the complete /21 connector authority that /22 extends additively", () => {
    expect(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:44044c90de3bb380f32c26db561bad1bd0f247c22ea35c54d75aa5ec6ef8f9a1"
      ],
    ).toEqual({
      sourceCommit: "98dc1e82b309eb52a6a32e0928ce075acb3e93ed",
      sourceEndpointCount: 2269,
      sourceEndpointMapDigest:
        "sha256:f84f1e0ec3e1d628b1bd49d869e6b9f3dbdb9d95be87b2fa81b396a566462d2b",
      sourcePairCount: 3,
      sourcePairMapDigest:
        "sha256:7431a242907aa9829ead6a279d0b530fe5f5d00ee31e6ddc1576fe66a8a07add",
      endpointDeltas: [],
      pairDeltas: [],
    });
  });

  it("pins the complete /22 connector authority that /23 extends additively", () => {
    expect(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:7f64021239ab6395a3666f1f72908fd420b73065909822bc68e5226785bfa12e"
      ],
    ).toEqual({
      sourceCommit: "94db468e6a5045a0a7732f8f4adc128e90f025b6",
      sourceEndpointCount: 2272,
      sourceEndpointMapDigest:
        "sha256:006157a4816e7dc9a001b0c15a7c2e45fdbaeb611142b428458457f2ea4b8ff2",
      sourcePairCount: 3,
      sourcePairMapDigest:
        "sha256:7431a242907aa9829ead6a279d0b530fe5f5d00ee31e6ddc1576fe66a8a07add",
      endpointDeltas: [],
      pairDeltas: [],
    });
  });

  it("pins the complete /23 connector authority that /24 extends additively", () => {
    expect(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:af781e7356e28622fb13afcb571d28495a0962d6aa78ef70d988126a9c4aeefb"
      ],
    ).toEqual({
      sourceCommit: "d99b74d355684c8ceaca0ad6f2df76d96ebe4937",
      sourceEndpointCount: 2277,
      sourceEndpointMapDigest:
        "sha256:5c441a333206827791b01f59643c145102ddf28d1410667d183fadafc0d0d84c",
      sourcePairCount: 3,
      sourcePairMapDigest:
        "sha256:7431a242907aa9829ead6a279d0b530fe5f5d00ee31e6ddc1576fe66a8a07add",
      endpointDeltas: [],
      pairDeltas: [],
    });
  });

  it("pins the complete /24 connector authority that /25 extends additively", () => {
    expect(
      REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH[
        "sha256:09288fc048ec112225b9e605df7af2d2e9692031b9eb7a89755575956af4c10d"
      ],
    ).toEqual({
      sourceCommit: "ec2387bf8b3b1a8d70a11e95c6c6547049037886",
      sourceEndpointCount: 2295,
      sourceEndpointMapDigest:
        "sha256:6dfd3657c9d4d3af8815fa6dad9cb2906416436239a07cfdcb968932b90f2ab1",
      sourcePairCount: 3,
      sourcePairMapDigest:
        "sha256:7431a242907aa9829ead6a279d0b530fe5f5d00ee31e6ddc1576fe66a8a07add",
      endpointDeltas: [],
      pairDeltas: [],
    });
  });

  it("pins the complete live target and every delta's target endpoint", () => {
    const live = projectConnectionSemantics(PART_DEFINITIONS, CONNECTOR_PAIR_RULES, "live-strict");

    expect({
      endpointCount: live.endpointCount,
      endpointMapDigest: live.endpointMapDigest,
      pairCount: live.pairCount,
      pairMapDigest: live.pairMapDigest,
    }).toEqual({
      endpointCount: CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointCount,
      endpointMapDigest: CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest,
      pairCount: CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairCount,
      pairMapDigest: CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairMapDigest,
    });
    for (const row of Object.values(REVIEWED_HISTORICAL_CONNECTION_SEMANTICS_BY_TRUTH_HASH)) {
      for (const delta of row.endpointDeltas) {
        expect(
          live.endpointDigests.get(connectionEndpointKey(delta.partId, delta.portId)) ?? null,
        ).toBe(delta.targetDigest);
      }
    }
  });

  it("fails closed when the live target no longer matches its reviewed projection", () => {
    const historical = documentAtReviewedTruth({
      id: "target-drift",
      name: "Target drift",
      truth: REVIEWED_TRUTH_V1,
    });
    const truncatedTarget = projectConnectionSemantics(
      PART_DEFINITIONS.slice(0, -1),
      CONNECTOR_PAIR_RULES,
      "live-strict",
    );

    expect(
      historicalConnectionSemanticsBlockingReasons(
        historical,
        "sha256:0f6b9dcb03a9dd570b4ccc68f41a015bb33422e5cf6c1fe032f1a15bfbd76a8a",
        CURRENT_CONNECTION_SEMANTICS_AUTHORITY.truthHash,
        truncatedTarget,
      ),
    ).toEqual([
      `Current connector endpoint projection is ${truncatedTarget.endpointCount}/${truncatedTarget.endpointMapDigest}, expected ${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointCount}/${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest}; run npm run migration-history:check and review the complete delta`,
    ]);
  });

  it("does not normalize a missing live connector gender into the reviewed target", () => {
    const mutatedParts = structuredClone(PART_DEFINITIONS) as unknown as {
      id: string;
      connectors: { id: string; gender?: unknown }[];
    }[];
    const brick = mutatedParts.find(({ id }) => id === "builtin:brick-1x1")!;
    const stud = brick.connectors.find(({ id }) => id === "stud:0:0")!;
    delete stud.gender;
    const mutatedTarget = projectConnectionSemantics(
      mutatedParts as unknown as typeof PART_DEFINITIONS,
      CONNECTOR_PAIR_RULES,
      "live-strict",
    );
    const historical = documentAtReviewedTruth({
      id: "missing-live-gender",
      name: "Missing live gender",
      truth: REVIEWED_TRUTH_V1,
    });

    expect(mutatedTarget.endpointMapDigest).not.toBe(
      CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest,
    );
    expect(
      historicalConnectionSemanticsBlockingReasons(
        historical,
        "sha256:0f6b9dcb03a9dd570b4ccc68f41a015bb33422e5cf6c1fe032f1a15bfbd76a8a",
        CURRENT_CONNECTION_SEMANTICS_AUTHORITY.truthHash,
        mutatedTarget,
      ),
    ).toEqual([
      `Current connector endpoint projection is ${mutatedTarget.endpointCount}/${mutatedTarget.endpointMapDigest}, expected ${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointCount}/${CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest}; run npm run migration-history:check and review the complete delta`,
    ]);
  });

  it("includes future connector fields in the live endpoint authority", () => {
    const mutatedParts = structuredClone(PART_DEFINITIONS) as unknown as {
      id: string;
      connectors: (Record<string, unknown> & { id: string })[];
    }[];
    const brick = mutatedParts.find(({ id }) => id === "builtin:brick-1x1")!;
    const stud = brick.connectors.find(({ id }) => id === "stud:0:0")!;
    stud.futureRuntimeSemantics = "must-move-the-root";

    const mutatedTarget = projectConnectionSemantics(
      mutatedParts as unknown as typeof PART_DEFINITIONS,
      CONNECTOR_PAIR_RULES,
      "live-strict",
    );

    expect(mutatedTarget.endpointMapDigest).not.toBe(
      CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest,
    );
    expect(mutatedTarget.pairMapDigest).toBe(CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairMapDigest);
  });

  it("deep-freezes live pair rows and distinguishes a missing live axis rule", () => {
    const firstRule = CONNECTOR_PAIR_RULES[0]!;
    const originalAxis = firstRule.axisMatching;
    expect(Object.isFrozen(firstRule)).toBe(true);
    expect(Reflect.set(firstRule, "axisMatching", "collinear")).toBe(false);
    expect(firstRule.axisMatching).toBe(originalAxis);

    const rulesWithoutAxis = CONNECTOR_PAIR_RULES.map((rule, index) => {
      if (index !== 0) return rule;
      const withoutAxis = { ...rule } as Record<string, unknown>;
      delete withoutAxis.axisMatching;
      return withoutAxis;
    });
    const mutatedTarget = projectConnectionSemantics(
      PART_DEFINITIONS,
      rulesWithoutAxis as unknown as typeof CONNECTOR_PAIR_RULES,
      "live-strict",
    );

    expect(mutatedTarget.endpointMapDigest).not.toBe(
      CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest,
    );
    expect(mutatedTarget.pairMapDigest).not.toBe(
      CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairMapDigest,
    );
  });

  it("includes future pair-rule fields in both live authorities", () => {
    const mutatedRules = structuredClone(CONNECTOR_PAIR_RULES) as unknown as Record<
      string,
      unknown
    >[];
    mutatedRules[0]!.futureRuntimeSemantics = "must-move-both-roots";

    const mutatedTarget = projectConnectionSemantics(
      PART_DEFINITIONS,
      mutatedRules as unknown as typeof CONNECTOR_PAIR_RULES,
      "live-strict",
    );

    expect(mutatedTarget.endpointMapDigest).not.toBe(
      CURRENT_CONNECTION_SEMANTICS_AUTHORITY.endpointMapDigest,
    );
    expect(mutatedTarget.pairMapDigest).not.toBe(
      CURRENT_CONNECTION_SEMANTICS_AUTHORITY.pairMapDigest,
    );
  });
});
