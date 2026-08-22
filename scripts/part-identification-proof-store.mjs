import { existsSync, lstatSync } from "node:fs";
import { join } from "node:path";

import { boundedDirectoryFiles } from "./part-identification-io.mjs";
import { exactOwnKeys, isOrdinaryObject, own, ownKeys } from "./part-identification-safe-shape.mjs";
import {
  PART_IDENTIFICATION_MAX_AGGREGATE_PROOF_BYTES,
  PART_IDENTIFICATION_MAX_CALLS,
  PART_IDENTIFICATION_MAX_PROOF_BYTES,
} from "./part-identification-transport-contract.mjs";

const FILE = /^[0-9a-f]{64}\.json$/u;

/** Account every generation-owned proof path, including crash-orphaned files. */
export function auditPartIdentificationProofStore(out, calls) {
  if (!isOrdinaryObject(calls))
    throw new Error("Proof-store audit requires the exact checkpoint call map.");
  const expected = Object.create(null);
  const callDigests = ownKeys(calls);
  for (let index = 0; index < callDigests.length; index += 1) {
    const callDigest = callDigests[index];
    const reference = calls[callDigest]?.proof;
    if (
      !exactOwnKeys(reference, ["path", "byteLength", "digest"]) ||
      reference.digest !== callDigest
    ) {
      throw new Error(`Proof-store call ${callDigest} has a malformed retained reference.`);
    }
    expected[reference.path.slice("call-proofs/sha256/".length)] = reference.byteLength;
  }
  const root = join(out, "call-proofs", "sha256");
  if (!existsSync(root)) {
    if (callDigests.length === 0) return 0;
    throw new Error("Proof-store directory is absent for retained checkpoint calls.");
  }
  const files = boundedDirectoryFiles(root, {
    label: "Part-identification call-proof store",
    maxEntries: PART_IDENTIFICATION_MAX_CALLS,
  });
  let aggregate = 0;
  for (let index = 0; index < files.length; index += 1) {
    const name = files[index];
    if (!FILE.test(name))
      throw new Error(`Proof-store entry ${JSON.stringify(name)} is not canonical.`);
    const stats = lstatSync(join(root, name), { bigint: true });
    const size = Number(stats.size);
    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      size < 1 ||
      size > PART_IDENTIFICATION_MAX_PROOF_BYTES
    ) {
      throw new Error(
        `Proof-store entry ${JSON.stringify(name)} is not one bounded ordinary proof file.`,
      );
    }
    aggregate += size;
    if (aggregate > PART_IDENTIFICATION_MAX_AGGREGATE_PROOF_BYTES) {
      throw new Error(
        "Proof-store bytes exceed the complete generation aggregate before provider launch.",
      );
    }
    if (!own(expected, name) || expected[name] !== size) {
      throw new Error(
        `Proof-store entry ${JSON.stringify(name)} is orphaned or has changed length; crash residue must be reviewed before another provider call.`,
      );
    }
    delete expected[name];
  }
  if (ownKeys(expected).length !== 0) {
    throw new Error("Proof-store is missing one or more checkpoint-owned proof files.");
  }
  return aggregate;
}
