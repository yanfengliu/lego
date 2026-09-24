import {
  createEmptyBrickDocument,
  createPartInstance,
  deriveBuildSequence,
  exportBrickDocumentToLDraw,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import { occupiedConnectorCapacityClaims } from "../../apps/web/src/connector-capacity.ts";
import { findStudConnections } from "../../apps/web/src/placement.ts";
import {
  assemblyOfPart,
  connectedComponents,
  MODEL_ASSEMBLY,
  type PlacedPart,
  type Playback,
} from "./playback.ts";

/**
 * The reference build as a file the editor imports: the valid prefix of the
 * reference playback, one document step per printed booklet step, written in
 * the editor's own LDraw subset (`importBrickDocumentFromLDraw`) so its build
 * playback steps through the booklet one printed step at a time.
 *
 * It is LEGO's official model, not anything the product read from the
 * booklet, and says so where the editor shows it: in the document name and in
 * every step name. It carries official poses, so main.ts writes it only to
 * ignored output. A colour the catalog lacks is drawn in a stand-in colour
 * and the part is tagged `colour-stand-in-ldraw-<code>`; its step name counts
 * the stand-ins.
 *
 * Playback holds a sub-build apart until the printed step that attaches it
 * (sub-build-attach.ts). The file is one document and draws every part where
 * it ends up, so a state may hold a pending sub-build unconnected to the rest.
 * The file runs through the last valid playback step when three things hold:
 * - every state it holds (one per printed step) is one the editor's build
 *   playback calls buildable: the kernel's own `deriveBuildSequence`, which
 *   allows no blocking code but DISCONNECTED_ASSEMBLY;
 * - each disconnection in those states falls between assemblies playback
 *   holds apart after that step (a pending sub-build), never through one (the
 *   model in two pieces, or a sub-build split);
 * - the kernel's LDraw exporter accepts the document. The exporter, like the
 *   importer, takes only a globally valid document, so the last state cannot
 *   be one where a pending sub-build is still apart.
 * Otherwise the file is cut back to the longest prefix that passes, and
 * `shortenedBy` names the first step left out, with the codes or the refusal.
 * The file is centred on the parts of the whole valid prefix, so a file cut
 * short is exactly a prefix of the document whose states were judged.
 */
export const REFERENCE_BUILD_FILE = "reference-build.mpd";
export const REFERENCE_BUILD_LIMITS = Object.freeze({ maxParts: 10_000 });
/** Opaque stand-in for a colour the catalog lacks (LDraw 47 trans-clear is the first). */
export const REFERENCE_STAND_IN_COLOR_ID = "builtin:very-light-gray";

export interface ReferenceBuildStep {
  readonly step: number;
  readonly page: number;
  readonly added: number;
  readonly cumulative: number;
  readonly colorStandIns: number;
  /**
   * Parts were built before this step, and the step places a part in a
   * sub-build that playback held nowhere after the step before and still
   * holds apart after this one. The file draws it where it ends up; the
   * booklet may draw it on its own first.
   */
  readonly startsSubBuild: boolean;
}

/** What the editor's playback bar shows for a printed step. */
export function referenceStepName(step: ReferenceBuildStep): string {
  const notes = ["reference"];
  if (step.added === 0) notes.push("no new parts");
  if (step.startsSubBuild) notes.push("sub-build drawn in place");
  if (step.colorStandIns > 0) {
    notes.push(`${step.colorStandIns} colour stand-in${step.colorStandIns === 1 ? "" : "s"}`);
  }
  return `Printed step ${step.step} (p. ${step.page}) · ${notes.join(" · ")}`;
}

export interface ReferenceBuild {
  readonly throughStep: number;
  /** The whole-stud horizontal move applied on top of playback's world shift. */
  readonly centringLdu: readonly [number, number, number];
  readonly steps: readonly ReferenceBuildStep[];
  readonly document: BrickDocumentV1;
}

export type ReferenceBuildResult =
  | ({ readonly status: "built" } & ReferenceBuild & {
        readonly text: string;
        /** Why the file stops before the end of the valid prefix, or null when it does not. */
        readonly shortenedBy: string | null;
      })
  | { readonly status: "not-built"; readonly reason: string };

/**
 * What status.json records about the file: which printed steps it holds and,
 * when it stops before the valid prefix ends, why. A reader of the file (the
 * opt-in reference-build playback spec) holds it to this record, so a file
 * cut short without a recorded reason cannot pass.
 */
export type ReferenceBuildRecord =
  | {
      readonly status: "built";
      readonly file: string;
      /** Last step of the valid playback prefix the file was cut from. */
      readonly validThrough: number;
      readonly firstStep: number;
      readonly throughStep: number;
      readonly parts: number;
      readonly colorStandIns: number;
      readonly shortenedBy: string | null;
      readonly steps: readonly Omit<ReferenceBuildStep, "page">[];
    }
  | { readonly status: "not-built"; readonly reason: string };

export function referenceBuildRecord(
  result: ReferenceBuildResult,
  playback: Pick<Playback, "steps">,
): ReferenceBuildRecord {
  if (result.status === "not-built") return result;
  return {
    status: "built",
    file: REFERENCE_BUILD_FILE,
    validThrough: validPrefixEnd(playback) ?? result.throughStep,
    firstStep: result.steps[0]!.step,
    throughStep: result.throughStep,
    parts: result.document.parts.length,
    colorStandIns: result.steps.reduce((sum, { colorStandIns }) => sum + colorStandIns, 0),
    shortenedBy: result.shortenedBy,
    steps: result.steps.map(({ step, added, cumulative, colorStandIns, startsSubBuild }) => ({
      step,
      added,
      cumulative,
      colorStandIns,
      startsSubBuild,
    })),
  };
}

const pad = (value: number) => String(value).padStart(3, "0");
const stepIdOf = (step: number) => `printed-step-${pad(step)}`;

/**
 * A whole-stud horizontal move that centres the parts' origins on the build
 * plate. Playback shifts the official model only vertically and by a few LDU,
 * which left the official model beside the editor's grid; a multiple of 20 LDU keeps
 * every part on its stud lattice and every connection intact.
 */
export function centringShift(
  placed: readonly { readonly transform: { readonly positionLdu: readonly number[] } }[],
): readonly [number, number, number] {
  if (placed.length === 0) return [0, 0, 0];
  const centre = (axis: number) => {
    const values = placed.map(({ transform }) => transform.positionLdu[axis]!);
    return (Math.min(...values) + Math.max(...values)) / 2;
  };
  const toStud = (value: number) => -Math.round(value / 20) * 20 || 0;
  return [toStud(centre(0)), 0, toStud(centre(2))];
}

/** The last step of the run of valid steps that starts at the first step, or null. */
export function validPrefixEnd(playback: Pick<Playback, "steps">): number | null {
  let end: number | null = null;
  for (const step of playback.steps) {
    if (step.status !== "valid") break;
    end = step.step;
  }
  return end;
}

/** The valid prefix placed once: parts in step order, the connections between them, and step rows. */
interface PlacedPrefix {
  readonly centringLdu: readonly [number, number, number];
  readonly parts: readonly PartInstance[];
  readonly connections: readonly ConnectionEdge[];
  readonly steps: readonly ReferenceBuildStep[];
  /** The playback part each file part was made from, by file part id. */
  readonly sourceOf: ReadonlyMap<string, PlacedPart>;
}

/**
 * Places printed steps up to `throughStep`, centred on their parts.
 * Connections are found the way the editor's place command finds them, each
 * part against every part already placed, so the file's declared edges are
 * the ones the importer infers, and those of an earlier step never depend on
 * a later one.
 */
function placePrefix(
  playback: Pick<Playback, "steps" | "placed">,
  throughStep: number,
): PlacedPrefix {
  const stepRows = playback.steps.filter(({ step }) => step <= throughStep);
  const placedThrough = playback.placed.filter(({ step }) => step <= throughStep);
  const centring = centringShift(placedThrough);
  const parts: PartInstance[] = [];
  const connections: ConnectionEdge[] = [];
  const steps: ReferenceBuildStep[] = [];
  const sourceOf = new Map<string, PlacedPart>();
  let previous: number | null = null;
  for (const row of stepRows) {
    const placed = placedThrough.filter(({ step }) => step === row.step);
    const heldBefore = new Set(
      previous === null
        ? []
        : [...sourceOf.values()].map((part) => assemblyOfPart(part, previous!)),
    );
    let standIns = 0;
    placed.forEach((brick, index) => {
      const standIn = brick.colorId === null;
      if (standIn) standIns += 1;
      const part = createPartInstance({
        id: `step-${pad(row.step)}-part-${pad(index + 1)}`,
        catalogPartId: brick.catalogPartId,
        colorId: brick.colorId ?? REFERENCE_STAND_IN_COLOR_ID,
        transform: {
          ...brick.transform,
          positionLdu: [
            brick.transform.positionLdu[0] + centring[0],
            brick.transform.positionLdu[1],
            brick.transform.positionLdu[2] + centring[2],
          ],
        },
        source: "import",
        stepId: stepIdOf(row.step),
        semanticTags: standIn ? [`colour-stand-in-ldraw-${brick.ldrawColor}`] : [],
      });
      const occupied = new Set(occupiedConnectorCapacityClaims(parts, connections));
      for (const found of findStudConnections(part, parts, occupied)) {
        connections.push({
          id: `connection-${pad(connections.length + 1)}`,
          kind: "stud-tube",
          a: { partId: found.targetPartId, portId: found.targetPortId },
          b: { partId: part.id, portId: found.candidatePortId },
          provenance: { source: "import" },
        });
      }
      parts.push(part);
      sourceOf.set(part.id, brick);
    });
    const opens = placed.some((brick) => {
      const assembly = assemblyOfPart(brick, row.step);
      return assembly !== MODEL_ASSEMBLY && !heldBefore.has(assembly);
    });
    steps.push({
      step: row.step,
      page: row.page,
      added: placed.length,
      cumulative: parts.length,
      colorStandIns: standIns,
      startsSubBuild: parts.length > placed.length && opens,
    });
    previous = row.step;
  }
  return { centringLdu: centring, parts, connections, steps, sourceOf };
}

/** The document for the placed prefix's printed steps up to `throughStep`. */
function documentThrough(prefix: PlacedPrefix, throughStep: number): ReferenceBuild {
  const steps = prefix.steps.filter(({ step }) => step <= throughStep);
  const stepIds = new Set(steps.map(({ step }) => stepIdOf(step)));
  const parts = prefix.parts.filter(({ stepId }) => stepIds.has(stepId));
  const partIds = new Set(parts.map(({ id }) => id));
  const connections = prefix.connections.filter(
    ({ a, b }) => partIds.has(a.partId) && partIds.has(b.partId),
  );
  const first = steps[0]?.step ?? throughStep;
  const base = createEmptyBrickDocument({
    id: "booklet-reference-build",
    name: `REFERENCE BUILD from LEGO's official model (printed steps ${first}-${throughStep}), not read from the booklet`,
    maxParts: REFERENCE_BUILD_LIMITS.maxParts,
  });
  const document: BrickDocumentV1 = {
    ...base,
    parts,
    connections,
    submodels: [{ ...base.submodels[0]!, partIds: parts.map(({ id }) => id) }],
    steps: steps.map((step) => ({
      id: stepIdOf(step.step),
      index: step.step,
      name: referenceStepName(step),
      partIds: parts.filter(({ stepId }) => stepId === stepIdOf(step.step)).map(({ id }) => id),
    })),
  };
  return { throughStep, centringLdu: prefix.centringLdu, steps, document };
}

interface StateVerdict {
  readonly step: number;
  /** Why the file cannot hold this state, or null when it can. */
  readonly refusal: string | null;
  /** The state is disconnected, and only between assemblies playback holds apart. */
  readonly apart: boolean;
}

/** Assemblies playback holds as one after `step` that the state's document leaves in pieces. */
function splitAssemblies(
  document: BrickDocumentV1,
  sourceOf: ReadonlyMap<string, PlacedPart>,
  step: number,
): string[] {
  const pieces = new Map<string, Set<number>>();
  connectedComponents(document.parts, document.connections).forEach((component, index) => {
    for (const id of component) {
      const assembly = assemblyOfPart(sourceOf.get(id)!, step)!;
      pieces.set(assembly, (pieces.get(assembly) ?? new Set<number>()).add(index));
    }
  });
  return [...pieces]
    .filter(([, components]) => components.size > 1)
    .map(
      ([assembly, components]) =>
        `${assembly === MODEL_ASSEMBLY ? "the model" : "a pending sub-build"} is in ${components.size} unconnected pieces`,
    );
}

/** Every state of `document`, one per printed step, judged by the kernel's build-sequence rule and against playback. */
function judgeStates(prefix: PlacedPrefix, document: BrickDocumentV1): StateVerdict[] {
  return deriveBuildSequence(document)
    .states.filter(({ stepIndex }) => stepIndex >= 0)
    .map((state) => {
      const step = state.stepIndex;
      if (!state.buildable) {
        return {
          step,
          refusal: `the editor's build playback calls it unbuildable (${state.blockingCodes.join(", ")})`,
          apart: false,
        };
      }
      if (state.connected) return { step, refusal: null, apart: false };
      const split = splitAssemblies(state.document, prefix.sourceOf, step);
      return split.length === 0
        ? { step, refusal: null, apart: true }
        : {
            step,
            refusal: `DISCONNECTED_ASSEMBLY that no pending sub-build explains (${split.join("; ")})`,
            apart: false,
          };
    });
}

/** One summary line: what was written and how to open it, or why nothing was. */
export function referenceBuildLine(result: ReferenceBuildResult, path: string): string {
  if (result.status === "not-built") return `[reference build] not written: ${result.reason}`;
  const standIns = result.steps.reduce((sum, { colorStandIns }) => sum + colorStandIns, 0);
  return `[reference build] printed steps ${result.steps[0]!.step}..${result.throughStep} (${result.document.parts.length} parts, ${standIns} colour stand-ins, centred by [${result.centringLdu.join(", ")}] LDU)${result.shortenedBy ? `, cut short at ${result.shortenedBy}` : ""} → ${path}; open it with the editor's Import, then Build playback`;
}

/**
 * The valid prefix as editor-importable LDraw, or why it cannot be written:
 * through the last valid playback step when every state passes and the
 * exporter accepts it, else cut back as the module comment says.
 */
export function buildReferenceFile(
  playback: Pick<Playback, "steps" | "placed">,
): ReferenceBuildResult {
  const validEnd = validPrefixEnd(playback);
  if (validEnd === null) return { status: "not-built", reason: "no printed step is valid" };
  const prefix = placePrefix(playback, validEnd);
  const verdicts = judgeStates(prefix, documentThrough(prefix, validEnd).document);
  const refused = verdicts.find(({ refusal }) => refusal !== null);
  let refusal = refused ? `step ${refused.step}: ${refused.refusal}` : null;
  const ends = verdicts
    .filter(({ step }) => refused === undefined || step < refused.step)
    .reverse();
  for (const { step: end, apart } of ends) {
    const build = documentThrough(prefix, end);
    try {
      const text = exportBrickDocumentToLDraw(build.document);
      return { status: "built", ...build, text, shortenedBy: refusal };
    } catch (error) {
      const note = apart ? " (a pending sub-build is still apart there)" : "";
      refusal = `step ${end}: the LDraw exporter refused it${note}: ${(error as Error).message}`;
    }
  }
  return { status: "not-built", reason: `steps up to ${validEnd} are valid, but ${refusal}` };
}
