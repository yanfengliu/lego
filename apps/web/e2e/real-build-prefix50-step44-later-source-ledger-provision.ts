import { createHash } from "node:crypto";
import { join } from "node:path";

import {
  captureRealBuildPrefix50Step44LaterSourceRepositoryIdentity,
  createRealBuildPrefix50Step44LaterSourceLedgerDirectory,
  createRealBuildPrefix50Step44LaterSourceSecureDirectory,
  readRealBuildPrefix50Step44LaterSourceLedgerFile,
  realBuildPrefix50Step44LaterSourceLedgerPathExists,
  realBuildPrefix50Step44LaterSourceLedgerPaths,
  requireRealBuildPrefix50Step44LaterSourceLedgerDirectory,
  writeRealBuildPrefix50Step44LaterSourceLedgerFileAtomic,
  type RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver,
  type RealBuildPrefix50Step44LaterSourceRepositoryIdentity,
} from "./real-build-prefix50-step44-later-source-ledger-files.ts";
import { runRealBuildPrefix50Step44LaterSourceLedgerClosed } from "./real-build-prefix50-step44-later-source-ledger-errors.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_SHA256,
  requireRealBuildPrefix50Step44LaterSourceExactKeys,
  type RealBuildPrefix50Step44LaterSourceLedgerState,
} from "./real-build-prefix50-step44-later-source-ledger-model.ts";
import {
  createRealBuildPrefix50Step44LaterSourceLedgerKey,
  openRealBuildPrefix50Step44LaterSourceLedgerKey,
  openRealBuildPrefix50Step44LaterSourceLedgerValue,
} from "./real-build-prefix50-step44-later-source-ledger-seal.ts";
import {
  requireRealBuildPrefix50Step44LaterSourceRepositoryIdentity,
  writeRealBuildPrefix50Step44LaterSourceSealed,
} from "./real-build-prefix50-step44-later-source-ledger-storage.ts";

interface RepositoryGenesisPaths {
  readonly stateParent: string;
  readonly directory: string;
  readonly marker: string;
  readonly key: string;
}

interface OpenRepositoryGenesis {
  readonly identity: RealBuildPrefix50Step44LaterSourceRepositoryIdentity;
  readonly paths: RepositoryGenesisPaths;
  readonly key: Buffer;
  readonly keyCommitment: `sha256:${string}`;
}

type RepositoryGenesisEventKind = "issue" | "burn" | "completion";

const NOOP: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver = () => {};
const PATH_SEED = "sha256:0000000000000000000000000000000000000000000000000000000000000000";

function genesisPaths(
  identity: RealBuildPrefix50Step44LaterSourceRepositoryIdentity,
  observer: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver,
): RepositoryGenesisPaths {
  const { stateParent } = realBuildPrefix50Step44LaterSourceLedgerPaths(
    identity,
    PATH_SEED,
    observer,
  );
  const directory = join(stateParent, "step44-later-source-ledger-v2-genesis");
  return Object.freeze({
    stateParent,
    directory,
    marker: join(stateParent, "step44-later-source-ledger-v2-genesis.anchor"),
    key: join(directory, "key.sealed.json"),
  });
}

function reservationPath(
  genesis: RepositoryGenesisPaths,
  qualificationCommitment: `sha256:${string}`,
): string {
  const key = createHash("sha256")
    .update("lego-step44-later-source-qualification-reservation-v2\0")
    .update(qualificationCommitment)
    .digest("hex");
  return join(genesis.directory, `qualification-${key}.reserved.sealed.json`);
}

function eventPath(
  genesis: RepositoryGenesisPaths,
  input: Readonly<{
    qualificationCommitment: `sha256:${string}`;
    claimCommitment: `sha256:${string}`;
    eventKind: RepositoryGenesisEventKind;
  }>,
): string {
  const key = createHash("sha256")
    .update("lego-step44-later-source-repository-event-v2\0")
    .update(input.qualificationCommitment)
    .update("\0")
    .update(input.claimCommitment)
    .update("\0")
    .update(input.eventKind)
    .digest("hex");
  return join(genesis.directory, `authority-${key}.${input.eventKind}.sealed.json`);
}

