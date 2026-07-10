import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ARTIFACT_POLICY,
  ArtifactStoreError,
  openArtifactStore,
  type PutArtifactInput,
} from "./index";
import { openArtifactStoreForTesting } from "./artifact-store";

const encoder = new TextEncoder();
const sandboxes: string[] = [];

async function makeSandbox(): Promise<string> {
  const sandbox = await mkdtemp(join(tmpdir(), "lego-companion-cas-"));
  sandboxes.push(sandbox);
  return sandbox;
}

function input(overrides: Partial<PutArtifactInput> = {}): PutArtifactInput {
  return {
    artifactId: "artifact-1",
    kind: "source",
    mediaType: "text/plain",
    bytes: encoder.encode("brick evidence"),
    ...overrides,
  };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function objectDirectory(root: string, casKey: string): string {
  const digest = casKey.slice("sha256:".length);
  return join(root, "objects", digest.slice(0, 2), digest);
}

function payloadPath(root: string, casKey: string): string {
  return join(objectDirectory(root, casKey), "payload");
}

async function expectStoreError(
  operation: Promise<unknown>,
  code: InstanceType<typeof ArtifactStoreError>["code"],
): Promise<void> {
  try {
    await operation;
  } catch (error) {
    expect(error).toBeInstanceOf(ArtifactStoreError);
    expect((error as ArtifactStoreError).code).toBe(code);
    return;
  }
  throw new Error(`Expected artifact store error ${code}`);
}

async function descendantNames(root: string): Promise<string[]> {
  const names: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    names.push(entry.name);
    if (entry.isDirectory()) {
      names.push(...(await descendantNames(join(root, entry.name))));
    }
  }
  return names;
}

