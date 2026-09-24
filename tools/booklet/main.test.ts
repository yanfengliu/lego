import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { exportRows, exportText, LXFML } from "./answer-key/pairing-fixture.ts";
import type { RegistryCheck } from "./frame-checks.ts";
import { assertOutputIgnored, inputFile, OutputGuardError } from "./inputs.ts";
import { runBooklet } from "./main.ts";
import { playBack } from "./playback.ts";
import type { PlaybackStage } from "./playback-stage.ts";
import { playbackHeadline, playbackLines } from "./summary-playback.ts";

/**
 * `npm run booklet` end to end on synthetic inputs: which stage says what, and
 * the exit code, when an input is absent, malformed or self-contradicting.
 * Bound: no real booklet PDF (a clean clone has none). One case reads a blank
 * one-page PDF, which identification refuses; otherwise read, identify, align
 * and playback never run here, and the real run is what exercises them.
 */
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

/** A valid PDF of one empty page: readable, with no steps and no parts inventory. */
function blankPdf(): string {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = body.length;
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = body.length;
  const entries = offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`);
  return `${body}xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${entries.join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}
const VARIABLES = [
  "BOOKLET_PDF",
  "BOOKLET_LXFML",
  "BOOKLET_OFFICIAL_LDRAW",
  "BOOKLET_LDRAW_FRAMES",
  "BOOKLET_OUT",
  "LEGO_RUN_EVIDENCE",
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
    // The run reads the opt-in itself, so each case starts opted out whatever the shell set.
    delete process.env.LEGO_RUN_EVIDENCE;
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
    expect(line("[identify]")).toMatch(/^\[identify\] skipped \(input absent\): no booklet PDF/u);
    expect(status.stages.identify.status).toBe("skipped");
    expect(status.headline.identify).toBeNull();
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

  it("fails a malformed frame registry by name once opted in, instead of skipping it", async () => {
    writeFileSync(join(dir, "model.ldr"), exportText(exportRows()));
    writeFileSync(join(dir, "frames.json"), "not json");
    process.env.BOOKLET_LDRAW_FRAMES = join(dir, "frames.json");
    process.env.LEGO_RUN_EVIDENCE = "1";
    expect(await runBooklet({ writeBaseline: false })).toBe(1);
    // No stage waits on the registry; the run still fails and says why.
    expect(line("[frame registry]")).toMatch(/FAILED: malformed: .*frames\.json is not JSON/u);
    expect(line("[playback]")).toMatch(/skipped \(input absent\): no booklet PDF/u);
    const status = JSON.parse(readFileSync(join(dir, "out", "status.json"), "utf8"));
    expect(status.stages.frameRegistry.status).toBe("failed");
    expect(status.stages.frameRegistry.reason).toMatch(/frames\.json is not JSON/u);
  });

  it("does not open the frame registry without LEGO_RUN_EVIDENCE=1, and says how to opt in", async () => {
    writeFileSync(join(dir, "model.ldr"), exportText(exportRows()));
    writeFileSync(join(dir, "frames.json"), "not json");
    process.env.BOOKLET_LDRAW_FRAMES = join(dir, "frames.json");
    // A malformed registry cannot fail a run that never reads it.
    expect(await runBooklet({ writeBaseline: false })).toBe(0);
    expect(line("[frame registry]")).toMatch(
      /^\[frame registry\] skipped \(not opted in\): .*set LEGO_RUN_EVIDENCE=1 to compare/u,
    );
    const status = JSON.parse(readFileSync(join(dir, "out", "status.json"), "utf8"));
    expect(status.inputs.ldrawFrames).toBeNull();
    expect(status.stages.frameRegistry.status).toBe("skipped");
  });

  it("says so when opted in without a registry, and refuses an opt-in value it does not know", async () => {
    writeFileSync(join(dir, "model.ldr"), exportText(exportRows()));
    process.env.LEGO_RUN_EVIDENCE = "1";
    expect(await runBooklet({ writeBaseline: false })).toBe(0);
    expect(line("[frame registry]")).toMatch(
      /^\[frame registry\] skipped \(input absent\): no first-50 frame registry at .*absent-frames\.json/u,
    );
    printed = "";
    process.env.LEGO_RUN_EVIDENCE = "yes";
    expect(await runBooklet({ writeBaseline: false })).toBe(1);
    expect(line("[frame registry]")).toBe(
      '[frame registry] FAILED: LEGO_RUN_EVIDENCE is "yes"; set it to 1 to read ignored run evidence (the first-50 frame registry), or leave it unset (or 0) to skip it.',
    );
  });

  it("fails a booklet identification refuses, by name, and aligns by counts instead", async () => {
    writeFileSync(join(dir, "model.ldr"), exportText(exportRows()));
    writeFileSync(join(dir, "blank.pdf"), blankPdf());
    process.env.BOOKLET_PDF = join(dir, "blank.pdf");
    expect(await runBooklet({ writeBaseline: false })).toBe(1);
    expect(line("[read]")).toMatch(/^\[read\] \d+\.\d s · /u);
    expect(line("[identify]")).toMatch(
      /^\[identify\] FAILED: identification of .*blank\.pdf stopped: identifyBooklet found no parts inventory in the 1 pages of this PDF/u,
    );
    expect(line("[align]")).toMatch(/ · by counts \(identification did not run: it failed\), /u);
    const status = JSON.parse(readFileSync(join(dir, "out", "status.json"), "utf8"));
    expect(status.stages.identify.status).toBe("failed");
    expect(status.headline.identify).toBeNull();
    expect(status.headline.align).toMatchObject({ basis: "counts", steps: 0 });
    expect(status.headline.align.identity).toBeUndefined();
  });

  it("refuses to write its rows where Git would track them", async () => {
    const tracked = join(repositoryRoot, "tools", "booklet", "guard-probe-out");
    process.env.BOOKLET_OUT = tracked;
    try {
      await expect(runBooklet({ writeBaseline: false })).rejects.toThrow(OutputGuardError);
      expect(existsSync(tracked)).toBe(false);
    } finally {
      // Only a broken guard creates it; never leave rows in the tree when that happens.
      rmSync(tracked, { recursive: true, force: true });
    }
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
  const stage = (registryCheck: RegistryCheck | null): PlaybackStage => ({
    corrections: [],
    asExported: playback,
    corrected: null,
    registryCheck,
  });
  const disagreement = (ldrawFilename: string) => ({
    ldrawFilename,
    catalogPartId: "builtin:plate-1x1",
    registry: { orientationId: "upright-yaw-0", translationLdu: [0, 0, 0] },
    catalog: { orientationId: "upright-yaw-0", translationLdu: [0, -4, 0] },
  });

  it("counts the parts on each catalog frame basis, and says nothing of a registry it did not read", () => {
    expect(playbackHeadline(stage(null)).frames).toEqual({
      meshAssetFrame: 0,
      measuredLdrawFrame: 2,
    });
    const lines = playbackLines(stage(null), 0).join("\n");
    expect(lines).toMatch(
      /frames from the catalog: 2 parts on measured LDraw frames, 0 on mesh asset frames · world shift \[-?\d+, -?\d+, -?\d+\]/u,
    );
    expect(lines).not.toMatch(/registry|inferred/iu);
  });

  it("reports the opt-in registry comparison without moving the headline", () => {
    const check: RegistryCheck = {
      path: "frames.json",
      rows: 66,
      agree: 60,
      equivalentBySymmetry: 1,
      unknownParts: ["99999.dat builtin:no-such-part"],
      disagreements: ["3024.dat", "3070b.dat", "3005.dat", "3062b.dat"].map(disagreement),
    };
    const lines = playbackLines(stage(check), 0);
    expect(lines).toContain(
      "  catalog frames vs first-50 registry (66 rows): 60 agree, 1 equivalent by symmetry, 4 disagree (3024.dat upright-yaw-0 (0, -4, 0)/upright-yaw-0 (0, 0, 0), 3070b.dat upright-yaw-0 (0, -4, 0)/upright-yaw-0 (0, 0, 0), 3005.dat upright-yaw-0 (0, -4, 0)/upright-yaw-0 (0, 0, 0) … (+1))",
    );
    expect(lines).toContain(
      "  registry rows naming no catalog part: 99999.dat builtin:no-such-part",
    );
    // The headline is committed; an ignored file must not move it.
    expect(playbackHeadline(stage(check))).toEqual(playbackHeadline(stage(null)));
  });
});