function openRepositoryGenesis(repositoryRoot: string): OpenRepositoryGenesis {
  const identity = captureRealBuildPrefix50Step44LaterSourceRepositoryIdentity(repositoryRoot);
  const paths = genesisPaths(identity, NOOP);
  if (
    !realBuildPrefix50Step44LaterSourceLedgerPathExists(paths.marker) ||
    !realBuildPrefix50Step44LaterSourceLedgerPathExists(paths.directory)
  )
    throw new TypeError(
      "Later-source repository genesis is not preprovisioned; qualification remains closed.",
    );
  requireRealBuildPrefix50Step44LaterSourceLedgerDirectory(paths.directory);
  const material = openRealBuildPrefix50Step44LaterSourceLedgerKey(
    readRealBuildPrefix50Step44LaterSourceLedgerFile(
      paths.key,
      "later-source repository genesis key",
    ),
    identity.commitment,
  );
  try {
    const anchor = openRealBuildPrefix50Step44LaterSourceLedgerValue(
      readRealBuildPrefix50Step44LaterSourceLedgerFile(
        paths.marker,
        "later-source repository genesis anchor",
      ),
      material.key,
    );
    if (
      anchor === null ||
      typeof anchor !== "object" ||
      Array.isArray(anchor) ||
      Object.keys(anchor).sort().join("\n") !==
        "keyCommitment\nrepositoryIdentityCommitment\nschemaVersion" ||
      (anchor as Record<string, unknown>).schemaVersion !==
        "lego.real-build-prefix50-step44-later-source-repository-genesis/2" ||
      (anchor as Record<string, unknown>).repositoryIdentityCommitment !== identity.commitment ||
      (anchor as Record<string, unknown>).keyCommitment !== material.keyCommitment
    )
      throw new TypeError("Later-source repository genesis anchor binding changed.");
    requireRealBuildPrefix50Step44LaterSourceRepositoryIdentity(identity);
    return { identity, paths, key: material.key, keyCommitment: material.keyCommitment };
  } catch (error) {
    material.key.fill(0);
    throw error;
  }
}

function requireQualificationReservation(
  genesis: OpenRepositoryGenesis,
  qualificationCommitment: `sha256:${string}`,
): void {
  const value = openRealBuildPrefix50Step44LaterSourceLedgerValue(
    readRealBuildPrefix50Step44LaterSourceLedgerFile(
      reservationPath(genesis.paths, qualificationCommitment),
      "later-source qualification reservation",
    ),
    genesis.key,
  );
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Later-source qualification reservation is invalid.");
  requireRealBuildPrefix50Step44LaterSourceExactKeys(
    value,
    ["schemaVersion", "repositoryIdentityCommitment", "qualificationCommitment"],
    "Later-source qualification reservation",
  );
  const record = value as Record<string, unknown>;
  if (
    record.schemaVersion !== "lego.real-build-prefix50-step44-later-source-reservation/2" ||
    record.repositoryIdentityCommitment !== genesis.identity.commitment ||
    record.qualificationCommitment !== qualificationCommitment
  )
    throw new TypeError("Later-source qualification reservation binding changed.");
}

export function realBuildPrefix50Step44LaterSourceRepositoryGenesisArtifacts(input: {
  readonly repositoryRoot: string;
  readonly qualificationCommitment?: `sha256:${string}`;
}): Readonly<RepositoryGenesisPaths & { reservation?: string }> {
  return runRealBuildPrefix50Step44LaterSourceLedgerClosed(() => {
    const identity = captureRealBuildPrefix50Step44LaterSourceRepositoryIdentity(
      input.repositoryRoot,
    );
    const paths = genesisPaths(identity, NOOP);
    return Object.freeze({
      ...paths,
      ...(input.qualificationCommitment === undefined
        ? {}
        : { reservation: reservationPath(paths, input.qualificationCommitment) }),
    });
  });
}

