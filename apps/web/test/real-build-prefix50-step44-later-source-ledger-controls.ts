import { createHash, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

import { canonicalDigest } from "@lego-studio/brick-kernel";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  abandonRealBuildPrefix50Step44LaterSourceInternalTransaction,
  beginRealBuildPrefix50Step44LaterSourceInternalTransaction,
  claimRealBuildPrefix50Step44LaterSourceIssuance,
  completeRealBuildPrefix50Step44LaterSourceInternalTransaction,
  realBuildPrefix50Step44LaterSourceLedgerArtifacts,
  type RealBuildPrefix50Step44LaterSourceLedgerArtifacts,
  type RealBuildPrefix50Step44LaterSourceLedgerClaim,
  type RealBuildPrefix50Step44LaterSourceLedgerPurpose,
} from "../e2e/real-build-prefix50-step44-later-source-ledger.ts";
import {
  provisionRealBuildPrefix50Step44LaterSourceQualificationGenesis,
  provisionRealBuildPrefix50Step44LaterSourceRepositoryGenesis,
  realBuildPrefix50Step44LaterSourceRepositoryGenesisArtifacts,
} from "../e2e/real-build-prefix50-step44-later-source-ledger-provision.ts";

let REPOSITORY_ROOT: string;
const PROCESS_CONTROL = resolve(
  "apps/web/test/real-build-prefix50-step44-later-source-ledger-process.mjs",
);
const cleanupDirectories = new Set<string>();
const cleanupFiles = new Set<string>();
const PAGES: Readonly<Record<RealBuildPrefix50Step44LaterSourceLedgerPurpose, 44 | 45>> =
  Object.freeze({
    "page44-step43-vector": 44,
    "page45-step44-vector": 45,
    "page45-camera-raster": 45,
    "page45-contact-raster": 45,
    "page45-review-artifact-raster": 45,
    "page45-promotion-raster": 45,
  });

