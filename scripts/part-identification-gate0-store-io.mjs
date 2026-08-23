import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { writeContainedFileAtomic } from "./part-identification-contained-write.mjs";
import { failGate0 } from "./part-identification-gate0-foundation.mjs";
import { readContainedFile } from "./part-identification-io.mjs";

const bufferEquals = Function.call.bind(Buffer.prototype.equals);

export function readExactGate0State(root, path, expected, maxBytes, label) {
  let observed;
  try {
    observed = readContainedFile(root, path, { maxBytes, label });
  } catch {
    failGate0(
      `${label} is missing, unreadable, or no longer an ordinary retained file; restore its exact original bytes before retrying.`,
    );
  }
  if (!bufferEquals(observed, expected)) {
    failGate0(`${label} no longer contains its exact canonical retained bytes.`);
  }
  return observed;
}

export function publishExclusiveGate0State(root, path, bytes, label) {
  writeContainedFileAtomic(root, path, bytes, {
    exclusive: true,
    label,
    pathLabel: `${label} path`,
    rootLabel: "Gate-0 local state root",
  });
}

export function publishContentAddressedGate0State(root, path, bytes, maxBytes, label) {
  try {
    publishExclusiveGate0State(root, path, bytes, label);
  } catch (error) {
    if (!existsSync(resolve(root, ...path.split("/")))) throw error;
    readExactGate0State(root, path, bytes, maxBytes, label);
  }
}

export function readExactGate0LaunchState(state, maxRecordBytes) {
  readExactGate0State(
    state.root,
    state.paths.launch,
    state.launchBytes,
    maxRecordBytes,
    "Gate-0 launch-start record",
  );
  if (state.pilotSlotBytes !== null) {
    readExactGate0State(
      state.root,
      state.paths.pilotSlot,
      state.pilotSlotBytes,
      maxRecordBytes,
      "Gate-0 global pilot launch slot",
    );
  }
}