export function requireRealBuildPrefix50Step44LaterSourceQualificationReservation(input: {
  readonly repositoryRoot: string;
  readonly qualificationCommitment: `sha256:${string}`;
  readonly expectedRepositoryIdentityCommitment: `sha256:${string}`;
}): void {
  return runRealBuildPrefix50Step44LaterSourceLedgerClosed(() => {
    if (
      !REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_SHA256.test(input.qualificationCommitment) ||
      !REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_SHA256.test(
        input.expectedRepositoryIdentityCommitment,
      )
    )
      throw new TypeError("Later-source repository genesis binding is invalid.");
    const genesis = openRepositoryGenesis(input.repositoryRoot);
    try {
      if (genesis.identity.commitment !== input.expectedRepositoryIdentityCommitment)
        throw new TypeError("Later-source repository genesis identity changed.");
      requireQualificationReservation(genesis, input.qualificationCommitment);
    } finally {
      genesis.key.fill(0);
    }
  });
}

export function recordRealBuildPrefix50Step44LaterSourceRepositoryEvent(input: {
  readonly repositoryRoot: string;
  readonly qualificationCommitment: `sha256:${string}`;
  readonly expectedRepositoryIdentityCommitment: `sha256:${string}`;
  readonly claimCommitment: `sha256:${string}`;
  readonly eventKind: RepositoryGenesisEventKind;
  readonly eventCommitment: `sha256:${string}`;
  readonly observer?: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver;
}): void {
  return runRealBuildPrefix50Step44LaterSourceLedgerClosed(() => {
    if (
      !REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_SHA256.test(input.qualificationCommitment) ||
      !REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_SHA256.test(
        input.expectedRepositoryIdentityCommitment,
      ) ||
      !REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_SHA256.test(input.claimCommitment) ||
      !REAL_BUILD_PREFIX50_STEP44_LATER_SOURCE_SHA256.test(input.eventCommitment) ||
      !["issue", "burn", "completion"].includes(input.eventKind)
    )
      throw new TypeError("Later-source repository event binding is invalid.");
    const genesis = openRepositoryGenesis(input.repositoryRoot);
    try {
      if (genesis.identity.commitment !== input.expectedRepositoryIdentityCommitment)
        throw new TypeError("Later-source repository genesis identity changed.");
      requireQualificationReservation(genesis, input.qualificationCommitment);
      const path = eventPath(genesis.paths, input);
      if (realBuildPrefix50Step44LaterSourceLedgerPathExists(path))
        throw new TypeError(`Later-source repository ${input.eventKind} is already recorded.`);
      writeRealBuildPrefix50Step44LaterSourceSealed({
        path,
        value: {
          schemaVersion: "lego.real-build-prefix50-step44-later-source-repository-event/2",
          repositoryIdentityCommitment: genesis.identity.commitment,
          qualificationCommitment: input.qualificationCommitment,
          claimCommitment: input.claimCommitment,
          eventKind: input.eventKind,
          eventCommitment: input.eventCommitment,
        },
        key: genesis.key,
        observer: input.observer ?? NOOP,
        boundary: `later-source repository ${input.eventKind}`,
        replace: false,
      });
      requireQualificationReservation(genesis, input.qualificationCommitment);
      requireRealBuildPrefix50Step44LaterSourceRepositoryIdentity(genesis.identity);
    } finally {
      genesis.key.fill(0);
    }
  });
}

export function provisionRealBuildPrefix50Step44LaterSourceRepositoryGenesis(input: {
  readonly repositoryRoot: string;
  readonly observer?: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver;
}): void {
  return runRealBuildPrefix50Step44LaterSourceLedgerClosed(() => {
    const observer = input.observer ?? NOOP;
    const identity = captureRealBuildPrefix50Step44LaterSourceRepositoryIdentity(
      input.repositoryRoot,
    );
    const paths = genesisPaths(identity, observer);
    if (
      realBuildPrefix50Step44LaterSourceLedgerPathExists(paths.marker) ||
      realBuildPrefix50Step44LaterSourceLedgerPathExists(paths.directory)
    )
      throw new TypeError("Later-source repository genesis is already provisioned or incomplete.");
    createRealBuildPrefix50Step44LaterSourceSecureDirectory(paths.directory, observer);
    const created = createRealBuildPrefix50Step44LaterSourceLedgerKey({
      repositoryIdentityCommitment: identity.commitment,
    });
    try {
      writeRealBuildPrefix50Step44LaterSourceLedgerFileAtomic({
        path: paths.key,
        bytes: created.bytes,
        observer,
        boundary: "later-source repository genesis key",
        replace: false,
      });
      writeRealBuildPrefix50Step44LaterSourceSealed({
        path: paths.marker,
        value: {
          schemaVersion: "lego.real-build-prefix50-step44-later-source-repository-genesis/2",
          repositoryIdentityCommitment: identity.commitment,
          keyCommitment: created.material.keyCommitment,
        },
        key: created.material.key,
        observer,
        boundary: "later-source repository genesis anchor",
        replace: false,
        exactParentMode: false,
      });
      requireRealBuildPrefix50Step44LaterSourceRepositoryIdentity(identity);
    } finally {
      created.material.key.fill(0);
    }
  });
}

