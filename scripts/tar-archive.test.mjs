/**
 * The shared tar helper reads an archive named by an absolute path, with every
 * tar this machine offers, and reads a single member out of a zip.
 *
 * `migration-history:check`, `migration-v9.test.ts` and the 2453 identity proof
 * all went red on Windows under Git Bash with "Cannot connect to C: resolve
 * failed": GNU tar parses `C:\...` as `host:path`. The 2453 proof reads a zip,
 * which GNU tar cannot read at all.
 *
 * Bound: both traps exist only on Windows with GNU tar reachable on PATH, as it
 * is under Git Bash. Run from PowerShell, where PATH finds the Windows tar, or on
 * Linux or macOS, the same cases pass but cannot fail on either trap. The zip
 * case runs on Windows only: no code path here reads a zip anywhere else.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { extractTarArchive, readArchiveMember, tarExecutable } from "./tar-archive.mjs";

const MEMBER = "nested/member.dat";
const BYTES = Buffer.from("0 Name: member.dat\r\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 stud.dat\n");

function versionOf(executable) {
  const result = spawnSync(executable, ["--version"], { encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.split("\n")[0].trim() : null;
}

/** The preferred tar, plus whichever tar a PATH lookup finds when that is a different program. */
const TARS = (() => {
  const preferred = { executable: tarExecutable(), version: versionOf(tarExecutable()) };
  const onPath = { executable: "tar", version: versionOf("tar") };
  const found = [preferred];
  if (onPath.version !== null && onPath.version !== preferred.version) found.push(onPath);
  return found.map((tar, index) => ({ ...tar, index }));
})();

let root;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "lego-tar-archive-"));
  mkdirSync(join(root, "source", "nested"), { recursive: true });
  writeFileSync(join(root, "source", MEMBER), BYTES);
  const created = spawnSync(tarExecutable(), ["-cf", "fixture.tar", "-C", "source", MEMBER], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  expect(created.status, created.stderr).toBe(0);
});

afterAll(() => {
  if (root !== undefined) rmSync(root, { recursive: true, force: true });
});

describe("shared tar helper", () => {
  it("finds a working tar", () => {
    expect(TARS[0].version).not.toBeNull();
  });

  describe.each(TARS)("with $version", ({ executable, index }) => {
    it("extracts a tar named by an absolute path", () => {
      const destination = join(root, `extracted-${index}`);
      mkdirSync(destination);
      extractTarArchive(join(root, "fixture.tar"), destination, { executable });
      expect(readFileSync(join(destination, MEMBER))).toEqual(BYTES);
    });

    it("reads one member of a tar named by an absolute path", () => {
      expect(readArchiveMember(join(root, "fixture.tar"), MEMBER, { executable })).toEqual(BYTES);
    });
  });

  // The fixture zip is written by the tar Windows ships, named here by its own
  // path, so a helper that stops preferring it is caught rather than excused.
  it.runIf(process.platform === "win32")(
    "reads one member of a zip named by an absolute path",
    () => {
      const zip = join(root, "fixture.zip");
      const windowsTar = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
      const created = spawnSync(windowsTar, ["-a", "-cf", "fixture.zip", "-C", "source", MEMBER], {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
      });
      expect(created.status, created.stderr).toBe(0);
      expect(readFileSync(zip).subarray(0, 4)).toEqual(Buffer.from("PK\x03\x04", "latin1"));
      expect(readArchiveMember(zip, MEMBER)).toEqual(BYTES);
    },
  );

  it("names the command, the archive and the directory when tar refuses", () => {
    expect(() => readArchiveMember(join(root, "fixture.tar"), "absent/member.dat")).toThrow(
      /-xOf fixture\.tar absent\/member\.dat \(run in .+\) failed with exit \d+/su,
    );
  });
});
