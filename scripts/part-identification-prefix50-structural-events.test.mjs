import { existsSync, readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import { sha256Digest } from "./part-identification-artifact-source.mjs";
import {
  bytesFromVerifiedPrefix50StructuralEvents,
  deriveSubBuildCompletionEvent,
  encodePrefix50StructuralEvents,
  inspectVerifiedPrefix50StructuralEvents,
  isVerifiedPrefix50StructuralEvents,
  verifyPrefix50StructuralEvents,
} from "./part-identification-prefix50-structural-events.mjs";
import { reproduceCurrentPrefix50StructuralEvents } from "./part-identification-prefix50-structural-events-current.mjs";
import {
  CURRENT_PREFIX50_STRUCTURAL_EVENTS_PINS,
  PREFIX50_STRUCTURAL_EVENTS_AUTHORITY,
  PREFIX50_STRUCTURAL_EVENTS_OUTPUT_PATH,
  PREFIX50_STRUCTURAL_EVENTS_SCHEMA,
} from "./part-identification-prefix50-structural-events-source.mjs";

const realEvidencePresent = [
  CURRENT_PREFIX50_STRUCTURAL_EVENTS_PINS.actionPreparation.path,
  CURRENT_PREFIX50_STRUCTURAL_EVENTS_PINS.officialModel.path,
  CURRENT_PREFIX50_STRUCTURAL_EVENTS_PINS.transitionClassifications.path,
  PREFIX50_STRUCTURAL_EVENTS_OUTPUT_PATH,
].every(existsSync);

function syntheticStructuralInput() {
  const action = {
    steps: [
      {
        stepNumber: 43,
        phases: [{}],
        phaseSequences: [71],
        callouts: [{ pageNumber: 44 }],
      },
      {
        stepNumber: 44,
        phases: [],
        phaseSequences: [],
        callouts: [],
        printedPieceCursorBefore: 280,
        printedPieceCursorAfter: 280,
        sourceBuilderIdentityOrdinals: [],
      },
      {
        stepNumber: 45,
        phases: [{}],
        phaseSequences: [72],
        callouts: [{ pageNumber: 46 }],
      },
    ],
  };
  const members = [
    {
      subBuildPath: ["parent-child", "exact-child"],
      sourceBuilderIdentityOrdinal: 260,
      actualBrickRef: "child-brick-b",
    },
    {
      subBuildPath: ["parent-child", "exact-child"],
      sourceBuilderIdentityOrdinal: 258,
      actualBrickRef: "child-brick-a",
    },
    {
      subBuildPath: ["parent-child", "sibling-child"],
      sourceBuilderIdentityOrdinal: 259,
      actualBrickRef: "sibling-brick",
    },
  ];
  const sourceEvent = {
    kind: "sub-build-complete",
    sequence: 8,
    sourceDigest: `sha256:${"a".repeat(64)}`,
    parentStepUuid: "parent-step",
    parentSubBuildPath: ["parent-child"],
    childSubBuildUuid: "exact-child",
    childSubBuildPath: ["parent-child", "exact-child"],
    precedingPhaseSequence: 71,
    followingPhaseSequence: 72,
    physicalBrickRefs: ["child-brick-b", "child-brick-a"],
  };
  return {
    action,
    builderOrder: { structuralEvents: [sourceEvent] },
    zeroStep: action.steps[1],
    stepIndex: 1,
    members,
  };
}

function deriveSyntheticEvent(classification = { byStep: {} }) {
  return deriveSubBuildCompletionEvent({
    ...syntheticStructuralInput(),
    classification,
  });
}

describe("prefix-50 structural-event semantics", () => {
  it("derives the official return boundary and exact member path without panel authority", () => {
    const event = deriveSyntheticEvent();

    expect(event).toMatchObject({
      kind: "sub-build-complete",
      sourceStructuralEventSequence: 8,
      printedStepNumber: 44,
      pdfPageNumber: 45,
      boundary: { precedingPhaseSequence: 71, followingPhaseSequence: 72 },
      parent: {
        stepUuid: "parent-step",
        subBuildPath: ["parent-child"],
      },
      child: {
        subBuildUuid: "exact-child",
        subBuildPath: ["parent-child", "exact-child"],
        memberCount: 2,
        sourceBuilderIdentityOrdinals: [258, 260],
        members: [
          { sourceBuilderIdentityOrdinal: 258, actualBrickRef: "child-brick-a" },
          { sourceBuilderIdentityOrdinal: 260, actualBrickRef: "child-brick-b" },
        ],
        memberCommitment: { rows: 2 },
      },
      connectionProjection: { status: "deferred", connections: [] },
      documentLegalityClaimed: false,
      unauthenticatedJoinInterpretation: { status: "absent", authorityUsed: false },
    });
  });

  it("does not let an unauthenticated attachment interpretation select or label the official event", () => {
    const absent = deriveSyntheticEvent();
    const attachment = deriveSyntheticEvent({
      byStep: {
        44: {
          pageNumber: 45,
          transition: "attachment",
          panelEvidenceDigest: `sha256:${"b".repeat(64)}`,
          evidenceDigest: `sha256:${"c".repeat(64)}`,
          localClassification: {
            authenticated: false,
            classifierClaimId: "unauthenticated-attachment",
          },
        },
      },
    });

    expect(attachment.kind).toBe("sub-build-complete");
    expect(attachment.sourceStructuralEventSequence).toBe(absent.sourceStructuralEventSequence);
    expect(attachment.boundary).toEqual(absent.boundary);
    expect(attachment.child).toEqual(absent.child);
    expect(attachment.unauthenticatedJoinInterpretation).toMatchObject({
      status: "reported-unauthenticated",
      authorityUsed: false,
      authenticated: false,
      transition: "attachment",
    });
  });

  it("rejects an off-path member, an extra action member, and a wrong return boundary", () => {
    const offPath = syntheticStructuralInput();
    offPath.members[0].subBuildPath = ["parent-child", "sibling-child"];
    expect(() =>
      deriveSubBuildCompletionEvent({ ...offPath, classification: { byStep: {} } }),
    ).toThrow(/absent from its exact prefix-50 action path/);

    const extraMember = syntheticStructuralInput();
    extraMember.members.push({
      subBuildPath: ["parent-child", "exact-child"],
      sourceBuilderIdentityOrdinal: 261,
      actualBrickRef: "unofficial-extra",
    });
    expect(() =>
      deriveSubBuildCompletionEvent({ ...extraMember, classification: { byStep: {} } }),
    ).toThrow(/has 2 members, but its exact prefix-50 action path has 3/);

    const wrongBoundary = syntheticStructuralInput();
    wrongBoundary.builderOrder.structuralEvents[0].followingPhaseSequence = 73;
    expect(() =>
      deriveSubBuildCompletionEvent({ ...wrongBoundary, classification: { byStep: {} } }),
    ).toThrow(/exactly one official sub-build completion between phases 71\/72/);
  });
});

describe.runIf(realEvidencePresent)("prefix-50 structural events", () => {
  let artifact;
  let bytes;
  let input;
  let verified;

  beforeAll(async () => {
    const reproduced = await reproduceCurrentPrefix50StructuralEvents();
    artifact = reproduced.artifact;
    bytes = reproduced.bytes;
    input = reproduced.input;
    const diskBytes = readFileSync(PREFIX50_STRUCTURAL_EVENTS_OUTPUT_PATH);
    expect(diskBytes).toEqual(bytes);
    verified = await verifyPrefix50StructuralEvents({ ...input, artifactBytes: diskBytes });
  }, 180_000);

  it("reproduces one exact authority-bounded step-44 sub-build completion artifact", () => {
    expect(artifact.schemaVersion).toBe(PREFIX50_STRUCTURAL_EVENTS_SCHEMA);
    expect(bytes).toHaveLength(7_292);
    expect(sha256Digest(bytes)).toBe(
      "sha256:ea1ee9791575ecd858cf13b076d0b3c6de4ebfca9a51a268a9242d3e07667fe3",
    );
    expect(inspectVerifiedPrefix50StructuralEvents(verified).digest).toBe(
      "sha256:ea1ee9791575ecd858cf13b076d0b3c6de4ebfca9a51a268a9242d3e07667fe3",
    );
    expect(bytesFromVerifiedPrefix50StructuralEvents(verified)).toEqual(bytes);
    expect(isVerifiedPrefix50StructuralEvents(verified)).toBe(true);
    expect(artifact.accounting).toEqual({
      actionPhases: 95,
      actionPhysicalIdentities: 320,
      zeroPiecePrintedRows: 1,
      structuralEvents: 1,
      subBuildCompletionEvents: 1,
      unauthenticatedJoinInterpretations: 1,
      suffixEvents: 0,
    });
    expect(artifact.structuralDigest).toBe(
      "sha256:866e56925be26397204fd0f390086321169258e8733ca87d50bafa05f5b2c1f4",
    );
  });

  it("keeps the 95-phase action artifact and official phase digest byte-exact", () => {
    expect(artifact.inputs.actionPreparation).toEqual({
      schemaVersion: "lego.real-build-action-preparation/1",
      bytes: 317_152,
      digest: "sha256:5fbab00b90c6ffbe6c9b09727819e0b3a964cebbd88138232bd2418df6100fb6",
      phaseDigest: "sha256:8988e328aa5793b07fc6c398eb518f4d972d90c8de85c41006db02b2792d896e",
    });
    expect(artifact.inputs.officialModel).toMatchObject({
      bytes: 1_903_169,
      digest: "sha256:c0564fd86ede633f6cb18738f999fbb70ee948ba93a55cc8d338b4b5f02b5922",
      phaseDigest: "sha256:8988e328aa5793b07fc6c398eb518f4d972d90c8de85c41006db02b2792d896e",
      structuralDigest: "sha256:600367e0966ae2f522f9207a4e608572eba61bd12cd971ed35c51d6b0e308a8c",
    });
  });

  it("binds the exact zero-piece return boundary and child membership", () => {
    const event = artifact.structuralEvents[0];
    expect(event).toMatchObject({
      kind: "sub-build-complete",
      sequence: 1,
      sourceStructuralEventSequence: 8,
      printedStepNumber: 44,
      pdfPageNumber: 45,
      printedPieceCursorBefore: 280,
      printedPieceCursorAfter: 280,
      addedSourceBuilderIdentityOrdinals: [],
      phaseSequences: [],
      boundary: { precedingPhaseSequence: 71, followingPhaseSequence: 72 },
      parent: {
        stepUuid: "c02cc03b-119d-4615-8619-4b12fd9ccf78",
        subBuildPath: ["7004cf0d-d97f-4b0d-8572-970e23815c05"],
      },
      child: {
        subBuildUuid: "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
        subBuildPath: [
          "7004cf0d-d97f-4b0d-8572-970e23815c05",
          "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
        ],
        memberCount: 23,
        sourceBuilderIdentityOrdinals: Array.from({ length: 23 }, (_, index) => 258 + index),
        memberCommitment: {
          schemaVersion: "lego.part-identification-prefix50-structural-member-commitment/1",
          rows: 23,
          bytes: 2_141,
          digest: "sha256:4944f0b5ef959fc73471c1dc9bcad76ed7b47aec0f74b76cf2d55a85f7cd725c",
        },
      },
      connectionProjection: { status: "deferred", connections: [] },
      buildStepConnectionTiming: { status: "not-representable-by-current-build-step" },
      documentLegalityClaimed: false,
      unauthenticatedJoinInterpretation: {
        status: "reported-unauthenticated",
        authorityUsed: false,
        authenticated: false,
        transition: "attachment",
      },
    });
    expect(event.child.members).toHaveLength(23);
    expect(event.child.members.at(0)).toEqual({
      sourceBuilderIdentityOrdinal: 258,
      actualBrickRef: "97adf751-0663-4d61-a4a2-6d6105294e7a",
    });
    expect(event.child.members.at(-1)).toEqual({
      sourceBuilderIdentityOrdinal: 280,
      actualBrickRef: "7204a4de-9f79-45d5-9ee2-476472469378",
    });
  });

  it("keeps the unauthenticated panel classification corroborative and grants no authority", () => {
    expect(artifact.authority).toEqual(PREFIX50_STRUCTURAL_EVENTS_AUTHORITY);
    expect(artifact.inputs.transitionClassificationCorroboration).toMatchObject({
      schemaVersion: "lego.transition-classifications/1",
      authenticated: false,
      authorityUsed: false,
    });
    for (const key of [
      "authenticated",
      "sourceExecution",
      "preparedRun",
      "physicalFrame",
      "connectionAuthority",
      "actionAuthority",
      "placement",
      "documentLegality",
      "documentMutation",
      "replay",
      "acceptedDocument",
      "completion",
    ]) {
      expect(artifact.authority[key]).toBe(false);
    }
  });

  async function expectTamperRejected(mutate) {
    const changed = structuredClone(artifact);
    mutate(changed);
    await expect(
      verifyPrefix50StructuralEvents({
        ...input,
        artifactBytes: encodePrefix50StructuralEvents(changed),
      }),
    ).rejects.toThrow(/do not exactly reproduce/);
  }

  it("rejects wrong parent or child source identity", async () => {
    await expectTamperRejected((changed) => {
      changed.structuralEvents[0].parent.stepUuid = "00000000-0000-4000-8000-000000000000";
    });
    await expectTamperRejected((changed) => {
      changed.structuralEvents[0].child.subBuildUuid = "00000000-0000-4000-8000-000000000000";
    });
  }, 30_000);

  it("rejects a child member swap even when the row count stays 23", async () => {
    await expectTamperRejected((changed) => {
      const members = changed.structuralEvents[0].child.members;
      [members[0].actualBrickRef, members[1].actualBrickRef] = [
        members[1].actualBrickRef,
        members[0].actualBrickRef,
      ];
    });
  });

  it("rejects suffix injection, a fake part phase, cursor drift, and event reordering", async () => {
    await expectTamperRejected((changed) => {
      const injected = structuredClone(changed.structuralEvents[0]);
      injected.sequence = 2;
      injected.printedStepNumber = 51;
      changed.structuralEvents.push(injected);
    });
    await expectTamperRejected((changed) => {
      changed.structuralEvents[0].phaseSequences = [71];
      changed.structuralEvents[0].addedSourceBuilderIdentityOrdinals = [280];
    });
    await expectTamperRejected((changed) => {
      changed.structuralEvents[0].printedPieceCursorAfter = 281;
    });
    await expectTamperRejected((changed) => {
      changed.structuralEvents[0].sequence = 2;
      changed.structuralEvents[0].sourceStructuralEventSequence = 7;
    });
  }, 60_000);
});
