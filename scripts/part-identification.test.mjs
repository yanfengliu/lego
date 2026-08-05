import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { crc32, deflateSync } from "node:zlib";

import { describe, expect, it, vi } from "vitest";

import { askBatch, commandAsk, settleVisionWorkers } from "./part-identification-ask.mjs";
import {
  FULL_CALLOUT_MANIFEST_EXPECTATION,
  PART_ANSWERS_SCHEMA,
  PART_CARDS_SCHEMA,
  PART_DISTANCES_SCHEMA,
  PART_FEATURES_SCHEMA,
  PART_MATCH_SCHEMA,
  deriveCardRunId,
  jsonArtifactFromBytes,
  readBoundInventoryThumbnail,
  readBoundManifestCrop,
  sha256Digest,
} from "./part-identification-artifacts.mjs";
import { commandCards, unexpectedCardPngs } from "./part-identification-cards.mjs";
import {
  MAX_NODE_TIMER_MS,
  readBoundedFile,
  readContainedFile,
  runBoundedChild,
  sameFileIdentity,
  writeContainedFile,
} from "./part-identification-io.mjs";
import {
  PART_IDENTIFICATION_MODEL_ID,
  PART_IDENTIFICATION_MODEL_IDENTITY,
  responseModelIdentity,
} from "./part-identification-model.mjs";
import { PART_IDENTIFICATION_PROMPT_DIGEST } from "./part-identification-prompt.mjs";
import { claimsFor, describesSameThing } from "./part-identification-score.mjs";
import { assertBoundedPngDimensions, createPngDecodeBudget } from "./part-thumbnail-image.mjs";
import {
  MAX_CARD_IMAGE_TOTAL_PIXELS,
  authenticateCardImageBundle,
  cardImageBundleArtifact,
  encodeCardImageBundle,
} from "./part-identification-card-images.mjs";
import {
  clusterCallouts,
  commandFeatures,
  option,
  runPartIdentificationCli,
  writeNestedArtifact,
} from "./part-identification.mjs";

const run = "0123456789abcdef01234567";
const digest = (label) => sha256Digest(label);

function pngHeader(width = 1, height = 1) {
  const header = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(header, 0);
  header.writeUInt32BE(13, 8);
  header.write("IHDR", 12, "ascii");
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  header[24] = 8;
  header[25] = 6;
  header[26] = 0;
  header[27] = 0;
  header[28] = 0;
  header.writeUInt32BE(crc32(header.subarray(12, 29)) >>> 0, 29);
  return header;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])) >>> 0, 8 + data.length);
  return chunk;
}

