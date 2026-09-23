import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { RealBuildPrefix50Step44OwnedProcessJob } from "./real-build-prefix50-subbuild-return-review-process-jobs.ts";
import { materializeRealBuildPrefix50Step44ProcessLaunch } from "./real-build-prefix50-subbuild-return-review-process-launch-table.ts";

interface ExpectedFile {
  readonly relativePath: string;
  readonly digest: `sha256:${string}`;
}

interface IntegrityFileEvidence {
  readonly path: string;
  readonly digest: `sha256:${string}`;
  readonly device: string;
  readonly inode: string;
  readonly size: string;
  readonly modifiedNanoseconds: string;
  readonly changedNanoseconds: string;
}

export interface RealBuildPrefix50Step44OwnedProcessIntegrityEvidence {
  readonly commitment: `sha256:${string}`;
  readonly files: readonly IntegrityFileEvidence[];
}

const SUPPORT_FILES = Object.freeze([
  Object.freeze({
    relativePath: "./real-build-prefix50-subbuild-return-review-process-bootstrap.ts",
    digest: "sha256:51e0fa773f6b9e0e9efcd9cb6a1d0573970edad4130b49bb5042f8445f2ff1be",
  }),
  Object.freeze({
    relativePath: "./real-build-prefix50-subbuild-return-review-process-jobs.ts",
    digest: "sha256:fa3ff807f2f77b63d1e2fc9ea6a15f688b7031d78ba6ed3a54c114f6edb115bc",
  }),
  Object.freeze({
    relativePath: "./real-build-prefix50-subbuild-return-review-process-launch-table.ts",
    digest: "sha256:aa4bd916f84b4458edc650641c88a7318df2c7e688293fa8bc3bda7dc85e3341",
  }),
  Object.freeze({
    relativePath: "./real-build-prefix50-subbuild-return-review-process-single-launch.ts",
    digest: "sha256:6d4a7e110e9ceacf568fa9fdf7b90e741bfb187eaa558a8f11d394f6ecedc4da",
  }),
] as const satisfies readonly ExpectedFile[]);

const TARGET_DIGESTS = Object.freeze({
  "static-app-server": "sha256:51e3603ed8887195cb6ca686220c874df4d4ba82fa1820ed220d426b6124f54c",
  "playwright-browser-worker":
    "sha256:dec4e5c7ecdc048f6b12a09762284bd90e92c918f7006a55263c5e5812111b62",
  "containment-transient-parent":
    "sha256:f48d6c3a3e5a0a34bfa6c1de003fce6be627cf2ce9b1144ae1b96ba71bb95c37",
  "containment-hold": "sha256:8935b7795fdae9e54802d217dbb1e8c3a46b42cc3fdec8742a193ddb050083ed",
} satisfies Readonly<
  Record<RealBuildPrefix50Step44OwnedProcessJob["jobKind"], `sha256:${string}`>
>);

function digest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function snapshot(path: string, expectedDigest: `sha256:${string}`): IntegrityFileEvidence {
  if (expectedDigest === "sha256:pending")
    throw new TypeError("Step-44 owned-process integrity pins require a reviewed repin.");
  const canonical = realpathSync.native(path);
  if (canonical !== path)
    throw new TypeError("Step-44 owned-process integrity rejects aliased or linked paths.");
  const before = lstatSync(canonical, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n)
    throw new TypeError(
      "Step-44 owned-process integrity requires regular, non-link, single-name files.",
    );
  const bytes = readFileSync(canonical);
  const after = lstatSync(canonical, { bigint: true });
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeNs !== after.mtimeNs ||
    before.ctimeNs !== after.ctimeNs ||
    after.nlink !== 1n ||
    BigInt(bytes.byteLength) !== after.size ||
    realpathSync.native(canonical) !== canonical
  )
    throw new TypeError("Step-44 owned-process file identity changed while authenticated.");
  const actualDigest = digest(bytes);
  if (actualDigest !== expectedDigest)
    throw new TypeError("Step-44 owned-process file digest changed without reviewed repin.");
  return Object.freeze({
    path: canonical,
    digest: actualDigest,
    device: String(after.dev),
    inode: String(after.ino),
    size: String(after.size),
    modifiedNanoseconds: String(after.mtimeNs),
    changedNanoseconds: String(after.ctimeNs),
  });
}

export function verifyRealBuildPrefix50Step44OwnedProcessIntegrity(
  job: RealBuildPrefix50Step44OwnedProcessJob,
): RealBuildPrefix50Step44OwnedProcessIntegrityEvidence {
  const support = SUPPORT_FILES.map(({ relativePath, digest: expectedDigest }) =>
    snapshot(fileURLToPath(new URL(relativePath, import.meta.url)), expectedDigest),
  );
  const launch = materializeRealBuildPrefix50Step44ProcessLaunch(job);
  const target = snapshot(launch.target, TARGET_DIGESTS[job.jobKind]);
  const files = Object.freeze([...support, target]);
  const identities = new Set(files.map((file) => `${file.device}:${file.inode}`));
  if (identities.size !== files.length)
    throw new TypeError("Step-44 owned-process integrity rejects duplicate file identities.");
  return Object.freeze({
    commitment: digest(Buffer.from(JSON.stringify(files), "utf8")),
    files,
  });
}

export function assertRealBuildPrefix50Step44SameOwnedProcessIntegrity(
  before: RealBuildPrefix50Step44OwnedProcessIntegrityEvidence,
  after: RealBuildPrefix50Step44OwnedProcessIntegrityEvidence,
): void {
  if (
    before.commitment !== after.commitment ||
    JSON.stringify(before.files) !== JSON.stringify(after.files)
  )
    throw new TypeError("Step-44 owned-process integrity changed across its launch boundary.");
}

export const REAL_BUILD_PREFIX50_STEP44_OWNED_PROCESS_INTEGRITY_PINS = Object.freeze({
  support: SUPPORT_FILES,
  targets: TARGET_DIGESTS,
});
