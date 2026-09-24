import { getPartDefinition, PROPER_ORIENTATIONS } from "@lego-studio/catalog";

import { SET_6651557_MEASURED_BLUEPRINTS } from "../../packages/catalog/src/part-blueprints-6651557-measured.ts";
import {
  lxfmlPoseInLdrawConvention,
  type AnswerKey,
  type ExportDesignFrame,
} from "./answer-key/index.ts";
import {
  isCatalogSelfMotion,
  ldrawMotionInCatalog,
  multiply,
  rotate,
  transpose,
} from "./frame-checks.ts";
import type { FramePin, FramePinsLoad } from "./frame-pins.ts";
import { catalogFrameFor, type OfficialPose } from "./playback-pose.ts";

const catalogFrameMatrix = (orientationId: string): readonly number[] =>
  PROPER_ORIENTATIONS.find(({ id }) => id === orientationId)!.matrix;

/**
 * Stage check: are the official export's per-design frames right?
 *
 * The pairing check (official-ldraw.ts) proves only that every instance of a
 * design agrees; one wrong frame used for every instance passes it. So each
 * design's frame is compared with the two places this repository records a
 * Builder-to-LDraw frame: the pins of scripts/builder_ldraw_frame_pins.py
 * (turn and origin, digest recomputed) and the catalog, whose measured parts
 * carry the digest of the frame their connectors were derived from
 * (`builderSource.frameSha256`). A frame that differs from its pin only by a
 * symmetry of the part (the catalog's connectors and bounds map onto
 * themselves) places the part identically and is reported as equivalent.
 *
 * Bound: only pinned designs can be checked (8 designs today); every other
 * design's export frame is unchecked, and the summary says how many.
 *
 * Corrections are a separate, explicit layer: a pinned design whose export
 * frame disagrees takes the pin, and REVIEWED_CORRECTIONS lists frames fixed
 * by review with no pin behind them. Each applies only while the export shows
 * exactly the frame that was reviewed, and playback reports its result both
 * with and without the layer.
 */
export const EXPORT_FRAMES_VERSION = "lego.booklet-export-frames/1";

export interface ReviewedCorrection {
  readonly designId: string;
  /** The export frame the review examined; the correction is stale once the export differs. */
  readonly reviewedExport: {
    readonly turn: readonly number[];
    readonly originLdu: readonly number[];
  };
  readonly originLdu: readonly number[];
  readonly why: string;
}

/** Frames fixed by review, with no Builder record behind them. Fitted evidence, and labelled so. */
export const REVIEWED_CORRECTIONS: readonly ReviewedCorrection[] = Object.freeze([
  {
    designId: "80015",
    reviewedExport: { turn: [0, 0, 1, 0, 1, 0, -1, 0, 0], originLdu: [50, 8, -30] },
    originLdu: [-10, 8, -70],
    why: "review 2026-09-23: keeps the export's turn and moves the LXFML origin to the stud at LDraw (-10, 8, -70), which alone takes playback from valid through 1 to 25; the quarter turn instead clears step 2 but disconnects step 1. Chosen by a playback search over the ring's stud positions, not derived from a Builder record.",
  },
]);

export type FrameVerdict = "agrees" | "equivalent by symmetry" | "disagrees";

export interface PinComparison {
  readonly designId: string;
  readonly designRevision: string;
  readonly filename: string;
  readonly instances: number;
  readonly verdict: FrameVerdict | "unusable pin";
  readonly export: {
    readonly turn: readonly number[] | null;
    readonly originLdu: readonly number[];
  };
  readonly pin: {
    readonly turn: string;
    readonly originLdu: readonly number[];
    readonly revision: string;
  };
  /** The catalog's measured part for the design records this pin's digest, another one, or none. */
  readonly catalogRecord: "matches the pin" | "differs from the pin" | "none";
  /** Problems with the pin itself or its catalog record; a pin with any is not used. */
  readonly pinProblems: readonly string[];
  readonly detail: string;
}

export interface FrameCorrection {
  readonly designId: string;
  readonly designRevision: string;
  readonly filename: string;
  readonly source: "pin" | "review";
  readonly why: string;
  /** For a reviewed correction: where each origin sits among the catalog part's studs, measured this run. */
  readonly premise?: string;
  readonly from: { readonly turn: readonly number[]; readonly originLdu: readonly number[] };
  readonly to: { readonly turn: readonly number[]; readonly originLdu: readonly number[] };
}

export interface ExportFrameCheck {
  readonly version: typeof EXPORT_FRAMES_VERSION;
  readonly pins: FramePinsLoad["status"];
  readonly pinsPath: string;
  readonly comparisons: readonly PinComparison[];
  /** Pinned designs the export does not use. */
  readonly pinsNotInExport: readonly string[];
  /** Single-part designs with no pin: their export frames are not checked. */
  readonly uncheckedDesigns: number;
  readonly corrections: readonly FrameCorrection[];
  /** Reviewed corrections not applied because the export no longer shows the reviewed frame. */
  readonly staleCorrections: readonly string[];
}

