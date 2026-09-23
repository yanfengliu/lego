import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  claimRealBuildPrefix50Step44LaterSourceIssuance,
  realBuildPrefix50Step44LaterSourceLedgerArtifacts,
  type RealBuildPrefix50Step44LaterSourceLedgerClaim,
  type RealBuildPrefix50Step44LaterSourceLedgerPurpose,
} from "../e2e/real-build-prefix50-step44-later-source-ledger.ts";
import {
  provisionRealBuildPrefix50Step44LaterSourceQualificationGenesis,
  provisionRealBuildPrefix50Step44LaterSourceRepositoryGenesis,
  realBuildPrefix50Step44LaterSourceRepositoryGenesisArtifacts,
} from "../e2e/real-build-prefix50-step44-later-source-ledger-provision.ts";

const PROCESS_CONTROL = resolve(
  "apps/web/test/real-build-prefix50-step44-later-source-ledger-process.mjs",
);
const REPOSITORY_GENESIS_BOOTSTRAP = resolve(
  "scripts/provision-step44-later-source-repository-genesis.mjs",
);
const OUTPUT_BASE = resolve("output/step44-later-source-ledger-crash-tests");
mkdirSync(OUTPUT_BASE, { recursive: true });
const OUTPUT_PARENT = mkdtempSync(join(OUTPUT_BASE, "run-"));
const REPOSITORY_ROOT = mkdtempSync(join(OUTPUT_PARENT, "repository-"));
writeFileSync(
  join(REPOSITORY_ROOT, "package.json"),
  '{"name":"synthetic-step44-crash-ledger","private":true}\n',
  { flag: "wx", mode: 0o600 },
);

const ISSUE_BOUNDARIES = [
  "later-source transaction-lock:file-fsync",
  "later-source transaction-lock:directory-fsync",
  "later-source repository issue:temporary:file-fsync",
  "later-source repository issue:link",
  "later-source repository issue:temporary-unlink",
  "later-source repository issue:directory-fsync",
  "later-source issue:temporary:file-fsync",
  "later-source issue:link",
  "later-source issue:temporary-unlink",
  "later-source issue:directory-fsync",
  "later-source issue-state:temporary:file-fsync",
  "later-source issue-state:rename",
  "later-source issue-state:directory-fsync",
  "later-source transaction-lock:unlink",
  "later-source transaction-lock:unlink-directory-fsync",
] as const;
const REPOSITORY_PROVISION_BOUNDARIES = [
  "later-source var root:parent-directory-fsync",
  "later-source state root:parent-directory-fsync",
  "later-source ledger directory:parent-directory-fsync",
  "later-source repository genesis key:temporary:file-fsync",
  "later-source repository genesis key:link",
  "later-source repository genesis key:temporary-unlink",
  "later-source repository genesis key:directory-fsync",
  "later-source repository genesis anchor:temporary:file-fsync",
  "later-source repository genesis anchor:link",
  "later-source repository genesis anchor:temporary-unlink",
  "later-source repository genesis anchor:directory-fsync",
] as const;
const QUALIFICATION_PROVISION_BOUNDARIES = [
  "later-source qualification reservation:temporary:file-fsync",
  "later-source qualification reservation:link",
  "later-source qualification reservation:temporary-unlink",
  "later-source qualification reservation:directory-fsync",
  "later-source ledger directory:parent-directory-fsync",
  "later-source qualification key:temporary:file-fsync",
  "later-source qualification key:link",
  "later-source qualification key:temporary-unlink",
  "later-source qualification key:directory-fsync",
  "later-source qualification anchor:temporary:file-fsync",
  "later-source qualification anchor:link",
  "later-source qualification anchor:temporary-unlink",
  "later-source qualification anchor:directory-fsync",
  "later-source qualification initial-state:temporary:file-fsync",
  "later-source qualification initial-state:link",
  "later-source qualification initial-state:temporary-unlink",
  "later-source qualification initial-state:directory-fsync",
] as const;
const OPERATION_BOUNDARIES = [
  "later-source transaction-lock:file-fsync",
  "later-source transaction-lock:directory-fsync",
  "later-source repository burn:temporary:file-fsync",
  "later-source repository burn:link",
  "later-source repository burn:temporary-unlink",
  "later-source repository burn:directory-fsync",
  "later-source burn:temporary:file-fsync",
  "later-source burn:link",
  "later-source burn:temporary-unlink",
  "later-source burn:directory-fsync",
  "later-source burn-state:temporary:file-fsync",
  "later-source burn-state:rename",
  "later-source burn-state:directory-fsync",
  "later-source repository completion:temporary:file-fsync",
  "later-source repository completion:link",
  "later-source repository completion:temporary-unlink",
  "later-source repository completion:directory-fsync",
  "later-source completion:temporary:file-fsync",
  "later-source completion:link",
  "later-source completion:temporary-unlink",
  "later-source completion:directory-fsync",
  "later-source completion-state:temporary:file-fsync",
  "later-source completion-state:rename",
  "later-source completion-state:directory-fsync",
  "later-source transaction-lock:unlink",
  "later-source transaction-lock:unlink-directory-fsync",
] as const;
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
  nonce: string,
  purpose: RealBuildPrefix50Step44LaterSourceLedgerPurpose,
): RealBuildPrefix50Step44LaterSourceLedgerClaim {
  return Object.freeze({
    qualificationCommitment: digest("qualification", nonce),
    sourceLockCommitment: digest("source-lock", nonce),
    purpose,
    physicalPageNumber: PAGES[purpose],
    capabilityCommitment: digest(`capability:${purpose}`, nonce),
  });
}

