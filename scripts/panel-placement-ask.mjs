import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import {
  CHILD_TIMEOUT_MS,
  MAX_CHILD_STDERR_BYTES,
  MAX_CHILD_STDOUT_BYTES,
  runBoundedChild,
} from "./part-identification-io.mjs";
import {
  PART_IDENTIFICATION_MODEL_ID,
  requirePinnedPartIdentificationModel,
  responseModelIdentity,
} from "./part-identification-model.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";
import { withCardCallSnapshot } from "./part-identification-call-snapshot.mjs";
import {
  PANEL_PLACEMENT_DIRECTIONS,
  PANEL_PLACEMENT_MAX_NOTE_LENGTH,
  PANEL_PLACEMENT_MAX_OVERLAP_STUDS,
  PANEL_PLACEMENT_PROMPT,
  PANEL_PLACEMENT_PROMPT_DIGEST,
  PANEL_PLACEMENT_RELATIONS,
  panelPlacementPieceBrief,
} from "./panel-placement-prompt.mjs";

/**
 * One printed panel, read by the pinned vision model, as a proposal only.
 *
 * The call machinery is the part-identification one and deliberately not a
 * second weaker copy of it: the model is pinned to an exact id rather than an
 * alias, the reply has to prove exactly one `modelUsage` entry so a background
 * model cannot have contributed, non-essential CLI traffic is off so that check
 * is enforceable, the image bytes handed to the child are authenticated against
 * a digest and locked for the duration of the call, and the reply is parsed by
 * the strict JSON parser rather than by a regex.
 *
 * `withCardCallSnapshot` names its inputs `card-NNNN`. A printed panel is not a
 * part card, and the id here is the printed step number in that shape — panel 7
 * travels as `card-0007`. Reusing the name buys the byte authentication, the
 * Windows read locks and the post-call re-verification unchanged; inventing a
 * parallel one would have bought a second thing to get wrong.
 */

const CARD_ID_FOR_STEP = (stepNumber) => `card-${String(stepNumber).padStart(4, "0")}`;
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export class PanelReadingError extends Error {
  constructor(message) {
    super(message);
    this.name = "PanelReadingError";
  }
}

const DIRECTIONS = new Set(PANEL_PLACEMENT_DIRECTIONS);
const RELATIONS = new Set(PANEL_PLACEMENT_RELATIONS);
const VIEWPOINTS = new Set(["from-above", "from-underneath", "cannot-tell"]);
const BUILT_ANCHOR = /^built:[A-Za-z][A-Za-z ]{0,31} (\d{1,2})x(\d{1,2})$/u;

function assertPanelLine(value) {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    value.id !== "panel" ||
    !VIEWPOINTS.has(value.viewpoint) ||
    !Number.isInteger(value.newPieceOutlines) ||
    value.newPieceOutlines < 0 ||
    value.newPieceOutlines > 64
  ) {
    throw new PanelReadingError(
      `Panel line is not a valid panel reading: ${JSON.stringify(value).slice(0, 400)}.`,
    );
  }
  return Object.freeze({
    id: "panel",
    viewpoint: value.viewpoint,
    newPieceOutlines: value.newPieceOutlines,
    ...(typeof value.note === "string" ? { note: value.note.slice(0, 400) } : {}),
  });
}

/**
 * The schema check, which is a filter and never a repair.
 *
 * A line that does not satisfy this is discarded with its reason and its quoted
 * text, exactly as the part-identification answer schema does, because a reply
 * the validator threw out and a reply that never arrived are different events
 * and only one of them is fixed by asking again.
 */
function assertPieceLine(value, allowedIds) {
  const fail = (why) => {
    throw new PanelReadingError(`${why}: ${JSON.stringify(value).slice(0, 400)}.`);
  };
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail("Not an object");
  if (typeof value.id !== "string" || !allowedIds.has(value.id)) fail("Unknown piece id");
  if (typeof value.visible !== "boolean") fail("visible must be a boolean");
  if (
    typeof value.longAxis !== "string" ||
    !(DIRECTIONS.has(value.longAxis) || value.longAxis === "square")
  ) {
    fail("longAxis is not a page direction or square");
  }
  if (!RELATIONS.has(value.relation)) fail("relation is not in the vocabulary");
  if (typeof value.side !== "string" || !(DIRECTIONS.has(value.side) || value.side === "centred")) {
    fail("side is not a page direction, centred or cannot-tell");
  }
  const anchorId = value.anchorId ?? null;
  if (anchorId !== null) {
    if (typeof anchorId !== "string") fail("anchorId must be a string or null");
    if (!allowedIds.has(anchorId) && !BUILT_ANCHOR.test(anchorId)) {
      fail('anchorId must be a listed piece id or "built:<Colour> <long>x<wide>"');
    }
    if (anchorId === value.id) fail("A piece cannot be its own anchor");
  }
  const overlapStuds = value.overlapStuds ?? null;
  if (
    overlapStuds !== null &&
    (!Number.isInteger(overlapStuds) ||
      overlapStuds < 0 ||
      overlapStuds > PANEL_PLACEMENT_MAX_OVERLAP_STUDS)
  ) {
    fail(`overlapStuds must be null or a whole number 0..${PANEL_PLACEMENT_MAX_OVERLAP_STUDS}`);
  }
  if (typeof value.confidence !== "number" || !(value.confidence >= 0 && value.confidence <= 1)) {
    fail("confidence must be a number from 0 through 1");
  }
  const declined =
    value.visible === false ||
    value.longAxis === "cannot-tell" ||
    value.relation === "cannot-tell" ||
    value.side === "cannot-tell";
  const cannotTell = value.cannotTell ?? null;
  if (declined && (typeof cannotTell !== "string" || cannotTell.trim().length === 0)) {
    fail("cannotTell is required whenever visible is false or a field is cannot-tell");
  }
  if (cannotTell !== null && typeof cannotTell !== "string") fail("cannotTell must be a string");
  for (const [field, text] of [
    ["note", value.note ?? null],
    ["cannotTell", cannotTell],
  ]) {
    if (
      text !== null &&
      (typeof text !== "string" || text.length > PANEL_PLACEMENT_MAX_NOTE_LENGTH)
    ) {
      fail(`${field} must be under ${PANEL_PLACEMENT_MAX_NOTE_LENGTH} characters`);
    }
  }
  return Object.freeze({
    id: value.id,
    visible: value.visible,
    longAxis: value.longAxis,
    anchorId,
    relation: value.relation,
    side: value.side,
    overlapStuds,
    confidence: value.confidence,
    ...(typeof value.note === "string" ? { note: value.note } : {}),
    ...(typeof cannotTell === "string" ? { cannotTell } : {}),
  });
}

