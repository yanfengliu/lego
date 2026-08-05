import { spawnSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { writeContainedRegularFileAtomic } from "./contained-atomic-write";
import { sha256Digest } from "./real-build-artifacts";
import { compileRealBuildActionLedger } from "./real-build-action-ledger-compile";
import { createBuilderCanonicalCalibration } from "./real-build-builder-calibration";
import {
  describeRealBuildInputChain,
  REAL_BUILD_INPUT_CHAIN,
  realBuildInputChainRecovery,
} from "./real-build-input-chain";
import {
  ACTION_LEDGER_PATH,
  BUILDER_CALIBRATION_PATH,
  BUILDER_GEOMETRY_PATH,
  COVERAGE_PATH,
  OFFICIAL_MODEL_PATH,
  readBinaryInput,
  readJsonArtifact,
} from "./real-build-input-files";
import { parseOfficialModelIndex } from "./real-build-ledger";
import type { StepFailure } from "./real-build-safety";
import { hasSampleBooklet } from "./sample-booklet";

/**
 * The one answer to "the catalog moved".
 *
 * Rebuilds the catalog-derived real-build inputs in the order
 * `real-build-input-chain.ts` declares, and stops at the first stage that
 * cannot be rebuilt rather than republishing a later stage against a stale
 * earlier one. Opt-in, because it writes real-build inputs and reads the 70MiB
 * uncommitted booklet.
 *
 * Stage 1 is a *source* pin, not an artifact: reviewed catalog digests inside
 * `real-build-builder-sources.ts` belong to the change that bumps the catalog
 * version, so this spec refuses rather than editing reviewed source.
 * Stage 2 is only rebuilt when `LEGO_REAL_BUILD_REGENERATE_COVERAGE=1` is also
 * set, because recompiling coverage is expensive and pointless while the
 * catalog is still moving.
 */

const REGENERATE = process.env.LEGO_REAL_BUILD_REGENERATE_INPUTS === "1";
const REGENERATE_COVERAGE = process.env.LEGO_REAL_BUILD_REGENERATE_COVERAGE === "1";

function coverageMode(): {
  readonly source: string;
  readonly model: string;
  readonly assign: string;
} {
  const failures: StepFailure[] = [];
  const coverage = readJsonArtifact<{
    readonly identification?: {
      readonly source?: unknown;
      readonly model?: unknown;
      readonly assignment?: unknown;
    };
  }>(COVERAGE_PATH, failures);
  if (failures.length > 0) {
    throw new TypeError(
      `Cannot read the retained coverage mode from ${COVERAGE_PATH}: ` +
        `${failures.map(({ message }) => message).join(" ")} ` +
        realBuildInputChainRecovery(COVERAGE_PATH),
    );
  }
  const identification = coverage.value.identification ?? {};
  if (
    typeof identification.source !== "string" ||
    typeof identification.assignment !== "string" ||
    (identification.source === "adjudicated" && typeof identification.model !== "string")
  ) {
    throw new TypeError(
      `Retained coverage does not declare the source/model/assignment it was compiled with, so it cannot ` +
        `be recompiled the same way. ` +
        realBuildInputChainRecovery(COVERAGE_PATH),
    );
  }
  return {
    source: identification.source,
    model: typeof identification.model === "string" ? identification.model : "",
    assign: identification.assignment,
  };
}

test("regenerates the catalog-derived real-build inputs in chain order", async () => {
  test.setTimeout(1_800_000);
  test.skip(
    !REGENERATE,
    `set LEGO_REAL_BUILD_REGENERATE_INPUTS=1 to rebuild:\n${describeRealBuildInputChain()}`,
  );
  test.skip(!hasSampleBooklet, "no sample booklet");

  const rebuilt: string[] = [];

  // Stage 1 — reviewed source pins. Refused, never edited here.
  const officialBytes = readBinaryInput(OFFICIAL_MODEL_PATH, []);
  const geometryBytes = readBinaryInput(BUILDER_GEOMETRY_PATH, []);
  let calibration: ReturnType<typeof createBuilderCanonicalCalibration>;
  try {
    calibration = createBuilderCanonicalCalibration(
      parseOfficialModelIndex(officialBytes),
      geometryBytes,
      sha256Digest(geometryBytes),
    );
  } catch (error) {
    throw new TypeError(
      `Stage ${REAL_BUILD_INPUT_CHAIN[0]!.order} of the real-build input chain is stale and this spec will ` +
        `not edit reviewed source to fix it: ${error instanceof Error ? error.message : String(error)} ` +
        `Nothing later in the chain was rebuilt, because it would be republished against stale pins.`,
      { cause: error },
    );
  }

  // Stage 2 — catalog coverage.
  if (REGENERATE_COVERAGE) {
    const mode = coverageMode();
    const argv = [
      "scripts/booklet-catalog-coverage.mjs",
      "--source",
      mode.source,
      ...(mode.model === "" ? [] : ["--model", mode.model]),
      "--assign",
      mode.assign,
      "--last-step",
      "359",
    ];
    const result = spawnSync(process.execPath, argv, { encoding: "utf8", cwd: process.cwd() });
    if (result.status !== 0) {
      throw new TypeError(
        `Stage 2 of the real-build input chain failed: node ${argv.join(" ")} exited ` +
          `${result.status ?? "on a signal"}. ${(result.stderr ?? "").slice(-2_000)} ` +
          `Nothing later in the chain was rebuilt.`,
      );
    }
    rebuilt.push(COVERAGE_PATH);
  }

  // Stage 3 — builder canonical calibration.
  const calibrationBytes = Buffer.from(JSON.stringify(calibration), "utf8");
  writeContainedRegularFileAtomic(process.cwd(), BUILDER_CALIBRATION_PATH, calibrationBytes, {
    label: `Builder canonical calibration ${BUILDER_CALIBRATION_PATH}`,
    replace: true,
  });
  rebuilt.push(BUILDER_CALIBRATION_PATH);

  // Stage 4 — action ledger, which binds the digests of stages 2 and 3.
  const compiled = await compileRealBuildActionLedger({
    validateThroughStep: Number(process.env.LEGO_REAL_BUILD_LAST_STEP ?? 12),
  });
  writeContainedRegularFileAtomic(process.cwd(), ACTION_LEDGER_PATH, compiled.encoded, {
    label: `Action ledger ${ACTION_LEDGER_PATH}`,
    replace: true,
  });
  rebuilt.push(ACTION_LEDGER_PATH);

  expect(rebuilt).toContain(ACTION_LEDGER_PATH);
  process.stdout.write(
    `rebuilt in chain order: ${rebuilt.join(", ")}\n` +
      `  catalog ${calibration.designFrames[0]?.catalogVersion ?? "unknown"}; ` +
      `ledger ${compiled.assembled.ledger.steps.length} steps, ` +
      `${compiled.assembled.directPieceCount} direct pieces, ` +
      `${compiled.validationFailures.length} remaining evidence failures through printed step ` +
      `${compiled.validatedThroughStep}\n` +
      (REGENERATE_COVERAGE
        ? ""
        : `  ${COVERAGE_PATH} was NOT rebuilt; set LEGO_REAL_BUILD_REGENERATE_COVERAGE=1 to include it.\n`),
  );
});