function provision(input: RealBuildPrefix50Step44LaterSourceLedgerClaim): void {
  provisionRealBuildPrefix50Step44LaterSourceQualificationGenesis({
    repositoryRoot: REPOSITORY_ROOT,
    qualificationCommitment: input.qualificationCommitment,
  });
}

function run(input: {
  action:
    | "provision-repository"
    | "crash-provision-repository"
    | "provision-qualification"
    | "crash-provision-qualification"
    | "crash-issue"
    | "crash-operate"
    | "issue"
    | "operate";
  nonce: string;
  purpose: RealBuildPrefix50Step44LaterSourceLedgerPurpose;
  marker: string;
  boundary?: string;
}) {
  return spawnSync(
    process.execPath,
    [
      PROCESS_CONTROL,
      input.action,
      input.nonce,
      REPOSITORY_ROOT,
      input.purpose,
      input.marker,
      ...(input.boundary === undefined ? [] : [input.boundary]),
    ],
    {
      cwd: OUTPUT_PARENT,
      encoding: "utf8",
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
      timeout: 30_000,
    },
  );
}

function createSyntheticRepository(label: string): string {
  const root = mkdtempSync(join(OUTPUT_PARENT, `${label}-`));
  writeFileSync(
    join(root, "package.json"),
    '{"name":"synthetic-step44-provision-crash","private":true}\n',
    { flag: "wx", mode: 0o600 },
  );
  return root;
}

