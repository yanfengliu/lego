import { createHash } from "node:crypto";

const stringify = JSON.stringify;

export const callProofJsonBytes = (value) => Buffer.from(stringify(value), "utf8");
export const callProofSha256 = (bytes) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
export const answerRecordDigest = (answer) => callProofSha256(callProofJsonBytes(answer));
