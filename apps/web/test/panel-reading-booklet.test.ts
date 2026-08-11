import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { UPRIGHT_ORIENTATIONS, getPartDefinition } from "@lego-studio/catalog";
import { applyBuildOperations, createEmptyBrickDocument } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, RigidTransform } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createPlacePartTransaction } from "../src/manual-commands";
import { panelProjectionFromFit } from "../src/assembly/arrow-placement";
import { enumeratePlacements } from "../src/assembly/enumerate-placements";
import { viewForPanelFace, type PanelFace } from "../src/assembly/panel-face";
import {
  classifyPageDirection,
  narrowByPanelReading,
  projectLdu,
  type PageDirection,
  type PanelProjection,
  type PartFacts,
  type PieceReading,
  type PlacedPart,
} from "../src/assembly/panel-reading";

function rotateByOrientation(
  orientationId: string,
  point: readonly [number, number, number],
): [number, number, number] {
  const matrix = UPRIGHT_ORIENTATIONS.find((entry) => entry.id === orientationId)!.matrix;
  return [
    matrix[0]! * point[0] + matrix[1]! * point[1] + matrix[2]! * point[2],
    matrix[3]! * point[0] + matrix[4]! * point[1] + matrix[5]! * point[2],
    matrix[6]! * point[0] + matrix[7]! * point[1] + matrix[8]! * point[2],
  ];
}

function classify(
  projection: PanelProjection,
  displacement: readonly [number, number, number],
): PageDirection | null {
  return classifyPageDirection(projectLdu(projection, displacement));
}

/**
 * What a real panel reading is worth, measured on the booklet itself.
 *
 * Everything this needs is a run artifact under an ignored path — the action
 * ledger, the settled document, a step's fitted camera, and the readings the
 * vision pass produced — so it skips rather than failing when they are absent.
 * That is deliberate: the numbers below are evidence about one booklet and one
 * set of readings, and a gate that demanded them would be asserting that a model
 * call went a particular way.
 *
 * What it does assert, whenever the artifacts are there, is the property that
 * makes the reading safe: a narrowing may only ever be a subset of what the
 * enumerator already offered, and a reading that disagrees with a settled step
 * has to show up as a disagreement rather than as a silent re-placement.
 */

const READING_ROOT = "output/panel-placement";
const LEDGER_PATH = "output/real-build/action-ledger.json";
const RUN_ROOT = "output/real-build/runs";

interface LedgerPiece {
  readonly catalogPartId: string;
  readonly colorId: string;
}

