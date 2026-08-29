import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { sha256Digest } from "./part-identification-artifact-source.mjs";
import {
  archiveDifferingCurrentArtifact,
  publishContainedArtifactWithoutOverwrite,
} from "./part-identification-counterevidence-archive.mjs";

const roots = [];

function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), "lego-counterevidence-"));
  roots.push(root);
  return root;
}

function options(root, nextBytes = Buffer.from("replacement\n")) {
  return {
    archiveNameStem: "fixture-artifact",
    currentFile: "current.json",
    label: "Fixture artifact",
    maxBytes: 1_024,
    nextBytes,
    outputRoot: root,
  };
}

const publicationRoles = [
  {
    archiveNameStem: "catalog-coverage",
    currentFile: "catalog-coverage.json",
    label: "Semantic catalog coverage",
    maxBytes: 2 * 1024 * 1024,
    name: "semantic catalog coverage",
  },
  {
    archiveNameStem: "action-preparation",
    currentFile: "action-preparation.json",
    label: "Prefix-50 action preparation",
    maxBytes: 2 * 1024 * 1024,
    name: "action preparation",
  },
  {
    archiveNameStem: "prefix50-official-ldraw-world-proposal",
    currentFile: "prefix50-official-ldraw-world-proposal.json",
    label: "Official XML/LDraw world proposal",
    maxBytes: 2 * 1024 * 1024,
    name: "official-world proposal",
  },
  {
    archiveNameStem: "prefix50-ldraw-catalog-frames",
    currentFile: "prefix50-ldraw-catalog-frames.json",
    label: "Prefix-50 LDraw/catalog frames",
    maxBytes: 512 * 1024,
    name: "LDraw/catalog frames",
  },
  {
    archiveNameStem: "prefix50-official-world-reconciliation",
    currentFile: "prefix50-official-world-reconciliation.json",
    label: "Official-world reconciliation",
    maxBytes: 2 * 1024 * 1024,
    name: "official-world reconciliation",
  },
  {
    archiveNameStem: "prefix50-structural-events",
    currentFile: "prefix50-structural-events.json",
    label: "Prefix-50 structural events",
    maxBytes: 256 * 1024,
    name: "prefix-50 structural events",
  },
];

