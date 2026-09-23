import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { importRepositoryTypeScript } from "../../../scripts/part-identification-typescript-runtime.mjs";

const [action, nonce, repositoryRootInput, purpose, operationMarker, crashBoundary] =
  process.argv.slice(2);
const codeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const actions = new Set([
  "provision-repository",
  "crash-provision-repository",
  "provision-qualification",
  "crash-provision-qualification",
  "issue",
  "crash-issue",
  "operate",
  "crash-operate",
]);
const pages = Object.freeze({
  "page44-step43-vector": 44,
  "page45-step44-vector": 45,
  "page45-camera-raster": 45,
  "page45-contact-raster": 45,
  "page45-review-artifact-raster": 45,
  "page45-promotion-raster": 45,
});

function fail(message, code) {
  process.stderr.write(`${message}\n`);
  process.exitCode = code;
}

if (
  !actions.has(action ?? "") ||
  !/^[0-9a-f]{32}$/u.test(nonce ?? "") ||
  typeof repositoryRootInput !== "string" ||
  !isAbsolute(repositoryRootInput) ||
  !(purpose in pages) ||
  ((action === "operate" || action === "crash-operate") &&
    (typeof operationMarker !== "string" || !isAbsolute(operationMarker))) ||
  (action?.startsWith("crash-") === true &&
    (typeof crashBoundary !== "string" || crashBoundary.length < 1))
) {
  fail("invalid-ledger-control", 64);
} else {
  const repositoryRoot = resolve(repositoryRootInput);
  const digest = (label) =>
    `sha256:${createHash("sha256").update(`${label}:${nonce}`).digest("hex")}`;
  const ledger = await importRepositoryTypeScript(
    pathToFileURL(join(codeRoot, "apps/web/e2e/real-build-prefix50-step44-later-source-ledger.ts"))
      .href,
  );
  const provision = await importRepositoryTypeScript(
    pathToFileURL(
      join(codeRoot, "apps/web/e2e/real-build-prefix50-step44-later-source-ledger-provision.ts"),
    ).href,
  );
  const claim = Object.freeze({
    qualificationCommitment: digest("qualification"),
    sourceLockCommitment: digest("source-lock"),
    purpose,
    physicalPageNumber: pages[purpose],
    capabilityCommitment: digest(`capability:${purpose}`),
  });
  let boundaryReached = false;
  const observer = (boundary) => {
    if (boundary !== crashBoundary) return;
    boundaryReached = true;
    process.kill(process.pid, "SIGKILL");
  };
  try {
    if (action === "provision-repository" || action === "crash-provision-repository") {
      provision.provisionRealBuildPrefix50Step44LaterSourceRepositoryGenesis({
        repositoryRoot,
        ...(action === "crash-provision-repository" ? { observer } : {}),
      });
      if (action === "crash-provision-repository" && !boundaryReached)
        fail("boundary-not-reached", 14);
      else process.stdout.write("repository-provisioned\n");
    } else if (action === "provision-qualification" || action === "crash-provision-qualification") {
      provision.provisionRealBuildPrefix50Step44LaterSourceQualificationGenesis({
        repositoryRoot,
        qualificationCommitment: claim.qualificationCommitment,
        ...(action === "crash-provision-qualification" ? { observer } : {}),
      });
      if (action === "crash-provision-qualification" && !boundaryReached)
        fail("boundary-not-reached", 14);
      else process.stdout.write("qualification-provisioned\n");
    } else if (action === "issue" || action === "crash-issue") {
      ledger.claimRealBuildPrefix50Step44LaterSourceIssuance({
        repositoryRoot,
        claim,
        ...(action === "crash-issue" ? { observer } : {}),
      });
      if (action === "crash-issue" && !boundaryReached) fail("boundary-not-reached", 14);
      else process.stdout.write("issued\n");
    } else {
      const source = Buffer.from(`synthetic-ledger-source:${nonce}`, "utf8");
      const transaction = ledger.beginRealBuildPrefix50Step44LaterSourceInternalTransaction({
        repositoryRoot,
        claim,
        operationCommitment: digest("operation"),
        ...(action === "crash-operate" ? { observer } : {}),
      });
      try {
        writeFileSync(operationMarker, "synthetic-operation-ran\n", {
          flag: "wx",
          mode: 0o600,
        });
        ledger.completeRealBuildPrefix50Step44LaterSourceInternalTransaction({
          transaction,
          evidence: Object.freeze({
            sourceByteLength: source.byteLength,
            sourceBindingCommitment: digest(
              `source-binding:${createHash("sha256").update(source).digest("hex")}`,
            ),
            derivedCommitment: digest("derived"),
          }),
        });
      } catch (error) {
        ledger.abandonRealBuildPrefix50Step44LaterSourceInternalTransaction(transaction);
        throw error;
      } finally {
        source.fill(0);
      }
      if (action === "crash-operate" && !boundaryReached) fail("boundary-not-reached", 14);
      else process.stdout.write("operated\n");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("already issued")) fail("already-issued", 11);
    else if (
      message.includes("already been consumed") ||
      message.includes("transaction.lock") ||
      message.includes("EEXIST") ||
      message.includes("unavailable") ||
      message.includes("incomplete") ||
      message.includes("already provisioned") ||
      message.includes("already reserved")
    )
      fail("operation-refused", 12);
    else fail("ledger-error", 13);
  }
}