function cleanupQualification(input: RealBuildPrefix50Step44LaterSourceLedgerClaim): void {
  const paths = realBuildPrefix50Step44LaterSourceLedgerArtifacts({
    repositoryRoot: REPOSITORY_ROOT,
    claim: input,
  });
  rmSync(paths.ledgerDirectory, { recursive: true, force: true });
  try {
    unlinkSync(paths.marker);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

beforeAll(() => {
  provisionRealBuildPrefix50Step44LaterSourceRepositoryGenesis({
    repositoryRoot: REPOSITORY_ROOT,
  });
});

afterAll(() => {
  rmSync(OUTPUT_PARENT, { recursive: true, force: true });
});

describe("later-source ledger real process-kill durability", () => {
  it("requires explicit operator bootstrap and ordinary use refuses after genesis deletion", () => {
    const repositoryRoot = createSyntheticRepository("operator-bootstrap");
    const mismatchedCommand = [
      REPOSITORY_GENESIS_BOOTSTRAP,
      "--repository-root",
      repositoryRoot,
      "--confirm-new-repository-genesis",
    ];
    const refused = spawnSync(process.execPath, mismatchedCommand.slice(0, -1), {
      cwd: OUTPUT_PARENT,
      encoding: "utf8",
      timeout: 30_000,
    });
    expect({ status: refused.status, stderr: refused.stderr }).toEqual({
      status: 64,
      stderr: "invalid-step44-repository-genesis-bootstrap-request\n",
    });
    const mismatched = spawnSync(process.execPath, mismatchedCommand, {
      cwd: OUTPUT_PARENT,
      encoding: "utf8",
      timeout: 30_000,
    });
    expect({ status: mismatched.status, stderr: mismatched.stderr }).toEqual({
      status: 73,
      stderr: "step44-later-source-repository-genesis-provisioning-refused\n",
    });
    expect(`${mismatched.stdout}${mismatched.stderr}`).not.toContain(repositoryRoot);
    const validated = spawnSync(
      process.execPath,
      [
        REPOSITORY_GENESIS_BOOTSTRAP,
        "--repository-root",
        resolve("."),
        "--validate-repository-genesis-bootstrap",
      ],
      { cwd: OUTPUT_PARENT, encoding: "utf8", timeout: 30_000 },
    );
    expect({ status: validated.status, stdout: validated.stdout }).toEqual({
      status: 0,
      stdout: "step44-later-source-repository-genesis-bootstrap-validated\n",
    });
    const copiedCli = join(OUTPUT_PARENT, "copied-step44-genesis-bootstrap.mjs");
    copyFileSync(REPOSITORY_GENESIS_BOOTSTRAP, copiedCli);
    const copiedRefusal = spawnSync(
      process.execPath,
      [copiedCli, "--repository-root", resolve("."), "--validate-repository-genesis-bootstrap"],
      { cwd: OUTPUT_PARENT, encoding: "utf8", timeout: 30_000 },
    );
    expect({ status: copiedRefusal.status, stderr: copiedRefusal.stderr }).toEqual({
      status: 73,
      stderr: "step44-later-source-repository-genesis-provisioning-refused\n",
    });
    provisionRealBuildPrefix50Step44LaterSourceRepositoryGenesis({ repositoryRoot });
    expect(() =>
      provisionRealBuildPrefix50Step44LaterSourceRepositoryGenesis({ repositoryRoot }),
    ).toThrow(/already provisioned or incomplete/u);
    const nonce = randomUUID().replaceAll("-", "");
    const input = claim(nonce, "page45-promotion-raster");
    provisionRealBuildPrefix50Step44LaterSourceQualificationGenesis({
      repositoryRoot,
      qualificationCommitment: input.qualificationCommitment,
    });
    const genesis = realBuildPrefix50Step44LaterSourceRepositoryGenesisArtifacts({
      repositoryRoot,
    });
    rmSync(genesis.directory, { recursive: true, force: true });
    unlinkSync(genesis.marker);
    expect(() =>
      claimRealBuildPrefix50Step44LaterSourceIssuance({ repositoryRoot, claim: input }),
    ).toThrow(/repository genesis is not preprovisioned/u);
    const ordinaryRetry = spawnSync(
      process.execPath,
      [PROCESS_CONTROL, "issue", nonce, repositoryRoot, input.purpose, "-"],
      { cwd: OUTPUT_PARENT, encoding: "utf8", timeout: 30_000 },
    );
    expect(ordinaryRetry.status).not.toBe(0);
    expect(`${ordinaryRetry.stdout}${ordinaryRetry.stderr}`).not.toContain(repositoryRoot);
    rmSync(repositoryRoot, { recursive: true, force: true });
  }, 60_000);

  it("has explicit restart semantics after every repository and qualification provisioning boundary", () => {
    for (const [index, boundary] of REPOSITORY_PROVISION_BOUNDARIES.entries()) {
      const repositoryRoot = createSyntheticRepository(`genesis-${index}`);
      const nonce = createHash("md5")
        .update(`repository:${boundary}:${randomUUID()}`)
        .digest("hex");
      const marker = resolve(repositoryRoot, "unused-operation.tmp");
      const killed = spawnSync(
        process.execPath,
        [
          PROCESS_CONTROL,
          "crash-provision-repository",
          nonce,
          repositoryRoot,
          "page45-promotion-raster",
          marker,
          boundary,
        ],
        {
          cwd: OUTPUT_PARENT,
          encoding: "utf8",
          env: { ...process.env, NODE_NO_WARNINGS: "1" },
          timeout: 30_000,
        },
      );
      expect(killed.status).not.toBe(0);
      const restarted = spawnSync(
        process.execPath,
        [
          PROCESS_CONTROL,
          "provision-repository",
          nonce,
          repositoryRoot,
          "page45-promotion-raster",
          marker,
        ],
        {
          cwd: OUTPUT_PARENT,
          encoding: "utf8",
          env: { ...process.env, NODE_NO_WARNINGS: "1" },
          timeout: 30_000,
        },
      );
      if (
        boundary === "later-source var root:parent-directory-fsync" ||
        boundary === "later-source state root:parent-directory-fsync"
      ) {
        expect(restarted.status).toBe(0);
        const replay = spawnSync(
          process.execPath,
          [
            PROCESS_CONTROL,
            "provision-repository",
            nonce,
            repositoryRoot,
            "page45-promotion-raster",
            marker,
          ],
          {
            cwd: OUTPUT_PARENT,
            encoding: "utf8",
            env: { ...process.env, NODE_NO_WARNINGS: "1" },
            timeout: 30_000,
          },
        );
        expect(replay.status).not.toBe(0);
      } else expect(restarted.status).not.toBe(0);
      rmSync(repositoryRoot, { recursive: true, force: true });
    }
    for (const [index, boundary] of QUALIFICATION_PROVISION_BOUNDARIES.entries()) {
      const nonce = createHash("md5")
        .update(`qualification:${boundary}:${index}:${randomUUID()}`)
        .digest("hex");
      const input = claim(nonce, "page45-promotion-raster");
      const marker = resolve(REPOSITORY_ROOT, `unused-provision-${index}.tmp`);
      const killed = run({
        action: "crash-provision-qualification",
        nonce,
        purpose: input.purpose,
        marker,
        boundary,
      });
      expect(killed.status).not.toBe(0);
      const restarted = run({
        action: "provision-qualification",
        nonce,
        purpose: input.purpose,
        marker,
      });
      expect(restarted.status).not.toBe(0);
      cleanupQualification(input);
    }
  }, 240_000);

  it("fails closed after a child is killed at every issuance fsync/publish boundary", () => {
    for (const [index, boundary] of ISSUE_BOUNDARIES.entries()) {
      const nonce = createHash("md5")
        .update(`issue:${boundary}:${index}:${randomUUID()}`)
        .digest("hex");
      const input = claim(nonce, "page45-promotion-raster");
      provision(input);
      const marker = resolve(REPOSITORY_ROOT, `issue-operation-${index}.tmp`);
      const killed = run({
        action: "crash-issue",
        nonce,
        purpose: input.purpose,
        marker,
        boundary,
      });
      expect(killed.status).not.toBe(0);
      expect(killed.stdout).toBe("");
      const restarted = run({
        action: "issue",
        nonce,
        purpose: input.purpose,
        marker,
      });
      expect(restarted.status).not.toBe(0);
      expect(`${restarted.stdout}${restarted.stderr}`).not.toContain(nonce);
      cleanupQualification(input);
    }
  }, 180_000);

  it("fails closed after every burn/completion boundary and runs the synthetic operation at most once", () => {
    for (const [index, boundary] of OPERATION_BOUNDARIES.entries()) {
      const nonce = createHash("md5")
        .update(`operation:${boundary}:${index}:${randomUUID()}`)
        .digest("hex");
      const input = claim(nonce, "page45-promotion-raster");
      provision(input);
      claimRealBuildPrefix50Step44LaterSourceIssuance({
        repositoryRoot: REPOSITORY_ROOT,
        claim: input,
      });
      const marker = resolve(REPOSITORY_ROOT, `synthetic-operation-${index}.tmp`);
      const killed = run({
        action: "crash-operate",
        nonce,
        purpose: input.purpose,
        marker,
        boundary,
      });
      expect(killed.status).not.toBe(0);
      expect(killed.stdout).toBe("");
      const restarted = run({
        action: "operate",
        nonce,
        purpose: input.purpose,
        marker,
      });
      expect(restarted.status).not.toBe(0);
      expect(`${restarted.stdout}${restarted.stderr}`).not.toContain(nonce);
      try {
        expect(readFileSync(marker, "utf8")).toBe("synthetic-operation-ran\n");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      cleanupQualification(input);
    }
  }, 240_000);

  (process.platform === "win32" ? it.skip : it)(
    "enforces descriptor UID/GID and exact 0700/0600 POSIX modes",
    () => {
      const nonce = randomUUID().replaceAll("-", "");
      const input = claim(nonce, "page45-promotion-raster");
      provision(input);
      claimRealBuildPrefix50Step44LaterSourceIssuance({
        repositoryRoot: REPOSITORY_ROOT,
        claim: input,
      });
      const paths = realBuildPrefix50Step44LaterSourceLedgerArtifacts({
        repositoryRoot: REPOSITORY_ROOT,
        claim: input,
      });
      expect(statSync(paths.ledgerDirectory).mode & 0o777).toBe(0o700);
      for (const file of [paths.key, paths.state, paths.issuance]) {
        const stats = statSync(file);
        expect(stats.mode & 0o777).toBe(0o600);
        expect(stats.uid).toBe(process.getuid?.());
        expect(stats.gid).toBe(process.getgid?.());
      }
      cleanupQualification(input);
    },
  );
});
