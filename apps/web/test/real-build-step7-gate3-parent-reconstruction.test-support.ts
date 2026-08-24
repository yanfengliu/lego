import { PART_DEFINITIONS } from "@lego-studio/catalog";
import {
  applyBuildOperations,
  canonicalDigest,
  createEmptyBrickDocument,
  documentStructuralHash,
  migrateDocumentTruth,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { createPlacePartTransaction } from "../src/manual-commands";
import { applyReviewedAdditiveLegacyBuildOperations } from "../e2e/real-build-reviewed-additive-legacy-operations";
import {
  reconstructStep7Gate3ParentsAgainstCallerPins,
  type Step7Gate3ParentMigrationPin,
  type Step7Gate3ParentOrigin,
} from "../e2e/real-build-step7-gate3-parent-reconstruction";

const ADDED_AFTER_13 = new Set([
  "builtin:tile-1x1-quarter-round",
  "builtin:bracket-1x2-1x4-rounded-bottom",
  "builtin:tile-2x2-triangular",
  "builtin:roller-skate",
  "builtin:arch-1x6-thin-top",
  "builtin:bracket-2x2-1x2-vertical-studs",
  "builtin:brick-1x2-grille",
  "builtin:slope-1x2-45",
  "builtin:axle-1x3",
  "builtin:technic-brick-1x2-axle-hole",
]);
const compareStrings = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export const SYNTHETIC_PARENT_MIGRATIONS = [
  {
    sourceDocumentHash: "sha256:550741e43f99fc0f93b3bdd76f2122f201958768b344b7c48c56bdfa74576c16",
    currentDocumentHash: "sha256:9760b650673c89b4edb445cafdce1df7ab54ee48e42129a259183542c56d6692",
  },
  {
    sourceDocumentHash: "sha256:754d1af102f30708241201d51f7101429545116c8ba8bafdd7787e4940763cbb",
    currentDocumentHash: "sha256:887dbb18da017ff4bfd5d9a1b1e63efeadf4ac7b80989af33003b62428b178f7",
  },
  {
    sourceDocumentHash: "sha256:c3a74e18fe2052f626ffe1aeb1a82c5f18ebb503c2b711184f39dc26e956ed6a",
    currentDocumentHash: "sha256:3eea35e613f45a9a3e47a0d9ae5b210ac6ad302ac0113288dc58cb2f63f1a793",
  },
  {
    sourceDocumentHash: "sha256:05c63816199829b436a995382878f66627881052e1d5e88ccd440230c1b1357c",
    currentDocumentHash: "sha256:29b5249032bf20d57c2b947297ccc555e3a0ee10b382653c9bc6c2f09568b68b",
  },
] as const satisfies readonly Step7Gate3ParentMigrationPin[];

export const SYNTHETIC_PARENT_PIECES = Array.from({ length: 4 }, (_parent, parentIndex) =>
  Array.from({ length: 4 }, (_piece, pieceIndex) => ({
    catalogPartId: "builtin:brick-2x2",
    colorId: "builtin:red",
    transform: {
      positionLdu: [parentIndex * 1000 + pieceIndex * 80, 0, 0] as const,
      orientationId: "upright-yaw-0",
    },
  })),
);

export function legacyThirteenDocument(): BrickDocumentV1 {
  const current = createEmptyBrickDocument({
    id: "reviewed-additive-legacy-operation",
    name: "Reviewed additive legacy operation",
  });
  return {
    ...current,
    truth: {
      schemaVersion: "lego.truth-snapshot/1",
      catalog: {
        id: "builtin.basic-parts",
        version: "builtin.basic-parts/13",
        hash: "sha256:100283423bf1cfecfdfec5ba2216d1834a9eb19b1757c71772f7fa53223190d6",
      },
      connectorTaxonomy: {
        id: "stud-tube",
        version: "stud-tube/1",
        hash: "sha256:57489cb5a3b5e1bf367984c2768318f151e19051d2b1b6ee3713a7e6ef53f6a2",
      },
      collisionModel: {
        id: "rectilinear-stud-clearance",
        version: "rectilinear-stud-clearance/2",
        hash: "sha256:a14d660a6b24a63326ab6c24865fc07ea59496b1cf48002cea83a4b615724edb",
      },
      transformPolicy: {
        id: "upright-quarter-turns-negative-y-up",
        version: "upright-quarter-turns-negative-y-up/1",
        hash: "sha256:0b440dad9403f63aa89496e0e129ef3cf5d78391565294cbde18e239ec66c7b6",
      },
      validatorSet: {
        id: "lego.kernel-validators",
        version: "lego.kernel-validators/2",
        hash: "sha256:cb2767cfa8c8d7adfe145bef950b49428d8c8fced235a04b5f984c29799a031e",
      },
    },
    constraints: {
      ...current.constraints,
      allowedCatalogPartIds: PART_DEFINITIONS.map(({ id }) => id)
        .filter((id) => !ADDED_AFTER_13.has(id))
        .sort(compareStrings),
      allowedColorIds: [...current.constraints.allowedColorIds].sort(compareStrings),
    },
  };
}

export function gate3Origins(): Step7Gate3ParentOrigin[] {
  return SYNTHETIC_PARENT_MIGRATIONS.map(({ sourceDocumentHash }, parentIndex) => ({
    candidateId: `step-006:${sourceDocumentHash}`,
    documentHash: sourceDocumentHash,
    pieces: structuredClone(SYNTHETIC_PARENT_PIECES[parentIndex]!),
  }));
}

export type MigrationMutation = (document: BrickDocumentV1) => BrickDocumentV1;
export type MigrationReportMutation = (report: Record<string, unknown>) => Record<string, unknown>;
export type HashPhase = "source" | "current";

function transparentReentrantProxy<T extends object>(value: T, attack: () => void): T {
  return new Proxy(value, {
    getPrototypeOf: (target) => {
      attack();
      return Reflect.getPrototypeOf(target);
    },
    ownKeys: (target) => {
      attack();
      return Reflect.ownKeys(target);
    },
    getOwnPropertyDescriptor: (target, key) => {
      attack();
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
}

function parentIndexFromDocument(document: BrickDocumentV1): number {
  const indices = new Set(
    document.parts.map(({ transform }) => Math.floor(transform.positionLdu[0] / 1000)),
  );
  if (indices.size !== 1) {
    throw new TypeError("Synthetic parent does not contain one structurally identifiable branch.");
  }
  return [...indices][0]!;
}

export function mutateMaxParts(document: BrickDocumentV1): void {
  Object.assign(document.constraints, { maxParts: document.constraints.maxParts + 1 });
}

function placeLegacyWitness(
  document: BrickDocumentV1,
  witness: Step7Gate3ParentOrigin["pieces"][number],
): { readonly document: BrickDocumentV1; readonly stepId: string } {
  const transaction = createPlacePartTransaction(document, witness);
  const placed = applyReviewedAdditiveLegacyBuildOperations(document, transaction.operations, {
    truthDigest: canonicalDigest,
    migrateDocumentTruth,
    applyBuildOperations: (active, operations) =>
      applyBuildOperations(active, operations as Parameters<typeof applyBuildOperations>[1]),
  });
  const placedPart = placed.parts.find(({ id }) => id === transaction.partId);
  if (placedPart === undefined)
    throw new TypeError("Synthetic placement did not add its real part.");
  return { document: placed, stepId: placedPart.stepId };
}

export function runGate3ParentReconstruction(
  options: {
    readonly baseDocument?: BrickDocumentV1;
    readonly mutateFirstMigration?: MigrationMutation;
    readonly mutateFirstMigrationReport?: MigrationReportMutation;
    readonly tamperCurrentHashIndex?: number;
    readonly mutateDetachedHashPhase?: HashPhase;
    readonly mutateAuthoritativeHashPhase?: HashPhase;
    readonly mutateEarlierAtFinalHash?: "document" | "report";
    readonly addUnreviewedReportField?: boolean;
    readonly mutateCallerOriginsAt?: "first-callback" | "last-callback";
    readonly attemptWitnessMutation?: boolean;
    readonly proxyMigrationResultIndex?: number;
    readonly proxyMigrationReportIndex?: number;
    readonly selfRemovingProxyMigrationReportIndex?: number;
    readonly onTransparentProxyTrap?: () => void;
    readonly poisonArrayPrimordialsAtLastCallback?: boolean;
  } = {},
) {
  const events: string[] = [];
  const sourceAuthorities: Array<BrickDocumentV1 | undefined> = [];
  const currentAuthorities: Array<BrickDocumentV1 | undefined> = [];
  const migrationReports: Array<Record<string, unknown> | undefined> = [];
  const callerOrigins = gate3Origins();
  let truthDigestCalls = 0;
  const originalEntriesDescriptor = Object.getOwnPropertyDescriptor(Array.prototype, "entries")!;
  const originalMapDescriptor = Object.getOwnPropertyDescriptor(Array.prototype, "map")!;
  const mutateCallerOrigins = (): void => {
    Object.assign(callerOrigins[0]!, { candidateId: "caller-mutated" });
    (callerOrigins[0]!.pieces[0]!.transform.positionLdu as unknown as number[])[0] = 999_999;
  };
  let result: ReturnType<typeof reconstructStep7Gate3ParentsAgainstCallerPins>;
  try {
    result = reconstructStep7Gate3ParentsAgainstCallerPins(
      {
        baseDocument: options.baseDocument ?? legacyThirteenDocument(),
        origins: callerOrigins,
        dependencies: {
          truthDigest: (truth) => {
            truthDigestCalls += 1;
            if (options.mutateCallerOriginsAt === "first-callback" && truthDigestCalls === 1) {
              mutateCallerOrigins();
            }
            return canonicalDigest(truth);
          },
          sourcePlace: (document, witness) => {
            const parentIndex = Math.floor(witness.transform.positionLdu[0] / 1000);
            events.push(`place:${parentIndex}`);
            if (options.attemptWitnessMutation) {
              try {
                (witness.transform.positionLdu as unknown as number[])[0] = 999_999;
              } catch {
                // Expected for the detached, deeply frozen callback witness.
              }
            }
            const placed = placeLegacyWitness(document, witness);
            if (placed.document.parts.length === 4)
              sourceAuthorities[parentIndex] = placed.document;
            return placed;
          },
          migrateDocumentTruth: (document) => {
            const parentIndex = parentIndexFromDocument(document);
            events.push(`final-migrate:${parentIndex}`);
            const migrated = migrateDocumentTruth(document);
            const migratedDocument =
              parentIndex === 0 && options.mutateFirstMigration !== undefined
                ? options.mutateFirstMigration(structuredClone(migrated.document))
                : migrated.document;
            const mutatedReport =
              parentIndex === 0 && options.mutateFirstMigrationReport !== undefined
                ? options.mutateFirstMigrationReport(
                    structuredClone(migrated.report) as unknown as Record<string, unknown>,
                  )
                : migrated.report;
            let observed = options.addUnreviewedReportField
              ? {
                  document: migratedDocument,
                  report: { ...mutatedReport, unreviewedAuthority: true },
                }
              : { document: migratedDocument, report: mutatedReport };
            const proxyAttack = (): void => {
              options.onTransparentProxyTrap?.();
              const earlier = currentAuthorities[0];
              if (parentIndex > 0 && earlier !== undefined) mutateMaxParts(earlier);
            };
            if (options.selfRemovingProxyMigrationReportIndex === parentIndex) {
              const plainReport = observed.report;
              observed = {
                ...observed,
                report: transparentReentrantProxy(plainReport, () => {
                  proxyAttack();
                  observed.report = plainReport;
                }),
              };
            } else if (options.proxyMigrationReportIndex === parentIndex) {
              observed = {
                ...observed,
                report: transparentReentrantProxy(observed.report, proxyAttack),
              };
            }
            currentAuthorities[parentIndex] = observed.document;
            migrationReports[parentIndex] = observed.report as unknown as Record<string, unknown>;
            return (
              options.proxyMigrationResultIndex === parentIndex
                ? transparentReentrantProxy(observed, proxyAttack)
                : observed
            ) as ReturnType<typeof migrateDocumentTruth>;
          },
          documentStructuralHash: (document) => {
            const parentIndex = parentIndexFromDocument(document);
            const phase: HashPhase =
              document.truth.catalog.version === "builtin.basic-parts/23" ? "current" : "source";
            events.push(`hash:${phase}:${parentIndex}`);
            const measured = documentStructuralHash(document);
            if (options.mutateDetachedHashPhase === phase) mutateMaxParts(document);
            if (options.mutateAuthoritativeHashPhase === phase) {
              const authoritative =
                phase === "source"
                  ? sourceAuthorities[parentIndex]
                  : currentAuthorities[parentIndex];
              if (authoritative === undefined) {
                throw new TypeError(`Synthetic ${phase} authority was not captured.`);
              }
              mutateMaxParts(authoritative);
            }
            if (phase === "current" && parentIndex === 3) {
              if (options.mutateCallerOriginsAt === "last-callback") mutateCallerOrigins();
              if (options.mutateEarlierAtFinalHash === "document") {
                mutateMaxParts(currentAuthorities[0]!);
              } else if (options.mutateEarlierAtFinalHash === "report") {
                Object.assign(migrationReports[0]!, { migrated: false });
              }
              if (options.poisonArrayPrimordialsAtLastCallback) {
                const refusePoisonedCall = (): never => {
                  throw new TypeError(
                    "poisoned Array primordial was invoked after callback return",
                  );
                };
                Object.defineProperty(Array.prototype, "entries", {
                  ...originalEntriesDescriptor,
                  value: refusePoisonedCall,
                });
                Object.defineProperty(Array.prototype, "map", {
                  ...originalMapDescriptor,
                  value: refusePoisonedCall,
                });
              }
            }
            if (phase === "current" && options.tamperCurrentHashIndex === parentIndex) {
              return `sha256:${"0".repeat(64)}`;
            }
            return measured;
          },
        },
      },
      SYNTHETIC_PARENT_MIGRATIONS,
    );
  } finally {
    Object.defineProperty(Array.prototype, "entries", originalEntriesDescriptor);
    Object.defineProperty(Array.prototype, "map", originalMapDescriptor);
  }
  return { result, events, currentAuthorities, migrationReports, callerOrigins };
}