const same = (left: readonly number[] | null, right: readonly number[]) =>
  left !== null &&
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

/** The catalog's recorded Builder frame digests, by design id. */
const catalogBuilderSources = new Map<
  string,
  { readonly ldrawId: string; readonly revision: string; readonly frameSha256: string }
>(
  SET_6651557_MEASURED_BLUEPRINTS.flatMap((blueprint) =>
    "builderSource" in blueprint && blueprint.builderSource
      ? [[blueprint.designId, { ldrawId: blueprint.ldrawId, ...blueprint.builderSource }] as const]
      : [],
  ),
);

function pinProblems(pin: FramePin, frame: ExportDesignFrame): string[] {
  const problems: string[] = [];
  if (!pin.digestVerified) {
    problems.push(`its digest ${pin.digest.slice(0, 12)}… does not reproduce from its own fields`);
  }
  const revision = frame.designRevision.split(";")[1] ?? "";
  if (revision !== pin.revision) {
    problems.push(
      `it pins Builder revision ${pin.revision} but the export's brick is ${frame.designRevision}`,
    );
  }
  const catalog = catalogBuilderSources.get(pin.designId);
  if (catalog && catalog.frameSha256 !== `sha256:${pin.digest}`) {
    problems.push(
      `the catalog's ${catalog.ldrawId} records Builder frame ${catalog.frameSha256.slice(0, 19)}…, not the pin's`,
    );
  }
  return problems;
}

const fmt = (values: readonly number[]) => `(${values.join(", ")})`;

/** The stud connector whose column holds LDraw-local `point`, through the part's catalog frame. */
function studColumnAt(
  filename: string,
  point: readonly number[],
  catalogPartFor: (filename: string) => string | null,
): string | null {
  const catalogPartId = catalogPartFor(filename);
  const definition = catalogPartId ? getPartDefinition(catalogPartId) : undefined;
  if (!catalogPartId || !definition) return null;
  const frame = catalogFrameFor(catalogPartId);
  // c = O p + t: the LDraw-local point in the catalog part's frame.
  const orientation = catalogFrameMatrix(frame.orientationId);
  const c = rotate(orientation, point).map((value, axis) => value + frame.translationLdu[axis]!);
  const stud = definition.connectors.find(
    ({ kind, positionLdu }) =>
      kind === "stud" &&
      Math.abs(positionLdu[0] - c[0]!) < 1e-6 &&
      Math.abs(positionLdu[2] - c[2]!) < 1e-6,
  );
  return stud ? `${catalogPartId} ${stud.id}` : null;
}

/** Whether the frame `from` and the frame `to` place the design identically, as the catalog models it. */
function symmetryVerdict(
  from: { turn: readonly number[]; originLdu: readonly number[] },
  to: { turn: readonly number[]; originLdu: readonly number[] },
  filename: string,
  catalogPartFor: (filename: string) => string | null,
): { verdict: FrameVerdict; detail: string } {
  // Two LXFML-to-LDraw frames F(q) = T q + b differ by D = F_to o F_from^-1 in LDraw-local space.
  const matrix = multiply(to.turn, transpose(from.turn));
  const moved = rotate(matrix, from.originLdu);
  const motion = {
    matrix,
    translationLdu: to.originLdu.map((value, axis) => value - moved[axis]!),
  };
  const catalogPartId = catalogPartFor(filename);
  const definition = catalogPartId ? getPartDefinition(catalogPartId) : undefined;
  if (!catalogPartId || !definition) {
    return {
      verdict: "disagrees",
      detail: `no catalog part for ${filename}, so symmetry is unknown`,
    };
  }
  const frame = catalogFrameFor(catalogPartId);
  const symmetric = isCatalogSelfMotion(catalogPartId, ldrawMotionInCatalog(frame, motion));
  return symmetric
    ? {
        verdict: "equivalent by symmetry",
        detail: `the difference maps ${catalogPartId}'s connectors and bounds onto themselves`,
      }
    : {
        verdict: "disagrees",
        detail: `the difference moves ${catalogPartId} (connectors or bounds do not map onto themselves)`,
      };
}

