import {
  COLOR_DEFINITIONS,
  PART_DEFINITIONS,
  STUD_PITCH_LDU,
  type PartDefinition,
} from "@lego-studio/catalog";
import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";
import type { BuildProgramV1, ProgramOperation } from "@lego-studio/protocol";

import { MAX_MAKER_PARTS, MIN_MAKER_PARTS } from "./brief.ts";
import type { CandidateGenerationFailure, NormalizedTextBrief, SupportedShape } from "./types.ts";

export const MAX_GENERATED_PROGRAM_OPERATIONS = 512;

interface Recipe {
  readonly strategyId: string;
  readonly shape: SupportedShape;
  readonly layout: "aligned" | "stepped";
  readonly partIds: readonly string[];
  readonly palette: "requested" | "primary" | "requested-reversed" | "allowed";
}

export interface GeneratedProgramDraft {
  readonly strategyId: string;
  readonly shape: SupportedShape;
  readonly program: BuildProgramV1;
  readonly programHash: ReturnType<typeof canonicalDigest>;
}

export interface GeneratedProgramFailure {
  readonly strategyId: string;
  readonly shape: SupportedShape;
  readonly failure: CandidateGenerationFailure;
}

export type GeneratedRecipeResult = GeneratedProgramDraft | GeneratedProgramFailure;

interface Placement {
  readonly localPartId: string;
  readonly definition: PartDefinition;
  readonly colorId: string;
  readonly positionLdu: readonly [number, number, number];
}

const recipes: readonly Recipe[] = [
  {
    strategyId: "deterministic.compact-tower/1",
    shape: "tower",
    layout: "aligned",
    partIds: ["builtin:brick-1x2"],
    palette: "requested",
  },
  {
    strategyId: "deterministic.zigzag-staircase/1",
    shape: "staircase",
    layout: "stepped",
    partIds: ["builtin:brick-1x2"],
    palette: "primary",
  },
  {
    strategyId: "deterministic.mixed-spire/1",
    shape: "spire",
    layout: "aligned",
    partIds: ["builtin:brick-1x1", "builtin:plate-1x1"],
    palette: "requested-reversed",
  },
  {
    strategyId: "deterministic.block-column/1",
    shape: "column",
    layout: "aligned",
    partIds: ["builtin:brick-2x2"],
    palette: "allowed",
  },
];

function orderedRecipes(requested: SupportedShape): readonly Recipe[] {
  return [
    ...recipes.filter(({ shape }) => shape === requested),
    ...recipes.filter(({ shape }) => shape !== requested),
  ];
}

function selectPartDefinitions(
  recipe: Recipe,
  allowedPartIds: ReadonlySet<string>,
): readonly PartDefinition[] {
  const preferred = recipe.partIds
    .map((id) => PART_DEFINITIONS.find((part) => part.id === id))
    .filter((part): part is PartDefinition => part !== undefined && allowedPartIds.has(part.id));
  if (preferred.length === recipe.partIds.length) return preferred;
  const fallback = PART_DEFINITIONS.find(({ id }) => allowedPartIds.has(id));
  return fallback ? [fallback] : [];
}

function selectPalette(recipe: Recipe, brief: NormalizedTextBrief): readonly string[] {
  switch (recipe.palette) {
    case "primary":
      return [brief.requestedColorIds[0]!];
    case "requested-reversed":
      return [...brief.requestedColorIds].reverse();
    case "allowed":
      return brief.allowedColorIds;
    case "requested":
      return brief.requestedColorIds;
  }
}

function layoutPlacements(
  recipe: Recipe,
  definitions: readonly PartDefinition[],
  colors: readonly string[],
  partCount: number,
  brief: NormalizedTextBrief,
): readonly Placement[] {
  const raw: Placement[] = [];
  for (let index = 0; index < partCount; index += 1) {
    const definition = definitions[index % definitions.length]!;
    const previous = raw[index - 1];
    const y = previous
      ? previous.positionLdu[1] -
        (previous.definition.dimensions.heightLdu + definition.dimensions.heightLdu) / 2
      : 0;
    const canStep = recipe.layout === "stepped" && definition.dimensions.lengthStuds >= 2;
    raw.push({
      localPartId: `part-${index + 1}`,
      definition,
      colorId: colors[index % colors.length]!,
      positionLdu: [0, y, canStep ? index * STUD_PITCH_LDU : 0],
    });
  }

  const modelMin = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const modelMax = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const placement of raw) {
    for (let axis = 0; axis < 3; axis += 1) {
      modelMin[axis] = Math.min(
        modelMin[axis]!,
        placement.positionLdu[axis]! + placement.definition.boundsLdu.min[axis]!,
      );
      modelMax[axis] = Math.max(
        modelMax[axis]!,
        placement.positionLdu[axis]! + placement.definition.boundsLdu.max[axis]!,
      );
    }
  }
  const shift = modelMin.map((minimum, axis) => {
    const availableCenter =
      (brief.generationVolume.minLdu[axis]! + brief.generationVolume.maxLdu[axis]!) / 2;
    return Math.round(availableCenter - (minimum + modelMax[axis]!) / 2);
  });
  return raw.map((placement) => ({
    ...placement,
    positionLdu: placement.positionLdu.map((value, axis) => value + shift[axis]!) as [
      number,
      number,
      number,
    ],
  }));
}

