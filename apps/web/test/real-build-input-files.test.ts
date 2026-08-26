import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  truncateSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";

const readObservation = vi.hoisted(() => ({ count: 0 }));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readSync: (...arguments_: unknown[]) => {
      readObservation.count += 1;
      return Reflect.apply(actual.readSync, null, arguments_);
    },
  };
});

const environmentKeys = [
  "LEGO_REAL_BUILD_BUILDER_CALIBRATION",
  "LEGO_REAL_BUILD_BUILDER_GEOMETRY",
  "LEGO_REAL_BUILD_IDENTIFICATION_ANSWERS",
  "LEGO_REAL_BUILD_IDENTIFICATION_CARD_IMAGES",
  "LEGO_REAL_BUILD_IDENTIFICATION_CARDS",
  "LEGO_REAL_BUILD_OFFICIAL_MODEL",
] as const;

const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
) as Readonly<Record<(typeof environmentKeys)[number], string | undefined>>;

let temporaryRoot = "";

function relativeTemporaryPath(name: string): string {
  return relative(process.cwd(), resolve(temporaryRoot, name)).replaceAll("\\", "/");
}

beforeEach(() => {
  mkdirSync(resolve(process.cwd(), "output"), { recursive: true });
  temporaryRoot = mkdtempSync(resolve(process.cwd(), "output/real-build-input-files-test-"));
  readObservation.count = 0;
});

