import { describe, expect, it } from "vitest";

import {
  deriveRealBuildCompiledObservationCameraId,
  deriveRealBuildCompiledObservationSourceId,
} from "../e2e/real-build-compiled-observation-closure-digest";
import { parseRealBuildCompiledObservationClosure } from "../e2e/real-build-compiled-observation-closure-parser";
import type {
  RealBuildCompiledObservationCameraCommitment,
  RealBuildCompiledObservationClosure,
  RealBuildCompiledObservationMaskReference,
  RealBuildCompiledObservationSourceCommitment,
} from "../e2e/real-build-compiled-observation-closure-types";
import { verifyRealBuildCompiledObservationClosure } from "../e2e/real-build-compiled-observation-closure";
import {
  commitCompiledObservation,
  compiledObservationClosureFixture,
  digestCompiledObservationBytes,
  encodeCompiledObservationClosure,
} from "./real-build-compiled-observation-closure.fixture";

type Fixture = ReturnType<typeof compiledObservationClosureFixture>;
type Source = RealBuildCompiledObservationSourceCommitment;
type Camera = RealBuildCompiledObservationCameraCommitment;

const DIGEST_A = `sha256:${"a".repeat(64)}` as const;
const DIGEST_B = `sha256:${"b".repeat(64)}` as const;
const SOURCE_ID_ZERO = `compiled-observation-source:sha256:${"0".repeat(64)}` as const;
const CAMERA_ID_ZERO = `compiled-observation-camera:sha256:${"0".repeat(64)}` as const;

function withoutSourceId(source: Source): Omit<Source, "sourceId"> {
  const { sourceId: _sourceId, ...commitment } = source;
  void _sourceId;
  return commitment;
}

function withoutCameraId(camera: Camera): Omit<Camera, "cameraId"> {
  const { cameraId: _cameraId, ...commitment } = camera;
  void _cameraId;
  return commitment;
}

function commitSource(commitment: Omit<Source, "sourceId">): Source {
  return { sourceId: deriveRealBuildCompiledObservationSourceId(commitment), ...commitment };
}

function commitCamera(commitment: Omit<Camera, "cameraId">): Camera {
  return { cameraId: deriveRealBuildCompiledObservationCameraId(commitment), ...commitment };
}

function maskAt(
  template: RealBuildCompiledObservationMaskReference,
  role: Uint8Array,
  offset: number,
  dimensions: Readonly<{ widthPx: number; heightPx: number }> = template,
): RealBuildCompiledObservationMaskReference {
  const bytes = Math.ceil((dimensions.widthPx * dimensions.heightPx) / 8);
  return {
    ...template,
    offset,
    bytes,
    digest: digestCompiledObservationBytes(role.subarray(offset, offset + bytes)),
    widthPx: dimensions.widthPx,
    heightPx: dimensions.heightPx,
  };
}

function recommitSelected(
  fixture: Fixture,
  input: Readonly<{
    role: Uint8Array;
    source?: Omit<Source, "sourceId">;
    camera?: Omit<Camera, "cameraId" | "sourceId">;
  }>,
): RealBuildCompiledObservationClosure {
  const source = commitSource(input.source ?? withoutSourceId(fixture.closure.sources[0]!));
  const camera = commitCamera({
    ...withoutCameraId(fixture.closure.cameras[0]!),
    ...input.camera,
    sourceId: source.sourceId,
  });
  const observations = fixture.closure.observations.map((row) =>
    commitCompiledObservation({
      lineageId: row.lineageId,
      sourceId: source.sourceId,
      cameraId: camera.cameraId,
      status: row.status,
      shiftPx: row.shiftPx,
      score: row.score,
      outcome: row.outcome,
    }),
  );
  return {
    ...fixture.closure,
    roleBytes: input.role.length,
    roleDigest: digestCompiledObservationBytes(input.role),
    sources: [source],
    cameras: [camera],
    observations,
    selection: {
      ...fixture.closure.selection,
      decisionSourceId: source.sourceId,
      selectedCameraId: camera.cameraId,
    },
  };
}

function verify(fixture: Fixture, closure: unknown, role: unknown = fixture.roleBytes) {
  return verifyRealBuildCompiledObservationClosure(
    fixture.lineageBytes,
    encodeCompiledObservationClosure(closure),
    role,
    fixture.policy,
  );
}

