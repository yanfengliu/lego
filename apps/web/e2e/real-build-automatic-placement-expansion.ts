import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  canonicalDigest,
  canonicalSha256,
  connectorCapacityClaimKeys,
  deepFreeze,
  describeConnectorCapacityClaimKey,
  getConnectorWorldFrame,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ProgramOperation, ScopeCapabilityV1 } from "@lego-studio/protocol";

import { assessSupport } from "../src/placement";
import {
  snapshotRealBuildAutomaticPlacementInput,
  type RealBuildAutomaticPlacementInput,
  type RealBuildAutomaticPlacementWitness,
} from "./real-build-automatic-placement-input";
import {
  measureRealBuildAutomaticPlacementBaseWork,
  measureRealBuildAutomaticPlacementWork,
  requireRealBuildAutomaticPlacementWorkWithinCompilerLimits,
} from "./real-build-automatic-placement-work";
import {
  createRealBuildAutomaticScope,
  prepareRealBuildAutomaticPrintedStep,
  REAL_BUILD_AUTOMATIC_MAXIMUM_OPERATIONS,
  REAL_BUILD_AUTOMATIC_MAXIMUM_REQUIRED_BASE_PORTS,
  type RealBuildAutomaticPrintedStepProgram,
  type RealBuildPreparedAutomaticPrintedStep,
} from "./real-build-automatic-placement-step";

export type RealBuildAutomaticPlacementWitnessPolicy =
  "ordinary" | "intentionalDetachedSubassembly";

export interface PreparedRealBuildAutomaticPlacementExpansion {
  readonly policy: RealBuildAutomaticPlacementWitnessPolicy;
  readonly input: RealBuildAutomaticPlacementInput;
  readonly document: BrickDocumentV1;
  readonly preparedStep: RealBuildPreparedAutomaticPrintedStep;
  readonly placementProgram: RealBuildAutomaticPrintedStepProgram["placementProgram"];
  readonly automaticProgram: RealBuildAutomaticPrintedStepProgram;
  readonly placementScope: ScopeCapabilityV1;
  readonly combinedScope: ScopeCapabilityV1;
  readonly proposalId: string;
  readonly jobId: string;
}

type CapacityPart = Parameters<typeof getConnectorWorldFrame>[0];

function deterministicId(prefix: string, value: unknown): string {
  return `${prefix}-${canonicalSha256(value).slice(0, 24)}`;
}

function reserveCapacity(
  occupied: Map<string, string>,
  endpoints: readonly { readonly part: CapacityPart; readonly portId: string }[],
  label: string,
): void {
  const claims = endpoints.flatMap(({ part, portId }) =>
    connectorCapacityClaimKeys(getConnectorWorldFrame(part, portId)),
  );
  const pending = new Map<string, string>();
  for (const claim of claims) {
    const priorOwner = occupied.get(claim) ?? pending.get(claim);
    if (priorOwner !== undefined) {
      throw new TypeError(
        `${label} consumes ${describeConnectorCapacityClaimKey(claim)}, already reserved by ${priorOwner}; choose a non-overlapping endpoint.`,
      );
    }
    pending.set(claim, label);
  }
  for (const [claim, owner] of pending) occupied.set(claim, owner);
}

function requireDetachedWitnessShape(
  witnesses: readonly RealBuildAutomaticPlacementWitness[],
): void {
  if (witnesses.length < 2) {
    throw new RangeError(
      "Intentional detached-subassembly compilation requires at least two witnesses; one floating placement is never a subassembly.",
    );
  }
  if (witnesses[0]!.connections.length !== 0) {
    throw new TypeError(
      "Intentional detached-subassembly witness 0 must be the sole zero-edge root witness.",
    );
  }
  for (let index = 1; index < witnesses.length; index += 1) {
    if (!witnesses[index]!.connections.some(({ target }) => target.kind === "witness")) {
      throw new TypeError(
        `Intentional detached-subassembly witness ${index} must connect to an earlier witness in the new component.`,
      );
    }
  }
}

