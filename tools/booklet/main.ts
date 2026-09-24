import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { BUILTIN_CATALOG_VERSION, COLOR_DEFINITIONS, PART_DEFINITIONS } from "@lego-studio/catalog";

import {
  ANSWER_KEY_DEFAULT_PATHS,
  AnswerKeyFormatError,
  loadAnswerKey,
  type AnswerKeyLoad,
} from "./answer-key/index.ts";
import { runAlignStage, type AlignStage } from "./align-stage.ts";
import { runCatalogStage, type CatalogStage } from "./catalog-coverage.ts";
import { checkExportFrames, type ExportFrameCheck } from "./export-frames.ts";
import { FRAME_PINS_DEFAULT_PATH, loadFramePins } from "./frame-pins.ts";
import {
  assertOutputIgnored,
  INPUT_LIMITS,
  inputFile,
  mainCheckoutRoot,
  readRunEvidenceOptIn,
  RUN_EVIDENCE_VARIABLE,
} from "./inputs.ts";
import {
  DEFAULT_MEASURED_FRAMES_PATH,
  loadMeasuredFrames,
  MeasuredFramesError,
  type FrameRegistry,
} from "./ldraw-frames.ts";
import { primaryPlayback, runPlaybackStage, type PlaybackStage } from "./playback-stage.ts";
import { buildReferenceFile, REFERENCE_BUILD_FILE, referenceBuildLine } from "./reference-build.ts";
import { readBookletPdf, type BookletRead } from "./read.ts";
import {
  alignRows,
  catalogRows,
  pairingRows,
  playbackSection,
  readRows,
  referencePlayback,
} from "./status-rows.ts";
import { compareWithBaseline, headlineOf, summaryLines, type Stage } from "./summary.ts";

/**
 * `npm run booklet`: how far the booklet build is, per printed step, scored
 * against LEGO's official model of the set.
 *
 * Stages — read, align, catalog, export frames, reference playback — write
 * their per-step rows to output/booklet/status.json, and the console gets a
 * summary of at most 40 lines. The valid prefix of reference playback also
 * goes to output/booklet/reference-build.mpd, which the editor imports and
 * plays back one printed step at a time. An absent input skips the stages that need it
 * ("skipped (input absent)") and never fails the run. A present input that
 * cannot be used — malformed, oversized, or an official export whose rows
 * contradict the LXFML — fails the stages that need it and the run (exit 1),
 * naming the file and the fault; the other stages still report.
 *
 * Every LDraw-to-catalog frame playback uses is catalog truth. The first-50
 * frame registry, an ignored run file that used to supply them, is read only
 * with LEGO_RUN_EVIDENCE=1, and then only to compare the catalog frames with
 * it; no stage waits on it.
 */
export const BOOKLET_STATUS_VERSION = "lego.booklet-status/2";
export const BOOKLET_BOOKLET_DEFAULT_PATH = "recipes/6651557.pdf";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BASELINE_PATH = resolve(REPOSITORY_ROOT, "status", "booklet-baseline.json");

async function timed<T>(run: () => T | Promise<T>): Promise<Stage<T>> {
  const started = performance.now();
  const value = await run();
  return { status: "ran", ms: Math.round(performance.now() - started), value };
}

/** Like `timed`, but an error the input caused becomes a failed stage instead of ending the run. */
async function attempt<T>(
  run: () => T | Promise<T>,
  isInputFault: (error: unknown) => boolean,
): Promise<Stage<T>> {
  try {
    return await timed(run);
  } catch (error) {
    if (!isInputFault(error)) throw error;
    return { status: "failed", reason: `malformed: ${(error as Error).message}` };
  }
}