interface StepFit {
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
  readonly pixelsPerUnit: number;
  readonly panelFace: PanelFace | null;
  /**
   * The quarter turn the run resolved between the world frame and this panel.
   *
   * A projected square lattice is the same lattice at all four quarter turns, so
   * the fit cannot pin it and `anchorStepCamera` resolves it by registering the
   * already-built prefix against the panel's own art. The renderer adds it to the
   * fitted azimuth, so anything that converts a direction on the page into a
   * direction in the model has to add it too. Printed steps 4, 5 and 6 of this
   * booklet all resolve to 90 degrees, and a converter that ignored it read every
   * direction one quadrant out — measured, on a reading that was in fact right.
   */
  readonly anchorTurnDegrees: number;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/**
 * The retained run that reaches furthest, not the newest one.
 *
 * Several sessions drive this booklet at once and a run requested through three
 * printed steps lands in the same directory as one requested through seven, so
 * "newest" picks whichever finished last rather than whichever knows the most.
 * The longest prefix is what this measurement needs, and ties break on recency.
 */
function findRuns(): { score: string | null; document: string | null } {
  if (!existsSync(RUN_ROOT)) return { score: null, document: null };
  const directories = readdirSync(RUN_ROOT)
    .filter((name) => !name.startsWith(".") && name !== "current.json")
    .sort()
    .reverse();
  let score: string | null = null;
  let scoreSteps = 0;
  let document: string | null = null;
  let documentParts = 0;
  for (const name of directories) {
    const scorePath = join(RUN_ROOT, name, "score.json");
    const documentPath = join(RUN_ROOT, name, "document.json");
    if (existsSync(scorePath)) {
      const parsed = readJson<{
        steps?: { panelFace?: unknown }[];
        piecesPlaced?: unknown;
      }>(scorePath);
      // Ranked by pieces placed rather than by steps attempted. A 359-step run
      // from before the face was derived carries a step row for every printed
      // step and a `panelFace` for none of them, so "most steps" picks the run
      // that knows least — measured, after that heuristic chose exactly it.
      const placed = typeof parsed.piecesPlaced === "number" ? parsed.piecesPlaced : 0;
      const carriesFace =
        Array.isArray(parsed.steps) &&
        parsed.steps.length > 0 &&
        parsed.steps.every((step) => step.panelFace !== undefined);
      if (carriesFace && placed > scoreSteps) {
        scoreSteps = placed;
        score = scorePath;
      }
    }
    if (existsSync(documentPath)) {
      const parsed = readJson<{ parts?: unknown[] }>(documentPath);
      if (Array.isArray(parsed.parts) && parsed.parts.length > documentParts) {
        documentParts = parsed.parts.length;
        document = documentPath;
      }
    }
  }
  return { score, document };
}

const runs = findRuns();
const hasEvidence = existsSync(LEDGER_PATH) && runs.score !== null && runs.document !== null;

describe.skipIf(!hasEvidence)("a real panel reading, narrowing the real enumeration", () => {
  const ledger = readJson<{ steps: { stepNumber: number; action: { pieces: LedgerPiece[] } }[] }>(
    LEDGER_PATH,
  );
  const settled = readJson<{
    parts: { catalogPartId: string; colorId: string; stepId: string; transform: RigidTransform }[];
  }>(runs.document!);
  const score = readJson<{
    steps: {
      stepNumber: number;
      panelFace: PanelFace | null;
      fit: { azimuthDegrees: number; elevationDegrees: number; pixelsPerUnit: number };
      camera?: { anchorTurnDegrees?: number | null } | null;
    }[];
  }>(runs.score!);

  const fitByStep = new Map<number, StepFit>(
    score.steps.map((step) => [
      step.stepNumber,
      {
        ...step.fit,
        panelFace: step.panelFace,
        anchorTurnDegrees: step.camera?.anchorTurnDegrees ?? 0,
      } satisfies StepFit,
    ]),
  );

  /**
   * The settled placements, grouped back onto the printed steps that made them.
   *
   * `document.json` carries an opaque step id per part rather than a printed step
   * number, so the groups are matched to the ledger by the multiset of catalog
   * parts they contain. Two of this booklet's first five steps place the same
   * wedge plate, which is why the match is on the whole group and not on a part.
   */
  function settledByStep(): Map<number, PlacedPart[]> {
    const groups = new Map<string, typeof settled.parts>();
    for (const part of settled.parts) {
      const group = groups.get(part.stepId) ?? [];
      group.push(part);
      groups.set(part.stepId, group);
    }
    const signature = (parts: readonly { catalogPartId: string }[]) =>
      parts
        .map((part) => part.catalogPartId)
        .sort()
        .join("|");
    const byStep = new Map<number, PlacedPart[]>();
    const unmatched = [...groups.values()];
    for (const step of ledger.steps) {
      const wanted = signature(step.action.pieces);
      const index = unmatched.findIndex((group) => signature(group) === wanted);
      if (index < 0) continue;
      const [group] = unmatched.splice(index, 1);
      byStep.set(
        step.stepNumber,
        group!.map((part, order) => ({
          partId: `settled-${step.stepNumber}-${order}`,
          catalogPartId: part.catalogPartId,
          colorId: part.colorId,
          transform: part.transform,
        })),
      );
    }
    return byStep;
  }

  const placementsByStep = settledByStep();

  function prefixDocument(beforeStep: number): {
    document: BrickDocumentV1;
    placed: PlacedPart[];
  } {
    let document = createEmptyBrickDocument({ id: "prefix", name: "Settled prefix" });
    const placed: PlacedPart[] = [];
    for (const step of ledger.steps) {
      if (step.stepNumber >= beforeStep) break;
      // `document.json` lists parts by id, not by the order they were placed, and
      // a step's second piece often rests on its first — so the order has to be
      // recovered rather than assumed. Anything the editor refuses is deferred
      // and retried; a pass that places nothing means the group is genuinely
      // unbuildable and says so rather than skipping a piece.
      let remaining = [...(placementsByStep.get(step.stepNumber) ?? [])];
      while (remaining.length > 0) {
        const deferred: PlacedPart[] = [];
        let progressed = false;
        for (const part of remaining) {
          try {
            const transaction = createPlacePartTransaction(document, {
              catalogPartId: part.catalogPartId,
              colorId: part.colorId,
              transform: part.transform,
            });
            document = applyBuildOperations(document, transaction.operations);
            placed.push({ ...part, partId: document.parts[document.parts.length - 1]!.id });
            progressed = true;
          } catch {
            deferred.push(part);
          }
        }
        if (!progressed) {
          throw new Error(
            `Printed step ${step.stepNumber} has ${deferred.length} settled placement(s) the editor will not accept in any order.`,
          );
        }
        remaining = deferred;
      }
    }
    return { document, placed };
  }

  function partFacts(...catalogPartIds: readonly string[]): Map<string, PartFacts> {
    const map = new Map<string, PartFacts>();
    for (const id of catalogPartIds) {
      const definition = getPartDefinition(id);
      if (definition === undefined) continue;
      map.set(id, {
        boundsLdu: definition.boundsLdu,
        colorName: "Black",
      });
    }
    return map;
  }

  const readingFiles = existsSync(READING_ROOT)
    ? readdirSync(READING_ROOT).filter((name) => /^reading-step-\d{3}\.json$/u.test(name))
    : [];

  /**
   * A reading derived from the placement the panel scorer already settled on.
   *
   * This is not a claim that a model would produce it. It is the control the
   * perturbation test needs: if a reading that describes the settled placement
   * truthfully does not keep that placement, the converter is broken, and any
   * later claim that a wrong reading was rejected would be measuring the same
   * bug rather than the guard.
   */
  function oracleReading(
    pieceId: string,
    catalogPartId: string,
    transform: RigidTransform,
    placed: readonly PlacedPart[],
    facts: ReadonlyMap<string, PartFacts>,
    projection: ReturnType<typeof panelProjectionFromFit>,
    document: BrickDocumentV1,
  ): PieceReading | null {
    const candidates = enumeratePlacements(document, catalogPartId).candidates;
    const settled = candidates.find(
      (candidate) =>
        candidate.transform.orientationId === transform.orientationId &&
        candidate.transform.positionLdu.every(
          (value, axis) => value === transform.positionLdu[axis],
        ),
    );
    if (settled === undefined) return null;
    const byTarget = new Map<string, number>();
    for (const connection of settled.connections) {
      byTarget.set(connection.targetPartId, (byTarget.get(connection.targetPartId) ?? 0) + 1);
    }
    let anchorPartId: string | null = null;
    let overlap = 0;
    for (const [targetPartId, count] of byTarget) {
      if (count > overlap) {
        overlap = count;
        anchorPartId = targetPartId;
      }
    }
    const anchor = placed.find((part) => part.partId === anchorPartId) ?? null;
    if (anchor === null) return null;
    const anchorFact = facts.get(anchor.catalogPartId)!;
    const anchorSpan = anchorFact.boundsLdu;
    const wide = Math.round((anchorSpan.max[0] - anchorSpan.min[0]) / 20);
    const long = Math.round((anchorSpan.max[2] - anchorSpan.min[2]) / 20);
    const definition = getPartDefinition(catalogPartId)!;
    const spanX = definition.boundsLdu.max[0] - definition.boundsLdu.min[0];
    const spanZ = definition.boundsLdu.max[2] - definition.boundsLdu.min[2];
    const localLong: [number, number, number] = spanZ > spanX ? [0, 0, 1] : [1, 0, 0];
    const worldLong = rotateByOrientation(transform.orientationId, localLong);
    const longAxis = classify(projection, [
      worldLong[0] * 20,
      worldLong[1] * 20,
      worldLong[2] * 20,
    ]);
    // Which way up the pair sits is read off the geometry rather than assumed.
    // This booklet builds partly downward — printed step 4 hangs its long plate
    // under what step 3 placed — so an oracle that always said "on top of" would
    // be testing the converter against a reading that is itself wrong.
    const here =
      transform.positionLdu[1] + (definition.boundsLdu.min[1] + definition.boundsLdu.max[1]) / 2;
    const anchorDefinition = getPartDefinition(anchor.catalogPartId)!;
    const there =
      anchor.transform.positionLdu[1] +
      (anchorDefinition.boundsLdu.min[1] + anchorDefinition.boundsLdu.max[1]) / 2;
    return {
      id: pieceId,
      visible: true,
      longAxis: Math.abs(spanX - spanZ) < 10 ? "square" : (longAxis ?? "cannot-tell"),
      anchorId: `built:${anchorFact.colorName} ${Math.max(long, wide)}x${Math.min(long, wide)}`,
      relation: here < there ? "on-top-of" : "underneath",
      side:
        classify(projection, [
          transform.positionLdu[0] - anchor.transform.positionLdu[0],
          transform.positionLdu[1] - anchor.transform.positionLdu[1],
          transform.positionLdu[2] - anchor.transform.positionLdu[2],
        ]) ?? "centred",
      overlapStuds: overlap,
      confidence: 1,
    };
  }

  it("reports the size of the discovery problem a reading is being asked to attack", () => {
    for (const step of ledger.steps.slice(0, 8)) {
      const { document } = prefixDocument(step.stepNumber);
      if (document.parts.length === 0 && step.stepNumber > 1) continue;
      const counts = step.action.pieces.map((piece) => {
        try {
          return enumeratePlacements(document, piece.catalogPartId).candidates.length;
        } catch {
          return 0;
        }
      });
      if (counts.some((count) => count === 0)) continue;
      console.log(
        `printed step ${step.stepNumber}: ${counts.join(" x ")} = ${counts.reduce((a, b) => a * b, 1).toLocaleString("en-US")}` +
          ` placements of ${step.action.pieces.length} piece(s) on the settled prefix`,
      );
    }
    expect(placementsByStep.size).toBeGreaterThan(0);
  }, 30_000);

  it("has readings to measure", () => {
    if (readingFiles.length === 0) {
      console.log(
        `no model readings under ${READING_ROOT}; the oracle and perturbation measurements below still run`,
      );
    }
    expect(placementsByStep.size).toBeGreaterThan(0);
  });

  for (const stepNumber of [4, 5]) {
    it(`keeps printed step ${stepNumber}'s settled placement from a truthful reading, and drops it from a wrong one`, () => {
      const fit = fitByStep.get(stepNumber);
      const truth = placementsByStep.get(stepNumber);
      if (fit === undefined || truth === undefined) {
        console.log(
          `step ${stepNumber}: no ${fit === undefined ? "fitted camera" : "settled placement"} in the retained artifacts ` +
            `(fits ${[...fitByStep.keys()].join(",")}; settled ${[...placementsByStep.keys()].join(",")})`,
        );
        return;
      }
      const { document, placed } = prefixDocument(stepNumber);
      const view =
        fit.panelFace === "studs-up" || fit.panelFace === "underside"
          ? viewForPanelFace(fit, fit.panelFace)
          : { ...fit, upSign: 1 as const };
      const turned = {
        ...view,
        azimuthDegrees: view.azimuthDegrees + fit.anchorTurnDegrees,
      };
      const projection = panelProjectionFromFit(turned);
      const facts = partFacts(...new Set([...placed, ...truth].map((part) => part.catalogPartId)));

      // Only the first piece of the step is exercised, because the second is
      // enumerated on a document that already contains the first and the whole
      // point here is a single reading against a single settled answer.
      const target = truth[0]!;
      const candidates = enumeratePlacements(document, target.catalogPartId).candidates.map(
        (candidate) => ({ transform: candidate.transform, connections: candidate.connections }),
      );
      const reading = oracleReading(
        "P1",
        target.catalogPartId,
        target.transform,
        placed,
        facts,
        projection,
        document,
      );
      expect(reading, "the settled placement must be in the enumeration").not.toBeNull();

      const run = (piece: PieceReading) =>
        narrowByPanelReading({
          reading: {
            panel: { viewpoint: fit.panelFace === "underside" ? "from-underneath" : "from-above" },
            pieces: [piece],
          },
          pieces: [{ id: "P1", catalogPartId: target.catalogPartId }],
          candidatesByPiece: [candidates],
          placed,
          facts,
          projection,
          panelFace: fit.panelFace,
          maximumProduct: 4096,
        });
      const keepsSettled = (result: ReturnType<typeof run>) =>
        result.perPiece[0]!.keptCandidates.some(
          (entry) =>
            entry.transform.orientationId === target.transform.orientationId &&
            entry.transform.positionLdu.every(
              (value, axis) => value === target.transform.positionLdu[axis],
            ),
        );

      const truthful = run(reading!);
      expect(keepsSettled(truthful)).toBe(true);
      console.log(
        `step ${stepNumber} oracle: ${target.catalogPartId} ${candidates.length} -> ${truthful.perPiece[0]!.kept}` +
          ` [${truthful.perPiece[0]!.appliedPredicates.join(" ")}]`,
      );

      // Every single-field lie, one at a time. Each must either drop the settled
      // placement or empty the set outright; none may keep it and stay silent.
      const lies: readonly { readonly label: string; readonly reading: PieceReading }[] = [
        // A square part has no long axis and the converter says so by ignoring
        // the field, so lying about it there is not a lie the reading can tell.
        // Asserting otherwise would demand that a field discriminate on a part it
        // cannot describe.
        ...(reading!.longAxis === "square"
          ? []
          : [
              {
                label: "the long axis on the other diagonal",
                reading: {
                  ...reading!,
                  longAxis: (reading!.longAxis === "up-and-right" ||
                  reading!.longAxis === "down-and-left"
                    ? "up-and-left"
                    : "up-and-right") as PageDirection,
                },
              },
            ]),
        {
          label: "the other side of the anchor vertically",
          reading: {
            ...reading!,
            relation: reading!.relation === "on-top-of" ? "underneath" : "on-top-of",
          },
        },
        {
          label: "two more studs of overlap than exist",
          reading: { ...reading!, overlapStuds: (reading!.overlapStuds ?? 0) + 2 },
        },
        {
          label: "an anchor size that was never placed",
          reading: { ...reading!, anchorId: "built:Black 16x9" },
        },
      ];
      for (const lie of lies) {
        const result = run(lie.reading);
        const kept = keepsSettled(result);
        console.log(
          `  lie "${lie.label}": ${result.perPiece[0]!.kept} kept, settled ${kept ? "SURVIVED" : "dropped"}` +
            `${result.usable ? "" : `, refused ${result.refusals.map((r) => r.code).join("/")}`}`,
        );
        expect(
          kept && result.usable,
          `a wrong reading must not keep the settled placement silently`,
        ).toBe(false);
      }
    });
  }

  for (const file of readingFiles) {
    const record = readJson<{
      stepNumber: number;
      pieces: { id: string; catalogPartId: string; colorId: string; colour: string }[];
      reading: { panel: { viewpoint: string } | null; pieces: PieceReading[]; rejected: string[] };
      elapsedMs: number;
      usdCost: number | null;
    }>(join(READING_ROOT, file));
    const stepNumber = record.stepNumber;

    it(`narrows printed step ${stepNumber} without ever proposing a placement the enumerator refused`, () => {
      const fit = fitByStep.get(stepNumber);
      if (fit === undefined) {
        console.log(`step ${stepNumber}: no fitted camera in the retained run; not narrowed`);
        return;
      }
      const { document, placed } = prefixDocument(stepNumber);
      const view =
        fit.panelFace === "studs-up" || fit.panelFace === "underside"
          ? viewForPanelFace(fit, fit.panelFace)
          : { ...fit, upSign: 1 as const };
      const turned = {
        ...view,
        azimuthDegrees: view.azimuthDegrees + fit.anchorTurnDegrees,
      };
      const projection = panelProjectionFromFit(turned);
      const facts = partFacts(
        ...new Set([
          ...placed.map((part) => part.catalogPartId),
          ...record.pieces.map((piece) => piece.catalogPartId),
        ]),
      );
      // Colour names come from the brief the call was given, so the anchor
      // vocabulary the model was told about is the one the converter resolves.
      for (const part of placed) {
        const named = record.pieces.find((piece) => piece.colorId === part.colorId);
        const fact = facts.get(part.catalogPartId);
        if (fact !== undefined && named !== undefined) {
          facts.set(part.catalogPartId, { ...fact, colorName: named.colour });
        }
      }
      for (const piece of record.pieces) {
        const fact = facts.get(piece.catalogPartId);
        if (fact !== undefined)
          facts.set(piece.catalogPartId, { ...fact, colorName: piece.colour });
      }

      const candidatesByPiece = record.pieces.map((piece) => {
        try {
          return enumeratePlacements(document, piece.catalogPartId).candidates.map((candidate) => ({
            transform: candidate.transform,
            connections: candidate.connections,
          }));
        } catch {
          return [];
        }
      });

      const narrowWith = (pieces: readonly PieceReading[]) =>
        narrowByPanelReading({
          reading: { ...record.reading, pieces },
          pieces: record.pieces.map((piece) => ({
            id: piece.id,
            catalogPartId: piece.catalogPartId,
          })),
          candidatesByPiece,
          placed,
          facts,
          projection,
          panelFace: fit.panelFace,
          maximumProduct: 512,
        });
      const narrowing = narrowWith(record.reading.pieces);
      const byIdReading = new Map(record.reading.pieces.map((piece) => [piece.id, piece]));

      const offeredKeys = candidatesByPiece.map(
        (candidates) =>
          new Set(
            candidates.map(
              (entry) =>
                `${entry.transform.positionLdu.join(",")}|${entry.transform.orientationId}`,
            ),
          ),
      );
      for (const [index, piece] of narrowing.perPiece.entries()) {
        for (const kept of piece.keptCandidates) {
          expect(
            offeredKeys[index]!.has(
              `${kept.transform.positionLdu.join(",")}|${kept.transform.orientationId}`,
            ),
          ).toBe(true);
        }
      }

      const truth = placementsByStep.get(stepNumber) ?? null;
      const lines: string[] = [];
      lines.push(
        `step ${stepNumber}: viewpoint ${record.reading.panel?.viewpoint ?? "none"} against derived ${fit.panelFace}, ` +
          `product ${narrowing.productSize ?? "refused"}, usable ${narrowing.usable}, ` +
          `${(record.elapsedMs / 1000).toFixed(1)}s, ${record.usdCost === null ? "cost unknown" : `$${record.usdCost.toFixed(4)}`}`,
      );
      for (const [index, piece] of narrowing.perPiece.entries()) {
        const settledTransform = truth?.[index]?.transform ?? null;
        const containsTruth =
          settledTransform === null
            ? null
            : piece.keptCandidates.some(
                (entry) =>
                  entry.transform.orientationId === settledTransform.orientationId &&
                  entry.transform.positionLdu.every(
                    (value, axis) => value === settledTransform.positionLdu[axis],
                  ),
              );
        lines.push(
          `  ${piece.pieceId} ${piece.catalogPartId}: ${piece.offered} -> ${piece.kept}` +
            ` [${piece.appliedPredicates.join(" ") || "no predicates"}]` +
            (containsTruth === null ? "" : containsTruth ? "  KEEPS SETTLED" : "  DROPS SETTLED") +
            (piece.refusal === null ? "" : `  refused ${piece.refusal.code}`),
        );
        // A reading that drops a settled placement is a defect in the reading and
        // the useful part is which sentence of it was wrong. Each field is
        // blanked in turn and the narrowing rerun: whichever blanking brings the
        // settled placement back is the field that disagreed.
        if (containsTruth === false && settledTransform !== null) {
          const record_ = narrowing.perPiece[index]!;
          void record_;
          const original = byIdReading.get(piece.pieceId);
          if (original !== undefined) {
            const blanked: readonly (readonly [string, PieceReading])[] = [
              ["longAxis", { ...original, longAxis: "cannot-tell", cannotTell: "blanked" }],
              ["relation", { ...original, relation: "cannot-tell", cannotTell: "blanked" }],
              ["side", { ...original, side: "cannot-tell", cannotTell: "blanked" }],
              ["overlapStuds", { ...original, overlapStuds: null }],
              ["anchorId", { ...original, anchorId: null }],
            ];
            const culprits: string[] = [];
            for (const [field, replacement] of blanked) {
              const replayed = narrowWith(
                record.reading.pieces.map((entry) =>
                  entry.id === piece.pieceId ? replacement : entry,
                ),
              );
              const back = replayed.perPiece[index]!.keptCandidates.some(
                (entry) =>
                  entry.transform.orientationId === settledTransform.orientationId &&
                  entry.transform.positionLdu.every(
                    (value, axis) => value === settledTransform.positionLdu[axis],
                  ),
              );
              if (back) culprits.push(field);
            }
            const truthful = oracleReading(
              piece.pieceId,
              piece.catalogPartId,
              settledTransform,
              placed,
              facts,
              projection,
              document,
            );
            lines.push(
              `    disagreed on: ${culprits.length === 0 ? "no single field — several together" : culprits.join(", ")}`,
            );
            if (truthful !== null) {
              lines.push(
                `    settled placement reads: longAxis ${truthful.longAxis}, anchor ${truthful.anchorId}, ` +
                  `${truthful.relation}, side ${truthful.side}, overlap ${truthful.overlapStuds}`,
              );
              lines.push(
                `    the model said:         longAxis ${original.longAxis}, anchor ${original.anchorId}, ` +
                  `${original.relation}, side ${original.side}, overlap ${original.overlapStuds}`,
              );
            }
          }
        }
      }
      for (const refusal of narrowing.refusals) {
        lines.push(`  refusal ${refusal.code}${refusal.pieceId ? ` (${refusal.pieceId})` : ""}`);
      }
      if (record.reading.rejected.length > 0) {
        lines.push(`  ${record.reading.rejected.length} reply line(s) refused by the schema`);
      }
      console.log(lines.join("\n"));
    });
  }
});