function roleOptions(root, role, nextBytes = Buffer.from("replacement\n")) {
  return { ...role, nextBytes, outputRoot: root };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("differing current-artifact counterevidence archive", () => {
  it("does nothing when current bytes are absent or already equal", () => {
    const root = temporaryRoot();
    const next = Buffer.from("same\n");
    expect(archiveDifferingCurrentArtifact(options(root, next))).toBeNull();
    expect(readdirSync(root)).toEqual([]);

    writeFileSync(join(root, "current.json"), next);
    expect(archiveDifferingCurrentArtifact(options(root, next))).toBeNull();
    expect(readdirSync(root)).toEqual(["current.json"]);
  });

  it("preserves differing bytes once under a full-digest immutable name and verifies them", () => {
    const root = temporaryRoot();
    const current = Buffer.from("current counterevidence\n");
    writeFileSync(join(root, "current.json"), current);
    const digest = sha256Digest(current);
    const expectedRelative = `history/fixture-artifact-stale-${digest.slice("sha256:".length)}.json`;

    const first = archiveDifferingCurrentArtifact(options(root));
    expect(first).toEqual({
      archivePath: join(root, ...expectedRelative.split("/")),
      archiveRelativePath: expectedRelative,
      bytes: current.length,
      digest,
    });
    expect(readFileSync(first.archivePath)).toEqual(current);
    expect(archiveDifferingCurrentArtifact(options(root))).toEqual(first);
    expect(readdirSync(join(root, "history"))).toEqual([
      `fixture-artifact-stale-${digest.slice("sha256:".length)}.json`,
    ]);
  });

  it("refuses a digest-path collision, unsafe path policy, and either side of the byte bound", () => {
    const root = temporaryRoot();
    const current = Buffer.from("current counterevidence\n");
    writeFileSync(join(root, "current.json"), current);
    const digest = sha256Digest(current).slice("sha256:".length);
    const history = join(root, "history");
    mkdirSync(history);
    writeFileSync(join(history, `fixture-artifact-stale-${digest}.json`), "collision\n");

    expect(() => archiveDifferingCurrentArtifact(options(root))).toThrow(
      /exists with bytes other than sha256:.*current evidence was not replaced/,
    );
    expect(() =>
      archiveDifferingCurrentArtifact({ ...options(root), currentFile: "../escape.json" }),
    ).toThrow(/parent-directory segment/);
    expect(() =>
      archiveDifferingCurrentArtifact({ ...options(root), archiveNameStem: "../escape" }),
    ).toThrow(/archive stem/);
    expect(() => archiveDifferingCurrentArtifact({ ...options(root), maxBytes: 4 })).toThrow(
      /outside the required 1\.\.4-byte range/,
    );
    expect(() =>
      archiveDifferingCurrentArtifact({
        ...options(root, Buffer.from("x\n")),
        maxBytes: 4,
      }),
    ).toThrow(/above the 4-byte input limit/);
  });
});

describe("fail-closed contained artifact publication", () => {
  it("exclusively creates an absent current path and reuses only identical bytes", () => {
    const root = temporaryRoot();
    const replacement = Buffer.from("reviewed current\n");
    const first = publishContainedArtifactWithoutOverwrite(options(root, replacement));
    expect(first).toMatchObject({
      archive: null,
      candidate: null,
      digest: sha256Digest(replacement),
      state: "published-current",
    });
    expect(readFileSync(join(root, "current.json"))).toEqual(replacement);

    expect(publishContainedArtifactWithoutOverwrite(options(root, replacement))).toMatchObject({
      archive: null,
      candidate: null,
      digest: sha256Digest(replacement),
      state: "current-identical",
    });
  });

  it("retains a differing current path and publishes only immutable archive and candidate bytes", () => {
    const root = temporaryRoot();
    const current = Buffer.from("prior current\n");
    const replacement = Buffer.from("reviewed replacement\n");
    const currentPath = join(root, "current.json");
    writeFileSync(currentPath, current);
    const currentDigest = sha256Digest(current);
    const nextDigest = sha256Digest(replacement);

    const publication = publishContainedArtifactWithoutOverwrite(options(root, replacement));
    expect(publication).toMatchObject({
      archive: { digest: currentDigest },
      candidate: {
        digest: nextDigest,
        relativePath: `fixture-artifact-candidate-${nextDigest.slice("sha256:".length)}.json`,
      },
      digest: nextDigest,
      state: "review-required",
    });
    expect(readFileSync(currentPath)).toEqual(current);
    expect(readFileSync(publication.archive.archivePath)).toEqual(current);
    expect(readFileSync(publication.candidate.path)).toEqual(replacement);
    expect(publishContainedArtifactWithoutOverwrite(options(root, replacement))).toEqual(
      publication,
    );
    expect(readFileSync(currentPath)).toEqual(current);
  });

  it.each(publicationRoles)(
    "refuses an absent-to-late-create race for $name without replacing late current bytes",
    (role) => {
      const root = temporaryRoot();
      const late = Buffer.from("late current\n");
      const currentPath = join(root, role.currentFile);

      expect(() =>
        publishContainedArtifactWithoutOverwrite({
          ...roleOptions(root, role),
          __testHooks: {
            currentWrite: {
              afterPreflight: () => writeFileSync(currentPath, late),
            },
          },
        }),
      ).toThrow(/already exists|EEXIST/);
      expect(readFileSync(currentPath)).toEqual(late);
      expect(readdirSync(root)).toEqual([role.currentFile]);
    },
  );

  it.each(publicationRoles)(
    "refuses a present-to-late-change race for $name without overwriting changed current bytes",
    (role) => {
      const root = temporaryRoot();
      const current = Buffer.from("prior current\n");
      const late = Buffer.from("late changed current\n");
      const replacement = Buffer.from("reviewed replacement\n");
      const currentPath = join(root, role.currentFile);
      writeFileSync(currentPath, current);
      const nextDigest = sha256Digest(replacement).slice("sha256:".length);

      expect(() =>
        publishContainedArtifactWithoutOverwrite({
          ...roleOptions(root, role, replacement),
          __testHooks: {
            candidateWrite: {
              afterPreflight: () => writeFileSync(currentPath, late),
            },
          },
        }),
      ).toThrow(/changed while its candidate was published.*no current artifact was overwritten/);
      expect(readFileSync(currentPath)).toEqual(late);
      expect(
        readFileSync(join(root, `${role.archiveNameStem}-candidate-${nextDigest}.json`)),
      ).toEqual(replacement);
    },
  );
});