/** A stage that did not run; assignable to every Stage<T>. */
type NotRun = { readonly status: "skipped" | "failed"; readonly reason: string };
const skipped = (reason: string): NotRun => ({
  status: "skipped",
  reason: `skipped (input absent): ${reason}`,
});
const failed = (reason: string): NotRun => ({ status: "failed", reason });
const notOptedIn = (reason: string): NotRun => ({
  status: "skipped",
  reason: `skipped (not opted in): ${reason}`,
});
/** A stage that cannot run because one it needs did not: carries that stage's verdict forward. */
const blockedBy = (stage: Stage<unknown>, what: string): NotRun =>
  stage.status === "failed"
    ? failed(`needs ${what}, which failed: ${stage.reason}`)
    : skipped(
        stage.status === "skipped"
          ? stage.reason.replace(/^skipped \(input absent\): /u, "")
          : `needs ${what}`,
      );

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
  const inputRoot = mainCheckoutRoot(REPOSITORY_ROOT);
  const outDir = resolve(process.env.BOOKLET_OUT ?? resolve(REPOSITORY_ROOT, "output", "booklet"));
  const statusPath = resolve(outDir, "status.json");
  const referencePath = resolve(outDir, "reference-playback.json");
  const referenceBuildPath = resolve(outDir, REFERENCE_BUILD_FILE);
  // Before any work: the rows carry official transforms and must never be committable.
  assertOutputIgnored(statusPath);
  assertOutputIgnored(referencePath);
  assertOutputIgnored(referenceBuildPath);
  const envPath = (name: string, fallback: string) =>
    resolve(process.env[name] ?? resolve(inputRoot, fallback));
  const runEvidence = readRunEvidenceOptIn(process.env[RUN_EVIDENCE_VARIABLE]);
  const inputs = {
    booklet: inputFile(
      envPath("BOOKLET_PDF", BOOKLET_BOOKLET_DEFAULT_PATH),
      INPUT_LIMITS.bookletPdfBytes,
    ),
    lxfml: inputFile(
      envPath("BOOKLET_LXFML", ANSWER_KEY_DEFAULT_PATHS.lxfml),
      INPUT_LIMITS.lxfmlBytes,
    ),
    officialLdraw: inputFile(
      envPath("BOOKLET_OFFICIAL_LDRAW", ANSWER_KEY_DEFAULT_PATHS.ldraw),
      INPUT_LIMITS.officialLdrawBytes,
    ),
    // Run evidence, not a playback input: not even sized or hashed unless opted in.
    ldrawFrames:
      runEvidence.status === "on"
        ? inputFile(
            envPath("BOOKLET_LDRAW_FRAMES", DEFAULT_MEASURED_FRAMES_PATH),
            INPUT_LIMITS.ldrawFramesBytes,
          )
        : null,
  };

  const read: Stage<BookletRead> = !inputs.booklet.present
    ? skipped(`no booklet PDF at ${inputs.booklet.path}; set BOOKLET_PDF`)
    : inputs.booklet.problem
      ? failed(`malformed: ${inputs.booklet.problem} (BOOKLET_PDF)`)
      : await attempt(
          () => readBookletPdf(inputs.booklet.path),
          () => true,
        );
  const keyLoad: Stage<AnswerKeyLoad> | null = !inputs.lxfml.present
    ? null
    : inputs.lxfml.problem
      ? failed(`malformed: ${inputs.lxfml.problem} (BOOKLET_LXFML)`)
      : await attempt(
          () =>
            loadAnswerKey({
              lxfmlPath: inputs.lxfml.path,
              ldrawPath: inputs.officialLdraw.problem ? null : inputs.officialLdraw.path,
            }),
          (error) => error instanceof AnswerKeyFormatError,
        );
  const key =
    keyLoad?.status === "ran" && keyLoad.value.status === "loaded" ? keyLoad.value.key : null;
  const keyStage: Stage<unknown> =
    keyLoad ?? skipped(`no official LXFML at ${inputs.lxfml.path}; set BOOKLET_LXFML`);

  const align: Stage<AlignStage> =
    read.status !== "ran"
      ? blockedBy(read, "the booklet read")
      : key
        ? await timed(() => runAlignStage(read.value, key))
        : blockedBy(keyStage, "the official LXFML");
  const alignValue = align.status === "ran" ? align.value : null;
  const catalog: Stage<CatalogStage> = key
    ? await timed(() =>
        runCatalogStage(key, alignValue, {
          version: BUILTIN_CATALOG_VERSION,
          parts: PART_DEFINITIONS,
          colors: COLOR_DEFINITIONS,
        }),
      )
    : blockedBy(keyStage, "the official LXFML");

  // The first-50 frame registry feeds no stage; opted in, playback compares the catalog frames with it.
  const framesFile = inputs.ldrawFrames;
  const registryStage: Stage<FrameRegistry> =
    runEvidence.status === "invalid"
      ? failed(runEvidence.reason)
      : framesFile === null
        ? notOptedIn(
            `playback takes every frame from the catalog; set ${RUN_EVIDENCE_VARIABLE}=1 to compare the catalog frames with the first-50 frame registry`,
          )
        : !framesFile.present
          ? skipped(
              `no first-50 frame registry at ${framesFile.path}, so the catalog frames are not compared with it; set BOOKLET_LDRAW_FRAMES`,
            )
          : framesFile.problem
            ? failed(`malformed: ${framesFile.problem} (BOOKLET_LDRAW_FRAMES)`)
            : await attempt(
                () => loadMeasuredFrames(framesFile.path),
                (error) => error instanceof MeasuredFramesError,
              );
  const registry =
    registryStage.status === "ran" && registryStage.value.status === "loaded"
      ? registryStage.value
      : null;
  const ldraw = key?.ldraw ?? null;
  // The official LDraw export is the pose source: absent skips, malformed or contradicted fails.
  const ldrawVerdict: NotRun | null = !key
    ? blockedBy(keyStage, "the official LXFML")
    : inputs.officialLdraw.problem
      ? failed(`malformed: ${inputs.officialLdraw.problem} (BOOKLET_OFFICIAL_LDRAW)`)
      : ldraw?.status === "absent"
        ? skipped(ldraw.reason.replace(/^input absent: /u, ""))
        : ldraw?.status === "malformed"
          ? failed(`malformed: ${ldraw.reason}`)
          : ldraw?.status === "contradicted"
            ? failed(
                `contradicted: the official LDraw export's rows disagree with the LXFML (${ldraw.pairing.invarianceFailures.length} invariance failures, ${ldraw.pairing.colorConflicts.length} colour conflicts); re-export it from this LXFML`,
              )
            : null;
  const catalogValue = catalog.status === "ran" ? catalog.value : null;
  const exportFrames: Stage<ExportFrameCheck> =
    ldrawVerdict ??
    (!catalogValue
      ? blockedBy(catalog, "the catalog stage")
      : await attempt(
          () =>
            checkExportFrames({
              key: key!,
              pins: loadFramePins(resolve(REPOSITORY_ROOT, FRAME_PINS_DEFAULT_PATH)),
              catalogPartFor: (filename) =>
                catalogValue.designs.find(({ design }) => design === filename)?.catalogPartId ??
                null,
            }),
          (error) => error instanceof Error && /^Frame pins /u.test(error.message),
        ));
  const playback: Stage<PlaybackStage> =
    ldrawVerdict ??
    (!alignValue
      ? blockedBy(align, "the booklet read, to know each printed step's bricks")
      : !catalogValue
        ? blockedBy(catalog, "the catalog stage")
        : exportFrames.status === "failed"
          ? blockedBy(exportFrames, "the export frame check")
          : await timed(() =>
              runPlaybackStage({
                key: key!,
                align: alignValue,
                catalog: catalogValue,
                registry,
                corrections: exportFrames.status === "ran" ? exportFrames.value.corrections : [],
              }),
            ));

  const stages = { read, align, catalog, exportFrames, playback, key };
  const headline = headlineOf(stages);
  writeJson(statusPath, {
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
      key: key ? { status: "ran", ldraw: key.ldraw.status, pairing: pairingRows(key) } : keyStage,
      align: alignValue ? { status: "ran", ...alignValue, steps: alignRows(alignValue) } : align,
      catalog: catalogValue
        ? {
            status: "ran",
            ...catalogValue,
            byBrick: undefined,
            steps: catalogRows(catalogValue, alignValue),
          }
        : catalog,
      exportFrames:
        exportFrames.status === "ran" ? { status: "ran", ...exportFrames.value } : exportFrames,
      frameRegistry:
        registryStage.status === "ran"
          ? { status: registryStage.value.status, path: registryStage.value.path }
          : registryStage,
      playback: playback.status === "ran" ? playbackSection(playback.value) : playback,
    },
  });
  if (playback.status === "ran") writeJson(referencePath, referencePlayback(playback.value));
  const referenceBuild =
    playback.status === "ran" ? buildReferenceFile(primaryPlayback(playback.value)) : null;
  if (referenceBuild?.status === "built") {
    mkdirSync(dirname(referenceBuildPath), { recursive: true });
    writeFileSync(referenceBuildPath, referenceBuild.text, "utf8");
  } else {
    // A file left by an earlier run would be played as if this run had written it.
    rmSync(referenceBuildPath, { force: true });
  }
  if (options.writeBaseline)
    writeJson(BASELINE_PATH, { version: BOOKLET_STATUS_VERSION, headline });
  const lines = summaryLines({
    ...stages,
    keyLoad,
    frameRegistry: registryStage,
    statusPath,
    baseline: compareWithBaseline(headline, readBaseline()),
    totalMs: Math.round(performance.now() - started),
  });
  if (referenceBuild) lines.splice(-1, 0, referenceBuildLine(referenceBuild, referenceBuildPath));
  process.stdout.write(`${lines.join("\n")}\n`);
  const anyFailed = [read, keyLoad, align, catalog, registryStage, exportFrames, playback].some(
    (stage) => stage?.status === "failed",
  );
  return anyFailed ? 1 : 0;
}
