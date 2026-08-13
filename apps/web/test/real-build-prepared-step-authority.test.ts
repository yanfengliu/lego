import { describe, expect, it } from "vitest";

import {
  inspectRealBuildPreparedStepInput,
  MAXIMUM_REAL_BUILD_PREPARED_RUN_INPUT_BYTES,
  requireRealBuildPreparedStepAuthority,
  requireRealBuildPreparedStepInspection,
} from "../e2e/real-build-prepared-step-authority";
import {
  preparedSearchOptions,
  preparedSearchOptionsBytes,
} from "./real-build-prepared-search.fixture";

describe("prepared real-build step prerequisite", () => {
  it("derives exact ordered physical identities from complete preflight-valid run bytes", () => {
    const inspection = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(2), 2);

    expect(inspection).toMatchObject({
      stepNumber: 2,
      authority: "absent",
      expectedAtomicPieces: [
        {
          identityKey: "direct-0",
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:black",
        },
        {
          identityKey: "direct-1",
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:black",
        },
      ],
    });
    expect(inspection.preparedRunInputDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(inspection.printedStepIdentity).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(Object.isFrozen(inspection)).toBe(true);
    expect(Object.isFrozen(inspection.expectedAtomicPieces)).toBe(true);
    expect(requireRealBuildPreparedStepInspection(inspection)).toBe(inspection);
  });

  it("binds full prepared input and the exact panel rather than a caller label", () => {
    const original = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(), 2);
    const mutated = preparedSearchOptions();
    const first = mutated.panels[1]!.pieces[0]!;
    const panels = [...mutated.panels];
    panels[1] = {
      ...panels[1]!,
      pieces: [{ ...first, identityKey: "direct-renamed" }],
    };
    const changed = inspectRealBuildPreparedStepInput(
      new TextEncoder().encode(JSON.stringify({ ...mutated, panels })),
      2,
    );

    expect(changed.expectedAtomicPieces[0]!.identityKey).toBe("direct-renamed");
    expect(changed.printedStepIdentity).not.toBe(original.printedStepIdentity);
    expect(changed.preparedRunInputDigest).not.toBe(original.preparedRunInputDigest);
  });

  it("keeps successful authority issuance unavailable to caller-authored run bytes", () => {
    const inspection = inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(), 2);

    expect(() => requireRealBuildPreparedStepAuthority(inspection)).toThrow(
      /private result of bounded run-input preflight/u,
    );
    expect(() =>
      requireRealBuildPreparedStepAuthority({
        ...inspection,
        authority: true,
      }),
    ).toThrow(/private result/u);
  });

  it("refuses non-bytes, hostile typed-array wrappers, and oversize before decoding", () => {
    let traps = 0;
    const hostile = new Proxy(preparedSearchOptionsBytes(), {
      get() {
        traps += 1;
        throw new Error("must remain inert");
      },
      ownKeys() {
        traps += 1;
        throw new Error("must remain inert");
      },
    });
    expect(() => inspectRealBuildPreparedStepInput(hostile, 2)).toThrow(/genuine Uint8Array/u);
    expect(traps).toBe(0);
    expect(() => inspectRealBuildPreparedStepInput({}, 2)).toThrow(/genuine Uint8Array/u);
    expect(() =>
      inspectRealBuildPreparedStepInput(
        new Uint8Array(MAXIMUM_REAL_BUILD_PREPARED_RUN_INPUT_BYTES + 1),
        2,
      ),
    ).toThrow(/no text was decoded or parsed/u);
  });

  it("refuses unsupported panels and invalid complete run preparation", () => {
    expect(() => inspectRealBuildPreparedStepInput(preparedSearchOptionsBytes(), 3)).toThrow(
      /currently admits only exact place-callouts/u,
    );
    const options = preparedSearchOptions();
    expect(() =>
      inspectRealBuildPreparedStepInput(
        new TextEncoder().encode(JSON.stringify({ ...options, panelCameraBranchBudget: 7 })),
        2,
      ),
    ).toThrow(/failed deterministic preflight/u);
  });

  it("bounds unknown JSON depth and structural expansion before parsing", () => {
    const deep = new TextEncoder().encode(`{"unknown":${"[".repeat(129)}0${"]".repeat(129)}}`);
    expect(() => inspectRealBuildPreparedStepInput(deep, 2)).toThrow(
      /exceeds depth 128.*not parsed/u,
    );

    const expanded = new TextEncoder().encode(`{"unknown":[${"0,".repeat(2_000_000)}0]}`);
    expect(() => inspectRealBuildPreparedStepInput(expanded, 2)).toThrow(
      /exceeds 2000000 structural values.*not parsed/u,
    );
  });
});