afterEach(async () => {
  await Promise.all(sandboxes.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("companion content-addressed artifact store", () => {
  it("requires an explicit absolute root that is either new or already store-owned", async () => {
    await expectStoreError(openArtifactStore({ root: "relative/cas" }), "INVALID_ROOT");

    const sandbox = await makeSandbox();
    const unowned = join(sandbox, "unowned");
    await mkdir(unowned);
    await writeFile(join(unowned, "user-file"), "leave me alone");

    await expectStoreError(openArtifactStore({ root: unowned }), "ROOT_NOT_OWNED");
    await expectStoreError(
      openArtifactStore({
        root: join(sandbox, "undersized-admission"),
        maxByteLength: 4,
        maxInFlightByteLength: 3,
      }),
      "INVALID_ROOT",
    );
    await expectStoreError(
      openArtifactStore({ root: join(sandbox, "zero-concurrency"), maxConcurrentOperations: 0 }),
      "INVALID_ROOT",
    );
    expect(await readFile(join(unowned, "user-file"), "utf8")).toBe("leave me alone");
  });

  it("puts once, returns a deeply frozen ArtifactRefV1, and reads verified bytes", async () => {
    const sandbox = await makeSandbox();
    const root = join(sandbox, "cas");
    const store = await openArtifactStore({ root });

    const reference = await store.put(input());
    const storedBefore = await stat(payloadPath(root, reference.casKey), { bigint: true });
    const repeated = await store.put(input());
    const storedAfter = await stat(payloadPath(root, reference.casKey), { bigint: true });

    expect(reference).toEqual({
      artifactId: "artifact-1",
      kind: "source",
      mediaType: "text/plain",
      sha256: reference.casKey,
      byteLength: encoder.encode("brick evidence").byteLength,
      casKey: reference.sha256,
    });
    expect(Object.isFrozen(reference)).toBe(true);
    expect(repeated).toEqual(reference);
    expect(storedAfter.ino).toBe(storedBefore.ino);
    expect(storedAfter.mtimeNs).toBe(storedBefore.mtimeNs);
    expect(await store.read(reference)).toEqual(encoder.encode("brick evidence"));
  });

  it("serializes concurrent same-content writes without partial or duplicate objects", async () => {
    const sandbox = await makeSandbox();
    const root = join(sandbox, "cas");
    const stores = await Promise.all([openArtifactStore({ root }), openArtifactStore({ root })]);

    const references = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        stores[index % stores.length]!.put(input({ artifactId: `artifact-${index + 1}` })),
      ),
    );

    expect(new Set(references.map(({ casKey }) => casKey))).toHaveLength(1);
    const finalDirectory = objectDirectory(root, references[0]!.casKey);
    expect(await readdir(finalDirectory)).toEqual(["payload"]);
    expect((await descendantNames(root)).some((name) => name.includes(".tmp"))).toBe(false);
    for (const reference of references) {
      expect(await stores[0]!.read(reference)).toEqual(encoder.encode("brick evidence"));
    }
  });

  it("bounds admitted artifact bytes and rejects work beyond the pending-operation cap", async () => {
    const sandbox = await makeSandbox();
    const root = join(sandbox, "cas");
    const firstFinalization = deferred();
    const releaseFirst = deferred();
    let blockFinalization = false;
    let finalizationCount = 0;
    const store = await openArtifactStoreForTesting(
      {
        root,
        maxByteLength: 4,
        maxInFlightByteLength: 4,
        maxConcurrentOperations: 2,
        maxQueuedOperations: 1,
      },
      async (from, to) => {
        if (blockFinalization && /^[0-9a-f]{64}$/.test(basename(to))) {
          finalizationCount += 1;
          if (finalizationCount === 1) {
            firstFinalization.resolve();
            await releaseFirst.promise;
          }
        }
        await rename(from, to);
      },
    );
    blockFinalization = true;

    const first = store.put(input({ artifactId: "first", bytes: new Uint8Array(4).fill(1) }));
    await firstFinalization.promise;
    const second = store.put(input({ artifactId: "second", bytes: new Uint8Array(4).fill(2) }));

    try {
      expect(finalizationCount).toBe(1);
      await expectStoreError(
        store.put(input({ artifactId: "overflow", bytes: new Uint8Array(1) })),
        "STORE_BUSY",
      );
    } finally {
      releaseFirst.resolve();
    }
    const references = await Promise.all([first, second]);
    expect(references.map(({ byteLength }) => byteLength)).toEqual([4, 4]);
    expect(finalizationCount).toBe(2);
  });

  it("bounds concurrent zero-byte operations independently from the byte budget", async () => {
    const sandbox = await makeSandbox();
    const root = join(sandbox, "cas");
    const firstFinalization = deferred();
    const releaseFirst = deferred();
    let blockFinalization = false;
    const store = await openArtifactStoreForTesting(
      {
        root,
        maxByteLength: 1,
        maxInFlightByteLength: 1,
        maxConcurrentOperations: 1,
        maxQueuedOperations: 1,
      },
      async (from, to) => {
        if (blockFinalization && /^[0-9a-f]{64}$/.test(basename(to))) {
          firstFinalization.resolve();
          await releaseFirst.promise;
        }
        await rename(from, to);
      },
    );
    blockFinalization = true;

    const first = store.put(input({ artifactId: "empty-1", bytes: new Uint8Array() }));
    await firstFinalization.promise;
    const second = store.put(input({ artifactId: "empty-2", bytes: new Uint8Array() }));

    try {
      await expectStoreError(
        store.put(input({ artifactId: "empty-overflow", bytes: new Uint8Array() })),
        "STORE_BUSY",
      );
    } finally {
      releaseFirst.resolve();
    }
    await Promise.all([first, second]);
  });

  it("fails closed when queued caller bytes change and accepts an unchanged retry", async () => {
    const sandbox = await makeSandbox();
    const root = join(sandbox, "cas");
    const firstFinalization = deferred();
    const releaseFirst = deferred();
    let blockFinalization = false;
    let finalizationCount = 0;
    const store = await openArtifactStoreForTesting(
      {
        root,
        maxByteLength: 4,
        maxInFlightByteLength: 4,
        maxConcurrentOperations: 1,
        maxQueuedOperations: 1,
      },
      async (from, to) => {
        if (blockFinalization && /^[0-9a-f]{64}$/.test(basename(to))) {
          finalizationCount += 1;
          if (finalizationCount === 1) {
            firstFinalization.resolve();
            await releaseFirst.promise;
          }
        }
        await rename(from, to);
      },
    );
    blockFinalization = true;
    const blocker = store.put(input({ artifactId: "blocker", bytes: new Uint8Array(4) }));
    await firstFinalization.promise;
    const callerBytes = new Uint8Array([1, 2, 3, 4]);
    const changedWhileQueued = store.put(
      input({ artifactId: "changed-while-queued", bytes: callerBytes }),
    );
    callerBytes[0] = 9;
    releaseFirst.resolve();

    await blocker;
    await expectStoreError(changedWhileQueued, "INVALID_METADATA");
    callerBytes[0] = 1;
    const restored = await store.put(input({ artifactId: "restored", bytes: callerBytes }));
    expect(await store.read(restored)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("detects same-length tampering and refuses to repair it by overwriting", async () => {
    const sandbox = await makeSandbox();
    const root = join(sandbox, "cas");
    const store = await openArtifactStore({ root });
    const artifactInput = input({ bytes: encoder.encode("original") });
    const reference = await store.put(artifactInput);
    const payload = payloadPath(root, reference.casKey);
    await writeFile(payload, "tampered");

    await expectStoreError(store.read(reference), "ARTIFACT_INTEGRITY");
    await expectStoreError(store.put(artifactInput), "ARTIFACT_INTEGRITY");
    expect(await readFile(payload, "utf8")).toBe("tampered");
  });

  it("detects truncated and missing objects", async () => {
    const sandbox = await makeSandbox();
    const root = join(sandbox, "cas");
    const store = await openArtifactStore({ root });
    const reference = await store.put(input());

    await truncate(payloadPath(root, reference.casKey), 2);
    await expectStoreError(store.read(reference), "ARTIFACT_INTEGRITY");

    await rm(objectDirectory(root, reference.casKey), { recursive: true });
    await expectStoreError(store.read(reference), "ARTIFACT_MISSING");
  });

  it("enforces the configured byte cap without writing candidate bytes", async () => {
    const sandbox = await makeSandbox();
    const root = join(sandbox, "cas");
    const store = await openArtifactStore({ root, maxByteLength: 1 });
    const empty = await store.put(input({ artifactId: "empty", bytes: new Uint8Array() }));
    const small = new Uint8Array(1);
    const large = new Uint8Array(8);
    let byteReads = 0;
    const hostile = new Proxy(input({ artifactId: "snapshot", bytes: small }), {
      get(target, key, receiver) {
        if (key === "bytes") return ++byteReads <= 2 ? small : large;
        return Reflect.get(target, key, receiver);
      },
    });
    const misleadingBytes = new Uint8Array(8);
    Object.defineProperties(misleadingBytes, {
      byteLength: { get: () => 1 },
      length: { get: () => 8 },
    });

    const snapshotted = await store.put(hostile);
    await expectStoreError(store.put(input({ bytes: new Uint8Array(2) })), "ARTIFACT_TOO_LARGE");
    await expectStoreError(store.put(input({ bytes: misleadingBytes })), "ARTIFACT_TOO_LARGE");
    expect(empty.byteLength).toBe(0);
    expect(await store.read(empty)).toEqual(new Uint8Array());
    expect(snapshotted.byteLength).toBe(1);
    expect(await store.read(snapshotted)).toEqual(small);
    expect(byteReads).toBe(0);
    expect(ARTIFACT_POLICY).toMatchObject({
      maxByteLength: 64 * 1024 * 1024,
      maxInFlightByteLength: 128 * 1024 * 1024,
      maxConcurrentOperations: 8,
      maxQueuedOperations: 32,
    });
    expect((await descendantNames(root)).some((name) => name.includes(".tmp"))).toBe(false);
  });

  it("rejects hostile or out-of-policy metadata instead of turning it into a path", async () => {
    const sandbox = await makeSandbox();
    const root = join(sandbox, "cas");
    const store = await openArtifactStore({ root });
    const hostileInputs = [
      { ...input(), artifactId: "../escape" },
      { ...input(), artifactId: "a".repeat(129) },
      { ...input(), kind: "../../source" },
      { ...input(), mediaType: "text/plain;../../escape" },
      { ...input(), mediaType: `text/${"a".repeat(124)}` },
      { ...input(), path: join(sandbox, "escape") },
      { ...input(), bytes: new Proxy(new Uint8Array(1), {}) },
      new Proxy(input(), {
        ownKeys() {
          throw new Error("hostile metadata reflection");
        },
      }),
    ];

    for (const hostile of hostileInputs) {
      await expectStoreError(store.put(hostile as never), "INVALID_METADATA");
    }
    await expectStoreError(
      store.read({
        artifactId: "artifact-1",
        kind: "source",
        mediaType: "text/plain",
        sha256: `sha256:${"0".repeat(64)}`,
        byteLength: 0,
        casKey: "sha256:../../escape",
      } as never),
      "INVALID_METADATA",
    );
    await expect(lstat(join(sandbox, "escape"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects symlinked roots and internal object-directory escapes", async () => {
    const sandbox = await makeSandbox();
    const externalRoot = join(sandbox, "external-root");
    const linkedRoot = join(sandbox, "linked-root");
    await mkdir(externalRoot);
    await symlink(externalRoot, linkedRoot, process.platform === "win32" ? "junction" : "dir");
    await expectStoreError(openArtifactStore({ root: linkedRoot }), "UNSAFE_PATH");

    const root = join(sandbox, "cas");
    const store = await openArtifactStore({ root });
    const reference = await store.put(input());
    const finalDirectory = objectDirectory(root, reference.casKey);
    const externalObject = join(sandbox, "external-object");
    await mkdir(externalObject);
    await writeFile(join(externalObject, "payload"), "brick evidence");
    await rm(finalDirectory, { recursive: true });
    await symlink(
      externalObject,
      finalDirectory,
      process.platform === "win32" ? "junction" : "dir",
    );

    await expectStoreError(store.read(reference), "UNSAFE_PATH");

    const shard = dirname(finalDirectory);
    const externalShard = join(sandbox, "external-shard");
    await rm(shard, { recursive: true });
    await mkdir(externalShard);
    await symlink(externalShard, shard, process.platform === "win32" ? "junction" : "dir");
    await expectStoreError(store.read(reference), "UNSAFE_PATH");
  });

  it("cleans staged files when atomic finalization fails", async () => {
    const sandbox = await makeSandbox();
    const root = join(sandbox, "cas");
    let failFinalization = false;
    const store = await openArtifactStoreForTesting({ root }, async (from, to) => {
      if (failFinalization && /^[0-9a-f]{64}$/.test(basename(to))) {
        throw Object.assign(new Error("injected rename failure"), { code: "EIO" });
      }
      await rename(from, to);
    });
    failFinalization = true;

    await expectStoreError(store.put(input()), "FINALIZATION_FAILED");
    expect((await descendantNames(root)).some((name) => name.includes(".tmp"))).toBe(false);
    failFinalization = false;
    expect(await store.put(input())).toMatchObject({ artifactId: "artifact-1" });
  });
});