function canonicalPng(width = 1, height = 1, fill = 0) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height, fill);
  for (let row = 0; row < height; row += 1) rows[row * (width * 4 + 1)] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function twoTonePng(width = 4, height = 4) {
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    for (let x = 0; x < width; x += 1) {
      const at = row + 1 + x * 4;
      const foreground = x >= 1 && x <= 2 && y >= 1 && y <= 2;
      rows[at] = foreground ? 0 : 255;
      rows[at + 1] = foreground ? 0 : 255;
      rows[at + 2] = foreground ? 0 : 255;
      rows[at + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function descriptor(seed, pixels) {
  const grid = Array(28 * 28).fill(0);
  const detail = Array(28 * 28).fill(0);
  grid[seed] = 255;
  detail[seed] = seed === 0 ? 10 : 240;
  const boxWidth = 2;
  const boxHeight = seed === 0 ? 2 : 1;
  const boundedPixels = Math.max(1, Math.min(pixels, boxWidth * boxHeight));
  return {
    grid,
    detail,
    aspect: boxWidth / boxHeight,
    ink: boundedPixels / (boxWidth * boxHeight),
    pixels: boundedPixels,
    boxWidth,
    boxHeight,
    mean: seed === 0 ? [10, 10, 10] : [240, 240, 240],
    lightFace: seed === 0 ? 20 : 250,
    colours: [{ rgb: seed === 0 ? [8, 8, 8] : [248, 248, 248], share: 1 }],
  };
}

function physical(identity, seed, pixels) {
  return {
    identity,
    file: `${identity}.png`,
    quantity: 1,
    evidenceKind: "part-art",
    descriptor: descriptor(seed, pixels),
  };
}

function assignmentByIdentity(callouts) {
  const clusters = clusterCallouts(callouts).map((cluster, clusterIndex) => ({
    ...cluster,
    clusterIndex,
    candidates: [{ elementId: String(300_501 + clusterIndex), total: 0 }],
  }));
  const claims = claimsFor({ clusters }, { elementIds: [], rows: [] }, "deterministic", null, {
    assign: "nearest",
  });
  return Object.fromEntries(
    [...claims].map(([index, claim]) => [callouts[index].identity, claim.elementId]).sort(),
  );
}

function boundCallout() {
  return {
    identity: "p11|q1|x43.074|y486.271",
    file: `runs/${run}/p11-q1-x43d074-y486d271.png`,
    pageNumber: 11,
    stepNumber: 1,
    quantity: 1,
    xPt: 43.074,
    yPt: 486.271,
    evidenceKind: "part-art",
    sha256: digest("crop"),
    descriptor: descriptor(0, 1),
  };
}

function writeArtifact(path, value) {
  const artifact = jsonArtifactFromBytes(Buffer.from(JSON.stringify(value)), `fixture ${path}`);
  writeFileSync(path, artifact.bytes);
  return artifact;
}

function writeIdentificationClosure(directory) {
  const callout = boundCallout();
  const featuresArtifact = writeArtifact(join(directory, "features.json"), {
    schemaVersion: PART_FEATURES_SCHEMA,
    inputDigests: { pdf: digest("pdf"), calloutManifest: digest("manifest") },
    manifestCalloutCount: 1,
    calloutCount: 1,
    nonClusteredCalloutCount: 0,
    nonClusteredCallouts: [],
    inventory: { 300501: descriptor(0, 1) },
    inventorySourceDigests: { 300501: digest("inventory") },
    callouts: [callout],
  });
  const matchArtifact = writeArtifact(join(directory, "match.json"), {
    schemaVersion: PART_MATCH_SCHEMA,
    featuresDigest: featuresArtifact.digest,
    calloutCount: 1,
    clusterCount: 1,
    clusters: [
      {
        clusterIndex: 0,
        lead: callout.file,
        members: [0],
        pieces: 1,
        candidates: [{ elementId: "300501", total: 0.1 }],
      },
    ],
  });
  writeArtifact(join(directory, "distances.json"), {
    schemaVersion: PART_DISTANCES_SCHEMA,
    featuresDigest: featuresArtifact.digest,
    elementIds: ["300501"],
    rows: [[0.1]],
  });
  return { featuresArtifact, matchArtifact };
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("physical part-identification inputs", () => {
  it("publishes nested artifacts atomically and refuses traversal or oversized reads", () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-contained-artifact-"));
    try {
      writeNestedArtifact(directory, "tiles/callout/crop.png", Buffer.from("first"));
      writeNestedArtifact(directory, "tiles/callout/crop.png", Buffer.from("bound tile"));
      expect(readContainedFile(directory, "tiles/callout/crop.png").toString("utf8")).toBe(
        "bound tile",
      );
      expect(readdirSync(join(directory, "tiles", "callout"))).toEqual(["crop.png"]);
      expect(() => writeContainedFile(directory, "../escaped.txt", "no")).toThrow(
        /parent-directory segment/,
      );
      expect(() => readContainedFile(directory, "..\\escaped.txt")).toThrow(
        /canonical forward-slash relative path/,
      );
      expect(() =>
        readBoundedFile(join(directory, "tiles", "callout", "crop.png"), { maxBytes: 4 }),
      ).toThrow(/above the 4-byte input limit/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("identifies stale canonical card PNGs before a new card publication writes anything", () => {
    expect(
      unexpectedCardPngs(
        ["card-0000.png", "card-0001.png", "images.bin", "manifest.json", "notes.txt"],
        ["card-0000"],
      ),
    ).toEqual(["card-0001.png"]);
  });

  it("rejects oversized PNG dimensions before invoking the native image decoder", () => {
    expect(() => assertBoundedPngDimensions(pngHeader(4_097, 1), "adversarial PNG")).toThrow(
      /4096 per side/,
    );
    const badCrc = pngHeader();
    badCrc[29] ^= 1;
    expect(() => assertBoundedPngDimensions(badCrc, "tampered PNG")).toThrow(
      /unauthenticated PNG IHDR/,
    );
    const incomplete = pngHeader();
    expect(() =>
      encodeCardImageBundle(
        { cards: { "card-0000": { sha256: sha256Digest(incomplete) } } },
        new Map([["card-0000", incomplete]]),
      ),
    ).toThrow(/incomplete.*IHDR, IDAT, and IEND/);
  });

  it("detaches authenticated card images from every caller-owned bundle buffer", () => {
    const original = canonicalPng(2, 2, 7);
    const replacement = canonicalPng(2, 2, 11);
    expect(replacement).toHaveLength(original.length);
    const manifest = {
      cards: { "card-0000": { sha256: sha256Digest(original) } },
    };
    const encoded = encodeCardImageBundle(manifest, new Map([["card-0000", original]]));
    const artifact = cardImageBundleArtifact(encoded);
    const authenticated = authenticateCardImageBundle(artifact, manifest);

    replacement.copy(encoded, encoded.length - replacement.length);
    replacement.copy(artifact.bytes, artifact.bytes.length - replacement.length);
    authenticated.bytes.fill(0);

    expect(authenticated.images.get("card-0000")).toEqual(original);
  });

  it("rejects a same-length card mutation against the manifest digest before model launch", async () => {
    const original = canonicalPng(2, 2, 7);
    const replacement = canonicalPng(2, 2, 11);
    expect(replacement).toHaveLength(original.length);
    const originalDigest = sha256Digest(original);
    const images = new Map([["card-0000", Buffer.from(original)]]);
    replacement.copy(images.get("card-0000"));
    const spawnImpl = vi.fn();

    await expect(
      askBatch(["card-0000"], PART_IDENTIFICATION_MODEL_ID, "unused", {
        cardImages: images,
        cardDigests: new Map([["card-0000", originalDigest]]),
        spawnImpl,
      }),
    ).rejects.toThrow(/hash to .*exact cards manifest requires/);
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("rejects aggregate card raster work before inflating the first image", () => {
    const image = pngHeader(4_096, 4_096);
    const cards = Object.fromEntries(
      Array.from({ length: MAX_CARD_IMAGE_TOTAL_PIXELS / (4_096 * 4_096) + 1 }, (_, index) => [
        `card-${String(index).padStart(4, "0")}`,
        { sha256: sha256Digest(image) },
      ]),
    );
    const bytes = new Map(Object.keys(cards).map((id) => [id, image]));
    expect(() => encodeCardImageBundle({ cards }, bytes)).toThrow(
      /aggregate replay-work limit.*before decoding any raster/,
    );
  });

  it("charges aggregate thumbnail and sheet work before each native decode", () => {
    const budget = createPngDecodeBudget("adversarial image workflow", 12);
    expect(budget.charge(pngHeader(2, 2), "first thumbnail")).toEqual({ width: 2, height: 2 });
    expect(() => budget.charge(pngHeader(3, 3), "second sheet cell")).toThrow(
      /13 pixels.*12-pixel aggregate work limit.*before invoking the native decoder/,
    );
    expect(budget.usedPixels).toBe(4);
  });

  it("treats a zero device id as unavailable while retaining inode identity", () => {
    expect(sameFileIdentity({ dev: 0, ino: 123 }, { dev: 44, ino: 123 })).toBe(true);
    expect(sameFileIdentity({ dev: 0, ino: 123 }, { dev: 44n, ino: 123n })).toBe(true);
    expect(sameFileIdentity({ dev: 44, ino: 123 }, { dev: 0, ino: 123 })).toBe(true);
    expect(sameFileIdentity({ dev: 44, ino: 123 }, { dev: 55, ino: 123 })).toBe(false);
    expect(sameFileIdentity({ dev: 0, ino: 123 }, { dev: 44, ino: 124 })).toBe(false);
    expect(sameFileIdentity({ dev: 0, ino: 0 }, { dev: 0, ino: 0 })).toBe(false);
  });

  it("rejects timer-overflow deadlines before spawning a child", async () => {
    const spawnImpl = vi.fn();
    await expect(
      runBoundedChild("never-spawned", [], {
        timeoutMs: MAX_NODE_TIMER_MS + 1,
        spawnImpl,
        label: "overflow-deadline child",
      }),
    ).rejects.toThrow(/no larger than 2147483647/);
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("rejects a pre-existing linked input or output component", () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-contained-link-"));
    const outside = mkdtempSync(join(tmpdir(), "lego-contained-outside-"));
    try {
      writeFileSync(join(outside, "crop.png"), "outside");
      let linked = false;
      try {
        symlinkSync(outside, join(directory, "linked"), "junction");
        linked = true;
      } catch {
        // Some Windows policies forbid junction creation. Other containment tests still run.
      }
      if (linked) {
        expect(() => readContainedFile(directory, "linked/crop.png")).toThrow(
          /resolves outside declared root|crosses symbolic-link or junction/,
        );
        expect(() => writeContainedFile(directory, "linked/new.png", "no")).toThrow(
          /ordinary directory|symbolic-link or junction|linked, junction/,
        );
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("rejects a linked declared root instead of redefining containment through it", () => {
    const parent = mkdtempSync(join(tmpdir(), "lego-linked-root-parent-"));
    const outside = mkdtempSync(join(tmpdir(), "lego-linked-root-outside-"));
    const linkedRoot = join(parent, "declared-root");
    try {
      try {
        symlinkSync(outside, linkedRoot, "junction");
      } catch {
        return;
      }
      expect(() => writeContainedFile(linkedRoot, "escaped.txt", "no")).toThrow(
        /Linked and junction-backed roots|crosses linked, junction/,
      );
      expect(existsSync(join(outside, "escaped.txt"))).toBe(false);
      expect(() => readContainedFile(linkedRoot, "anything.txt")).toThrow(
        /Linked and junction-backed roots|crosses linked, junction/,
      );
    } finally {
      rmSync(parent, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("rejects an ordinary replacement root installed after contained-read preflight", () => {
    const parent = mkdtempSync(join(tmpdir(), "lego-contained-read-swap-"));
    const root = join(parent, "root");
    const moved = join(parent, "original-root");
    mkdirSync(root);
    writeFileSync(join(root, "crop.png"), "authenticated-original");
    let swapped = false;
    try {
      expect(() =>
        readContainedFile(root, "crop.png", {
          __testHooks: {
            afterPreflight: () => {
              renameSync(root, moved);
              mkdirSync(root);
              writeFileSync(join(root, "crop.png"), "attacker-replacement");
              swapped = true;
            },
          },
        }),
      ).toThrow(/ancestor.*changed identity|changed identity.*containment preflight/);
      expect(swapped).toBe(true);
      expect(readFileSync(join(root, "crop.png"), "utf8")).toBe("attacker-replacement");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("rejects an ordinary replacement candidate installed after contained-read preflight", () => {
    const root = mkdtempSync(join(tmpdir(), "lego-contained-file-swap-"));
    const candidate = join(root, "crop.png");
    const moved = join(root, "authenticated-original.png");
    writeFileSync(candidate, "authenticated-original");
    try {
      expect(() =>
        readContainedFile(root, "crop.png", {
          __testHooks: {
            afterPreflight: () => {
              renameSync(candidate, moved);
              writeFileSync(candidate, "attacker-replacement");
            },
          },
        }),
      ).toThrow(/changed identity or content metadata after containment preflight/);
      expect(readFileSync(candidate, "utf8")).toBe("attacker-replacement");
      expect(readFileSync(moved, "utf8")).toBe("authenticated-original");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("never path-unlinks an attacker replacement during failed publication cleanup", () => {
    const root = mkdtempSync(join(tmpdir(), "lego-exact-cleanup-race-"));
    const moved = join(root, "publisher-file-zeroed.tmp");
    let replacementPath = null;
    try {
      expect(() =>
        writeContainedFile(root, "result.bin", "task-secret", {
          __testHooks: {
            afterTemporaryWrite: () => {
              throw new Error("forced publication failure");
            },
            beforeExactCleanup: ({ path }) => {
              replacementPath = path;
              renameSync(path, moved);
              writeFileSync(path, "attacker-owned");
            },
          },
        }),
      ).toThrow(/forced publication failure/);
      expect(readFileSync(replacementPath, "utf8")).toBe("attacker-owned");
      expect(readFileSync(moved)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("deletes the exact scrubbed publisher file through its Windows handle", () => {
    if (process.platform !== "win32") return;
    const root = mkdtempSync(join(tmpdir(), "lego-exact-cleanup-success-"));
    try {
      expect(() =>
        writeContainedFile(root, "result.bin", "task-secret", {
          __testHooks: {
            afterTemporaryWrite: () => {
              throw new Error("forced exact cleanup");
            },
          },
        }),
      ).toThrow(/forced exact cleanup/);
      expect(readdirSync(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves an attacker replacement installed after publication rename", () => {
    const root = mkdtempSync(join(tmpdir(), "lego-published-cleanup-race-"));
    const candidate = join(root, "result.bin");
    const moved = join(root, "publisher-file-zeroed.bin");
    try {
      expect(() =>
        writeContainedFile(root, "result.bin", "task-secret", {
          __testHooks: {
            afterRename: () => {
              renameSync(candidate, moved);
              writeFileSync(candidate, "attacker-owned");
            },
          },
        }),
      ).toThrow(/published path does not retain|ancestor.*changed|could not remove/s);
      expect(readFileSync(candidate, "utf8")).toBe("attacker-owned");
      expect(readFileSync(moved)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("never unlinks an attacker path or leaves task bytes after a real post-rename root swap", () => {
    const parent = mkdtempSync(join(tmpdir(), "lego-contained-after-rename-"));
    const outside = mkdtempSync(join(tmpdir(), "lego-contained-attacker-"));
    const root = join(parent, "root");
    const moved = join(parent, "moved-root");
    mkdirSync(root);
    writeFileSync(join(outside, "published.txt"), "attacker-owned");
    let rootMoved = false;
    let failure = null;
    try {
      try {
        writeContainedFile(root, "published.txt", "task-secret", {
          __testHooks: {
            afterRename: () => {
              try {
                renameSync(root, moved);
                rootMoved = true;
                symlinkSync(outside, root, "junction");
              } catch {
                // Windows may refuse the directory rename while the exact file handle is open.
              }
            },
          },
        });
      } catch (error) {
        failure = error;
      }
      expect(readFileSync(join(outside, "published.txt"), "utf8")).toBe("attacker-owned");
      if (rootMoved) {
        expect(failure).toBeInstanceOf(Error);
        expect(readFileSync(join(moved, "published.txt"))).toHaveLength(0);
      } else {
        expect(failure).toBeNull();
        expect(readFileSync(join(root, "published.txt"), "utf8")).toBe("task-secret");
      }
    } finally {
      rmSync(parent, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("terminates output-flooding children and their exact descendant tree", async () => {
    await expect(
      runBoundedChild(process.execPath, ["-e", "process.stdout.write(Buffer.from([0xff]))"], {
        timeoutMs: 5_000,
        maxStdoutBytes: 64,
        maxStderrBytes: 64,
        label: "malformed-output child",
      }),
    ).rejects.toThrow(/malformed UTF-8 on stdout/);

    await expect(
      runBoundedChild(process.execPath, ["-e", "process.stdout.write('x'.repeat(4096))"], {
        timeoutMs: 5_000,
        maxStdoutBytes: 64,
        maxStderrBytes: 64,
        label: "output-flood child",
      }),
    ).rejects.toThrow(/64-byte stdout limit.*terminated/);

    const directory = mkdtempSync(join(tmpdir(), "lego-child-tree-"));
    const pidPath = join(directory, "descendant.pid");
    const parentProgram = [
      "const {spawn}=require('node:child_process');",
      "const {writeFileSync}=require('node:fs');",
      "const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});",
      "writeFileSync(process.argv[1],String(child.pid));",
      "setInterval(()=>{},1000);",
    ].join("");
    try {
      await expect(
        runBoundedChild(process.execPath, ["-e", parentProgram, pidPath], {
          timeoutMs: 2_000,
          maxStdoutBytes: 1_024,
          maxStderrBytes: 1_024,
          label: "descendant-owning child",
        }),
      ).rejects.toThrow(/2000 ms execution limit.*terminated/);
      expect(existsSync(pidPath)).toBe(true);
      const descendantPid = Number(readFileSync(pidPath, "utf8"));
      for (let attempt = 0; attempt < 20 && processExists(descendantPid); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(processExists(descendantPid)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("closes a Windows Job Object around a detached grandchild after its intermediary exits", async () => {
    if (process.platform !== "win32") return;
    const directory = mkdtempSync(join(tmpdir(), "lego-detached-grandchild-"));
    const pidPath = join(directory, "grandchild.pid");
    const intermediary = [
      "const {spawn}=require('node:child_process');",
      "const {writeFileSync}=require('node:fs');",
      "const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});",
      "writeFileSync(process.argv[1],String(child.pid));",
      "child.unref();",
    ].join("");
    try {
      const result = await runBoundedChild(process.execPath, ["-e", intermediary, pidPath], {
        timeoutMs: 5_000,
        maxStdoutBytes: 1_024,
        maxStderrBytes: 4_096,
        label: "short-lived descendant intermediary",
      });
      expect(result.code).toBe(0);
      expect(existsSync(pidPath)).toBe(true);
      const descendantPid = Number(readFileSync(pidPath, "utf8"));
      for (let attempt = 0; attempt < 40 && processExists(descendantPid); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(processExists(descendantPid)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("waits for sibling vision workers to finish before reporting one failure", async () => {
    let siblingFinished = false;
    const sibling = new Promise((resolve) => {
      setTimeout(() => {
        siblingFinished = true;
        resolve();
      }, 25);
    });
    await expect(
      settleVisionWorkers([Promise.reject(new Error("first worker failed")), sibling]),
    ).rejects.toThrow(/every sibling worker and owned child process finished/);
    expect(siblingFinished).toBe(true);
  });

  it("reports truthful help and explicitly rejects the nonexistent resolve command", async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    await expect(runPartIdentificationCli(["--help"], { stdout, stderr })).resolves.toBe(0);
    expect(stdout.mock.calls.flat().join("\n")).toMatch(/features.*match.*ask.*score/s);
    await expect(runPartIdentificationCli(["resolve"], { stdout, stderr })).resolves.toBe(1);
    expect(stderr.mock.calls.flat().join("\n")).toMatch(/There is no resolver command/);
  });

  it("rejects arbitrary manifest evidence before feature extraction", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-manifest-contract-"));
    const identity = "p11|q1|x43.074|y486.271";
    const identityDigest = sha256Digest(identity);
    const manifest = {
      schemaVersion: "lego.callout-thumbnails/4",
      sourceHash: FULL_CALLOUT_MANIFEST_EXPECTATION.sourceHash,
      pageSelection: "full booklet",
      pagesCropped: 1,
      calloutCount: 1,
      accounting: {
        rawNxIdentityCount: 1,
        rawNxQuantityTotal: 1,
        physicalPartArtIdentityCount: 0,
        physicalPartArtQuantityTotal: 0,
        semanticIdentityCount: 1,
        semanticQuantityTotal: 1,
      },
      conservation: {
        expectedIdentityCount: 1,
        expectedRawNxQuantityTotal: 1,
        expectedIdentitySetSha256: identityDigest,
        publishedIdentityCount: 1,
        publishedRawNxQuantityTotal: 1,
        publishedIdentitySetSha256: identityDigest,
      },
      failures: [],
      callouts: [
        {
          identity,
          file: `runs/${run}/p11-q1-x43d074-y486d271.png`,
          pageNumber: 11,
          stepNumber: 1,
          quantity: 1,
          xPt: 43.074,
          yPt: 486.271,
          evidenceKind: "attacker-controlled",
          sha256: sha256Digest("crop"),
        },
      ],
    };
    try {
      writeFileSync(join(directory, "manifest.json"), JSON.stringify(manifest));
      await expect(
        commandFeatures(["--callouts", directory, "--inventory", join(directory, "missing")], {
          manifestExpectation: {
            sourceHash: manifest.sourceHash,
            pagesCropped: 1,
            identityCount: 1,
            rawQuantity: 1,
            identitySetDigest: identityDigest,
            accounting: manifest.accounting,
          },
        }),
      ).rejects.toThrow(/fixed evidence contract/);
      await expect(
        commandFeatures(["--callouts", directory, "--inventory", join(directory, "missing")]),
      ).rejects.toThrow(/independently pinned full-booklet publication/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("keeps physical clusters and claims invariant when semantic rows are inserted", () => {
    const physicalOnly = [
      physical("physical-a1", 0, 100),
      physical("physical-a2", 0, 90),
      physical("physical-b", 1, 80),
    ];
    const withSemantic = [
      physicalOnly[0],
      {
        identity: "semantic-repeat",
        file: "semantic-repeat.png",
        quantity: 4,
        evidenceKind: "subassembly-repeat",
        descriptor: descriptor(1, 10_000),
      },
      physicalOnly[1],
      physicalOnly[2],
    ];
    const identityGroups = (callouts) =>
      clusterCallouts(callouts).map(({ members }) =>
        members.map((index) => callouts[index].identity).sort(),
      );
    expect(identityGroups(withSemantic)).toEqual(identityGroups(physicalOnly));
    expect(clusterCallouts(withSemantic).flatMap(({ members }) => members)).not.toContain(1);
    expect(assignmentByIdentity(withSemantic)).toEqual(assignmentByIdentity(physicalOnly));
  });

  it("rejects mutated crop bytes before decoding and decodes only the authenticated Buffer", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-bound-crop-"));
    const relative = `runs/${run}/p11-q1-x43d074-y486d271.png`;
    const path = join(directory, ...relative.split("/"));
    const original = Buffer.from("original crop bytes");
    const entry = {
      identity: "p11|q1|x43.074|y486.271",
      file: relative,
      sha256: sha256Digest(original),
    };
    try {
      mkdirSync(join(directory, "runs", run), { recursive: true });
      writeFileSync(path, "mutated crop bytes");
      const decode = vi.fn();
      await expect(readBoundManifestCrop(entry, directory, decode)).rejects.toThrow(
        /p11\|q1\|x43\.074\|y486\.271.*digest.*manifest binds/s,
      );
      expect(decode).not.toHaveBeenCalled();

      writeFileSync(path, original);
      const decoded = await readBoundManifestCrop(entry, directory, async (bytes) => {
        writeFileSync(path, "changed after authenticated read");
        expect(bytes).toEqual(original);
        return { decoded: true };
      });
      expect(decoded).toEqual({ decoded: true });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects a same-length post-feature inventory replacement before any derived image decode", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-bound-inventory-"));
    const path = join(directory, "300501.png");
    const original = Buffer.from("inventory-A");
    const replacement = Buffer.from("inventory-B");
    expect(replacement.length).toBe(original.length);
    try {
      writeFileSync(path, replacement);
      const decode = vi.fn();
      await expect(
        readBoundInventoryThumbnail("300501", sha256Digest(original), directory, decode),
      ).rejects.toThrow(/300501.*digest.*features bind.*same-path replacement/s);
      expect(decode).not.toHaveBeenCalled();

      writeFileSync(path, original);
      const decoded = await readBoundInventoryThumbnail(
        "300501",
        sha256Digest(original),
        directory,
        async (bytes) => {
          writeFileSync(path, replacement);
          expect(bytes).toEqual(original);
          return { decoded: true };
        },
      );
      expect(decoded).toEqual({ decoded: true });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("builds cards from authenticated raw galleries, ignores post-tile swaps, and rejects post-feature swaps", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-source-bound-cards-"));
    const out = join(directory, "identification");
    const calloutRoot = join(directory, "callouts");
    const inventoryRoot = join(directory, "inventory");
    const callouts = [
      boundCallout(),
      {
        ...boundCallout(),
        identity: "p11|q1|x108.908|y486.271",
        file: `runs/${run}/p11-q1-x108d908-y486d271.png`,
        xPt: 108.908,
        descriptor: descriptor(1, 1),
      },
    ];
    const calloutPaths = callouts.map((callout) => join(calloutRoot, ...callout.file.split("/")));
    const inventoryPaths = [join(inventoryRoot, "300501.png"), join(inventoryRoot, "300502.png")];
    const calloutPng = twoTonePng();
    const inventoryPng = twoTonePng();
    const writeJson = (path, value) =>
      writeFileSync(path, `${JSON.stringify(value, null, 1)}\n`, "utf8");
    const helpers = { out, option, writeJson, writeNestedArtifact };
    const argv = ["--k", "1", "--callouts", calloutRoot, "--inventory", inventoryRoot];
    try {
      for (const path of calloutPaths) mkdirSync(dirname(path), { recursive: true });
      mkdirSync(inventoryRoot, { recursive: true });
      mkdirSync(out, { recursive: true });
      for (const path of calloutPaths) writeFileSync(path, calloutPng);
      for (const path of inventoryPaths) writeFileSync(path, inventoryPng);
      for (const callout of callouts) callout.sha256 = sha256Digest(calloutPng);
      const featuresArtifact = writeArtifact(join(out, "features.json"), {
        schemaVersion: PART_FEATURES_SCHEMA,
        inputDigests: { pdf: digest("pdf"), calloutManifest: digest("manifest") },
        calloutDir: calloutRoot,
        inventoryDir: inventoryRoot,
        manifestCalloutCount: 2,
        calloutCount: 2,
        nonClusteredCalloutCount: 0,
        nonClusteredCallouts: [],
        inventory: { 300501: descriptor(0, 1), 300502: descriptor(1, 1) },
        inventorySourceDigests: {
          300501: sha256Digest(inventoryPng),
          300502: sha256Digest(inventoryPng),
        },
        callouts,
      });
      const matchArtifact = writeArtifact(join(out, "match.json"), {
        schemaVersion: PART_MATCH_SCHEMA,
        featuresDigest: featuresArtifact.digest,
        calloutCount: 2,
        clusterCount: 2,
        clusters: [
          {
            clusterIndex: 0,
            lead: callouts[0].file,
            members: [0],
            pieces: 1,
            candidates: [{ elementId: "300501", total: 0.1 }],
          },
          {
            clusterIndex: 1,
            lead: callouts[1].file,
            members: [1],
            pieces: 1,
            candidates: [{ elementId: "300502", total: 0.1 }],
          },
        ],
      });
      writeArtifact(join(out, "distances.json"), {
        schemaVersion: PART_DISTANCES_SCHEMA,
        featuresDigest: featuresArtifact.digest,
        elementIds: ["300501", "300502"],
        rows: [
          [0.1, 0.2],
          [0.2, 0.1],
        ],
      });

      await commandCards(argv, helpers);
      const manifestPath = join(out, "cards", "manifest.json");
      const exactManifest = readFileSync(manifestPath);
      const manifest = JSON.parse(exactManifest);
      expect(manifest).toMatchObject({
        schemaVersion: PART_CARDS_SCHEMA,
        featuresDigest: featuresArtifact.digest,
        matchDigest: matchArtifact.digest,
      });

      const exactRunDirectory = join(out, "cards", "runs", manifest.runId);
      const exactRunFiles = Object.fromEntries(
        readdirSync(exactRunDirectory).map((file) => [
          file,
          readFileSync(join(exactRunDirectory, file)),
        ]),
      );
      const expectPublishedRunUnchanged = () => {
        expect(readdirSync(exactRunDirectory).sort()).toEqual(Object.keys(exactRunFiles).sort());
        for (const [file, bytes] of Object.entries(exactRunFiles)) {
          expect(readFileSync(join(exactRunDirectory, file))).toEqual(bytes);
        }
      };
      const expectNoStagedRuns = () => {
        expect(
          readdirSync(join(out, "cards", "runs")).filter((name) => name.startsWith(".staging-")),
        ).toEqual([]);
      };
      const fakeCalloutTile = join(out, "tiles", "callout", ...callouts[0].file.split("/"));
      const fakeInventoryTile = join(out, "tiles", "inventory", "300501.png");
      mkdirSync(dirname(fakeCalloutTile), { recursive: true });
      mkdirSync(dirname(fakeInventoryTile), { recursive: true });
      writeFileSync(fakeCalloutTile, "attacker tile A");
      writeFileSync(fakeInventoryTile, "attacker tile B");
      await commandCards(argv, helpers);
      expect(readFileSync(manifestPath)).toEqual(exactManifest);

      let sameRunWrites = 0;
      await commandCards(argv, {
        ...helpers,
        writeContainedFile(root, relativePath, bytes, options) {
          sameRunWrites += 1;
          const corrupted = Buffer.from(bytes);
          corrupted[corrupted.length - 1] ^= 1;
          return writeContainedFile(root, relativePath, corrupted, options);
        },
      });
      expect(sameRunWrites).toBe(0);
      expect(readFileSync(manifestPath)).toEqual(exactManifest);
      expectPublishedRunUnchanged();
      expectNoStagedRuns();

      const expandedMatchArtifact = writeArtifact(join(out, "match.json"), {
        ...matchArtifact.value,
        clusters: matchArtifact.value.clusters.map((cluster, clusterIndex) => ({
          ...cluster,
          candidates:
            clusterIndex === 0
              ? [
                  { elementId: "300501", total: 0.1 },
                  { elementId: "300502", total: 0.2 },
                ]
              : [
                  { elementId: "300502", total: 0.1 },
                  { elementId: "300501", total: 0.2 },
                ],
        })),
      });
      expect(expandedMatchArtifact.digest).not.toBe(matchArtifact.digest);
      const expandedArgv = ["--k", "2", "--callouts", calloutRoot, "--inventory", inventoryRoot];

      await expect(
        commandCards(expandedArgv, {
          ...helpers,
          writeContainedFile(root, relativePath, bytes, options) {
            if (relativePath.endsWith("/images.bin")) throw new Error("injected bundle fault");
            return writeContainedFile(root, relativePath, bytes, options);
          },
        }),
      ).rejects.toThrow(/injected bundle fault/);
      expect(readFileSync(manifestPath)).toEqual(exactManifest);
      expectPublishedRunUnchanged();
      expectNoStagedRuns();

      await expect(
        commandCards(expandedArgv, {
          ...helpers,
          writeContainedFile(root, relativePath, bytes, options) {
            const published = Buffer.from(bytes);
            if (relativePath.endsWith("/images.bin")) {
              published[published.length - 1] ^= 1;
            }
            return writeContainedFile(root, relativePath, published, options);
          },
        }),
      ).rejects.toThrow(/failed (?:its )?PNG CRC|differs byte-for-byte|digest/s);
      expect(readFileSync(manifestPath)).toEqual(exactManifest);
      expectPublishedRunUnchanged();
      expectNoStagedRuns();

      await expect(
        commandCards(expandedArgv, {
          ...helpers,
          writeContainedFile(root, relativePath, bytes, options) {
            const published = Buffer.from(bytes);
            if (relativePath.endsWith("/card-0000.png")) {
              published[published.length - 1] ^= 1;
            }
            return writeContainedFile(root, relativePath, published, options);
          },
        }),
      ).rejects.toThrow(/failed (?:its )?PNG CRC|differs byte-for-byte|digest/s);
      expect(readFileSync(manifestPath)).toEqual(exactManifest);
      expectPublishedRunUnchanged();
      expectNoStagedRuns();

      await expect(
        commandCards(expandedArgv, {
          ...helpers,
          writeJson() {
            throw new Error("injected pointer fault");
          },
        }),
      ).rejects.toThrow(/injected pointer fault/);
      expect(readFileSync(manifestPath)).toEqual(exactManifest);
      expectPublishedRunUnchanged();
      expectNoStagedRuns();

      const changedCallout = Buffer.from(calloutPng);
      changedCallout[changedCallout.length - 1] ^= 1;
      expect(changedCallout.length).toBe(calloutPng.length);
      writeFileSync(calloutPaths[0], changedCallout);
      await expect(commandCards(argv, helpers)).rejects.toThrow(/digest.*manifest binds/s);
      expect(readFileSync(manifestPath)).toEqual(exactManifest);
      writeFileSync(calloutPaths[0], calloutPng);

      const changedInventory = Buffer.from(inventoryPng);
      changedInventory[changedInventory.length - 1] ^= 1;
      expect(changedInventory.length).toBe(inventoryPng.length);
      writeFileSync(inventoryPaths[1], changedInventory);
      await expect(commandCards(argv, helpers)).rejects.toThrow(
        /digest.*features bind.*same-path replacement/s,
      );
      expect(readFileSync(manifestPath)).toEqual(exactManifest);
      expectPublishedRunUnchanged();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects a mutated card even when its cluster already has an answer", async () => {
    const directory = mkdtempSync(join(tmpdir(), "lego-card-closure-"));
    const cardsDirectory = join(directory, "cards");
    mkdirSync(cardsDirectory);
    try {
      const { featuresArtifact, matchArtifact } = writeIdentificationClosure(directory);
      const expectedCard = canonicalPng(2, 2);
      const expectedCardDigest = sha256Digest(expectedCard);
      const cardEntries = {
        "card-0000": {
          sha256: expectedCardDigest,
          candidateElementIds: ["300501"],
        },
      };
      const cardRunId = deriveCardRunId(featuresArtifact.digest, matchArtifact.digest, cardEntries);
      const cardsArtifact = writeArtifact(join(cardsDirectory, "manifest.json"), {
        schemaVersion: PART_CARDS_SCHEMA,
        featuresDigest: featuresArtifact.digest,
        matchDigest: matchArtifact.digest,
        runId: cardRunId,
        imagesFile: `runs/${cardRunId}/images.bin`,
        cards: {
          "card-0000": {
            ...cardEntries["card-0000"],
            file: `runs/${cardRunId}/card-0000.png`,
          },
        },
      });
      const manifest = cardsArtifact.value;
      const bundlePath = join(cardsDirectory, ...manifest.imagesFile.split("/"));
      mkdirSync(dirname(bundlePath), { recursive: true });
      writeFileSync(
        bundlePath,
        cardImageBundleArtifact(
          encodeCardImageBundle(manifest, new Map([["card-0000", expectedCard]])),
        ).bytes,
      );
      const cardPath = join(
        cardsDirectory,
        ...cardsArtifact.value.cards["card-0000"].file.split("/"),
      );
      mkdirSync(dirname(cardPath), { recursive: true });
      writeFileSync(cardPath, canonicalPng(3, 2, 1));
      writeArtifact(join(directory, `answers-${PART_IDENTIFICATION_MODEL_ID}.json`), {
        schemaVersion: PART_ANSWERS_SCHEMA,
        model: PART_IDENTIFICATION_MODEL_ID,
        modelIdentity: PART_IDENTIFICATION_MODEL_IDENTITY,
        matchDigest: matchArtifact.digest,
        cardsDigest: cardsArtifact.digest,
        promptDigest: PART_IDENTIFICATION_PROMPT_DIGEST,
        answers: {
          0: {
            kind: "brick",
            studsLong: 1,
            studsWide: 1,
            colour: "black",
            pick: 1,
            confidence: 0.9,
          },
        },
      });
      await expect(
        commandAsk(["--out", directory, "--model", PART_IDENTIFICATION_MODEL_ID]),
      ).rejects.toThrow(/including already-answered clusters/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("feeds the model a locked one-use snapshot of authenticated retained card bytes", async () => {
    if (process.platform !== "win32") return;
    const directory = mkdtempSync(join(tmpdir(), "lego-model-card-snapshot-"));
    const cardsDirectory = join(directory, "cards");
    mkdirSync(cardsDirectory);
    const retained = canonicalPng(2, 2, 7);
    const authenticated = Buffer.from(retained);
    const replacement = canonicalPng(2, 2, 11);
    const canonicalPath = join(cardsDirectory, "card-0000.png");
    writeFileSync(canonicalPath, retained);
    let observed = null;
    let snapshotRoot = null;
    let snapshotMutationDenied = false;
    const spawnImpl = vi.fn((_command, args) => {
      const instruction = args[1];
      const snapshotPath = /^Read these 1 images: ([^\r\n]+)/u.exec(instruction)?.[1];
      expect(snapshotPath).toBeTruthy();
      snapshotRoot = dirname(snapshotPath);
      writeFileSync(canonicalPath, replacement);
      retained.fill(0);
      try {
        writeFileSync(snapshotPath, replacement);
      } catch {
        snapshotMutationDenied = true;
      }
      observed = readFileSync(snapshotPath);
      writeFileSync(canonicalPath, authenticated);
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = vi.fn(() => true);
      child.pid = 10_001;
      queueMicrotask(() => {
        child.stdout.write(
          JSON.stringify({
            is_error: false,
            result:
              'card-0000 {"kind":"brick","studsLong":1,"studsWide":1,"colour":"black","pick":1,"confidence":0.9}',
            modelUsage: {
              [PART_IDENTIFICATION_MODEL_ID]: {
                canonicalModel: PART_IDENTIFICATION_MODEL_IDENTITY.canonicalModel,
                provider: PART_IDENTIFICATION_MODEL_IDENTITY.provider,
              },
            },
          }),
        );
        child.emit("close", 0, null);
      });
      return child;
    });
    try {
      const reply = await askBatch(["card-0000"], PART_IDENTIFICATION_MODEL_ID, directory, {
        cardImages: new Map([["card-0000", retained]]),
        cardDigests: new Map([["card-0000", sha256Digest(authenticated)]]),
        spawnImpl,
      });
      expect(reply.answers.get("card-0000")).toMatchObject({ pick: 1 });
      expect(observed).toEqual(authenticated);
      expect(snapshotMutationDenied).toBe(true);
      expect(existsSync(snapshotRoot)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("discards a model result when the exact-lock helper exits cleanly before release", async () => {
    if (process.platform !== "win32") return;
    const retained = canonicalPng(2, 2, 7);
    const replacement = canonicalPng(2, 2, 11);
    let snapshotRoot = null;
    let observed = null;
    const lockSpawnImpl = vi.fn(() => {
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      child.exitCode = null;
      child.kill = vi.fn(() => true);
      queueMicrotask(() => {
        child.stdout.write("READY\n");
        queueMicrotask(() => {
          child.exitCode = 0;
          child.emit("close", 0, null);
        });
      });
      return child;
    });
    const spawnImpl = vi.fn((_command, args) => {
      const snapshotPath = /^Read these 1 images: ([^\r\n]+)/u.exec(args[1])?.[1];
      snapshotRoot = dirname(snapshotPath);
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = vi.fn(() => true);
      child.pid = 10_002;
      setTimeout(() => {
        writeFileSync(snapshotPath, replacement);
        observed = readFileSync(snapshotPath);
        writeFileSync(snapshotPath, retained);
        child.stdout.write(
          JSON.stringify({
            is_error: false,
            result:
              'card-0000 {"kind":"brick","studsLong":1,"studsWide":1,"colour":"black","pick":1,"confidence":0.9}',
            modelUsage: {
              [PART_IDENTIFICATION_MODEL_ID]: {
                canonicalModel: PART_IDENTIFICATION_MODEL_IDENTITY.canonicalModel,
                provider: PART_IDENTIFICATION_MODEL_IDENTITY.provider,
              },
            },
          }),
        );
        child.emit("close", 0, null);
      }, 10);
      return child;
    });
    try {
      await expect(
        askBatch(["card-0000"], PART_IDENTIFICATION_MODEL_ID, "unused", {
          cardImages: new Map([["card-0000", retained]]),
          cardDigests: new Map([["card-0000", sha256Digest(retained)]]),
          lockSpawnImpl,
          spawnImpl,
        }),
      ).rejects.toThrow(/after readiness but before explicit release/);
      expect(spawnImpl).toHaveBeenCalledOnce();
      expect(observed).toEqual(replacement);
    } finally {
      if (snapshotRoot !== null) rmSync(snapshotRoot, { recursive: true, force: true });
    }
  });

  it("fails closed on incomplete descriptions, mutable model aliases, and extra model usage", async () => {
    const cluster = {
      clusterIndex: 0,
      members: [0],
      candidates: [{ elementId: "300501", total: 0.1 }],
    };
    const names = new Map([["300501", { name: "Brick 1 x 1", colorId: 0 }]]);
    const cards = {
      "card-0000": { candidateElementIds: ["300501"] },
    };
    for (const proposed of [
      { kind: "other", studsLong: 0, studsWide: 0, pick: 1 },
      { kind: "brick", studsLong: "1", studsWide: 1, pick: 1 },
    ]) {
      const claims = claimsFor(
        { clusters: [cluster] },
        { elementIds: ["300501"], rows: [[0.1]] },
        "adjudicated",
        { 0: proposed },
        { assign: "nearest", names, cards },
      );
      expect(claims.get(0)).toMatchObject({
        elementId: "300501",
        picked: "description-unverifiable",
      });
    }
    expect(
      describesSameThing(
        { kind: "brick", studsLong: 1, studsWide: 1, colour: "black" },
        { name: "Brick 1 x 1", colorId: 0 },
      ),
    ).toEqual({
      kindAgrees: true,
      sizeAgrees: true,
      colourAgrees: true,
    });
    expect(
      describesSameThing(
        { kind: "brick", studsLong: 1, studsWide: 1, colour: "ultraviolet" },
        { name: "Brick 1 x 1", colorId: 0 },
      ),
    ).toMatchObject({ colourAgrees: false });
    const accepted = claimsFor(
      { clusters: [cluster] },
      { elementIds: ["300501"], rows: [[0.1]] },
      "adjudicated",
      {
        0: {
          kind: "brick",
          studsLong: 1,
          studsWide: 1,
          colour: "black",
          pick: 1,
          confidence: 0.9,
        },
      },
      { assign: "nearest", names, cards },
    );
    expect(accepted.get(0)).toMatchObject({ elementId: "300501", picked: "vision-kept" });
    const impossibleColour = claimsFor(
      { clusters: [cluster] },
      { elementIds: ["300501"], rows: [[0.1]] },
      "adjudicated",
      {
        0: {
          kind: "brick",
          studsLong: 1,
          studsWide: 1,
          colour: "ultraviolet",
          pick: 1,
          confidence: 0.9,
        },
      },
      { assign: "nearest", names, cards },
    );
    expect(impossibleColour.get(0)).toMatchObject({ picked: "self-contradicted" });
    expect(() => responseModelIdentity({}, "opus")).toThrow(/pinned to/);
    expect(() =>
      responseModelIdentity(
        {
          is_error: false,
          result: "card-0000 {}",
          modelUsage: {
            [PART_IDENTIFICATION_MODEL_ID]: {
              canonicalModel: PART_IDENTIFICATION_MODEL_ID,
              provider: "firstParty",
            },
            fallback: { canonicalModel: "fallback", provider: "firstParty" },
          },
        },
        PART_IDENTIFICATION_MODEL_ID,
      ),
    ).toThrow(/did not prove pinned model/);
    await expect(askBatch(["../../card-0000"], PART_IDENTIFICATION_MODEL_ID)).rejects.toThrow(
      /unique canonical card-NNNN ids/,
    );
  });
});
