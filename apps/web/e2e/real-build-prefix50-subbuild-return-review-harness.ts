import { resolve } from "node:path";

import {
  parseRealBuildPrefix50Step44ReviewArguments,
  readRealBuildPrefix50Step44ReviewHarnessInput,
} from "./real-build-prefix50-subbuild-return-review-harness-input.ts";

async function run(
  inputPath: string,
  expectedInputBytesHash: `sha256:${string}`,
  outputPath: string,
): Promise<void> {
  const { input, bytesHash } = await readRealBuildPrefix50Step44ReviewHarnessInput(
    inputPath,
    expectedInputBytesHash,
  );
  if (input.schemaVersion !== "lego.real-build-prefix50-subbuild-return-review-batch-input/2")
    throw new TypeError(
      "Step-44 promotion-safe harness requires the exact compact 211-candidate batch input.",
    );
  const { runRealBuildPrefix50Step44CameraQualifiedProduction } =
    await import("./real-build-prefix50-subbuild-return-review-camera-qualified-production.ts");
  const result = await runRealBuildPrefix50Step44CameraQualifiedProduction({
    outputPath,
    repositoryRoot: resolve("."),
    inputBytesHash: bytesHash,
    batch: input,
  });
  process.stdout.write(
    `${JSON.stringify({
      outputPath: result.outputPath,
      publicRoot: result.publicRoot,
      manifest: resolve(result.publicRoot, result.publicManifest.artifactFile),
      success: resolve(result.publicRoot, result.success.artifactFile),
      complete: resolve(result.outputPath, result.complete.artifactFile),
    })}\n`,
  );
}

const parsed = parseRealBuildPrefix50Step44ReviewArguments(process.argv.slice(2));
if (parsed === null) {
  process.stdout.write(
    "Usage: node --experimental-strip-types apps/web/e2e/real-build-prefix50-subbuild-return-review-harness.ts --input output/playwright/real-build-prefix50-step44-return-review/<input>.json --expected-input-sha256 sha256:<digest> --output output/playwright/real-build-prefix50-step44-return-review/<new-run>\n",
  );
} else {
  await run(parsed.inputPath, parsed.expectedInputBytesHash, parsed.outputPath);
}