export function checkExportFrames(input: {
  readonly key: AnswerKey;
  readonly pins: FramePinsLoad;
  readonly catalogPartFor: (filename: string) => string | null;
}): ExportFrameCheck {
  const { key, pins, catalogPartFor } = input;
  if (key.ldraw.status !== "paired")
    throw new Error("checkExportFrames needs a paired official LDraw export.");
  const frames = [...key.ldraw.pairing.designFrames.values()];
  const byDesignId = new Map(frames.map((frame) => [frame.designId, frame] as const));
  const pinList = pins.status === "loaded" ? pins.pins : [];
  const comparisons: PinComparison[] = [];
  const corrections: FrameCorrection[] = [];
  for (const pin of pinList) {
    const frame = byDesignId.get(pin.designId);
    if (!frame) continue;
    const problems = pinProblems(pin, frame);
    const record = catalogBuilderSources.get(pin.designId);
    const exported = { turn: frame.turn, originLdu: frame.originLdu };
    const pinned = { turn: pin.turn, originLdu: pin.originLdu };
    let verdict: PinComparison["verdict"];
    let detail: string;
    if (problems.length > 0) {
      verdict = "unusable pin";
      detail = problems.join("; ");
    } else if (same(frame.turn, pin.turn) && same(frame.originLdu, pin.originLdu)) {
      verdict = "agrees";
      detail = "turn and origin equal the pin";
    } else if (frame.turn === null) {
      verdict = "disagrees";
      detail = "the export's turn is not a quarter turn";
    } else {
      ({ verdict, detail } = symmetryVerdict(
        pinned,
        { turn: frame.turn, originLdu: frame.originLdu },
        frame.filename,
        catalogPartFor,
      ));
    }
    comparisons.push({
      designId: pin.designId,
      designRevision: frame.designRevision,
      filename: frame.filename,
      instances: frame.instances,
      verdict,
      export: exported,
      pin: { turn: pin.turnName, originLdu: pin.originLdu, revision: pin.revision },
      catalogRecord: !record
        ? "none"
        : record.frameSha256 === `sha256:${pin.digest}`
          ? "matches the pin"
          : "differs from the pin",
      pinProblems: problems,
      detail,
    });
    if (verdict === "disagrees" && frame.turn !== null) {
      corrections.push({
        designId: pin.designId,
        designRevision: frame.designRevision,
        filename: frame.filename,
        source: "pin",
        why: `scripts/builder_ldraw_frame_pins.py pins ${pin.turnName} with origin ${fmt(pin.originLdu)} (${pin.derivation}, digest ${pin.digest.slice(0, 12)}…${record ? ", the frame the catalog's connectors came from" : ""}); the export has origin ${fmt(frame.originLdu)}`,
        from: { turn: frame.turn, originLdu: frame.originLdu },
        to: pinned,
      });
    }
  }
  const staleCorrections: string[] = [];
  for (const reviewed of REVIEWED_CORRECTIONS) {
    const frame = byDesignId.get(reviewed.designId);
    if (!frame || corrections.some(({ designId }) => designId === reviewed.designId)) continue;
    if (
      !same(frame.turn, reviewed.reviewedExport.turn) ||
      !same(frame.originLdu, reviewed.reviewedExport.originLdu)
    ) {
      staleCorrections.push(
        `${reviewed.designId}: the export now shows origin ${fmt(frame.originLdu)}, not the reviewed ${fmt(reviewed.reviewedExport.originLdu)}; re-review before correcting it`,
      );
      continue;
    }
    const before = studColumnAt(frame.filename, frame.originLdu, catalogPartFor);
    const after = studColumnAt(frame.filename, reviewed.originLdu, catalogPartFor);
    const premise = `LDraw ${fmt(reviewed.originLdu)} is under ${after ?? "no catalog stud"}; the export's ${fmt(frame.originLdu)} is under ${before ?? "no catalog stud"}`;
    if (after === null) {
      staleCorrections.push(
        `${reviewed.designId}: the reviewed origin ${fmt(reviewed.originLdu)} is no longer under a stud of the catalog part (${premise}); re-review before correcting it`,
      );
      continue;
    }
    corrections.push({
      designId: reviewed.designId,
      designRevision: frame.designRevision,
      filename: frame.filename,
      source: "review",
      why: reviewed.why,
      premise,
      from: { turn: frame.turn!, originLdu: frame.originLdu },
      to: { turn: frame.turn!, originLdu: reviewed.originLdu },
    });
  }
  const pinnedIds = new Set(pinList.map(({ designId }) => designId));
  return {
    version: EXPORT_FRAMES_VERSION,
    pins: pins.status,
    pinsPath: pins.path,
    comparisons,
    pinsNotInExport: pinList
      .filter(({ designId }) => !byDesignId.has(designId))
      .map(({ designId }) => designId),
    uncheckedDesigns: frames.filter(({ designId }) => !pinnedIds.has(designId)).length,
    corrections,
    staleCorrections,
  };
}

/** Each corrected brick's LDraw pose: the LXFML pose carried through the corrected frame. */
export function correctedPoses(
  key: AnswerKey,
  corrections: readonly FrameCorrection[],
): Map<string, OfficialPose> {
  const byDesign = new Map(
    corrections.map((correction) => [correction.designRevision, correction] as const),
  );
  const poses = new Map<string, OfficialPose>();
  for (const brick of key.model.bricks) {
    const correction = byDesign.get(brick.designRevision);
    if (!correction || brick.parts.length !== 1) continue;
    // world = X q + x, q = turnT (p - origin), so the LDraw row is (X turnT, x - X turnT origin).
    const xml = lxfmlPoseInLdrawConvention(brick.parts[0]!);
    const matrix = multiply(xml.matrix, transpose(correction.to.turn));
    const offset = rotate(matrix, correction.to.originLdu);
    poses.set(brick.uuid, {
      matrix,
      positionLdu: xml.positionLdu.map((value, axis) => value - offset[axis]!),
    });
  }
  return poses;
}
