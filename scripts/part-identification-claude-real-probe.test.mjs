import { createHash } from "node:crypto";
import { createReadStream, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  assertPinnedClaudeVersionResult,
  boundedPartIdentificationEnvironment,
  providerPartIdentificationEnvironment,
  resolveClaudeBinary,
} from "./part-identification-claude-runtime.mjs";
import { runBoundedChild } from "./part-identification-io.mjs";

const enabled =
  process.platform === "win32" &&
  process.env.LEGO_PART_IDENTIFICATION_CLAUDE_REAL_PROBE === "1" &&
  process.env.LEGO_PART_IDENTIFICATION_ACK_UNGATED_VERSION_NETWORK_UNMEASURED === "1";
const retainedDescribe = enabled ? describe : describe.skip;

function executableRoots() {
  return readdirSync(tmpdir())
    .filter((name) => name.startsWith("lego-part-identification-claude-bin-"))
    .sort();
}

function hashFile(path) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path, { highWaterMark: 1024 * 1024 });
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolvePromise(`sha256:${hash.digest("hex")}`));
  });
}

retainedDescribe("explicit ungated exact-Claude executable/version probe", () => {
  it("hashes and invokes only --version; network-attempt and provider-call absence are unmeasured", async () => {
    const resolverEnvironment = boundedPartIdentificationEnvironment(process.env);
    const environment = providerPartIdentificationEnvironment(resolverEnvironment);
    const binary = resolveClaudeBinary(resolverEnvironment);
    const beforeRoots = executableRoots();
    const before = statSync(binary.path, { bigint: true });
    expect(before.isFile()).toBe(true);
    expect(before.size).toBe(BigInt(binary.exactExecutablePin.byteLength));
    expect(await hashFile(binary.path)).toBe(binary.exactExecutablePin.digest);

    const started = process.hrtime.bigint();
    const result = await runBoundedChild(binary.path, ["--version"], {
      exactExecutablePin: binary.exactExecutablePin,
      timeoutMs: 60_000,
      maxStdoutBytes: 4_096,
      maxStderrBytes: 4_096,
      cwd: tmpdir(),
      env: environment,
      label: "retained Claude 2.1.232 exact executable probe",
    });
    const elapsedMs = Number((process.hrtime.bigint() - started) / 1_000_000n);
    expect(assertPinnedClaudeVersionResult(result)).toBe("2.1.232 (Claude Code)");
    expect(result.executableEvidence).toEqual(binary.exactExecutablePin);
    expect(elapsedMs).toBeLessThan(60_000);

    const after = statSync(binary.path, { bigint: true });
    expect(after.size).toBe(before.size);
    expect(after.mtimeNs).toBe(before.mtimeNs);
    expect(after.ctimeNs).toBe(before.ctimeNs);
    expect(await hashFile(binary.path)).toBe(binary.exactExecutablePin.digest);
    expect(executableRoots()).toEqual(beforeRoots);
  }, 90_000);
});