/** Parses a whole reply into a panel line plus one line per piece. */
export function parsePanelReading(resultText, pieceIds) {
  const allowed = new Set(pieceIds);
  const rejected = [];
  let panel = null;
  const pieces = new Map();
  for (const line of String(resultText).split("\n")) {
    const opened = line.indexOf("{");
    const closed = line.lastIndexOf("}");
    if (opened < 0 || closed < opened) continue;
    let parsed;
    try {
      parsed = parseStrictJsonBytes(Buffer.from(line.slice(opened, closed + 1), "utf8"));
    } catch (error) {
      rejected.push(`unparseable line: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    try {
      if (parsed?.id === "panel") {
        if (panel !== null) {
          rejected.push("a second panel line arrived; both were discarded");
          panel = null;
          continue;
        }
        panel = assertPanelLine(parsed);
        continue;
      }
      const piece = assertPieceLine(parsed, allowed);
      if (pieces.has(piece.id)) {
        rejected.push(`a second line for ${piece.id} arrived; both were discarded`);
        pieces.delete(piece.id);
        continue;
      }
      pieces.set(piece.id, piece);
    } catch (error) {
      rejected.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { panel, pieces: [...pieces.values()], rejected };
}

/**
 * Reads one printed panel. Returns the reading, the raw reply and the cost.
 *
 * Nothing here decides anything: the reading is untrusted model output and the
 * converter refuses it whenever it is under-determined or contradicts the
 * enumeration, before the printed contour is ever consulted.
 */
export async function readPanel(input) {
  const model = input.model ?? PART_IDENTIFICATION_MODEL_ID;
  requirePinnedPartIdentificationModel(model);
  const imagePath = resolve(input.panelImagePath);
  const bytes = readFileSync(imagePath);
  const digest = sha256(bytes);
  const cardId = CARD_ID_FOR_STEP(input.stepNumber);
  const brief = panelPlacementPieceBrief({ pieces: input.pieces, built: input.built ?? [] });
  const startedAt = Date.now();
  const result = await withCardCallSnapshot(
    [cardId],
    new Map([[cardId, new Uint8Array(bytes)]]),
    new Map([[cardId, digest]]),
    async (paths) => {
      const instruction =
        `Read this image: ${paths[0]}\n\n${brief}\n\n` +
        `Answer with ${input.pieces.length + 1} lines of JSON: one panel line then one line per piece id, ` +
        `in the order ${input.pieces.map((piece) => piece.id).join(", ")}. No prose, no code fences.\n\n` +
        PANEL_PLACEMENT_PROMPT;
      return runBoundedChild(
        input.command ?? process.env.CLAUDE_CLI ?? "claude",
        ["-p", instruction, "--model", model, "--allowedTools", "Read", "--output-format", "json"],
        {
          label: `Pinned Claude panel-placement call for printed step ${input.stepNumber}`,
          timeoutMs: input.timeoutMs ?? CHILD_TIMEOUT_MS,
          maxStdoutBytes: MAX_CHILD_STDOUT_BYTES,
          maxStderrBytes: MAX_CHILD_STDERR_BYTES,
          env: { ...process.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" },
        },
      );
    },
  );
  const elapsedMs = Date.now() - startedAt;
  if (result.code !== 0) {
    throw new PanelReadingError(
      `Panel-placement call for printed step ${input.stepNumber} exited ${result.code}; stderr: ${result.stderr.trim() || "empty"}. No reading was retained.`,
    );
  }
  const payload = parseStrictJsonBytes(Buffer.from(result.stdout, "utf8"));
  const modelIdentity = responseModelIdentity(payload, model);
  const parsed = parsePanelReading(
    payload.result,
    input.pieces.map((piece) => piece.id),
  );
  return {
    schemaVersion: "lego.panel-placement-reading/1",
    stepNumber: input.stepNumber,
    panelImageDigest: digest,
    promptDigest: PANEL_PLACEMENT_PROMPT_DIGEST,
    briefDigest: sha256(Buffer.from(brief, "utf8")),
    modelIdentity,
    elapsedMs,
    calls: 1,
    usdCost: typeof payload.total_cost_usd === "number" ? payload.total_cost_usd : null,
    reading: parsed,
    rawResult: payload.result,
  };
}

export function writeReading(outputRoot, reading) {
  mkdirSync(outputRoot, { recursive: true });
  const path = join(outputRoot, `reading-step-${String(reading.stepNumber).padStart(3, "0")}.json`);
  writeFileSync(path, `${JSON.stringify(reading, null, 1)}\n`);
  return path;
}

export { CARD_ID_FOR_STEP, sha256, dirname, basename };
