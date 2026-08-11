import { relative, resolve } from "node:path";
import { createServer } from "vite";

import { assertOrdinaryDirectoryPath } from "./part-identification-contained-path.mjs";
import { readContainedFile } from "./part-identification-io.mjs";

const MAX_INPUT_BYTES = 64 * 1024;
const INPUT_SCHEMA = "lego.part-visual-admission-review-input/1";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 2;
  return null;
}

function argumentsFrom(values) {
  if (values.length === 2 && values[0] === "--batch" && !values[1].startsWith("--")) {
    return { kind: "batch", batch: values[1] };
  }
  const parsed = {};
  for (let index = 0; index < values.length; index += 2) {
    const flag = values[index];
    const value = values[index + 1];
    if (!["--packet", "--input"].includes(flag) || value === undefined || value.startsWith("--")) {
      return fail(
        "Visual review requires either --packet <packet.json> --input <review-input.json> or --batch <capture-batch.json>.",
      );
    }
    parsed[flag.slice(2)] = value;
  }
  if (
    values.length !== 4 ||
    typeof parsed.packet !== "string" ||
    typeof parsed.input !== "string"
  ) {
    return fail(
      "Visual review requires either --packet <packet.json> --input <review-input.json> or --batch <capture-batch.json>.",
    );
  }
  return { kind: "packet", ...parsed };
}

function exactInput(repository, path) {
  const absolute = resolve(path);
  const relativeInput = relative(repository, absolute).replaceAll("\\", "/");
  if (!/^(?:output|test-results)(?:\/[A-Za-z0-9._@-]+)+\.json$/u.test(relativeInput)) {
    throw new TypeError(
      `Visual-review input must be a contained JSON file below output/ or test-results/: ${absolute}.`,
    );
  }
  const bytes = readContainedFile(repository, relativeInput, {
    maxBytes: MAX_INPUT_BYTES,
    label: "visual-review input",
    pathLabel: "visual-review input path",
  });
  const parsed = JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes));
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new TypeError(
      `Visual-review input must be ${INPUT_SCHEMA} with exactly schemaVersion, reviewer, method, and views.`,
    );
  }
  const keys = Object.keys(parsed).sort();
  if (
    JSON.stringify(keys) !== JSON.stringify(["method", "reviewer", "schemaVersion", "views"]) ||
    parsed.schemaVersion !== INPUT_SCHEMA
  ) {
    throw new TypeError(
      `Visual-review input must be ${INPUT_SCHEMA} with exactly schemaVersion, reviewer, method, and views.`,
    );
  }
  return parsed;
}

const parsed = argumentsFrom(process.argv.slice(2));
if (parsed === null) process.exit();
let server;
try {
  const repository = assertOrdinaryDirectoryPath(process.cwd(), {
    label: "Visual-review repository root",
  });
  const reviewInput = parsed.kind === "packet" ? exactInput(repository, parsed.input) : null;
  server = await createServer({
    root: process.cwd(),
    configFile: resolve("apps/web/vite.config.ts"),
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
  });
  const module = await server.ssrLoadModule("/apps/web/e2e/part-visual-admission-review.ts");
  if (parsed.kind === "batch") {
    const publication = module.publishPartVisualAdmissionReviewBatch({
      captureBatchPath: parsed.batch,
    });
    process.stdout.write(
      `${JSON.stringify({
        reviewBatchPath: publication.reviewBatchPath,
        outcome: publication.reviewBatch.outcome,
        reviewCount: publication.reviewBatch.reviews.length,
        reviewBatchHash: publication.reviewBatch.reviewBatchHash,
      })}\n`,
    );
  } else {
    const publication = module.publishPartVisualAdmissionReview({
      packetPath: parsed.packet,
      reviewer: reviewInput.reviewer,
      method: reviewInput.method,
      views: reviewInput.views,
    });
    process.stdout.write(
      `${JSON.stringify({
        reviewPath: publication.reviewPath,
        outcome: publication.review.outcome,
        reviewHash: publication.review.reviewHash,
      })}\n`,
    );
  }
} catch (error) {
  process.stderr.write(
    `Visual review failed: ${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
} finally {
  await server?.close();
}
