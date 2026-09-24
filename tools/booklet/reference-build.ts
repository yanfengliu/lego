import {
  createEmptyBrickDocument,
  createPartInstance,
  exportBrickDocumentToLDraw,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

import { occupiedConnectorCapacityClaims } from "../../apps/web/src/connector-capacity.ts";
import { findStudConnections } from "../../apps/web/src/placement.ts";
import type { Playback } from "./playback.ts";

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
   * The step opens a sub-build playback holds apart from what is already built.
   * The file draws it where it ends up; the booklet may draw it on its own first.
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

/**
 * The document for printed steps up to `throughStep`. Connections are found
 * the way the editor's place command finds them, each part against every part
 * already placed, so the file's declared edges are the ones the importer infers.
 */
export function referenceBuildDocument(
  playback: Pick<Playback, "steps" | "placed">,
  throughStep: number,
): ReferenceBuild {
  const stepRows = playback.steps.filter(({ step }) => step <= throughStep);
  const centring = centringShift(playback.placed.filter(({ step }) => step <= throughStep));
  const parts: PartInstance[] = [];
  const connections: ConnectionEdge[] = [];
  const steps: ReferenceBuildStep[] = [];
  let pending = 0;
  for (const row of stepRows) {
    const placed = playback.placed.filter(({ step }) => step === row.step);
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
    });
    steps.push({
      step: row.step,
      page: row.page,
      added: placed.length,
      cumulative: parts.length,
      colorStandIns: standIns,
      startsSubBuild: parts.length > placed.length && row.pendingSubAssemblies > pending,
    });
    pending = row.pendingSubAssemblies;
  }
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
  return { throughStep, centringLdu: centring, steps, document };
}

/** One summary line: what was written and how to open it, or why nothing was. */
export function referenceBuildLine(result: ReferenceBuildResult, path: string): string {
  if (result.status === "not-built") return `[reference build] not written: ${result.reason}`;
  const standIns = result.steps.reduce((sum, { colorStandIns }) => sum + colorStandIns, 0);
  return `[reference build] printed steps ${result.steps[0]!.step}..${result.throughStep} (${result.document.parts.length} parts, ${standIns} colour stand-ins, centred by [${result.centringLdu.join(", ")}] LDU)${result.shortenedBy ? `, cut short at ${result.shortenedBy}` : ""} → ${path}; open it with the editor's Import, then Build playback`;
}

/**
 * The valid prefix as editor-importable LDraw, or why it cannot be written.
 *
 * Playback holds a sub-build apart until the step that attaches it, but the
 * editor imports only one hard-valid, connected document. A valid prefix whose
 * last states the editor cannot hold is cut back to the longest one it can,
 * and `shortenedBy` names the first step left out and why.
 */
export function buildReferenceFile(
  playback: Pick<Playback, "steps" | "placed">,
): ReferenceBuildResult {
  const validEnd = validPrefixEnd(playback);
  if (validEnd === null) return { status: "not-built", reason: "no printed step is valid" };
  const ends = playback.steps.map(({ step }) => step).filter((step) => step <= validEnd);
  let refusal: string | null = null;
  for (const end of ends.reverse()) {
    const build = referenceBuildDocument(playback, end);
    const report = validateBrickDocument(build.document);
    let why: string;
    if (report.documentGloballyValid) {
      try {
        const text = exportBrickDocumentToLDraw(build.document);
        return { status: "built", ...build, text, shortenedBy: refusal };
      } catch (error) {
        why = `the LDraw exporter refused it: ${(error as Error).message}`;
      }
    } else {
      why = `not one hard-valid document (${[...new Set(report.issues.map(({ code }) => code))].join(", ")})`;
    }
    refusal = `step ${end}: ${why}`;
  }
  return { status: "not-built", reason: `steps up to ${validEnd} are valid, but ${refusal}` };
}
