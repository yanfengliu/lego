import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_NAME = "provision-step44-later-source-repository-genesis.mjs";
const MAXIMUM_PACKAGE_BYTES = 1024 * 1024;

function samePath(left, right) {
  return process.platform === "win32"
    ? left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US")
    : left === right;
}

function captureIdentity(repositoryRoot) {
  const requested = resolve(repositoryRoot);
  const rootLink = lstatSync(requested, { bigint: true });
  const realPath = realpathSync.native(requested);
  const rootAfter = lstatSync(requested, { bigint: true });
  if (
    rootLink.isSymbolicLink() ||
    !rootLink.isDirectory() ||
    !samePath(realPath, requested) ||
    rootAfter.dev !== rootLink.dev ||
    rootAfter.ino !== rootLink.ino
  )
    throw new TypeError("invalid root");
  const packagePath = join(realPath, "package.json");
  const packageLink = lstatSync(packagePath, { bigint: true });
  if (
    packageLink.isSymbolicLink() ||
    !packageLink.isFile() ||
    !samePath(realpathSync.native(packagePath), packagePath)
  )
    throw new TypeError("invalid package");
  const descriptor = openSync(packagePath, constants.O_RDONLY);
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (
      !before.isFile() ||
      before.nlink !== 1n ||
      before.size < 1n ||
      before.size > BigInt(MAXIMUM_PACKAGE_BYTES)
    )
      throw new TypeError("invalid package");
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs ||
      after.nlink !== before.nlink
    )
      throw new TypeError("unstable package");
    return Object.freeze({
      realPath,
      device: rootLink.dev.toString(10),
      inode: rootLink.ino.toString(10),
      packageJsonDigest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    });
  } finally {
    closeSync(descriptor);
  }
}

function sameIdentity(left, right) {
  return (
    samePath(left.realPath, right.realPath) &&
    left.device === right.device &&
    left.inode === right.inode &&
    left.packageJsonDigest === right.packageJsonDigest
  );
}

const [rootFlag, repositoryRootInput, action] = process.argv.slice(2);
if (
  process.argv.slice(2).length !== 3 ||
  rootFlag !== "--repository-root" ||
  typeof repositoryRootInput !== "string" ||
  !isAbsolute(repositoryRootInput) ||
  (action !== "--confirm-new-repository-genesis" &&
    action !== "--validate-repository-genesis-bootstrap")
) {
  process.stderr.write("invalid-step44-repository-genesis-bootstrap-request\n");
  process.exitCode = 64;
} else {
  try {
    const scriptPath = realpathSync.native(fileURLToPath(import.meta.url));
    const scriptDirectory = dirname(scriptPath);
    if (basename(scriptDirectory) !== "scripts") throw new TypeError("relocated script");
    const codeRoot = realpathSync.native(dirname(scriptDirectory));
    if (!samePath(scriptPath, join(codeRoot, "scripts", SCRIPT_NAME)))
      throw new TypeError("relocated script");
    const targetIdentity = captureIdentity(repositoryRootInput);
    const codeIdentity = captureIdentity(codeRoot);
    if (!sameIdentity(targetIdentity, codeIdentity)) throw new TypeError("root mismatch");
    if (action === "--validate-repository-genesis-bootstrap") {
      process.stdout.write("step44-later-source-repository-genesis-bootstrap-validated\n");
    } else {
      delete process.env.NODE_OPTIONS;
      delete process.env.NODE_PATH;
      const runtime = await import(
        pathToFileURL(join(codeRoot, "scripts", "part-identification-typescript-runtime.mjs")).href
      );
      const files = await runtime.importRepositoryTypeScript(
        pathToFileURL(
          join(codeRoot, "apps/web/e2e/real-build-prefix50-step44-later-source-ledger-files.ts"),
        ).href,
      );
      const provision = await runtime.importRepositoryTypeScript(
        pathToFileURL(
          join(
            codeRoot,
            "apps/web/e2e/real-build-prefix50-step44-later-source-ledger-provision.ts",
          ),
        ).href,
      );
      const importedIdentity =
        files.captureRealBuildPrefix50Step44LaterSourceRepositoryIdentity(codeRoot);
      if (!sameIdentity(targetIdentity, importedIdentity)) throw new TypeError("identity drift");
      provision.provisionRealBuildPrefix50Step44LaterSourceRepositoryGenesis({
        repositoryRoot: codeRoot,
      });
      process.stdout.write("step44-later-source-repository-genesis-provisioned\n");
    }
  } catch {
    process.stderr.write("step44-later-source-repository-genesis-provisioning-refused\n");
    process.exitCode = 73;
  }
}