function connectionOperations(
  lower: Placement,
  upper: Placement,
  level: number,
): readonly ProgramOperation[] {
  const upperPorts = new Map(
    upper.definition.connectors
      .filter(({ kind }) => kind === "undersideClutch")
      .map((port) => [
        port.positionLdu.map((value, axis) => value + upper.positionLdu[axis]!).join(","),
        port,
      ]),
  );
  return lower.definition.connectors
    .filter(({ kind }) => kind === "stud")
    .flatMap((port, portIndex): readonly ProgramOperation[] => {
      const worldKey = port.positionLdu
        .map((value, axis) => value + lower.positionLdu[axis]!)
        .join(",");
      const upperPort = upperPorts.get(worldKey);
      return upperPort
        ? [
            {
              kind: "attach",
              operationId: `attach-${level}-${portIndex + 1}`,
              a: { partId: lower.localPartId, portId: port.id },
              b: { partId: upper.localPartId, portId: upperPort.id },
              connectionKind: "stud-tube",
            },
          ]
        : [];
    });
}

function buildProgram(placements: readonly Placement[]): BuildProgramV1 | null {
  const operations: ProgramOperation[] = [];
  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index]!;
    operations.push({
      kind: "placePart",
      operationId: `place-${index + 1}`,
      localPartId: placement.localPartId,
      catalogPartId: placement.definition.id,
      colorId: placement.colorId,
      transform: { positionLdu: placement.positionLdu, orientationId: "upright-yaw-0" },
      submodelId: "root",
      stepId: "step-1",
      semanticTags: ["generated"],
    });
    if (index === 0) continue;
    const connections = connectionOperations(placements[index - 1]!, placement, index);
    if (connections.length === 0) return null;
    operations.push(...connections);
  }
  return { schemaVersion: "lego.build-program/1", operations };
}

function generateRecipe(
  recipe: Recipe,
  brief: NormalizedTextBrief,
  maxOperations: number,
): GeneratedRecipeResult {
  const definitions = selectPartDefinitions(recipe, new Set(brief.allowedCatalogPartIds));
  const palette = selectPalette(recipe, brief).filter((colorId) =>
    COLOR_DEFINITIONS.some(({ id }) => id === colorId),
  );
  for (
    let partCount = Math.min(brief.targetPartCount, MAX_MAKER_PARTS);
    partCount >= MIN_MAKER_PARTS;
    partCount -= 1
  ) {
    const placements = layoutPlacements(recipe, definitions, palette, partCount, brief);
    const program = buildProgram(placements);
    if (program === null) {
      return {
        strategyId: recipe.strategyId,
        shape: recipe.shape,
        failure: {
          stage: "generation",
          code: "NO_CONNECTION_PATH",
          message: "Recipe could not connect every adjacent placement through catalog ports",
        },
      };
    }
    if (
      program.operations.length <= maxOperations &&
      program.operations.length <= MAX_GENERATED_PROGRAM_OPERATIONS
    ) {
      return deepFreeze({
        strategyId: recipe.strategyId,
        shape: recipe.shape,
        program,
        programHash: canonicalDigest(program),
      });
    }
  }
  return {
    strategyId: recipe.strategyId,
    shape: recipe.shape,
    failure: {
      stage: "generation",
      code: "OPERATION_BUDGET_TOO_SMALL",
      message: "Recipe cannot create a connected ten-part model within the operation budget",
    },
  };
}

export function generateDeterministicPrograms(
  brief: NormalizedTextBrief,
  maxOperations: number,
): readonly GeneratedRecipeResult[] {
  return deepFreeze(
    orderedRecipes(brief.requestedShape)
      .slice(0, brief.candidateLimit)
      .map((recipe) => generateRecipe(recipe, brief, maxOperations)),
  );
}