function parseWithSource(
  fixture: Fixture,
  patch: Partial<RealBuildCompiledObservationSourceCommitment>,
) {
  return parseRealBuildCompiledObservationClosure(
    encodeCompiledObservationClosure({
      ...fixture.closure,
      sources: [{ ...fixture.closure.sources[0]!, ...patch }],
    }),
  );
}

describe("compiled observation closure hostile byte parsing", () => {
  it("accepts an ordinary genuine Uint8Array and snapshots its exact JSON", () => {
    const fixture = compiledObservationClosureFixture();
    expect(parseRealBuildCompiledObservationClosure(fixture.closureBytes)).toEqual(fixture.closure);
  });

  it.each([
    ["Int8Array", (bytes: Uint8Array) => new Int8Array(bytes)],
    ["Uint16Array", (bytes: Uint8Array) => new Uint16Array(bytes)],
    ["Proxy", (bytes: Uint8Array) => new Proxy(bytes, {})],
  ])("rejects a %s wrapper before decoding", (_label, wrap) => {
    const fixture = compiledObservationClosureFixture();
    expect(() => parseRealBuildCompiledObservationClosure(wrap(fixture.closureBytes))).toThrow(
      /genuine Uint8Array/u,
    );
  });

  it("rejects SharedArrayBuffer storage before decoding", () => {
    if (typeof SharedArrayBuffer === "undefined") return;
    const fixture = compiledObservationClosureFixture();
    const shared = new Uint8Array(new SharedArrayBuffer(fixture.closureBytes.length));
    shared.set(fixture.closureBytes);
    expect(() => parseRealBuildCompiledObservationClosure(shared)).toThrow(/SharedArrayBuffer/u);
  });

  it("rejects malformed UTF-8 and undeclared object keys", () => {
    const fixture = compiledObservationClosureFixture();
    expect(() => parseRealBuildCompiledObservationClosure(Uint8Array.of(0xc3, 0x28))).toThrow(
      /well-formed UTF-8/u,
    );
    expect(() =>
      parseRealBuildCompiledObservationClosure(
        encodeCompiledObservationClosure({ ...fixture.closure, undeclared: true }),
      ),
    ).toThrow(/must contain exactly/u);
    expect(() =>
      parseRealBuildCompiledObservationClosure(
        encodeCompiledObservationClosure({
          ...fixture.closure,
          sources: [{ ...fixture.closure.sources[0]!, undeclared: true }],
        }),
      ),
    ).toThrow(/sources\[0\].*must contain exactly/u);
  });
});

describe("compiled observation closure panel ordering", () => {
  it("accepts own-panel evidence at terminal printed step 359", () => {
    const fixture = compiledObservationClosureFixture();
    const parsed = parseWithSource(fixture, {
      observationMode: "own-panel",
      compiledThroughStepNumber: 359,
      registrationPanelStepNumber: 359,
    });
    expect(parsed.sources[0]).toMatchObject({
      observationMode: "own-panel",
      compiledThroughStepNumber: 359,
      registrationPanelStepNumber: 359,
    });
  });

  it("accepts only a strictly later registration panel for lookahead", () => {
    const fixture = compiledObservationClosureFixture();
    const parsed = parseWithSource(fixture, {
      observationMode: "lookahead",
      compiledThroughStepNumber: 358,
      registrationPanelStepNumber: 359,
    });
    expect(parsed.sources[0]).toMatchObject({
      observationMode: "lookahead",
      compiledThroughStepNumber: 358,
      registrationPanelStepNumber: 359,
    });
    for (const registrationPanelStepNumber of [358, 357]) {
      expect(() =>
        parseWithSource(fixture, {
          observationMode: "lookahead",
          compiledThroughStepNumber: 358,
          registrationPanelStepNumber,
        }),
      ).toThrow(/lookahead mode requires a later panel/u);
    }
  });

  it("refuses a later panel while declaring own-panel mode", () => {
    const fixture = compiledObservationClosureFixture();
    expect(() =>
      parseWithSource(fixture, {
        observationMode: "own-panel",
        compiledThroughStepNumber: 358,
        registrationPanelStepNumber: 359,
      }),
    ).toThrow(/own-panel mode requires equality/u);
  });
});

