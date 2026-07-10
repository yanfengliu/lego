import { COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";
import {
  compileBuildProgram,
  documentStructuralHash,
  type CompilationResult,
} from "@lego-studio/brick-kernel";
import type {
  BrickDocumentV1,
  BuildProgramV1,
  ProgramOperation,
  ScopeCapabilityV1,
} from "@lego-studio/protocol";

export interface LocalPlan {
  readonly strategy: "tower";
  readonly summary: string;
  readonly program: BuildProgramV1;
}

function requestedHeight(prompt: string): number {
  const match = prompt.match(/\b([1-8])\b/);
  return match ? Number(match[1]) : 4;
}

export function createLocalPromptPlan(prompt: string): LocalPlan {
  const height = requestedHeight(prompt.toLowerCase());
  const operations: ProgramOperation[] = [];
  for (let index = 0; index < height; index += 1) {
    const localPartId = `level-${index + 1}`;
    operations.push({
      kind: "placePart",
      operationId: `place-level-${index + 1}`,
      localPartId,
      catalogPartId: "builtin:brick-1x2",
      colorId: index % 2 === 0 ? "builtin:red" : "builtin:yellow",
      transform: {
        positionLdu: [0, index * -24, 0],
        orientationId: index % 2 === 0 ? "upright-yaw-0" : "upright-yaw-180",
      },
      submodelId: "root",
      stepId: "step-1",
      semanticTags: ["tower", `level-${index + 1}`],
    });
    if (index > 0) {
      for (let studIndex = 0; studIndex < 2; studIndex += 1) {
        operations.push({
          kind: "attach",
          operationId: `attach-level-${index}-stud-${studIndex}`,
          a: { partId: `level-${index}`, portId: `stud:0:${studIndex}` },
          b: { partId: localPartId, portId: `undersideClutch:0:${1 - studIndex}` },
          connectionKind: "stud-tube",
        });
      }
    }
  }

  return {
    strategy: "tower",
    summary: `${height}-level alternating-color tower`,
    program: { schemaVersion: "lego.build-program/1", operations },
  };
}

export function createLocalAssistantScope(
  document: BrickDocumentV1,
  maxAddedParts: number,
): ScopeCapabilityV1 {
  return {
    schemaVersion: "lego.scope-capability/1",
    capabilityId: "local-preview-scope",
    baseRevision: document.revision,
    baseDocumentHash: documentStructuralHash(document),
    frozenPartIds: document.parts.map(({ id }) => id),
    mutablePartIds: [],
    requiredAttachmentPorts: [],
    allowedVolume: { minLdu: [-400, -400, -400], maxLdu: [400, 400, 400] },
    allowedCatalogPartIds: PART_DEFINITIONS.map(({ id }) => id),
    allowedColorIds: COLOR_DEFINITIONS.map(({ id }) => id),
    budgets: {
      maxAddedParts,
      maxRemovedParts: 0,
      maxOperations: Math.max(1, maxAddedParts * 3),
    },
  };
}

export function compileLocalPromptPreview(
  document: BrickDocumentV1,
  prompt: string,
): { readonly plan: LocalPlan; readonly result: CompilationResult } {
  const plan = createLocalPromptPlan(prompt);
  const addedParts = plan.program.operations.filter(({ kind }) => kind === "placePart").length;
  return {
    plan,
    result: compileBuildProgram(document, plan.program, {
      scope: createLocalAssistantScope(document, addedParts),
      jobId: "local-preview-job",
      candidateId: "local-preview-candidate",
    }),
  };
}
