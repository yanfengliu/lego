import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { exportRows, exportText, LXFML } from "./answer-key/pairing-fixture.ts";
import { assertOutputIgnored, inputFile, OutputGuardError } from "./inputs.ts";
import { runBooklet } from "./main.ts";
import { playBack } from "./playback.ts";
import { playbackLines } from "./summary-playback.ts";

/**
 * `npm run booklet` end to end on synthetic inputs: which stage says what, and
 * the exit code, when an input is absent, malformed or self-contradicting.
 * Bound: no booklet PDF (a clean clone has none), so read, align and playback
 * never run here; the real run is what exercises them.
 */
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const VARIABLES = [
  "BOOKLET_PDF",
  "BOOKLET_LXFML",
  "BOOKLET_OFFICIAL_LDRAW",
  "BOOKLET_LDRAW_FRAMES",
  "BOOKLET_OUT",
] as const;

describe("npm run booklet", { timeout: 60_000 }, () => {
  let dir = "";
  let saved: Record<string, string | undefined> = {};
  let printed = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "booklet-main-"));
    saved = Object.fromEntries(VARIABLES.map((name) => [name, process.env[name]]));
    process.env.BOOKLET_PDF = join(dir, "absent.pdf");
    process.env.BOOKLET_LXFML = join(dir, "model.xml");
    process.env.BOOKLET_OFFICIAL_LDRAW = join(dir, "model.ldr");
    process.env.BOOKLET_LDRAW_FRAMES = join(dir, "absent-frames.json");
    process.env.BOOKLET_OUT = join(dir, "out");
    writeFileSync(join(dir, "model.xml"), LXFML);
    printed = "";
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      printed += String(chunk);
      return true;
    });
  });
  afterEach(() => {
    for (const name of VARIABLES) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
    rmSync(dir, { recursive: true, force: true });
  });
  const line = (prefix: string) =>
    printed.split("\n").find((text) => text.startsWith(prefix)) ?? "";

  it("turns red on a shifted official export and says the pairing is contradicted", async () => {
    const rows = exportRows();
    writeFileSync(join(dir, "model.ldr"), exportText([...rows.slice(1), rows[0]!]));
    expect(await runBooklet({ writeBaseline: false })).toBe(1);
    expect(printed).toMatch(/official LDraw CONTRADICTED: .*[1-9]\d* invariance failures/u);
    expect(line("[playback]")).toMatch(/^\[playback\] FAILED: contradicted: /u);
    const status = JSON.parse(readFileSync(join(dir, "out", "status.json"), "utf8"));
    expect(status.headline.key.ldraw.status).toBe("contradicted");
    expect(status.stages.key.pairing.invarianceFailures.length).toBeGreaterThan(0);
  });

  it("stays green on a faithful export and reports which pairings it could not verify", async () => {
    writeFileSync(join(dir, "model.ldr"), exportText(exportRows()));
    expect(await runBooklet({ writeBaseline: false })).toBe(0);
    expect(printed).toMatch(
      /paired by file order: 6 bricks verified \(2 designs agree across instances\); unverified: 1 single-instance designs, 1 multi-part brick/u,
    );
    const status = JSON.parse(readFileSync(join(dir, "out", "status.json"), "utf8"));
    expect(status.stages.key.pairing.singleInstanceDesigns).toEqual(["3001;A 3001.dat"]);
    expect(line("[catalog]")).toMatch(/designs/u);
    expect(printed).toMatch(
      /first step needing an uncovered design: unknown \(no aligned booklet\)/u,
    );
    expect(line("[playback]")).toMatch(/skipped \(input absent\): no booklet PDF/u);
  });

  it("reports a present but malformed export as malformed and fails, never as absent", async () => {
    writeFileSync(
      join(dir, "model.ldr"),
      "0 FILE main.ldr\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 3024.dat\n",
    );
    expect(await runBooklet({ writeBaseline: false })).toBe(1);
    expect(line("[playback]")).toMatch(
      /^\[playback\] FAILED: malformed: .*re-export the LDraw file/u,
    );
    expect(line("[playback]")).not.toMatch(/input absent/u);
  });

  it("fails a malformed frame registry by name instead of skipping it", async () => {
    writeFileSync(join(dir, "model.ldr"), exportText(exportRows()));
    writeFileSync(join(dir, "frames.json"), "not json");
    process.env.BOOKLET_LDRAW_FRAMES = join(dir, "frames.json");
    process.env.BOOKLET_PDF = join(dir, "absent.pdf");
    expect(await runBooklet({ writeBaseline: false })).toBe(1);
    // Without a booklet, playback is skipped before it needs the registry; the run still fails and says why.
    expect(line("[frame registry]")).toMatch(/FAILED: malformed: .*frames\.json is not JSON/u);
    const status = JSON.parse(readFileSync(join(dir, "out", "status.json"), "utf8"));
    expect(status.stages.frameRegistry.status).toBe("failed");
    expect(status.stages.frameRegistry.reason).toMatch(/frames\.json is not JSON/u);
  });

  it("refuses to write its rows where Git would track them", async () => {
    const tracked = join(repositoryRoot, "tools", "booklet", "guard-probe-out");
    process.env.BOOKLET_OUT = tracked;
    await expect(runBooklet({ writeBaseline: false })).rejects.toThrow(OutputGuardError);
    expect(existsSync(tracked)).toBe(false);
  });
});