describe("compiled observation closure hostile mask commitments", () => {
  it("rejects a role slice whose bytes no longer reproduce its mask digest", () => {
    const fixture = compiledObservationClosureFixture();
    const role = fixture.roleBytes!.slice();
    role[0] = role[0]! ^ 0x80;
    const closure = {
      ...fixture.closure,
      roleDigest: digestCompiledObservationBytes(role),
    };
    expect(() => verify(fixture, closure, role)).toThrow(/exact retained slice digest/u);
  });

  it("rejects non-zero low padding in an otherwise exact seven-pixel mask", () => {
    const fixture = compiledObservationClosureFixture();
    const role = Uint8Array.of(0x71, 0, 0xe0);
    const sourceBase = withoutSourceId(fixture.closure.sources[0]!);
    const cameraBase = withoutCameraId(fixture.closure.cameras[0]!);
    const dimensions = { widthPx: 7, heightPx: 1 };
    const closure = recommitSelected(fixture, {
      role,
      source: {
        ...sourceBase,
        sourceMask: maskAt(sourceBase.sourceMask, role, 0, dimensions),
        excludedMask: maskAt(sourceBase.excludedMask, role, 1, dimensions),
      },
      camera: {
        ...cameraBase,
        candidateMask: maskAt(cameraBase.candidateMask, role, 2, dimensions),
      },
    });
    expect(() => verify(fixture, closure, role)).toThrow(/non-zero low MSB padding bits/u);
  });

  it("rejects an unused byte gap in the role map", () => {
    const fixture = compiledObservationClosureFixture();
    const role = Uint8Array.of(0x70, 0, 0, 0xe0);
    const cameraBase = withoutCameraId(fixture.closure.cameras[0]!);
    const closure = recommitSelected(fixture, {
      role,
      camera: {
        ...cameraBase,
        candidateMask: maskAt(cameraBase.candidateMask, role, 3),
      },
    });
    expect(() => verify(fixture, closure, role)).toThrow(/unused or overlapping byte range/u);
  });

  it("rejects different descriptors that alias one exact role range", () => {
    const fixture = compiledObservationClosureFixture();
    const cameraBase = withoutCameraId(fixture.closure.cameras[0]!);
    const closure = recommitSelected(fixture, {
      role: fixture.roleBytes!,
      camera: {
        ...cameraBase,
        candidateMask: {
          ...cameraBase.candidateMask,
          offset: 0,
          digest: DIGEST_A,
        },
      },
    });
    expect(() => verify(fixture, closure)).toThrow(/mask aliases must retain identical/u);
  });
});

describe("compiled observation closure hostile commitment tables", () => {
  it("rejects a camera raster that differs from its committed source", () => {
    const fixture = compiledObservationClosureFixture();
    const cameraBase = withoutCameraId(fixture.closure.cameras[0]!);
    const closure = recommitSelected(fixture, {
      role: fixture.roleBytes!,
      camera: {
        ...cameraBase,
        candidateMask: { ...cameraBase.candidateMask, widthPx: 7 },
      },
    });
    expect(() => verify(fixture, closure)).toThrow(/bind one exact source raster/u);
  });

  it("rejects committed but unused source and camera entries", () => {
    const fixture = compiledObservationClosureFixture();
    const source = fixture.closure.sources[0]!;
    const orphanSource = commitSource({
      ...withoutSourceId(source),
      sourceDescriptorDigest: DIGEST_A,
    });
    expect(() => verify(fixture, { ...fixture.closure, sources: [source, orphanSource] })).toThrow(
      /cannot retain orphan entries/u,
    );

    const camera = fixture.closure.cameras[0]!;
    const orphanCamera = commitCamera({
      ...withoutCameraId(camera),
      d4CameraRecipeDigest: DIGEST_B,
    });
    expect(() => verify(fixture, { ...fixture.closure, cameras: [camera, orphanCamera] })).toThrow(
      /cannot retain orphan entries/u,
    );
  });

  it("rejects source and camera IDs that do not hash their exact descriptors", () => {
    const fixture = compiledObservationClosureFixture();
    expect(() =>
      verify(fixture, {
        ...fixture.closure,
        sources: [{ ...fixture.closure.sources[0]!, sourceId: SOURCE_ID_ZERO }],
      }),
    ).toThrow(/source IDs must uniquely commit/u);
    expect(() =>
      verify(fixture, {
        ...fixture.closure,
        cameras: [{ ...fixture.closure.cameras[0]!, cameraId: CAMERA_ID_ZERO }],
      }),
    ).toThrow(/camera IDs must uniquely commit/u);
  });
});
