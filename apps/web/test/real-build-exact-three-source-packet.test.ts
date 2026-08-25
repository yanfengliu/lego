import { canonicalStringify, sha256Hex, type Sha256Digest } from "@lego-studio/brick-kernel";
import { beforeEach, describe, expect, it } from "vitest";

import { createRealBuildBrowserOutputV4SourceEvidencePanel } from "../e2e/real-build-browser-output-v4-source-evidence-panel-writer";
import { sourceEvidenceDigest } from "../e2e/real-build-browser-output-v4-source-evidence-primitives";
import type { RealBuildBrowserOutputV4SourceEvidencePanelArtifact } from "../e2e/real-build-browser-output-v4-source-evidence-types";
import {
  readRealBuildExactThreeCompiledObservationSource,
  readRealBuildExactThreeSourcePacket,
  requireRealBuildExactThreeSourcePacketInspection,
} from "../e2e/real-build-exact-three-source-packet-reader";
import type {
  RealBuildExactThreeSourcePacketBytes,
  RealBuildExactThreeSourcePacketManifest,
} from "../e2e/real-build-exact-three-source-packet-types";
import {
  createRealBuildExactThreeSourcePacket,
  readRealBuildExactThreeSourcePacketBytes,
} from "../e2e/real-build-exact-three-source-packet-writer";
import type { ScopedRealBuildPanelEvidence } from "../e2e/real-build-panel-evidence";
import { stepPanelEvidenceDigest } from "../e2e/real-build-panel-evidence-digest";
import {
  SOURCE_EVIDENCE_TEST_PDF_DIGEST,
  sourceEvidenceTestPanelInput,
} from "./real-build-browser-output-v4-source-evidence-fixture";

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();
const CALLER_SOURCE_SNAPSHOT_DIGEST =
  `sha256:${sha256Hex("exact-three caller source snapshot")}` as Sha256Digest;

function exactThreeInputs() {
  const panelInputs = [2, 3, 4].map((stepNumber) => {
    const input = sourceEvidenceTestPanelInput(stepNumber);
    const { minXPt, maxXPt, minYPt, maxYPt, calloutBoxes } = input.panel;
    return {
      ...input,
      panel: {
        ...input.panel,
        pageNumber: 11,
        panelEvidenceDigest: stepPanelEvidenceDigest({
          pdfDigest: SOURCE_EVIDENCE_TEST_PDF_DIGEST,
          stepNumber,
          pageNumber: 11,
          bounds: { minXPt, maxXPt, minYPt, maxYPt },
          calloutBoxes,
        }) as Sha256Digest,
      },
    };
  });
  const sourcePanels = panelInputs.map((input) =>
    createRealBuildBrowserOutputV4SourceEvidencePanel(input),
  );
  const panels = panelInputs.map(({ panel }) => ({
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    bounds: {
      minXPt: panel.minXPt,
      maxXPt: panel.maxXPt,
      minYPt: panel.minYPt,
      maxYPt: panel.maxYPt,
    },
    labelXPt: panel.minXPt,
    labelYPt: panel.minYPt,
    quantities: [] as number[],
  }));
  const calloutProbePageNumbers = [...new Set(panels.map(({ pageNumber }) => pageNumber))];
  const scopedPanelEvidence = {
    panels,
    calloutBoxesByStep: { 2: [], 3: [], 4: [] },
    callerSourcePanelCommitmentByStep: {
      2: {
        pageNumber: panelInputs[0]!.panel.pageNumber,
        commitmentDigest: panelInputs[0]!.panel.panelEvidenceDigest,
      },
      3: {
        pageNumber: panelInputs[1]!.panel.pageNumber,
        commitmentDigest: panelInputs[1]!.panel.panelEvidenceDigest,
      },
      4: {
        pageNumber: panelInputs[2]!.panel.pageNumber,
        commitmentDigest: panelInputs[2]!.panel.panelEvidenceDigest,
      },
    },
    authority: {
      sourceText: "caller-supplied-unverified" as const,
      preparedRun: "absent" as const,
      placement: "absent" as const,
      completion: "absent" as const,
    },
    binding: {
      pdfBytesDigest: SOURCE_EVIDENCE_TEST_PDF_DIGEST,
      callerInstructionSourceSnapshotDigest: CALLER_SOURCE_SNAPSHOT_DIGEST,
      callerSourceContentHashClaimMatchedPdfBytes: true as const,
      sourceTextParserReplay: "not-performed" as const,
    },
    scope: {
      requestedStepNumbers: [2, 3, 4],
      calloutProbePageNumbers,
      indexedStepLabelCount: 359,
      materializedPagePanelCount: 4,
      emittedPanelCount: 3,
    },
  } satisfies ScopedRealBuildPanelEvidence;
  return { scopedPanelEvidence, sourcePanels };
}