function requireBoundedWork(
  input: RealBuildAutomaticPlacementInput,
  preparationOperations: number,
): void {
  const work = measureRealBuildAutomaticPlacementWork({
    base: measureRealBuildAutomaticPlacementBaseWork(
      input.documentSnapshot.document,
      input.documentSnapshot.canonicalByteLength,
    ),
    printedStepNumber: input.printedStepNumber,
    printedStep: input.printedStep,
    witnesses: input.witnesses,
  });
  if (work.preparationOperations !== preparationOperations) {
    throw new TypeError(
      "Automatic placement compiler preparation and work policies disagree for this printed step.",
    );
  }
  requireRealBuildAutomaticPlacementWorkWithinCompilerLimits(work);
}

function programFor(
  document: BrickDocumentV1,
  targetStepId: string,
  proposalId: string,
  witnesses: readonly RealBuildAutomaticPlacementWitness[],
  policy: RealBuildAutomaticPlacementWitnessPolicy,
): {
  readonly operations: readonly ProgramOperation[];
  readonly requiredPorts: ScopeCapabilityV1["requiredAttachmentPorts"];
} {
  const operations: ProgramOperation[] = [];
  const localPartIds: string[] = [];
  const localParts: CapacityPart[] = [];
  const retained = new Map(document.parts.map((part) => [part.id, part]));
  const occupiedCapacityClaims = new Map<string, string>();
  for (const connection of document.connections) {
    reserveCapacity(
      occupiedCapacityClaims,
      [connection.a, connection.b].map(({ partId, portId }) => {
        const part = retained.get(partId);
        if (part === undefined) {
          throw new TypeError(
            `Automatic placement base connection ${JSON.stringify(connection.id)} names missing part ${JSON.stringify(partId)}.`,
          );
        }
        return { part, portId };
      }),
      `Automatic placement base connection ${JSON.stringify(connection.id)}`,
    );
  }
  const required = new Map<string, { partId: string; portId: string }>();
  witnesses.forEach((witness, index) => {
    const localPartId = deterministicId("candidate-part", { proposalId, index, witness });
    const localPart = {
      id: localPartId,
      catalogPartId: witness.catalogPartId,
      transform: witness.transform,
    };
    operations.push({
      kind: "placePart",
      operationId: `place-${index + 1}`,
      localPartId,
      catalogPartId: witness.catalogPartId,
      colorId: witness.colorId,
      transform: witness.transform,
      submodelId: document.submodels[0]?.id ?? "root",
      stepId: targetStepId,
      semanticTags: [],
    });
    const discovered = witness.connections.map((connection, connectionIndex) => {
      const targetPartId =
        connection.target.kind === "base"
          ? connection.target.partId
          : localPartIds[connection.target.witnessIndex];
      if (
        targetPartId === undefined ||
        (connection.target.kind === "witness" && connection.target.witnessIndex >= index)
      ) {
        throw new TypeError(
          `Witness ${index} connection ${connectionIndex} must target the base or an earlier witness.`,
        );
      }
      return { ...connection, targetPartId };
    });
    if (!(policy === "intentionalDetachedSubassembly" && index === 0)) {
      const support = assessSupport(
        { id: localPartId, catalogPartId: witness.catalogPartId, transform: witness.transform },
        discovered,
      );
      if (!support.supported) {
        throw new TypeError(
          `Automatic placement witness ${index} is not supported: ${support.reason}`,
        );
      }
    }
    discovered.forEach((connection, connectionIndex) => {
      const targetPart =
        connection.target.kind === "base"
          ? retained.get(connection.targetPartId)
          : localParts[connection.target.witnessIndex];
      if (targetPart === undefined) {
        throw new TypeError(
          `Witness ${index} connection ${connectionIndex} target is absent from the exact base and earlier witness set.`,
        );
      }
      reserveCapacity(
        occupiedCapacityClaims,
        [
          { part: targetPart, portId: connection.targetPortId },
          { part: localPart, portId: connection.candidatePortId },
        ],
        `Automatic placement witness ${index} connection ${connectionIndex}`,
      );
      operations.push({
        kind: "attach",
        operationId: `attach-${index + 1}-${connectionIndex + 1}`,
        a: { partId: connection.targetPartId, portId: connection.targetPortId },
        b: { partId: localPartId, portId: connection.candidatePortId },
        connectionKind: connection.connectionKind,
      });
      if (retained.has(connection.targetPartId)) {
        required.set(`${connection.targetPartId}\0${connection.targetPortId}`, {
          partId: connection.targetPartId,
          portId: connection.targetPortId,
        });
      }
    });
    localPartIds.push(localPartId);
    localParts.push(localPart);
  });
  if (required.size > REAL_BUILD_AUTOMATIC_MAXIMUM_REQUIRED_BASE_PORTS) {
    throw new RangeError(
      `Automatic placement requires ${required.size} base attachment ports above the ${REAL_BUILD_AUTOMATIC_MAXIMUM_REQUIRED_BASE_PORTS} scope limit.`,
    );
  }
  return intrinsicRealBuildFreeze({
    operations: intrinsicRealBuildFreeze(operations),
    requiredPorts: intrinsicRealBuildFreeze([...required.values()]),
  });
}

