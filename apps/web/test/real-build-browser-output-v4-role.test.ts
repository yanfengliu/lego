import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  inspectRealBuildBrowserBranchEvidenceV1,
  MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES,
} from "../e2e/real-build-browser-output-v4-role";

const encoder = new TextEncoder();
const EMPTY_DIGEST = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function digest(value: Uint8Array): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function jsonBytes(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

function fixture() {
  const lineage1 = encoder.encode('{"lineage":1}');
  const closure1 = encoder.encode('{"closure":1}');
  const lineage3 = encoder.encode('{"lineage":3}');
  const observation1 = Uint8Array.of(0x80, 0x40, 0x20);
  const compiled = concat(lineage1, closure1, lineage3);
  const observations = observation1.slice();
  const branchEvidence = {
    schemaVersion: "lego.real-build-browser-branch-evidence/1",
    compiledBranchRole: {
      role: "compiled-branch-evidence-bytes",
      bytes: compiled.length,
      digest: digest(compiled),
    },
    observationRole: {
      role: "branch-observation-bytes",
      bytes: observations.length,
      digest: digest(observations),
    },
    steps: [
      {
        stepNumber: 1,
        compiledLineage: {
          role: "compiled-branch-evidence-bytes",
          offset: 0,
          bytes: lineage1.length,
          digest: digest(lineage1),
          encoding: "utf8-json/1",
        },
        observationClosure: {
          role: "compiled-branch-evidence-bytes",
          offset: lineage1.length,
          bytes: closure1.length,
          digest: digest(closure1),
          encoding: "utf8-json/1",
        },
        observations: {
          role: "branch-observation-bytes",
          offset: 0,
          bytes: observation1.length,
          digest: digest(observation1),
          encoding: "raw-bytes/1",
        },
      },
      {
        stepNumber: 3,
        compiledLineage: {
          role: "compiled-branch-evidence-bytes",
          offset: lineage1.length + closure1.length,
          bytes: lineage3.length,
          digest: digest(lineage3),
          encoding: "utf8-json/1",
        },
        observationClosure: null,
        observations: null,
      },
    ],
  };
  return { branchEvidence, compiled, observations };
}

function inspect(input = fixture()) {
  return inspectRealBuildBrowserBranchEvidenceV1(
    jsonBytes(input.branchEvidence),
    input.compiled,
    input.observations,
  );
}

describe("browser-output /4 branch role transport", () => {
  it("verifies ordered digest-bound references without interpreting their semantic JSON", () => {
    const source = fixture();
    const inspected = inspect(source);
    expect(inspected.steps.map(({ stepNumber }) => stepNumber)).toEqual([1, 3]);
    expect(inspected.compiledBranchRole.digest).toBe(digest(source.compiled));
    expect(Object.isFrozen(inspected)).toBe(true);
    expect(Object.isFrozen(inspected.steps)).toBe(true);
    expect(Object.isFrozen(inspected.steps[0]!.compiledLineage)).toBe(true);
  });

  it("admits an exact empty pre-execution role pair only with the empty digest", () => {
    const empty = {
      schemaVersion: "lego.real-build-browser-branch-evidence/1",
      compiledBranchRole: {
        role: "compiled-branch-evidence-bytes",
        bytes: 0,
        digest: EMPTY_DIGEST,
      },
      observationRole: { role: "branch-observation-bytes", bytes: 0, digest: EMPTY_DIGEST },
      steps: [],
    };
    expect(
      inspectRealBuildBrowserBranchEvidenceV1(jsonBytes(empty), new Uint8Array(), new Uint8Array())
        .steps,
    ).toEqual([]);
    expect(() =>
      inspectRealBuildBrowserBranchEvidenceV1(
        jsonBytes({
          ...empty,
          compiledBranchRole: {
            ...empty.compiledBranchRole,
            digest: `sha256:${"0".repeat(64)}`,
          },
        }),
        new Uint8Array(),
        new Uint8Array(),
      ),
    ).toThrow(/hashes to .*descriptor pins/iu);
  });

  it("allows a retained closure with no raw observation role bytes", () => {
    const source = fixture();
    source.branchEvidence.steps[0]!.observations = null;
    source.branchEvidence.observationRole = {
      role: "branch-observation-bytes",
      bytes: 0,
      digest: EMPTY_DIGEST,
    };
    expect(
      inspectRealBuildBrowserBranchEvidenceV1(
        jsonBytes(source.branchEvidence),
        source.compiled,
        new Uint8Array(),
      ).steps[0]!.observationClosure,
    ).not.toBeNull();
  });

  it("refuses raw observations without their typed closure", () => {
    const source = fixture();
    source.branchEvidence.steps[0]!.observationClosure = null;
    expect(() => inspect(source)).toThrow(/cannot retain bytes without an observationClosure/iu);
  });

  it("refuses drift in the closed role and encoding vocabulary", () => {
    const wrongJsonEncoding = fixture();
    wrongJsonEncoding.branchEvidence.steps[0]!.compiledLineage.encoding = "raw-bytes/1";
    expect(() => inspect(wrongJsonEncoding)).toThrow(/encoding must be utf8-json\/1/iu);

    const wrongObservationRole = fixture();
    wrongObservationRole.branchEvidence.steps[0]!.observations!.role =
      "compiled-branch-evidence-bytes";
    expect(() => inspect(wrongObservationRole)).toThrow(/role must be branch-observation-bytes/iu);
  });

  it("applies semantic-parser byte ceilings to each referenced segment before role copying", () => {
    const oversizedLineage = fixture();
    oversizedLineage.branchEvidence.steps[0]!.compiledLineage.bytes = 64 * 1024 * 1024 + 1;
    expect(() => inspect(oversizedLineage)).toThrow(/1 through 67108864/iu);

    const oversizedClosure = fixture();
    oversizedClosure.branchEvidence.steps[0]!.observationClosure!.bytes = 16 * 1024 * 1024 + 1;
    expect(() => inspect(oversizedClosure)).toThrow(/1 through 16777216/iu);

    const oversizedObservations = fixture();
    oversizedObservations.branchEvidence.steps[0]!.observations!.bytes = 64 * 1024 * 1024 + 1;
    expect(() => inspect(oversizedObservations)).toThrow(/1 through 67108864/iu);
  });

  it("refuses malformed and accessor-backed index values without invoking caller hooks", () => {
    let reads = 0;
    const fake = Object.defineProperty({}, "length", {
      get() {
        reads += 1;
        return 0;
      },
    });
    const source = fixture();
    for (const value of [
      fake,
      new Uint16Array(),
      new Proxy(jsonBytes(source.branchEvidence), {}),
    ]) {
      expect(() =>
        inspectRealBuildBrowserBranchEvidenceV1(value, source.compiled, source.observations),
      ).toThrow(/genuine Uint8Array/iu);
    }
    expect(reads).toBe(0);
    expect(() =>
      inspectRealBuildBrowserBranchEvidenceV1(
        Uint8Array.of(0xc3, 0x28),
        source.compiled,
        source.observations,
      ),
    ).toThrow(/well-formed UTF-8/iu);
  });

  it("uses typed-array intrinsics without consulting a hostile species hook", () => {
    let speciesReads = 0;
    class HostileBytes extends Uint8Array {
      static get [Symbol.species]() {
        speciesReads += 1;
        throw new Error("species must not run");
      }
    }
    const source = fixture();
    const index = new HostileBytes(jsonBytes(source.branchEvidence));
    const compiled = new HostileBytes(source.compiled);
    const observations = new HostileBytes(source.observations);
    expect(
      inspectRealBuildBrowserBranchEvidenceV1(index, compiled, observations).steps,
    ).toHaveLength(2);
    expect(speciesReads).toBe(0);
  });

  it("refuses proxies, wrong typed-array kinds, shared storage, and detached storage for roles", () => {
    const source = fixture();
    const index = jsonBytes(source.branchEvidence);
    for (const value of [new Uint16Array(), new Proxy(source.compiled, {})]) {
      expect(() =>
        inspectRealBuildBrowserBranchEvidenceV1(index, value, source.observations),
      ).toThrow(/genuine Uint8Array/iu);
    }
    if (typeof SharedArrayBuffer !== "undefined") {
      expect(() =>
        inspectRealBuildBrowserBranchEvidenceV1(
          index,
          new Uint8Array(new SharedArrayBuffer(source.compiled.length)),
          source.observations,
        ),
      ).toThrow(/SharedArrayBuffer/iu);
    }
    const empty = new ArrayBuffer(0);
    const detached = new Uint8Array(empty);
    structuredClone(empty, { transfer: [empty] });
    const emptyIndex = jsonBytes({
      schemaVersion: "lego.real-build-browser-branch-evidence/1",
      compiledBranchRole: {
        role: "compiled-branch-evidence-bytes",
        bytes: 0,
        digest: EMPTY_DIGEST,
      },
      observationRole: { role: "branch-observation-bytes", bytes: 0, digest: EMPTY_DIGEST },
      steps: [],
    });
    expect(() =>
      inspectRealBuildBrowserBranchEvidenceV1(emptyIndex, detached, new Uint8Array()),
    ).toThrow(/detached|changed/iu);
  });

  it("refuses descriptor length, role digest, and reference digest drift", () => {
    const lengthDrift = fixture();
    lengthDrift.branchEvidence.compiledBranchRole.bytes -= 1;
    expect(() => inspect(lengthDrift)).toThrow(/contains .*descriptor declares/iu);

    const roleDrift = fixture();
    roleDrift.compiled[0] = roleDrift.compiled[0]! ^ 0xff;
    expect(() => inspect(roleDrift)).toThrow(/role hashes to .*descriptor pins/iu);

    const sliceDrift = fixture();
    sliceDrift.branchEvidence.steps[0]!.compiledLineage.digest = `sha256:${"0".repeat(64)}`;
    expect(() => inspect(sliceDrift)).toThrow(/reference 0 hashes to .*pins/iu);
  });

  it("refuses gaps, overlaps, reference reordering, and trailing unreferenced role bytes", () => {
    const gap = fixture();
    gap.branchEvidence.steps[0]!.observationClosure!.offset += 1;
    expect(() => inspect(gap)).toThrow(/ordered dense coverage requires/iu);

    const overlap = fixture();
    overlap.branchEvidence.steps[0]!.observationClosure!.offset -= 1;
    expect(() => inspect(overlap)).toThrow(/ordered dense coverage requires/iu);

    const reordered = fixture();
    reordered.branchEvidence.steps.reverse();
    expect(() => inspect(reordered)).toThrow(/strictly greater/iu);

    const trailing = fixture();
    trailing.compiled = concat(trailing.compiled, Uint8Array.of(0));
    trailing.branchEvidence.compiledBranchRole.bytes = trailing.compiled.length;
    trailing.branchEvidence.compiledBranchRole.digest = digest(trailing.compiled);
    expect(() => inspect(trailing)).toThrow(/exact dense role coverage/iu);

    const unreferenced = fixture();
    unreferenced.branchEvidence.steps = [];
    expect(() => inspect(unreferenced)).toThrow(/references cover 0 bytes/iu);
  });

  it("refuses duplicate or descending steps and more than 359 indexed steps", () => {
    const duplicate = fixture();
    duplicate.branchEvidence.steps[1]!.stepNumber = 1;
    expect(() => inspect(duplicate)).toThrow(/strictly greater/iu);

    const outOfRange = fixture();
    outOfRange.branchEvidence.steps[1]!.stepNumber = 360;
    expect(() => inspect(outOfRange)).toThrow(/1 through 359/iu);

    const source = fixture();
    source.branchEvidence.steps = Array.from({ length: 360 }, (_, index) => ({
      ...source.branchEvidence.steps[0]!,
      stepNumber: index + 1,
    }));
    expect(() => inspect(source)).toThrow(/0 through 359/iu);
  });

  it("preflights the declared aggregate ceiling before inspecting role contents", () => {
    const source = fixture();
    source.branchEvidence.compiledBranchRole.bytes = MAXIMUM_REAL_BUILD_BROWSER_BRANCH_ROLE_BYTES;
    source.branchEvidence.observationRole.bytes = 1;
    expect(() =>
      inspectRealBuildBrowserBranchEvidenceV1(
        jsonBytes(source.branchEvidence),
        new Proxy(source.compiled, {}),
        new Uint16Array(),
      ),
    ).toThrow(/declares .*combined maximum/iu);
  });

  it("normalizes negative zero numeric spellings before returning canonical metadata", () => {
    const emptyWithNegativeZero = encoder.encode(
      '{"schemaVersion":"lego.real-build-browser-branch-evidence/1","compiledBranchRole":{"role":"compiled-branch-evidence-bytes","bytes":-0,"digest":"' +
        EMPTY_DIGEST +
        '"},"observationRole":{"role":"branch-observation-bytes","bytes":-0,"digest":"' +
        EMPTY_DIGEST +
        '"},"steps":[]}',
    );
    const inspected = inspectRealBuildBrowserBranchEvidenceV1(
      emptyWithNegativeZero,
      new Uint8Array(),
      new Uint8Array(),
    );
    expect(Object.is(inspected.compiledBranchRole.bytes, -0)).toBe(false);
    expect(Object.is(inspected.observationRole.bytes, -0)).toBe(false);
  });

  it("returns metadata detached from later caller mutation", () => {
    const source = fixture();
    const index = jsonBytes(source.branchEvidence);
    const inspected = inspectRealBuildBrowserBranchEvidenceV1(
      index,
      source.compiled,
      source.observations,
    );
    index.fill(0);
    source.compiled.fill(0);
    source.observations.fill(0);
    expect(inspected.steps[0]!.compiledLineage.digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(inspected.steps[0]!.stepNumber).toBe(1);
  });
});