describe("the harness's file boundary", () => {
  it("allows an ignored output and one outside every repository, and refuses a tracked one", () => {
    expect(() =>
      assertOutputIgnored(resolve(repositoryRoot, "output", "booklet", "status.json")),
    ).not.toThrow();
    expect(() =>
      assertOutputIgnored(join(tmpdir(), "booklet-anywhere", "status.json")),
    ).not.toThrow();
    expect(() => assertOutputIgnored(resolve(repositoryRoot, "status", "status.json"))).toThrow(
      /Refusing to write .*Git does not ignore it/u,
    );
    // An existing tracked file is refused as well.
    expect(() => assertOutputIgnored(resolve(repositoryRoot, "package.json"))).toThrow(
      OutputGuardError,
    );
  });

  it("sizes an input before reading it", () => {
    const dir = mkdtempSync(join(tmpdir(), "booklet-input-"));
    try {
      writeFileSync(join(dir, "big.xml"), "x".repeat(2_048));
      const big = inputFile(join(dir, "big.xml"), 1_024);
      expect(big).toMatchObject({ present: true, sha256: null, bytes: 2_048 });
      expect(big.problem).toMatch(/2048 bytes, over the 1024-byte limit/u);
      expect(inputFile(dir, 1_024).problem).toMatch(/is not a file/u);
      expect(inputFile(join(dir, "none.xml"), 1_024)).toMatchObject({
        present: false,
        problem: null,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("playback frame report", () => {
  it("warns loudly without the registry and names the inferred frames", () => {
    const plate = (uuid: string, y: number) => ({
      uuid,
      design: "3024.dat",
      catalogPartId: "builtin:plate-1x1",
      ldrawColor: 4,
      colorId: "builtin:red",
      pose: { matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], positionLdu: [0, y, 0] },
      assemblyAt: () => "model",
    });
    const playback = playBack([
      { step: 1, page: 11, lastUnit: 0, bricks: [plate("a", 0), plate("b", -8)] },
    ]);
    const lines = playbackLines(
      {
        corrections: [],
        asExported: playback,
        corrected: null,
        registry: { status: "absent", path: "C:/nowhere/frames.json", rows: 0 },
        fallbackCheck: null,
      },
      0,
    );
    expect(lines.join("\n")).toMatch(
      /frames: REGISTRY ABSENT \(C:\/nowhere\/frames\.json\) — 0 parts from the registry, 0 catalog-declared, 2 INFERRED in 1 files \(3024\.dat x2\)/u,
    );
    expect(lines.join("\n")).toMatch(
      /restore it \(BOOKLET_LDRAW_FRAMES\) before trusting playback/u,
    );
  });
});