afterEach(() => {
  for (const key of environmentKeys) {
    const original = originalEnvironment[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
  rmSync(temporaryRoot, { recursive: true, force: true });
  vi.resetModules();
});

describe("bounded real-build input reads", () => {
  it("derives artifact digest and parsed value from the exact bounded bytes", async () => {
    const path = relativeTemporaryPath("artifact.json");
    const bytes = Buffer.from('{"bound":true}\n');
    writeFileSync(resolve(process.cwd(), path), bytes);
    const input = await import("../e2e/real-build-input-files");
    const failures: Parameters<typeof input.readJsonArtifact>[1] = [];

    expect(input.readJsonArtifact<{ bound: boolean }>(path, failures)).toEqual({
      bytes,
      digest: sha256Digest(bytes),
      value: { bound: true },
    });
    expect(failures).toEqual([]);
  });

  it("rejects traversal before opening an otherwise valid repository file", async () => {
    const input = await import("../e2e/real-build-input-files");
    const failures: Parameters<typeof input.readJsonArtifact>[1] = [];

    expect(input.readJsonArtifact<unknown>("../package.json", failures).bytes).toHaveLength(0);
    expect(readObservation.count).toBe(0);
    expect(failures).toEqual([
      expect.objectContaining({
        code: "path-policy-violation",
        inputKey: "../package.json",
        message: expect.stringMatching(/missing, escaped, linked.*without traversal/u),
      }),
    ]);
  });

  it("rejects source-mirror highlight cases that differ by one byte", async () => {
    const input = await import("../e2e/real-build-input-files");
    expect(() =>
      input.assertHighlightRendererCasesReproduced(Buffer.from([1, 2]), Buffer.from([1, 3])),
    ).toThrow(/renderer\/source compatibility failure.*authenticate the instruction PDF/u);
    expect(() =>
      input.assertHighlightRendererCasesReproduced(Buffer.from([1, 2]), Buffer.from([1, 2])),
    ).not.toThrow();
  });

  it("binds both exact highlight compatibility roles behind the retained contract field", async () => {
    const input = await import("../e2e/real-build-input-files");
    const raw = Buffer.from("raw");
    const summary = Buffer.from("summary");
    const encoded = input.encodeHighlightRendererCompatibilityInputClosure(raw, summary);
    const parsed = JSON.parse(encoded.toString("utf8")) as {
      renderCases: { digest: string; byteLength: number; base64: string };
      summary: { digest: string; byteLength: number; base64: string };
    };

    expect(parsed.renderCases).toEqual({
      digest: sha256Digest(raw),
      byteLength: raw.length,
      base64: raw.toString("base64"),
    });
    expect(parsed.summary).toEqual({
      digest: sha256Digest(summary),
      byteLength: summary.length,
      base64: summary.toString("base64"),
    });
    expect(
      input.encodeHighlightRendererCompatibilityInputClosure(Buffer.from("Raw"), summary),
    ).not.toEqual(encoded);
    expect(
      input.encodeHighlightRendererCompatibilityInputClosure(raw, Buffer.from("Summary")),
    ).not.toEqual(encoded);
  });

  it("rejects a wrong-sized Builder geometry bundle before reading any byte", async () => {
    const path = relativeTemporaryPath("builder-geometry.bin");
    process.env.LEGO_REAL_BUILD_BUILDER_GEOMETRY = path;
    const input = await import("../e2e/real-build-input-files");

    writeFileSync(resolve(process.cwd(), path), Buffer.alloc(input.BUILDER_GEOMETRY_EXACT_BYTES));
    const validFailures: Parameters<typeof input.readBinaryInput>[1] = [];
    expect(input.readBinaryInput(path, validFailures)).toHaveLength(
      input.BUILDER_GEOMETRY_EXACT_BYTES,
    );
    expect(validFailures).toEqual([]);
    expect(readObservation.count).toBeGreaterThan(0);

    truncateSync(resolve(process.cwd(), path), input.BUILDER_GEOMETRY_EXACT_BYTES + 1);
    readObservation.count = 0;
    const failures: Parameters<typeof input.readBinaryInput>[1] = [];
    expect(input.readBinaryInput(path, failures)).toHaveLength(0);
    expect(readObservation.count).toBe(0);
    expect(failures).toEqual([
      expect.objectContaining({
        code: "input-digest-mismatch",
        inputKey: path,
        message: expect.stringMatching(
          new RegExp(
            `exactly ${input.BUILDER_GEOMETRY_EXACT_BYTES} bytes.*rejected before any contents were read`,
            "u",
          ),
        ),
      }),
    ]);

    truncateSync(resolve(process.cwd(), path), input.BUILDER_GEOMETRY_EXACT_BYTES - 1);
    const undersizedFailures: Parameters<typeof input.readBinaryInput>[1] = [];
    expect(input.readBinaryInput(path, undersizedFailures)).toHaveLength(0);
    expect(readObservation.count).toBe(0);
    expect(undersizedFailures[0]?.message).toMatch(
      new RegExp(
        `is ${input.BUILDER_GEOMETRY_EXACT_BYTES - 1} bytes.*exactly ` +
          `${input.BUILDER_GEOMETRY_EXACT_BYTES} bytes`,
        "u",
      ),
    );
  });

  it("rejects Builder calibration JSON above 64 KiB before parsing or reading", async () => {
    const path = relativeTemporaryPath("builder-calibration.json");
    process.env.LEGO_REAL_BUILD_BUILDER_CALIBRATION = path;
    const input = await import("../e2e/real-build-input-files");
    writeFileSync(resolve(process.cwd(), path), "");
    truncateSync(resolve(process.cwd(), path), input.CALIBRATION_JSON_MAXIMUM_BYTES + 1);

    const failures: Parameters<typeof input.readJsonInput>[1] = [];
    const result = input.readJsonInput<unknown>(path, failures);
    expect(result.bytes).toHaveLength(0);
    expect(result.value).toEqual({});
    expect(readObservation.count).toBe(0);
    expect(failures[0]?.message).toMatch(/Builder canonical calibration JSON.*0\.\.65536 bytes/u);
  });

  it("rejects oversized official XML before reading", async () => {
    const path = relativeTemporaryPath("official.xml");
    process.env.LEGO_REAL_BUILD_OFFICIAL_MODEL = path;
    const input = await import("../e2e/real-build-input-files");
    writeFileSync(resolve(process.cwd(), path), "");
    truncateSync(resolve(process.cwd(), path), input.OFFICIAL_MODEL_MAXIMUM_BYTES + 1);

    const failures: Parameters<typeof input.readBinaryInput>[1] = [];
    expect(input.readBinaryInput(path, failures)).toHaveLength(0);
    expect(readObservation.count).toBe(0);
    expect(failures[0]?.message).toMatch(/official Builder XML.*0\.\.8388608 bytes/u);
  });

  it("applies an explicit small cap to model-answer JSON before reading", async () => {
    const path = relativeTemporaryPath("answers.json");
    process.env.LEGO_REAL_BUILD_IDENTIFICATION_ANSWERS = path;
    const input = await import("../e2e/real-build-input-files");
    writeFileSync(resolve(process.cwd(), path), "");
    truncateSync(resolve(process.cwd(), path), 256 * 1024 + 1);

    const failures: Parameters<typeof input.readJsonInput>[1] = [];
    expect(input.readJsonInput<unknown>(path, failures).bytes).toHaveLength(0);
    expect(readObservation.count).toBe(0);
    expect(failures[0]?.message).toMatch(/bounded model-answer JSON.*0\.\.262144 bytes/u);
  });

  it("does not open nonexistent adjudication paths for deterministic coverage", async () => {
    process.env.LEGO_REAL_BUILD_IDENTIFICATION_CARDS = relativeTemporaryPath("missing-cards.json");
    process.env.LEGO_REAL_BUILD_IDENTIFICATION_CARD_IMAGES =
      relativeTemporaryPath("missing-card-images.bin");
    process.env.LEGO_REAL_BUILD_IDENTIFICATION_ANSWERS =
      relativeTemporaryPath("missing-answers.json");
    const input = await import("../e2e/real-build-input-files");
    const failures: Parameters<typeof input.readIdentificationAdjudicationInputs>[1] = [];

    expect(input.readIdentificationAdjudicationInputs("deterministic", failures)).toEqual({
      cards: null,
      cardImages: null,
      answers: null,
    });
    expect(failures).toEqual([]);
    expect(readObservation.count).toBe(0);

    const adjudicatedFailures: Parameters<typeof input.readIdentificationAdjudicationInputs>[1] =
      [];
    input.readIdentificationAdjudicationInputs("adjudicated", adjudicatedFailures);
    expect(adjudicatedFailures).toHaveLength(3);
  });

  it("reads exact card-image bundle bytes from the configured output and derives its digest", async () => {
    const path = relativeTemporaryPath("card-images.bin");
    const bytes = Buffer.from("exact-card-image-bundle-bytes");
    process.env.LEGO_REAL_BUILD_IDENTIFICATION_CARD_IMAGES = path;
    process.env.LEGO_REAL_BUILD_IDENTIFICATION_CARDS = relativeTemporaryPath("cards.json");
    process.env.LEGO_REAL_BUILD_IDENTIFICATION_ANSWERS = relativeTemporaryPath("answers.json");
    writeFileSync(resolve(process.cwd(), path), bytes);
    writeFileSync(resolve(process.cwd(), process.env.LEGO_REAL_BUILD_IDENTIFICATION_CARDS), "{}\n");
    writeFileSync(
      resolve(process.cwd(), process.env.LEGO_REAL_BUILD_IDENTIFICATION_ANSWERS),
      "{}\n",
    );
    const input = await import("../e2e/real-build-input-files");
    const failures: Parameters<typeof input.readIdentificationAdjudicationInputs>[1] = [];

    expect(input.readIdentificationAdjudicationInputs("adjudicated", failures).cardImages).toEqual({
      bytes,
      digest: sha256Digest(bytes),
    });
    expect(input.IDENTIFICATION_CARD_IMAGES_PATH_OVERRIDE).toBe(path);
    expect(failures).toEqual([]);
  });

  it("reads the card-image bundle the cards manifest names rather than a sibling copy", async () => {
    delete process.env.LEGO_REAL_BUILD_IDENTIFICATION_CARD_IMAGES;
    const input = await import("../e2e/real-build-input-files");
    const failures: Parameters<typeof input.resolveCardImagesPath>[1] = [];
    const runFile = `runs/${"0123456789abcdef01234567"}/images.bin`;
    expect(input.resolveCardImagesPath({ imagesFile: runFile }, failures)).toBe(
      `output/part-identification/cards/${runFile}`,
    );
    expect(failures).toEqual([]);
  });

  // A leftover images.bin beside the manifest belongs to an earlier cards run
  // and would silently bind a superseded card set to a fresh manifest.
  it("refuses a card-image bundle that is not the manifest's own immutable run file", async () => {
    delete process.env.LEGO_REAL_BUILD_IDENTIFICATION_CARD_IMAGES;
    const input = await import("../e2e/real-build-input-files");
    for (const named of ["images.bin", "runs/../images.bin", "runs/NOTHEX/images.bin", undefined]) {
      const failures: Parameters<typeof input.resolveCardImagesPath>[1] = [];
      expect(input.resolveCardImagesPath({ imagesFile: named }, failures)).toBeNull();
      expect(failures).toEqual([expect.objectContaining({ inputKey: "identificationCardImages" })]);
    }
  });

  it("rejects a card-image bundle above 192 MiB before reading any byte", async () => {
    const path = relativeTemporaryPath("oversized-card-images.bin");
    process.env.LEGO_REAL_BUILD_IDENTIFICATION_CARD_IMAGES = path;
    const input = await import("../e2e/real-build-input-files");
    writeFileSync(resolve(process.cwd(), path), "");
    truncateSync(resolve(process.cwd(), path), input.IDENTIFICATION_CARD_IMAGES_MAXIMUM_BYTES + 1);
    const failures: Parameters<typeof input.readBinaryInput>[1] = [];

    expect(input.readBinaryInput(path, failures)).toHaveLength(0);
    expect(readObservation.count).toBe(0);
    expect(input.IDENTIFICATION_CARD_IMAGES_MAXIMUM_BYTES).toBe(192 * 1024 * 1024);
    expect(failures[0]?.message).toMatch(
      /identification-card image replay bundle.*0\.\.201326592 bytes/u,
    );
  });

  it("rejects an oversized manifest-controlled callout crop before reading", async () => {
    const path = relativeTemporaryPath("callout.png");
    const absolutePath = resolve(process.cwd(), path);
    const input = await import("../e2e/real-build-input-files");
    writeFileSync(absolutePath, "");
    truncateSync(absolutePath, input.CALLOUT_CROP_MAXIMUM_BYTES + 1);

    expect(() => input.readCalloutCropInput(process.cwd(), path)).toThrow(
      /Manifest callout crop.*8388609 bytes.*rejected before any contents were read/u,
    );
    expect(readObservation.count).toBe(0);
  });

  it("rejects an oversized sample booklet before reading or PDF parsing", async () => {
    const path = relativeTemporaryPath("booklet.pdf");
    const absolutePath = resolve(process.cwd(), path);
    const booklet = await import("../e2e/booklet-fixture");
    writeFileSync(absolutePath, "");
    truncateSync(absolutePath, booklet.SAMPLE_BOOKLET_MAXIMUM_BYTES + 1);

    expect(() => booklet.readSampleBookletBytes(absolutePath)).toThrow(
      /Sample instruction booklet 6651557\.pdf.*100663297 bytes.*rejected before any contents were read/u,
    );
    expect(readObservation.count).toBe(0);
  });

  it("passes only the exact Buffer view to PDF ingestion without pooled head or tail bytes", async () => {
    const booklet = await import("../e2e/booklet-fixture");
    const pooled = Buffer.from([0xa1, 0x25, 0x50, 0x44, 0x46, 0xb2]);
    const view = pooled.subarray(1, 5);

    const exact = new Uint8Array(booklet.exactSampleBookletArrayBuffer(view));

    expect([...exact]).toEqual([0x25, 0x50, 0x44, 0x46]);
    expect(exact.byteLength).toBe(view.byteLength);
  });

  it("still reports an empty in-bounds JSON file as invalid JSON", async () => {
    const path = relativeTemporaryPath("empty.json");
    writeFileSync(resolve(process.cwd(), path), "");
    const input = await import("../e2e/real-build-input-files");

    const failures: Parameters<typeof input.readJsonInput>[1] = [];
    expect(input.readJsonInput<unknown>(path, failures).bytes).toHaveLength(0);
    expect(readObservation.count).toBeGreaterThan(0);
    expect(failures[0]?.message).toMatch(/is not valid JSON/u);
  });

  it("rejects malformed UTF-8 JSON instead of parsing replacement characters", async () => {
    const path = relativeTemporaryPath("invalid-utf8.json");
    writeFileSync(resolve(process.cwd(), path), Buffer.from([0xff]));
    const input = await import("../e2e/real-build-input-files");

    const failures: Parameters<typeof input.readJsonInput>[1] = [];
    expect(input.readJsonInput<unknown>(path, failures).value).toEqual({});
    expect(failures[0]?.message).toMatch(/is not valid JSON.*encoded data was not valid/u);
  });

  it("rejects malformed UTF-8 in the retained artifact manifest before replay access", async () => {
    writeFileSync(join(temporaryRoot, "artifact-manifest.json"), Buffer.from([0xff]));
    const artifacts = await import("../e2e/real-build-artifacts");

    expect(() => artifacts.verifyRealBuildArtifactManifest(temporaryRoot)).toThrow(
      /current artifact manifest must be duplicate-free finite UTF-8 JSON.*encoded data was not valid/u,
    );
    expect(() => artifacts.prepareRealBuildArtifactManifestVerification(temporaryRoot)).toThrow(
      /current artifact manifest must be duplicate-free finite UTF-8 JSON.*encoded data was not valid/u,
    );
  });

  it("rejects an oversized retained artifact manifest before reading its contents", async () => {
    const manifestPath = join(temporaryRoot, "artifact-manifest.json");
    writeFileSync(manifestPath, "");
    truncateSync(manifestPath, 16 * 1024 * 1024 + 1);
    const artifacts = await import("../e2e/real-build-artifacts");

    expect(() => artifacts.verifyRealBuildArtifactManifest(temporaryRoot)).toThrow(
      /artifact manifest.*16777217 bytes.*rejected before any contents were read/u,
    );
    expect(() => artifacts.prepareRealBuildArtifactManifestVerification(temporaryRoot)).toThrow(
      /artifact manifest.*16777217 bytes.*rejected before any contents were read/u,
    );
    expect(readObservation.count).toBe(0);
  });

  it.runIf(process.platform === "win32")(
    "rejects an actual parent junction replacement between containment and open",
    async () => {
      const trustedRoot = join(temporaryRoot, "trusted-read");
      const parent = join(trustedRoot, "parent");
      const originalParent = join(trustedRoot, "parent-original");
      const external = join(temporaryRoot, "external-read");
      mkdirSync(parent, { recursive: true });
      mkdirSync(external, { recursive: true });
      writeFileSync(join(parent, "value.json"), '{"origin":"contained"}\n');
      writeFileSync(join(external, "value.json"), '{"origin":"external"}\n');
      const bounded = await import("../e2e/bounded-file-read");

      try {
        expect(() =>
          bounded.readContainedBoundedRegularFile(trustedRoot, "parent/value.json", {
            label: "junction race input",
            maximumBytes: 1_024,
            __testHooks: {
              afterPreflight: () => {
                renameSync(parent, originalParent);
                symlinkSync(external, parent, "junction");
              },
            },
          }),
        ).toThrow(/replaced or written between those two calls|junction was replaced/u);
        expect(readFileSync(join(external, "value.json"), "utf8")).toBe('{"origin":"external"}\n');
      } finally {
        try {
          unlinkSync(parent);
        } catch {
          // The hook may have failed before it installed a junction.
        }
      }
    },
  );

  /**
   * The previous version of this test mutated the file with no forced timestamp change and
   * asserted a rejection. It passed only because an intervening `await import(...)` happened to
   * let the filesystem clock tick: replaying its hook with no delay left 30-33 of 50 mutations
   * undetected on this Windows/NTFS checkout. It now advances the timestamp explicitly, so it
   * tests the metadata comparison deterministically instead of testing the scheduler.
   */
  it("rejects a same-size concurrent mutation once its recorded timestamp actually advances", async () => {
    const trustedRoot = join(temporaryRoot, "trusted-mutation");
    const target = join(trustedRoot, "value.bin");
    mkdirSync(trustedRoot, { recursive: true });
    writeFileSync(target, "AAAA");
    const bounded = await import("../e2e/bounded-file-read");

    expect(() =>
      bounded.readContainedBoundedRegularFile(trustedRoot, "value.bin", {
        label: "same-size mutation input",
        maximumBytes: 4,
        exactBytes: 4,
        __testHooks: {
          afterRead: () => {
            writeFileSync(target, "BBBB");
            const distinctPast = new Date(Date.now() - 60_000);
            utimesSync(target, distinctPast, distinctPast);
          },
        },
      }),
    ).toThrow(/did not hold one device, inode, size, modification time, and change time/u);
  });

  /**
   * The metadata comparison cannot make the guarantee its message used to claim, so the message
   * must name the dead end rather than tell the caller to retry.
   */
  it("states that a metadata-only rejection never compared contents", async () => {
    const trustedRoot = join(temporaryRoot, "trusted-honest-message");
    const target = join(trustedRoot, "value.bin");
    mkdirSync(trustedRoot, { recursive: true });
    writeFileSync(target, "AAAA");
    const bounded = await import("../e2e/bounded-file-read");

    expect(() =>
      bounded.readContainedBoundedRegularFile(trustedRoot, "value.bin", {
        label: "metadata-only input",
        maximumBytes: 4,
        exactBytes: 4,
        __testHooks: {
          afterRead: () => {
            writeFileSync(target, "BBBB");
            const distinctPast = new Date(Date.now() - 60_000);
            utimesSync(target, distinctPast, distinctPast);
          },
        },
      }),
    ).toThrow(/never contents.*not fixed by retrying.*timestamp tick.*expectedSha256/su);
  });

  /**
   * The real closure for a same-size concurrent rewrite. Deterministic on every platform and
   * every clock: nothing mutates the file, so only the content comparison can reject it.
   */
  it("rejects bytes whose content digest differs from the caller's pin", async () => {
    const trustedRoot = join(temporaryRoot, "trusted-pin");
    mkdirSync(trustedRoot, { recursive: true });
    writeFileSync(join(trustedRoot, "value.bin"), "AAAAAAAAAAAAAAAA");
    const bounded = await import("../e2e/bounded-file-read");
    let thrown: unknown = null;

    try {
      bounded.readContainedBoundedRegularFile(trustedRoot, "value.bin", {
        label: "pinned input",
        maximumBytes: 16,
        expectedSha256: `sha256:${"0".repeat(64)}`,
      });
    } catch (error) {
      thrown = error;
    }

    expect((thrown as { code?: string } | null)?.code).toBe("CONTENT_DIGEST_MISMATCH");
    expect((thrown as Error).message).toMatch(
      /hashes to sha256:[0-9a-f]{64} over the 16 bytes.*caller pinned sha256:0{64}.*discarded and never returned/su,
    );
  });

  it("refuses a malformed content pin as a policy error before opening anything", async () => {
    const trustedRoot = join(temporaryRoot, "trusted-malformed-pin");
    mkdirSync(trustedRoot, { recursive: true });
    writeFileSync(join(trustedRoot, "value.bin"), "AAAA");
    const bounded = await import("../e2e/bounded-file-read");
    let thrown: unknown = null;

    try {
      bounded.readContainedBoundedRegularFile(trustedRoot, "value.bin", {
        label: "malformed pin input",
        maximumBytes: 4,
        expectedSha256: "deadbeef",
      });
    } catch (error) {
      thrown = error;
    }

    expect((thrown as { code?: string } | null)?.code).toBe("INVALID_BOUND");
    expect((thrown as Error).message).toMatch(/64 lowercase hexadecimal characters/u);
    expect(readObservation.count).toBe(0);
  });

  /**
   * The bug class itself: a same-size rewrite injected before the open, in the same filesystem
   * timestamp tick, so the pre-open lstat, the fstat at open, the post-read fstat, the realpath
   * re-check and the ancestor re-check all observe byte-identical metadata. Measured unpinned on
   * this checkout, 12-15 of 50 such reads returned the attacker's bytes with no error at all.
   * The pin must make that zero on every attempt.
   */
  it("never returns same-tick pre-open rewritten bytes when the caller pins their digest", async () => {
    const trustedRoot = join(temporaryRoot, "trusted-same-tick");
    const target = join(trustedRoot, "value.bin");
    mkdirSync(trustedRoot, { recursive: true });
    const honest = "AAAAAAAAAAAAAAAA";
    const attacker = "BBBBBBBBBBBBBBBB";
    const pin = `sha256:${createHash("sha256").update(honest).digest("hex")}`;
    // Imported before the loop: an import inside the attack window is exactly the incidental
    // delay that made the previous guard test pass for the wrong reason.
    const bounded = await import("../e2e/bounded-file-read");
    const returnedBytes: string[] = [];
    const rejectionCodes: string[] = [];

    for (let attempt = 0; attempt < 40; attempt += 1) {
      writeFileSync(target, honest);
      try {
        returnedBytes.push(
          bounded
            .readContainedBoundedRegularFile(trustedRoot, "value.bin", {
              label: "same-tick pre-open mutation input",
              maximumBytes: 16,
              exactBytes: 16,
              expectedSha256: pin,
              __testHooks: { afterPreflight: () => writeFileSync(target, attacker) },
            })
            .toString("utf8"),
        );
      } catch (error) {
        rejectionCodes.push((error as { code?: string }).code ?? "no-code");
      }
    }

    expect(returnedBytes).toEqual([]);
    expect(rejectionCodes).toHaveLength(40);
    // Which guard fires depends on whether the clock ticked, so only the outcome is asserted.
    expect(
      rejectionCodes.every((code) =>
        ["CONTENT_DIGEST_MISMATCH", "CHANGED_DURING_READ"].includes(code),
      ),
    ).toBe(true);
  });

  it("rejects and removes a same-size mutation after atomic publication", async () => {
    const trustedRoot = join(temporaryRoot, "trusted-published-mutation");
    const target = join(trustedRoot, "value.bin");
    mkdirSync(trustedRoot);
    const atomicWrite = await import("../e2e/contained-atomic-write");

    expect(() =>
      atomicWrite.writeContainedRegularFileAtomic(trustedRoot, "value.bin", "AAAA", {
        label: "same-size published mutation",
        __testHooks: { afterRename: () => writeFileSync(target, "BBBB") },
      }),
    ).toThrow(/identity and metadata|published path does not retain/u);
    expect(existsSync(target) ? readFileSync(target).length : 0).toBe(0);
  });

  it.runIf(process.platform === "win32")(
    "leaves a now-external cleanup path untouched after a parent junction swap",
    async () => {
      const trustedRoot = join(temporaryRoot, "trusted-cleanup");
      const parent = join(trustedRoot, "publish");
      const originalParent = join(trustedRoot, "publish-original");
      const external = join(temporaryRoot, "external-cleanup");
      mkdirSync(parent, { recursive: true });
      mkdirSync(external, { recursive: true });
      const atomicWrite = await import("../e2e/contained-atomic-write");
      let externalTemporary = "";

      try {
        expect(() =>
          atomicWrite.writeContainedRegularFileAtomic(
            trustedRoot,
            "publish/result.txt",
            "contained-result",
            {
              label: "junction cleanup output",
              __testHooks: {
                afterTemporaryWrite: () => {
                  const temporaryName = readdirSync(parent).find((name) => name.includes(".tmp-"));
                  if (temporaryName === undefined)
                    throw new Error("temporary file was not present");
                  externalTemporary = join(external, temporaryName);
                  writeFileSync(externalTemporary, "external-sentinel");
                  renameSync(parent, originalParent);
                  symlinkSync(external, parent, "junction");
                },
              },
            },
          ),
        ).toThrow(/EPERM|cleanup also failed|not a symlink, junction/u);
        expect(readFileSync(externalTemporary, "utf8")).toBe("external-sentinel");
      } finally {
        try {
          unlinkSync(parent);
        } catch {
          // The hook may have failed before it installed a junction.
        }
      }
    },
  );

  it.runIf(process.platform === "win32")(
    "holds and scrubs the published file across a parent junction replacement attempt",
    async () => {
      const trustedRoot = join(temporaryRoot, "trusted-write");
      const parent = join(trustedRoot, "publish");
      const originalParent = join(trustedRoot, "publish-original");
      const external = join(temporaryRoot, "external-write");
      mkdirSync(parent, { recursive: true });
      mkdirSync(external, { recursive: true });
      writeFileSync(join(external, "result.txt"), "external-sentinel");
      const atomicWrite = await import("../e2e/contained-atomic-write");
      let hookReached = false;

      try {
        expect(() =>
          atomicWrite.writeContainedRegularFileAtomic(
            trustedRoot,
            "publish/result.txt",
            "contained-result",
            {
              label: "junction race output",
              __testHooks: {
                afterRename: () => {
                  hookReached = true;
                  renameSync(parent, originalParent);
                  symlinkSync(external, parent, "junction");
                },
              },
            },
          ),
        ).toThrow(/EPERM|ancestor identity changed|realpath changed|not a symlink, junction/u);
        expect(hookReached).toBe(true);
        expect(readFileSync(join(external, "result.txt"), "utf8")).toBe("external-sentinel");
        if (existsSync(originalParent)) {
          expect(readFileSync(join(originalParent, "result.txt"))).toHaveLength(0);
        } else {
          expect(existsSync(parent)).toBe(true);
          const guardedResult = join(parent, "result.txt");
          if (existsSync(guardedResult)) expect(readFileSync(guardedResult)).toHaveLength(0);
        }
      } finally {
        try {
          unlinkSync(parent);
        } catch {
          // The hook may have failed before it installed a junction.
        }
      }
    },
  );

  it.runIf(process.platform === "win32")(
    "pins the real root while creating a contained directory tree",
    async () => {
      const trustedRoot = join(temporaryRoot, "trusted-directory-root");
      const displacedRoot = join(temporaryRoot, "trusted-directory-root-original");
      const external = join(temporaryRoot, "external-directory-root");
      mkdirSync(trustedRoot);
      mkdirSync(external);
      const containedDirectory = await import("../e2e/contained-directory");

      try {
        expect(() =>
          containedDirectory.ensureContainedDirectoryTree(
            trustedRoot,
            "nested/leaf",
            "directory root race",
            {
              afterPreflight: () => {
                renameSync(trustedRoot, displacedRoot);
                symlinkSync(external, trustedRoot, "junction");
              },
            },
          ),
        ).toThrow(/EPERM|guard|ancestor identity changed|realpath changed/u);
        expect(existsSync(join(external, "nested"))).toBe(false);
      } finally {
        try {
          unlinkSync(trustedRoot);
        } catch {
          // The open root guard normally prevents the hook from installing a junction.
        }
      }
    },
  );

  it.runIf(process.platform === "win32")(
    "keeps the directory guard handle open through its final path unlink",
    async () => {
      const trustedRoot = join(temporaryRoot, "trusted-guard-cleanup-root");
      const displacedRoot = join(temporaryRoot, "trusted-guard-cleanup-root-original");
      const external = join(temporaryRoot, "external-guard-cleanup-root");
      mkdirSync(trustedRoot);
      mkdirSync(external);
      writeFileSync(join(external, "sentinel.txt"), "external-sentinel");
      const containedDirectory = await import("../e2e/contained-directory");

      try {
        expect(() =>
          containedDirectory.ensureContainedDirectoryTree(
            trustedRoot,
            "nested",
            "directory guard cleanup race",
            {
              beforeGuardCleanupUnlink: () => {
                renameSync(trustedRoot, displacedRoot);
                symlinkSync(external, trustedRoot, "junction");
              },
            },
          ),
        ).toThrow(/EPERM|guard|ancestor identity changed|realpath changed/u);
        expect(readFileSync(join(external, "sentinel.txt"), "utf8")).toBe("external-sentinel");
      } finally {
        try {
          unlinkSync(trustedRoot);
        } catch {
          // The live guard normally prevents the hook from installing a junction.
        }
      }
    },
  );

  it.runIf(process.platform === "win32")(
    "pins the publication root across a contained directory rename",
    async () => {
      const trustedRoot = join(temporaryRoot, "trusted-publication-root");
      const displacedRoot = join(temporaryRoot, "trusted-publication-root-original");
      const external = join(temporaryRoot, "external-publication-root");
      mkdirSync(join(trustedRoot, "source"), { recursive: true });
      mkdirSync(external);
      writeFileSync(join(trustedRoot, "source", "payload.txt"), "task-payload");
      const containedDirectory = await import("../e2e/contained-directory");

      try {
        expect(() =>
          containedDirectory.renameContainedDirectoryAtomic(
            trustedRoot,
            "source",
            "published",
            "directory publication root race",
            {
              afterMutation: () => {
                renameSync(trustedRoot, displacedRoot);
                symlinkSync(external, trustedRoot, "junction");
              },
            },
          ),
        ).toThrow(/EPERM|guard|ancestor identity changed|realpath changed/u);
        expect(existsSync(join(external, "published"))).toBe(false);
      } finally {
        try {
          unlinkSync(trustedRoot);
        } catch {
          // The open root guard normally prevents the hook from installing a junction.
        }
      }
    },
  );

  it.runIf(process.platform === "win32")(
    "atomically refuses a destination created after directory publication preflight",
    async () => {
      const trustedRoot = join(temporaryRoot, "trusted-no-replace-root");
      mkdirSync(join(trustedRoot, "source"), { recursive: true });
      writeFileSync(join(trustedRoot, "source", "payload.txt"), "task-payload");
      const containedDirectory = await import("../e2e/contained-directory");

      expect(() =>
        containedDirectory.renameContainedDirectoryAtomic(
          trustedRoot,
          "source",
          "published",
          "directory publication no-replace race",
          { afterPreflight: () => mkdirSync(join(trustedRoot, "published")) },
        ),
      ).toThrow();
      expect(readFileSync(join(trustedRoot, "source", "payload.txt"), "utf8")).toBe("task-payload");
      expect(readdirSync(join(trustedRoot, "published"))).toEqual([]);
    },
  );

  it.runIf(process.platform === "win32")(
    "refuses a junction inside bounded recursive cleanup without touching external bytes",
    async () => {
      const trustedRoot = join(temporaryRoot, "trusted-removal-root");
      const source = join(trustedRoot, "source");
      const external = join(temporaryRoot, "external-removal-root");
      mkdirSync(source, { recursive: true });
      mkdirSync(external);
      writeFileSync(join(external, "sentinel.txt"), "external-sentinel");
      const link = join(source, "redirect");
      symlinkSync(external, link, "junction");
      const containedDirectory = await import("../e2e/contained-directory");

      try {
        expect(() =>
          containedDirectory.removeContainedDirectoryTree(
            trustedRoot,
            "source",
            "recursive removal junction",
          ),
        ).toThrow(/refused symlink or junction/u);
        expect(readFileSync(join(external, "sentinel.txt"), "utf8")).toBe("external-sentinel");
      } finally {
        try {
          unlinkSync(link);
        } catch {
          // The refusal may already have removed only task-owned non-link siblings.
        }
      }
    },
  );
});
