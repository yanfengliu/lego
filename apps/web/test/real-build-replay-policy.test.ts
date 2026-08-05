import { describe, expect, it } from "vitest";

import { encodeBoundedJson } from "../e2e/bounded-json";

import {
  assertReplayDeclaredBudgets,
  MAXIMUM_REPLAY_ROLE_COUNT,
  MAXIMUM_REPLAY_SOURCE_FILE_BYTES,
} from "../e2e/real-build-replay-policy";
import { INSTRUCTION_PDF_LIMITS } from "../src/instructions/instruction-source";
import {
  BUILDER_GEOMETRY_EXACT_BYTES,
  CALIBRATION_JSON_MAXIMUM_BYTES,
  HIGHLIGHT_COMPATIBILITY_ROLE_MAXIMUM_BYTES,
  OFFICIAL_MODEL_MAXIMUM_BYTES,
  REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES,
} from "../e2e/real-build-input-limits";
import { materializeRealBuildSourceMirror } from "../e2e/real-build-replay-files";

describe("real-build replay resource policy", () => {
  it("copies special JSON keys without prototype mutation and refuses accessor arrays", () => {
    const input = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(input, "__proto__", {
      value: { retained: true },
      enumerable: true,
    });
    const parsed = JSON.parse(
      encodeBoundedJson(input, 1024, "bounded JSON").toString("utf8"),
    ) as Record<string, unknown>;
    expect(Object.hasOwn(parsed, "__proto__")).toBe(true);
    expect(parsed.__proto__).toEqual({ retained: true });

    let accessed = false;
    const accessorArray: unknown[] = [];
    Object.defineProperty(accessorArray, "0", {
      get: () => {
        accessed = true;
        return "unexpected";
      },
      enumerable: true,
    });
    accessorArray.length = 1;
    expect(() => encodeBoundedJson(accessorArray, 1024, "bounded JSON")).toThrow(
      /array index 0 may not be an accessor/u,
    );
    expect(accessed).toBe(false);
  });

  it("shares every live raw-role maximum with replay verification", () => {
    expect(HIGHLIGHT_COMPATIBILITY_ROLE_MAXIMUM_BYTES).toBe(2_883_909);
    for (const [role, policy] of Object.entries(REAL_BUILD_RAW_REPLAY_ROLE_BYTE_POLICIES)) {
      expect(() =>
        assertReplayDeclaredBudgets({
          roles: [{ role, bytes: policy.maximumBytes }],
          sources: [],
        }),
      ).not.toThrow();
      expect(() =>
        assertReplayDeclaredBudgets({
          roles: [{ role, bytes: policy.maximumBytes + 1 }],
          sources: [],
        }),
      ).toThrow(new RegExp(`${role}.*role-specific requirement`, "u"));
      if ("allowEmpty" in policy && policy.allowEmpty === true) {
        expect(() =>
          assertReplayDeclaredBudgets({
            roles: [{ role, bytes: 0 }],
            sources: [],
            allowRejectedInputPlaceholders: true,
          }),
        ).not.toThrow();
      }
    }
  });

  it("enforces role-specific byte ceilings before CAS access", () => {
    expect(() =>
      assertReplayDeclaredBudgets({
        roles: [{ role: "builder-calibration", bytes: CALIBRATION_JSON_MAXIMUM_BYTES + 1 }],
        sources: [],
      }),
    ).toThrow(/builder-calibration.*role-specific requirement/u);
    expect(() =>
      assertReplayDeclaredBudgets({
        roles: [{ role: "official-model", bytes: OFFICIAL_MODEL_MAXIMUM_BYTES + 1 }],
        sources: [],
      }),
    ).toThrow(/official-model.*role-specific requirement/u);
  });

  it("requires the exact live Builder geometry byte length", () => {
    expect(() =>
      assertReplayDeclaredBudgets({
        roles: [{ role: "builder-geometry", bytes: BUILDER_GEOMETRY_EXACT_BYTES - 1 }],
        sources: [],
      }),
    ).toThrow(/builder-geometry.*exactly 122688/u);
    expect(() =>
      assertReplayDeclaredBudgets({
        roles: [{ role: "builder-geometry", bytes: BUILDER_GEOMETRY_EXACT_BYTES }],
        sources: [],
      }),
    ).not.toThrow();
    expect(() =>
      assertReplayDeclaredBudgets({
        roles: [{ role: "builder-geometry", bytes: 0 }],
        sources: [],
        allowRejectedInputPlaceholders: true,
      }),
    ).not.toThrow();
    for (const role of ["official-model", "builder-geometry"] as const) {
      expect(() =>
        assertReplayDeclaredBudgets({ roles: [{ role, bytes: 0 }], sources: [] }),
      ).toThrow(new RegExp(`${role}.*role-specific requirement`, "u"));
    }
  });

  it("bounds aggregate retained role and source bytes", () => {
    expect(() =>
      assertReplayDeclaredBudgets({
        roles: Array.from({ length: 6 }, () => ({ role: "pdf", bytes: 96 * 1024 * 1024 })),
        sources: [],
      }),
    ).toThrow(/aggregate bytes/u);
    expect(() =>
      assertReplayDeclaredBudgets({
        roles: [],
        sources: Array.from({ length: 5 }, (_, index) => ({
          path: `source-${index}.ts`,
          bytes: 64 * 1024 * 1024,
        })),
      }),
    ).toThrow(/sources declare.*aggregate bytes/u);
  });

  it("keeps fixed replay sources large enough for every live-admissible booklet", () => {
    expect(MAXIMUM_REPLAY_SOURCE_FILE_BYTES).toBe(INSTRUCTION_PDF_LIMITS.maxBytes);
    expect(() =>
      assertReplayDeclaredBudgets({
        roles: [],
        sources: [{ path: "inputs/booklet.pdf", bytes: INSTRUCTION_PDF_LIMITS.maxBytes }],
      }),
    ).not.toThrow();
    expect(() =>
      assertReplayDeclaredBudgets({
        roles: [],
        sources: [{ path: "inputs/booklet.pdf", bytes: INSTRUCTION_PDF_LIMITS.maxBytes + 1 }],
      }),
    ).toThrow(/each source is limited/u);
  });

  it("bounds retained role verification work", () => {
    expect(() =>
      assertReplayDeclaredBudgets({
        roles: Array.from({ length: MAXIMUM_REPLAY_ROLE_COUNT + 1 }, () => ({
          role: "environment",
          bytes: 0,
        })),
        sources: [],
      }),
    ).toThrow(/closed policy permits at most/u);
  });

  it("rejects unbounded fixed mirror work before creating output", () => {
    const fixedInputs = Array.from({ length: 10_021 }, (_, index) => ({
      path: `fixed/${index}.json`,
      bytes: new Uint8Array(),
    }));
    expect(() =>
      materializeRealBuildSourceMirror({
        directory: "output/must-not-be-created",
        repoRoot: process.cwd(),
        sourceFiles: [],
        fixedInputs,
      }),
    ).toThrow(/10021 fixed inputs.*work maximum is 10020/u);
  });
});
