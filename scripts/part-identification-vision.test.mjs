import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { askBatch, settleVisionWorkers } from "./part-identification-ask.mjs";
import { sha256Digest } from "./part-identification-artifacts.mjs";
import {
  PART_IDENTIFICATION_MODEL_ID,
  PART_IDENTIFICATION_MODEL_IDENTITY,
  responseModelIdentity,
} from "./part-identification-model.mjs";
import {
  PART_IDENTIFICATION_COLOUR_VOCABULARY,
  PART_IDENTIFICATION_PROMPT,
} from "./part-identification-prompt.mjs";
import { claimsFor, describesSameThing } from "./part-identification-score.mjs";
import { canonicalPng } from "./part-identification-test-fixture.mjs";
import { COLOR_DEFINITIONS } from "../packages/catalog/src/colors.ts";

/** The one reply shape the bounded child parser accepts, for a single answered card. */
function visionReply() {
  return JSON.stringify({
    is_error: false,
    result:
      'card-0000 {"kind":"brick","studsLong":1,"studsWide":1,"colour":"black","pick":1,"confidence":0.9}',
    modelUsage: {
      [PART_IDENTIFICATION_MODEL_ID]: {
        canonicalModel: PART_IDENTIFICATION_MODEL_IDENTITY.canonicalModel,
        provider: PART_IDENTIFICATION_MODEL_IDENTITY.provider,
      },
    },
  });
}

describe("part-identification vision call boundary", () => {
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
        child.stdout.write(visionReply());
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
        child.stdout.write(visionReply());
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

describe("part-identification colour vocabulary", () => {
  // The prompt and the grader have to name colours in one language. Asking for a
  // "plain colour name" and grading against the LDraw display name scored wording,
  // not sight: 65 of 136 self-contradictions over 273 drawings were colour-only,
  // most of them "light gray" for Light Bluish Gray or a dropped shade. Naming the
  // vocabulary in the prompt is the fix; loosening the grader is not.
  it("offers the call only names the grader can accept", () => {
    expect(PART_IDENTIFICATION_COLOUR_VOCABULARY.length).toBeGreaterThan(0);
    expect(new Set(PART_IDENTIFICATION_COLOUR_VOCABULARY).size).toBe(
      PART_IDENTIFICATION_COLOUR_VOCABULARY.length,
    );
    for (const colour of PART_IDENTIFICATION_COLOUR_VOCABULARY) {
      const definition = COLOR_DEFINITIONS.find(({ displayName }) => displayName === colour);
      expect(definition, `${colour} must be a catalog colour the grader can resolve`).toBeDefined();
      expect(
        describesSameThing(
          { kind: "brick", studsLong: 1, studsWide: 1, colour },
          { name: "Brick 1 x 1", colorId: definition.ldrawCode },
        ),
      ).toMatchObject({ colourAgrees: true });
      expect(PART_IDENTIFICATION_PROMPT).toContain(colour);
    }
  });

  it("still fails the near misses that are real sight errors", () => {
    // Black graded against "dark gray", and Sand Blue against "light blue", are
    // the third of the colour-only contradictions that were never a synonym.
    for (const [colour, ldrawCode] of [
      ["dark gray", 0],
      ["light grey", 72],
      ["light blue", 379],
      ["blue", 272],
    ]) {
      expect(
        describesSameThing(
          { kind: "brick", studsLong: 1, studsWide: 1, colour },
          { name: "Brick 1 x 1", colorId: ldrawCode },
        ),
      ).toMatchObject({ colourAgrees: false });
    }
  });
});
