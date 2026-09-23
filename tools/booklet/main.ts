import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { BUILTIN_CATALOG_VERSION, COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";

import {
  ANSWER_KEY_DEFAULT_PATHS,
  assemblyKeyAt,
  loadAnswerKey,
  type AnswerKey,
} from "./answer-key/index.ts";
import { runAlignStage, type AlignStage } from "./align-stage.ts";
import { runCatalogStage, type CatalogStage } from "./catalog-coverage.ts";
import { DEFAULT_MEASURED_FRAMES_PATH, loadMeasuredFrames } from "./ldraw-frames.ts";
import { playBack, type Playback, type PlaybackStepInput } from "./playback.ts";
import { readBookletPdf, type BookletRead } from "./read.ts";
import { compareWithBaseline, headlineOf, summaryLines, type Stage } from "./summary.ts";

/**
 * `npm run booklet`: how far the booklet build is, per printed step, scored
 * against LEGO's official model of the set.
 *
 * Four stages — read, align, catalog, reference playback — each write their
 * per-step rows to output/booklet/status.json, and the console gets a
 * summary of at most 40 lines. An absent input skips the stages that need it
 * ("skipped (input absent)") and never fails the run; a present input that
 * cannot be read fails it, naming the file and the fault.
 */
export const BOOKLET_STATUS_VERSION = "lego.booklet-status/1";
export const BOOKLET_BOOKLET_DEFAULT_PATH = "recipes/6651557.pdf";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BASELINE_PATH = resolve(REPOSITORY_ROOT, "status", "booklet-baseline.json");

/** The main checkout, where the ignored inputs live; a worktree shares its Git directory. */
function mainCheckoutRoot(): string {
  try {
    const common = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      {
        cwd: REPOSITORY_ROOT,
        encoding: "utf8",
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
    return dirname(common);
  } catch {
    return REPOSITORY_ROOT;
  }
}

interface InputFile {
  readonly path: string;
  readonly present: boolean;
  readonly sha256: string | null;
}

function inputFile(path: string): InputFile {
  try {
    if (!statSync(path).isFile()) return { path, present: false, sha256: null };
  } catch {
    return { path, present: false, sha256: null };
  }
  return {
    path,
    present: true,
    sha256: `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`,
  };
}

async function timed<T>(run: () => T | Promise<T>): Promise<Stage<T>> {
  const started = performance.now();
  const value = await run();
  return { status: "ran", ms: Math.round(performance.now() - started), value };
}

function skipped<T>(reason: string): Stage<T> {
  return { status: "skipped", reason: `skipped (input absent): ${reason}` };
}

function playbackInputs(
  key: AnswerKey,
  align: AlignStage,
  catalog: CatalogStage,
): PlaybackStepInput[] {
  if (key.ldraw.status !== "paired") return [];
  const official = key.ldraw.pairing.byBrick;
  const colorByCode = new Map(
    COLOR_DEFINITIONS.map((color) => [color.ldrawCode, color.id] as const),
  );
  return align.steps.map((step) => ({
    step: step.step,
    page: step.page,
    lastUnit: step.unitEnd - 1,
    bricks: step.bricks.map((uuid) => {
      const pose = official.get(uuid)!;
      const cover = catalog.byBrick[uuid]!;
      const placement = key.sequence.placements.get(uuid)!;
      return {
        uuid,
        design: cover.design,
        catalogPartId: cover.coverage === "missing" ? null : cover.catalogPartId,
        ldrawColor: pose.colorCode,
        colorId: colorByCode.get(pose.colorCode) ?? null,
        pose: { matrix: pose.matrix, positionLdu: pose.positionLdu },
        assemblyAt: (lastUnit: number) => assemblyKeyAt(placement, lastUnit),
      };
    }),
  }));
}

function readRows(read: BookletRead) {
  return read.steps.map(({ step, page, callouts, pieces }) => ({ step, page, callouts, pieces }));
}

function alignRows(align: AlignStage) {
  return align.steps.map(({ step, page, matched, repaired, expected, actual, bricks }) => ({
    step,
    page,
    matched,
    repaired,
    bricks: bricks.length,
    ...(matched ? {} : { expected, actual }),
  }));
}

function catalogRows(catalog: CatalogStage, align: AlignStage | null) {
  return (align?.steps ?? []).map(({ step, bricks }) => {
    const covers = bricks.map((uuid) => catalog.byBrick[uuid]!);
    const missing = [
      ...new Set(
        covers.filter(({ coverage }) => coverage === "missing").map(({ design }) => design),
      ),
    ].sort();
    return {
      step,
      pieces: bricks.length,
      exact: covers.filter(({ coverage }) => coverage === "exact").length,
      interchangeable: covers.filter(({ coverage }) => coverage === "interchangeable").length,
      missing: covers.filter(({ coverage }) => coverage === "missing").length,
      ...(missing.length > 0 ? { missingDesigns: missing } : {}),
    };
  });
}

/** The committed headline counts, or null when there are none yet. */
function readBaseline(): unknown {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function runBooklet(options: { readonly writeBaseline: boolean }): Promise<number> {
  const started = performance.now();
  const inputRoot = mainCheckoutRoot();
  const outDir = resolve(process.env.BOOKLET_OUT ?? resolve(REPOSITORY_ROOT, "output", "booklet"));
  const inputs = {
    booklet: inputFile(
      resolve(process.env.BOOKLET_PDF ?? resolve(inputRoot, BOOKLET_BOOKLET_DEFAULT_PATH)),
    ),
    lxfml: inputFile(
      resolve(process.env.BOOKLET_LXFML ?? resolve(inputRoot, ANSWER_KEY_DEFAULT_PATHS.lxfml)),
    ),
    officialLdraw: inputFile(
      resolve(
        process.env.BOOKLET_OFFICIAL_LDRAW ?? resolve(inputRoot, ANSWER_KEY_DEFAULT_PATHS.ldraw),
      ),
    ),
    ldrawFrames: inputFile(
      resolve(process.env.BOOKLET_LDRAW_FRAMES ?? resolve(inputRoot, DEFAULT_MEASURED_FRAMES_PATH)),
    ),
  };

  const read: Stage<BookletRead> = inputs.booklet.present
    ? await timed(() => readBookletPdf(inputs.booklet.path))
    : skipped(`no booklet PDF at ${inputs.booklet.path}; set BOOKLET_PDF`);
  const keyLoad = inputs.lxfml.present
    ? await timed(() =>
        loadAnswerKey({ lxfmlPath: inputs.lxfml.path, ldrawPath: inputs.officialLdraw.path }),
      )
    : null;
  const key =
    keyLoad?.status === "ran" && keyLoad.value.status === "loaded" ? keyLoad.value.key : null;
  const keyReason = `no official LXFML at ${inputs.lxfml.path}; set BOOKLET_LXFML`;

  const align: Stage<AlignStage> =
    read.status !== "ran"
      ? skipped(read.reason.replace(/^skipped \(input absent\): /u, ""))
      : key
        ? await timed(() => runAlignStage(read.value, key))
        : skipped(keyReason);
  const alignValue = align.status === "ran" ? align.value : null;
  const catalog: Stage<CatalogStage> = key
    ? await timed(() =>
        runCatalogStage(key, alignValue, {
          version: BUILTIN_CATALOG_VERSION,
          parts: PART_DEFINITIONS,
          colors: COLOR_DEFINITIONS,
        }),
      )
    : skipped(keyReason);
  const playback: Stage<Playback> =
    !key || !alignValue || catalog.status !== "ran"
      ? skipped(
          !key
            ? keyReason
            : `the booklet read is needed to know each printed step's bricks (${inputs.booklet.path})`,
        )
      : key.ldraw.status !== "paired"
        ? skipped(key.ldraw.reason)
        : await timed(() =>
            playBack(
              playbackInputs(key, alignValue, catalog.value),
              loadMeasuredFrames(inputs.ldrawFrames.path),
            ),
          );

  const headline = headlineOf({ read, align, catalog, playback, key });
  const status = {
    version: BOOKLET_STATUS_VERSION,
    inputs,
    catalogVersion: BUILTIN_CATALOG_VERSION,
    headline,
    stages: {
      read:
        read.status === "ran"
          ? {
              status: "ran",
              ...read.value,
              steps: readRows(read.value),
              inventory: { ...read.value.inventory, quantities: undefined },
            }
          : read,
      align: alignValue ? { status: "ran", ...alignValue, steps: alignRows(alignValue) } : align,
      catalog:
        catalog.status === "ran"
          ? {
              status: "ran",
              ...catalog.value,
              byBrick: undefined,
              steps: catalogRows(catalog.value, alignValue),
            }
          : catalog,
      playback:
        playback.status === "ran"
          ? {
              status: "ran",
              worldShiftLdu: playback.value.worldShiftLdu,
              frameBases: playback.value.frameBases,
              steps: playback.value.steps,
            }
          : playback,
    },
  };
  const statusPath = resolve(outDir, "status.json");
  writeJson(statusPath, status);
  if (playback.status === "ran") {
    writeJson(resolve(outDir, "reference-playback.json"), {
      version: playback.value.version,
      note: "Reference build from LEGO's official model: scoring answer key, never a product input.",
      worldShiftLdu: playback.value.worldShiftLdu,
      steps: playback.value.steps.map(({ step, page, status: verdict }) => ({
        step,
        page,
        status: verdict,
        added: playback.value.placed
          .filter((part) => part.step === step)
          .map(({ uuid, design, catalogPartId, colorId, ldrawColor, transform, frameBasis }) => ({
            uuid,
            design,
            catalogPartId,
            colorId,
            ldrawColor,
            transform,
            frameBasis,
          })),
      })),
    });
  }
  if (options.writeBaseline)
    writeJson(BASELINE_PATH, { version: BOOKLET_STATUS_VERSION, headline });
  const baseline = readBaseline();
  const lines = summaryLines({
    read,
    align,
    catalog,
    playback,
    key,
    keyLoad,
    statusPath,
    baseline: compareWithBaseline(headline, baseline),
    totalMs: Math.round(performance.now() - started),
  });
  process.stdout.write(`${lines.join("\n")}\n`);
  return 0;
}