function mutableManifest(bytes: RealBuildExactThreeSourcePacketBytes) {
  return JSON.parse(
    DECODER.decode(bytes.manifestBytes),
  ) as Mutable<RealBuildExactThreeSourcePacketManifest>;
}

function withManifest(
  bytes: RealBuildExactThreeSourcePacketBytes,
  mutate: (manifest: Mutable<RealBuildExactThreeSourcePacketManifest>) => void,
): RealBuildExactThreeSourcePacketBytes {
  const manifest = mutableManifest(bytes);
  mutate(manifest);
  return {
    ...bytes,
    manifestBytes: ENCODER.encode(canonicalStringify(manifest)),
  };
}

let scopedPanelEvidence: ScopedRealBuildPanelEvidence;
let sourcePanels: RealBuildBrowserOutputV4SourceEvidencePanelArtifact[];

beforeEach(() => {
  ({ scopedPanelEvidence, sourcePanels } = exactThreeInputs());
});

describe("exact-three authority-absent source packet", () => {
  it("round-trips exactly panels 2-4 for placement steps 1-3 with all authority absent", () => {
    const artifact = createRealBuildExactThreeSourcePacket({
      scopedPanelEvidence,
      sourcePanels,
    });
    const bytes = readRealBuildExactThreeSourcePacketBytes(artifact);
    const inspection = readRealBuildExactThreeSourcePacket(bytes);

    expect(artifact.manifestDigest).toBe(sourceEvidenceDigest(bytes.manifestBytes));
    expect(artifact.acceptedDocument).toBeNull();
    expect(inspection.manifest.scope).toMatchObject({
      placementStepNumbers: [1, 2, 3],
      registrationPanelStepNumbers: [2, 3, 4],
      emittedPanelCount: 3,
    });
    expect(inspection.manifest.panels.map((panel) => panel.registrationPanelStepNumber)).toEqual([
      2, 3, 4,
    ]);
    expect(inspection.manifest.panels.map((panel) => panel.placementStepNumber)).toEqual([1, 2, 3]);
    expect(inspection.manifest.binding).toEqual({
      pdfBytesDigest: SOURCE_EVIDENCE_TEST_PDF_DIGEST,
      callerInstructionSourceSnapshotDigest: CALLER_SOURCE_SNAPSHOT_DIGEST,
      callerSourceContentHashClaimMatchedPdfBytes: true,
      sourceTextParserReplay: "not-performed",
    });
    expect(inspection.manifest.authority).toEqual({
      sourceText: "caller-supplied-unverified",
      sourceExecution: "absent",
      preparedRun: "absent",
      physicalFrame: "absent",
      placement: "absent",
      completion: "absent",
    });
    expect(inspection).toMatchObject({
      reproducible: true,
      sourceExecutionAuthority: "absent",
      preparedRunAuthority: "absent",
      physicalFrameAuthority: "absent",
      placementAuthority: "absent",
      completionAuthority: "absent",
      acceptedDocument: null,
    });
    expect(Object.isFrozen(inspection)).toBe(true);
    expect(Object.isFrozen(inspection.manifest.panels[0])).toBe(true);
    expect(requireRealBuildExactThreeSourcePacketInspection(inspection)).toBe(inspection);
    expect(() => requireRealBuildExactThreeSourcePacketInspection({ ...inspection })).toThrow(
      /privately branded/iu,
    );
    const compiledSource = readRealBuildExactThreeCompiledObservationSource(inspection, 1);
    const descriptor = inspection.manifest.panels[0]!.sourceArtifactDescriptor;
    expect(compiledSource).toMatchObject({
      observationMode: "lookahead",
      registrationPanelStepNumber: 2,
      pageNumber: 11,
      widthPx: descriptor.workWidth,
      heightPx: descriptor.workHeight,
      panelDigest: inspection.manifest.panels[0]!.callerSourcePanelCommitmentDigest,
      cropDigest: descriptor.cropDescriptorDigest,
      sourceDescriptorDigest: descriptor.lookahead.sourceDescriptorDigest,
      exclusionDescriptorDigest: descriptor.lookahead.exclusionDescriptorDigest,
      measure: descriptor.lookahead.measure,
    });
    const sourceReference = descriptor.masks.find(({ name }) => name === "lookahead-source")!;
    const exclusionReference = descriptor.masks.find(({ name }) => name === "lookahead-exclusion")!;
    expect(`sha256:${sha256Hex(compiledSource.sourceMask)}`).toBe(sourceReference.unpackedDigest);
    expect(`sha256:${sha256Hex(compiledSource.excludedMask!)}`).toBe(
      exclusionReference.unpackedDigest,
    );
    compiledSource.sourceMask.fill(0);
    expect(
      `sha256:${sha256Hex(
        readRealBuildExactThreeCompiledObservationSource(inspection, 1).sourceMask,
      )}`,
    ).toBe(sourceReference.unpackedDigest);
  });

  it("detaches scoped input, source artifacts, and every returned byte role", () => {
    const artifact = createRealBuildExactThreeSourcePacket({
      scopedPanelEvidence,
      sourcePanels,
    });
    const expected = readRealBuildExactThreeSourcePacketBytes(artifact);

    (scopedPanelEvidence.panels as Mutable<typeof scopedPanelEvidence.panels>)[0]!.pageNumber = 400;
    sourcePanels[0]!.highRgbaBytes.fill(0xff);
    sourcePanels[0]!.workRgbaBytes.fill(0xff);
    sourcePanels[0]!.packedMaskBytes.fill(0xff);
    const callerCopy = readRealBuildExactThreeSourcePacketBytes(artifact);
    callerCopy.manifestBytes.fill(0);
    callerCopy.highRgbaRoleBytes.fill(0);
    callerCopy.workRgbaRoleBytes.fill(0);
    callerCopy.maskRoleBytes.fill(0);

    const retained = readRealBuildExactThreeSourcePacketBytes(artifact);
    expect(retained).toEqual(expected);
    expect(retained.manifestBytes.buffer).not.toBe(callerCopy.manifestBytes.buffer);
    expect(readRealBuildExactThreeSourcePacket(retained).reproducible).toBe(true);
  });

  it("rejects malformed, reordered, missing, sparse, forged, or drifted writer inputs", () => {
    expect(() =>
      createRealBuildExactThreeSourcePacket({
        scopedPanelEvidence,
        sourcePanels: sourcePanels.slice(0, 2),
      }),
    ).toThrow(/3 through 3 dense/iu);

    const sparse = new Array<RealBuildBrowserOutputV4SourceEvidencePanelArtifact>(3);
    sparse[0] = sourcePanels[0]!;
    sparse[2] = sourcePanels[2]!;
    expect(() =>
      createRealBuildExactThreeSourcePacket({ scopedPanelEvidence, sourcePanels: sparse }),
    ).toThrow(/dense/iu);

    expect(() =>
      createRealBuildExactThreeSourcePacket({
        scopedPanelEvidence,
        sourcePanels: [sourcePanels[1]!, sourcePanels[0]!, sourcePanels[2]!],
      }),
    ).toThrow(/independently reproduce/iu);

    const reorderedScoped = structuredClone(
      scopedPanelEvidence,
    ) as Mutable<ScopedRealBuildPanelEvidence>;
    [reorderedScoped.panels[0], reorderedScoped.panels[1]] = [
      reorderedScoped.panels[1]!,
      reorderedScoped.panels[0]!,
    ];
    expect(() =>
      createRealBuildExactThreeSourcePacket({
        scopedPanelEvidence: reorderedScoped,
        sourcePanels,
      }),
    ).toThrow(/stepNumber/iu);

    const drifted = structuredClone(scopedPanelEvidence) as Mutable<ScopedRealBuildPanelEvidence>;
    drifted.callerSourcePanelCommitmentByStep[2]!.commitmentDigest = `sha256:${"0".repeat(64)}`;
    expect(() =>
      createRealBuildExactThreeSourcePacket({ scopedPanelEvidence: drifted, sourcePanels }),
    ).toThrow(/commitment does not reproduce/iu);

    const truncatedIndex = structuredClone(
      scopedPanelEvidence,
    ) as Mutable<ScopedRealBuildPanelEvidence>;
    truncatedIndex.scope.indexedStepLabelCount = 358 as never;
    expect(() =>
      createRealBuildExactThreeSourcePacket({
        scopedPanelEvidence: truncatedIndex,
        sourcePanels,
      }),
    ).toThrow();

    const incompletePage = structuredClone(
      scopedPanelEvidence,
    ) as Mutable<ScopedRealBuildPanelEvidence>;
    incompletePage.scope.materializedPagePanelCount = 3 as never;
    expect(() =>
      createRealBuildExactThreeSourcePacket({
        scopedPanelEvidence: incompletePage,
        sourcePanels,
      }),
    ).toThrow();

    const alternatePage = structuredClone(
      scopedPanelEvidence,
    ) as Mutable<ScopedRealBuildPanelEvidence>;
    alternatePage.panels[0]!.pageNumber = 12;
    expect(() =>
      createRealBuildExactThreeSourcePacket({
        scopedPanelEvidence: alternatePage,
        sourcePanels,
      }),
    ).toThrow();

    const alternateProbe = structuredClone(
      scopedPanelEvidence,
    ) as Mutable<ScopedRealBuildPanelEvidence>;
    alternateProbe.scope.calloutProbePageNumbers = [12];
    expect(() =>
      createRealBuildExactThreeSourcePacket({
        scopedPanelEvidence: alternateProbe,
        sourcePanels,
      }),
    ).toThrow();

    const forged = {
      ...sourcePanels[0]!,
      descriptor: structuredClone(sourcePanels[0]!.descriptor),
    };
    expect(() =>
      createRealBuildExactThreeSourcePacket({
        scopedPanelEvidence,
        sourcePanels: [forged, sourcePanels[1]!, sourcePanels[2]!],
      }),
    ).toThrow(/module-created panel descriptor/iu);

    expect(() =>
      createRealBuildExactThreeSourcePacket({
        scopedPanelEvidence,
        sourcePanels,
        extra: true,
      }),
    ).toThrow(/exactly the declared data keys/iu);
  });

  it("strictly rejects noncanonical, extra, missing, reordered, and drifted manifest fields", () => {
    const artifact = createRealBuildExactThreeSourcePacket({ scopedPanelEvidence, sourcePanels });
    const bytes = readRealBuildExactThreeSourcePacketBytes(artifact);
    const mutations: Array<(manifest: Mutable<RealBuildExactThreeSourcePacketManifest>) => void> = [
      (manifest) => {
        (manifest as unknown as Record<string, unknown>).extra = true;
      },
      (manifest) => {
        manifest.panels.pop();
      },
      (manifest) => {
        manifest.panels[1] = null as never;
      },
      (manifest) => {
        [manifest.panels[0], manifest.panels[1]] = [manifest.panels[1]!, manifest.panels[0]!];
      },
      (manifest) => {
        manifest.roles.pop();
      },
      (manifest) => {
        manifest.roles.reverse();
      },
      (manifest) => {
        (manifest.panels[0] as unknown as Record<string, unknown>).extra = true;
      },
      (manifest) => {
        manifest.panels[0]!.roleSlices.reverse();
      },
      (manifest) => {
        manifest.panels[0]!.pageNumber += 1;
      },
      (manifest) => {
        manifest.scope.calloutProbePageNumbers = [12] as never;
      },
      (manifest) => {
        manifest.scope.indexedStepLabelCount = 358 as never;
      },
      (manifest) => {
        manifest.scope.materializedPagePanelCount = 3 as never;
      },
      (manifest) => {
        manifest.binding.sourceTextParserReplay = "performed" as never;
      },
      (manifest) => {
        manifest.authority.placement = "present" as never;
      },
      (manifest) => {
        manifest.acceptedDocument = {} as never;
      },
    ];
    for (const mutate of mutations) {
      expect(() => readRealBuildExactThreeSourcePacket(withManifest(bytes, mutate))).toThrow();
    }

    const noncanonical = {
      ...bytes,
      manifestBytes: ENCODER.encode(JSON.stringify(mutableManifest(bytes), null, 2)),
    };
    expect(() => readRealBuildExactThreeSourcePacket(noncanonical)).toThrow(/canonical JSON/iu);
    expect(() => readRealBuildExactThreeSourcePacket({ ...bytes, extra: true })).toThrow(
      /exactly the declared data keys/iu,
    );

    expect(() =>
      readRealBuildExactThreeSourcePacket(
        withManifest(bytes, (manifest) => {
          manifest.panels[0]!.callerSourcePanelCommitmentDigest = `sha256:${"0".repeat(64)}`;
        }),
      ),
    ).toThrow(/commitment does not reproduce its retained source binding/iu);
  });

  it("rejects role corruption even when an attacker updates both aggregate and slice digests", () => {
    const artifact = createRealBuildExactThreeSourcePacket({ scopedPanelEvidence, sourcePanels });
    const bytes = readRealBuildExactThreeSourcePacketBytes(artifact);
    const direct = { ...bytes, maskRoleBytes: bytes.maskRoleBytes.slice() };
    direct.maskRoleBytes[0] = direct.maskRoleBytes[0]! ^ 1;
    expect(() => readRealBuildExactThreeSourcePacket(direct)).toThrow(/role digest/iu);

    const rewrittenMask = bytes.maskRoleBytes.slice();
    rewrittenMask[0] = rewrittenMask[0]! ^ 1;
    const selfConsistent = withManifest({ ...bytes, maskRoleBytes: rewrittenMask }, (manifest) => {
      manifest.roles[2]!.digest = sourceEvidenceDigest(rewrittenMask);
      const first = manifest.panels[0]!.roleSlices[2]!;
      const slice = rewrittenMask.slice(first.offset, first.offset + first.byteLength);
      first.digest = sourceEvidenceDigest(slice);
    });
    expect(() => readRealBuildExactThreeSourcePacket(selfConsistent)).toThrow(
      /independently reproduce/iu,
    );
  });

  it("rejects gaps, overlaps, and orphan bytes in the aggregate roles", () => {
    const artifact = createRealBuildExactThreeSourcePacket({ scopedPanelEvidence, sourcePanels });
    const bytes = readRealBuildExactThreeSourcePacketBytes(artifact);
    expect(() =>
      readRealBuildExactThreeSourcePacket(
        withManifest(bytes, (manifest) => {
          manifest.panels[1]!.roleSlices[0]!.offset += 1;
        }),
      ),
    ).toThrow(/gap or overlap/iu);

    const extended = new Uint8Array(bytes.highRgbaRoleBytes.length + 1);
    extended.set(bytes.highRgbaRoleBytes);
    const orphan = withManifest({ ...bytes, highRgbaRoleBytes: extended }, (manifest) => {
      manifest.roles[0]!.byteLength = extended.byteLength;
      manifest.roles[0]!.digest = sourceEvidenceDigest(extended);
    });
    expect(() => readRealBuildExactThreeSourcePacket(orphan)).toThrow(/orphan bytes/iu);
  });
});