function digest(label: string, nonce: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(`${label}:${nonce}`).digest("hex")}`;
}

function claim(
  nonce = randomUUID().replaceAll("-", ""),
  purpose: RealBuildPrefix50Step44LaterSourceLedgerPurpose = "page45-promotion-raster",
): RealBuildPrefix50Step44LaterSourceLedgerClaim {
  return Object.freeze({
    qualificationCommitment: digest("qualification", nonce),
    sourceLockCommitment: digest("source-lock", nonce),
    purpose,
    physicalPageNumber: PAGES[purpose],
    capabilityCommitment: digest(`capability:${purpose}`, nonce),
  });
}

function retain(
  repositoryRoot: string,
  input: RealBuildPrefix50Step44LaterSourceLedgerClaim,
): RealBuildPrefix50Step44LaterSourceLedgerArtifacts {
  provisionRealBuildPrefix50Step44LaterSourceQualificationGenesis({
    repositoryRoot,
    qualificationCommitment: input.qualificationCommitment,
  });
  const paths = realBuildPrefix50Step44LaterSourceLedgerArtifacts({
    repositoryRoot,
    claim: input,
  });
  const stateRoot = resolve(repositoryRoot, "var/state");
  for (const path of [paths.ledgerDirectory, paths.marker]) {
    const local = relative(stateRoot, resolve(path));
    if (
      local.length === 0 ||
      local === ".." ||
      local.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    )
      throw new TypeError("Test ledger cleanup target escaped its exact state root.");
  }
  cleanupDirectories.add(paths.ledgerDirectory);
  cleanupFiles.add(paths.marker);
  return paths;
}

function syntheticRepository(): string {
  const parent = resolve("output/step44-later-source-ledger-tests");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, "repository-"));
  cleanupDirectories.add(root);
  writeFileSync(
    join(root, "package.json"),
    '{"name":"synthetic-step44-ledger-root","private":true}\n',
    { flag: "wx", mode: 0o600 },
  );
  provisionRealBuildPrefix50Step44LaterSourceRepositoryGenesis({ repositoryRoot: root });
  return root;
}

beforeEach(() => {
  REPOSITORY_ROOT = syntheticRepository();
});

function processRun(input: {
  action: "issue" | "operate";
  nonce: string;
  repositoryRoot?: string;
  purpose?: RealBuildPrefix50Step44LaterSourceLedgerPurpose;
  cwd?: string;
  operationMarker?: string;
}) {
  return spawnSync(
    process.execPath,
    [
      PROCESS_CONTROL,
      input.action,
      input.nonce,
      input.repositoryRoot ?? REPOSITORY_ROOT,
      input.purpose ?? "page45-promotion-raster",
      input.operationMarker ?? "-",
    ],
    {
      cwd: input.cwd ?? REPOSITORY_ROOT,
      encoding: "utf8",
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
      timeout: 30_000,
    },
  );
}

function processRunConcurrent(
  action: "issue" | "operate",
  nonce: string,
  operationMarker: string,
): Promise<Readonly<{ status: number | null; output: string }>> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(
      process.execPath,
      [PROCESS_CONTROL, action, nonce, REPOSITORY_ROOT, "page45-promotion-raster", operationMarker],
      {
        cwd: REPOSITORY_ROOT,
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (output += chunk));
    child.stderr.on("data", (chunk: string) => (output += chunk));
    const timeout = setTimeout(() => child.kill(), 30_000);
    child.once("error", reject);
    child.once("close", (status) => {
      clearTimeout(timeout);
      resolveResult({ status, output });
    });
  });
}

afterEach(() => {
  for (const file of cleanupFiles) {
    try {
      unlinkSync(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  for (const directory of [...cleanupDirectories].sort((a, b) => b.length - a.length))
    rmSync(directory, { recursive: true, force: true });
  cleanupFiles.clear();
  cleanupDirectories.clear();
});

// These controls launch bounded OS key-protection and Node child processes.
describe("sealed repository-qualified later-source ledger", { timeout: 30_000 }, () => {
  // Bound: each case owns a synthetic repository. Ordinary verification must never
  // provision or remove the working checkout's stable later-source genesis.
  it("owns its genesis only inside a fresh synthetic repository", () => {
    const genesis = realBuildPrefix50Step44LaterSourceRepositoryGenesisArtifacts({
      repositoryRoot: REPOSITORY_ROOT,
    });
    expect(REPOSITORY_ROOT).not.toBe(resolve("."));
    expect(cleanupDirectories.has(REPOSITORY_ROOT)).toBe(true);
    expect(relative(REPOSITORY_ROOT, genesis.directory)).toMatch(/^var[\\/]state[\\/]/u);
  });
  it("withholds repository coordinates from storage failures", () => {
    const unavailable = resolve(
      "output/step44-later-source-ledger-tests/raw-coordinate-must-not-leak/missing-repository",
    );
    let failure: unknown;
    try {
      provisionRealBuildPrefix50Step44LaterSourceRepositoryGenesis({
        repositoryRoot: unavailable,
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(TypeError);
    expect((failure as Error).message).toBe(
      "Later-source ledger storage is unavailable; access remains closed.",
    );
    expect((failure as Error).message).not.toContain(unavailable);
  });

  it("binds one qualification to its canonical repository independent of CWD", () => {
    const nonce = randomUUID().replaceAll("-", "");
    const input = claim(nonce);
    const files = retain(REPOSITORY_ROOT, input);
    const otherCwd = syntheticRepository();
    const issued = processRun({ action: "issue", nonce, cwd: otherCwd });
    expect({ status: issued.status, stdout: issued.stdout }).toEqual({
      status: 0,
      stdout: "issued\n",
    });
    const replay = processRun({ action: "issue", nonce });
    expect({ status: replay.status, stderr: replay.stderr }).toEqual({
      status: 11,
      stderr: "already-issued\n",
    });
    expect(statSync(files.key).size).toBeGreaterThan(100);
    expect(files.ledgerDirectory).toContain(resolve(REPOSITORY_ROOT, "var/state"));
  });

  it("keeps identical qualification commitments in distinct canonical roots", () => {
    const nonce = randomUUID().replaceAll("-", "");
    const input = claim(nonce);
    const leftRoot = syntheticRepository();
    const rightRoot = syntheticRepository();
    const left = retain(leftRoot, input);
    const right = retain(rightRoot, input);
    const leftReceipt = claimRealBuildPrefix50Step44LaterSourceIssuance({
      repositoryRoot: leftRoot,
      claim: input,
    });
    const rightReceipt = claimRealBuildPrefix50Step44LaterSourceIssuance({
      repositoryRoot: rightRoot,
      claim: input,
    });
    expect(leftReceipt.namespaceCommitment).not.toBe(rightReceipt.namespaceCommitment);
    expect(left.ledgerDirectory).not.toBe(right.ledgerDirectory);
  });

  it("cannot reopen issuance after authenticated record deletion or tamper", () => {
    const input = claim();
    const files = retain(REPOSITORY_ROOT, input);
    claimRealBuildPrefix50Step44LaterSourceIssuance({
      repositoryRoot: REPOSITORY_ROOT,
      claim: input,
    });
    unlinkSync(files.issuance);
    expect(() =>
      claimRealBuildPrefix50Step44LaterSourceIssuance({
        repositoryRoot: REPOSITORY_ROOT,
        claim: input,
      }),
    ).toThrow(/already issued/u);
    const state = readFileSync(files.state);
    state[Math.floor(state.length / 2)]! ^= 1;
    writeFileSync(files.state, state, { flag: "w" });
    expect(() =>
      claimRealBuildPrefix50Step44LaterSourceIssuance({
        repositoryRoot: REPOSITORY_ROOT,
        claim: input,
      }),
    ).toThrow(/HMAC|ledger/u);
  });

  it("cannot reprovision or reissue after the whole qualification namespace is deleted", () => {
    const input = claim();
    const files = retain(REPOSITORY_ROOT, input);
    claimRealBuildPrefix50Step44LaterSourceIssuance({
      repositoryRoot: REPOSITORY_ROOT,
      claim: input,
    });
    rmSync(files.ledgerDirectory, { recursive: true, force: true });
    unlinkSync(files.marker);
    expect(() =>
      provisionRealBuildPrefix50Step44LaterSourceQualificationGenesis({
        repositoryRoot: REPOSITORY_ROOT,
        qualificationCommitment: input.qualificationCommitment,
      }),
    ).toThrow(/already reserved/u);
    expect(() =>
      claimRealBuildPrefix50Step44LaterSourceIssuance({
        repositoryRoot: REPOSITORY_ROOT,
        claim: input,
      }),
    ).toThrow(/no stable preprovisioned qualification genesis/u);
  });

  it("cannot replay a restored pre-issuance qualification namespace", () => {
    const input = claim();
    const files = retain(REPOSITORY_ROOT, input);
    const backupRoot = mkdtempSync(
      join(resolve("output/step44-later-source-ledger-tests"), "namespace-backup-"),
    );
    cleanupDirectories.add(backupRoot);
    const backupDirectory = join(backupRoot, "ledger");
    const backupMarker = join(backupRoot, "anchor");
    cpSync(files.ledgerDirectory, backupDirectory, { recursive: true, errorOnExist: true });
    copyFileSync(files.marker, backupMarker);
    claimRealBuildPrefix50Step44LaterSourceIssuance({
      repositoryRoot: REPOSITORY_ROOT,
      claim: input,
    });
    rmSync(files.ledgerDirectory, { recursive: true, force: true });
    unlinkSync(files.marker);
    cpSync(backupDirectory, files.ledgerDirectory, { recursive: true, errorOnExist: true });
    copyFileSync(backupMarker, files.marker);
    expect(() =>
      claimRealBuildPrefix50Step44LaterSourceIssuance({
        repositoryRoot: REPOSITORY_ROOT,
        claim: input,
      }),
    ).toThrow(/repository issue is already recorded/u);
  });

  it("burns before one synthetic operation and returns derived evidence only", () => {
    const input = claim();
    const files = retain(REPOSITORY_ROOT, input);
    claimRealBuildPrefix50Step44LaterSourceIssuance({
      repositoryRoot: REPOSITORY_ROOT,
      claim: input,
    });
    const operationCommitment = canonicalDigest({ operation: randomUUID() });
    const transaction = beginRealBuildPrefix50Step44LaterSourceInternalTransaction({
      repositoryRoot: REPOSITORY_ROOT,
      claim: input,
      operationCommitment,
    });
    expect(statSync(files.burn).size).toBeGreaterThan(100);
    const evidence = completeRealBuildPrefix50Step44LaterSourceInternalTransaction({
      transaction,
      evidence: Object.freeze({
        sourceByteLength: 23,
        sourceBindingCommitment: canonicalDigest({ source: "synthetic" }),
        derivedCommitment: canonicalDigest({ output: "synthetic" }),
      }),
    });
    expect(Object.keys(evidence).sort()).toEqual([
      "derivedCommitment",
      "operationCommitment",
      "schemaVersion",
      "sourceBindingCommitment",
      "sourceByteLength",
      "transactionCommitment",
    ]);
    expect(JSON.stringify(evidence)).not.toContain(REPOSITORY_ROOT);
    expect(() =>
      beginRealBuildPrefix50Step44LaterSourceInternalTransaction({
        repositoryRoot: REPOSITORY_ROOT,
        claim: input,
        operationCommitment,
      }),
    ).toThrow(/already been consumed/u);
  }, 30_000);

  it("preserves a burn when its internal operation is abandoned", () => {
    const input = claim();
    retain(REPOSITORY_ROOT, input);
    claimRealBuildPrefix50Step44LaterSourceIssuance({
      repositoryRoot: REPOSITORY_ROOT,
      claim: input,
    });
    const transaction = beginRealBuildPrefix50Step44LaterSourceInternalTransaction({
      repositoryRoot: REPOSITORY_ROOT,
      claim: input,
      operationCommitment: canonicalDigest({ operation: "abandoned" }),
    });
    abandonRealBuildPrefix50Step44LaterSourceInternalTransaction(transaction);
    expect(() =>
      beginRealBuildPrefix50Step44LaterSourceInternalTransaction({
        repositoryRoot: REPOSITORY_ROOT,
        claim: input,
        operationCommitment: canonicalDigest({ operation: "replay" }),
      }),
    ).toThrow(/already been consumed/u);
  }, 30_000);

  it("admits one winner under concurrent cross-process issue and operation", async () => {
    const nonce = randomUUID().replaceAll("-", "");
    const input = claim(nonce);
    retain(REPOSITORY_ROOT, input);
    const operationMarker = resolve(REPOSITORY_ROOT, `.step44-ledger-operation-${nonce}.tmp`);
    cleanupFiles.add(operationMarker);
    const issues = await Promise.all([
      processRunConcurrent("issue", nonce, operationMarker),
      processRunConcurrent("issue", nonce, operationMarker),
    ]);
    expect(issues.filter(({ status }) => status === 0)).toHaveLength(1);
    const operations = await Promise.all([
      processRunConcurrent("operate", nonce, operationMarker),
      processRunConcurrent("operate", nonce, operationMarker),
    ]);
    expect(operations.filter(({ status }) => status === 0)).toHaveLength(1);
    expect(readFileSync(operationMarker, "utf8")).toBe("synthetic-operation-ran\n");
    for (const { output } of [...issues, ...operations]) {
      expect(output).not.toContain(nonce);
      expect(output).not.toContain(REPOSITORY_ROOT);
    }
  }, 30_000);
});
