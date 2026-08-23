import { createHash } from "node:crypto";
import { partIdentificationSafeJsonBytes } from "./part-identification-safe-json.mjs";

const hashPrototype = Object.getPrototypeOf(createHash("sha256"));
const hashUpdate = Function.call.bind(hashPrototype.update);
const hashDigest = Function.call.bind(hashPrototype.digest);

export const callProofJsonBytes = (value) => partIdentificationSafeJsonBytes(value);
export const callProofSha256 = (bytes) => {
  const hash = createHash("sha256");
  hashUpdate(hash, bytes);
  return `sha256:${hashDigest(hash, "hex")}`;
};
export const answerRecordDigest = (answer) => callProofSha256(callProofJsonBytes(answer));
