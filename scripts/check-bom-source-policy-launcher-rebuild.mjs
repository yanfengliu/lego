import { spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  REVIEWED_POPPLER_LAUNCHER,
  sourcePolicySha256,
} from "./check-bom-source-policy-binary.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const compilerRoot =
  "C:/Program Files (x86)/Microsoft Visual Studio/18/BuildTools/MSBuild/Current/Bin/Roslyn";
const frameworkRoot = "C:/Windows/Microsoft.NET/Framework64/v4.0.30319";
const buildInputs = [
  [
    join(compilerRoot, "csc.exe"),
    64_808,
    "cf9b364171b07822f5afa44391ae4fb4a4418d2056a5c5a018ce64f62173ab2c",
  ],
  [
    join(compilerRoot, "csc.exe.config"),
    6_353,
    "0a820d11cae0895d0682233c6c7a8f63fc48bdd42f6ce874280b8738bb340245",
  ],
  [
    join(compilerRoot, "Microsoft.CodeAnalysis.dll"),
    4_015_368,
    "f663593ab14a3f0a887c9ba53491e46c2ede422b7f2f1998d1260904b2c9953d",
  ],
  [
    join(compilerRoot, "Microsoft.CodeAnalysis.CSharp.dll"),
    8_604_976,
    "2866a6058c36d3bc36555819cd14a61104e6059d82753d2a2e8343e7b4c4c84b",
  ],
  [
    join(frameworkRoot, "mscorlib.dll"),
    5_445_432,
    "5bffb20e1217bad314143d7e5c4c809bf9f522e8a0a063c8e7e9b25113de26eb",
  ],
  [
    join(frameworkRoot, "System.dll"),
    3_545_264,
    "2b3c17c6208a0b4b6beb94e1a066f99ba06cdb2ea919479e99d47e8c6d96dc71",
  ],
];

function requireExactFile(path, expectedBytes, expectedDigest) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size !== expectedBytes)
    throw new TypeError(`Launcher rebuild requires the reviewed ${expectedBytes}-byte ${path}.`);
  const bytes = readFileSync(path);
  if (bytes.length !== expectedBytes || sourcePolicySha256(bytes) !== expectedDigest)
    throw new TypeError(
      `Launcher rebuild input or output changed: ${path}. Restore its reviewed bytes.`,
    );
  return bytes;
}

export function verifyReviewedPopplerLauncherBuild() {
  if (process.platform !== "win32")
    throw new TypeError(
      "Launcher rebuild requires the reviewed Windows Visual Studio 18 installation.",
    );
  const pin = REVIEWED_POPPLER_LAUNCHER;
  const source = resolve(repositoryRoot, pin.sourcePath);
  const binary = requireExactFile(
    resolve(repositoryRoot, pin.binaryPath),
    pin.binaryBytes,
    pin.binaryDigest,
  );
  const requireInputs = () => {
    requireExactFile(source, pin.sourceBytes, pin.sourceDigest);
    for (const row of buildInputs) requireExactFile(...row);
  };
  requireInputs();
  const outputParent = resolve(repositoryRoot, "output");
  mkdirSync(outputParent, { recursive: true });
  const ownedRoot = mkdtempSync(join(realpathSync(outputParent), "step44-launcher-rebuild-"));
  const canonicalOwnedRoot = realpathSync(ownedRoot);
  const local = relative(realpathSync(outputParent), canonicalOwnedRoot);
  if (!/^step44-launcher-rebuild-[A-Za-z0-9]+$/u.test(local))
    throw new TypeError("Launcher rebuild output is not its own fresh directory; cleanup refused.");
  let result;
  let failure;
  try {
    // harness: compile the exact C# source twice; never load or execute either assembly.
    for (const name of ["first", "second"]) {
      const directory = join(canonicalOwnedRoot, name);
      mkdirSync(directory);
      const output = join(directory, basename(pin.binaryPath));
      const run = spawnSync(
        buildInputs[0][0],
        [
          "/nologo",
          "/noconfig",
          "/nostdlib+",
          "/target:library",
          "/optimize+",
          "/deterministic",
          `/reference:${buildInputs[4][0]}`,
          `/reference:${buildInputs[5][0]}`,
          `/out:${output}`,
          source,
        ],
        {
          cwd: directory,
          encoding: "utf8",
          windowsHide: true,
          timeout: 30_000,
          maxBuffer: 32 * 1024,
          env: {
            SystemRoot: "C:\\Windows",
            WINDIR: "C:\\Windows",
            TEMP: directory,
            TMP: directory,
          },
        },
      );
      requireInputs();
      if (run.error !== undefined || run.status !== 0)
        throw new TypeError(
          `Launcher rebuild failed with status ${String(run.status)}: ${run.error?.message ?? run.stderr}`,
        );
      const rebuilt = requireExactFile(output, pin.binaryBytes, pin.binaryDigest);
      if (!rebuilt.equals(binary))
        throw new TypeError("Launcher rebuild did not reproduce the reviewed binary.");
    }
    result = Object.freeze({
      schemaVersion: "lego.source-policy-launcher-rebuild/1",
      sourceDigest: `sha256:${pin.sourceDigest}`,
      binaryDigest: `sha256:${pin.binaryDigest}`,
      binaryBytes: pin.binaryBytes,
      identicalBuilds: 2,
      assemblyExecuted: false,
    });
  } catch (error) {
    failure = error;
  }
  try {
    if (realpathSync(ownedRoot) !== canonicalOwnedRoot)
      throw new TypeError("Launcher rebuild output identity changed; cleanup refused.");
    rmSync(canonicalOwnedRoot, { recursive: true });
  } catch (error) {
    failure =
      failure === undefined
        ? error
        : new AggregateError(
            [failure, error],
            "Launcher rebuild failed and its owned output could not be removed.",
          );
  }
  if (failure !== undefined) throw failure;
  return result;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv.length !== 2) {
    process.stderr.write("Launcher rebuild accepts no paths, compiler options, or overrides.\n");
    process.exitCode = 64;
  } else {
    try {
      process.stdout.write(`${JSON.stringify(verifyReviewedPopplerLauncherBuild())}\n`);
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  }
}