export function prepareRealBuildAutomaticPlacementExpansion(
  unsafeInput: unknown,
  policy: RealBuildAutomaticPlacementWitnessPolicy,
): PreparedRealBuildAutomaticPlacementExpansion {
  const input = snapshotRealBuildAutomaticPlacementInput(unsafeInput);
  if (policy === "intentionalDetachedSubassembly") {
    requireDetachedWitnessShape(input.witnesses);
  }
  const document = input.documentSnapshot.document;
  const compilerInputDigest = canonicalDigest({
    schemaVersion: "lego.real-build-automatic-placement-input/2",
    baseCanonicalBytesHash: input.documentSnapshot.canonicalBytesHash,
    baseCanonicalByteLength: input.documentSnapshot.canonicalByteLength,
    baseDocumentHash: input.documentSnapshot.documentHash,
    printedStepNumber: input.printedStepNumber,
    printedStep: input.printedStep,
    witnesses: input.witnesses,
  });
  const proposalId = deterministicId("real-build-proposal", { compilerInputDigest });
  const preparedStep = prepareRealBuildAutomaticPrintedStep({
    document,
    printedStepNumber: input.printedStepNumber,
    metadata: input.printedStep,
    compilerInputDigest,
  });
  const program = programFor(
    preparedStep.documentWithStep,
    preparedStep.step.id,
    proposalId,
    input.witnesses,
    policy,
  );
  const placementProgram = deepFreeze({
    schemaVersion: "lego.build-program/1" as const,
    operations: program.operations,
  });
  const automaticProgram: RealBuildAutomaticPrintedStepProgram = deepFreeze({
    schemaVersion: "lego.real-build-automatic-printed-step-program/1",
    compilerInputDigest,
    baseCanonicalBytesHash: input.documentSnapshot.canonicalBytesHash,
    baseCanonicalByteLength: input.documentSnapshot.canonicalByteLength,
    baseDocumentHash: input.documentSnapshot.documentHash,
    printedStepNumber: input.printedStepNumber,
    printedStep: input.printedStep,
    preparationOperations: preparedStep.preparationOperations,
    placementProgram,
  });
  const combinedOperationCount =
    program.operations.length + preparedStep.preparationOperations.length;
  if (combinedOperationCount > REAL_BUILD_AUTOMATIC_MAXIMUM_OPERATIONS) {
    throw new RangeError(
      `Automatic printed step expands to ${combinedOperationCount} operations above the ${REAL_BUILD_AUTOMATIC_MAXIMUM_OPERATIONS}-operation compiler limit.`,
    );
  }
  requireBoundedWork(input, preparedStep.preparationOperations.length);
  const placementScope = createRealBuildAutomaticScope({
    document: preparedStep.documentWithStep,
    printedStepNumber: input.printedStepNumber,
    maximumAddedParts: input.witnesses.length,
    maximumOperations: program.operations.length,
    requiredAttachmentPorts: program.requiredPorts,
    compilerInputDigest,
    phase: "placement",
  });
  const combinedScope = createRealBuildAutomaticScope({
    document,
    printedStepNumber: input.printedStepNumber,
    maximumAddedParts: input.witnesses.length,
    maximumOperations: combinedOperationCount,
    requiredAttachmentPorts: program.requiredPorts,
    compilerInputDigest,
    phase: "combined",
  });
  return intrinsicRealBuildFreeze({
    policy,
    input,
    document,
    preparedStep,
    placementProgram,
    automaticProgram,
    placementScope,
    combinedScope,
    proposalId,
    jobId: deterministicId("real-build-job", { compilerInputDigest }),
  });
}