export function provisionRealBuildPrefix50Step44LaterSourceQualificationGenesis(input: {
  readonly repositoryRoot: string;
  readonly qualificationCommitment: `sha256:${string}`;
  readonly observer?: RealBuildPrefix50Step44LaterSourceLedgerBoundaryObserver;
}): void {
  return runRealBuildPrefix50Step44LaterSourceLedgerClosed(() => {
    const observer = input.observer ?? NOOP;
    const genesis = openRepositoryGenesis(input.repositoryRoot);
    const paths = realBuildPrefix50Step44LaterSourceLedgerPaths(
      genesis.identity,
      input.qualificationCommitment,
      observer,
    );
    const reservation = reservationPath(genesis.paths, input.qualificationCommitment);
    try {
      if (
        realBuildPrefix50Step44LaterSourceLedgerPathExists(reservation) ||
        realBuildPrefix50Step44LaterSourceLedgerPathExists(paths.marker) ||
        realBuildPrefix50Step44LaterSourceLedgerPathExists(paths.ledgerDirectory)
      )
        throw new TypeError(
          "Later-source qualification genesis is already reserved or incomplete.",
        );
      writeRealBuildPrefix50Step44LaterSourceSealed({
        path: reservation,
        value: {
          schemaVersion: "lego.real-build-prefix50-step44-later-source-reservation/2",
          repositoryIdentityCommitment: genesis.identity.commitment,
          qualificationCommitment: input.qualificationCommitment,
        },
        key: genesis.key,
        observer,
        boundary: "later-source qualification reservation",
        replace: false,
      });
      createRealBuildPrefix50Step44LaterSourceLedgerDirectory(paths, observer);
      const created = createRealBuildPrefix50Step44LaterSourceLedgerKey({
        repositoryIdentityCommitment: genesis.identity.commitment,
      });
      const state: RealBuildPrefix50Step44LaterSourceLedgerState = Object.freeze({
        schemaVersion: "lego.real-build-prefix50-step44-later-source-ledger-state/2",
        namespaceCommitment: paths.namespaceCommitment,
        repositoryIdentityCommitment: genesis.identity.commitment,
        qualificationCommitment: input.qualificationCommitment,
        revision: 0,
        entries: Object.freeze({}),
      });
      try {
        writeRealBuildPrefix50Step44LaterSourceLedgerFileAtomic({
          path: paths.key,
          bytes: created.bytes,
          observer,
          boundary: "later-source qualification key",
          replace: false,
        });
        writeRealBuildPrefix50Step44LaterSourceSealed({
          path: paths.marker,
          value: {
            schemaVersion: "lego.real-build-prefix50-step44-later-source-ledger-anchor/2",
            namespaceCommitment: paths.namespaceCommitment,
            repositoryIdentityCommitment: genesis.identity.commitment,
            qualificationCommitment: input.qualificationCommitment,
            keyCommitment: created.material.keyCommitment,
          },
          key: created.material.key,
          observer,
          boundary: "later-source qualification anchor",
          replace: false,
          exactParentMode: false,
        });
        writeRealBuildPrefix50Step44LaterSourceSealed({
          path: paths.state,
          value: state,
          key: created.material.key,
          observer,
          boundary: "later-source qualification initial-state",
          replace: false,
        });
        requireRealBuildPrefix50Step44LaterSourceRepositoryIdentity(genesis.identity);
      } finally {
        created.material.key.fill(0);
      }
    } finally {
      genesis.key.fill(0);
    }
  });
}
