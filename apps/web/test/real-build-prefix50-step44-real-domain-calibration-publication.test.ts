import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { afterAll, describe, expect, it, vi } from "vitest";

import type { RealBuildPrefix50Step44CameraOnlyLiveSourceLock } from "../e2e/real-build-prefix50-step44-camera-only-source-lock.ts";
import { RealBuildPrefix50Step44VerifiedRealDomainRefusalError } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-gate.ts";
import type {
  PersistedRefusalManifest,
  RealBuildPrefix50Step44VerifiedRealDomainRefusal,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-gate-evidence.ts";
import type { RealBuildPrefix50Step44RealDomainCalibrationSession } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts";
import type { RealBuildPrefix50Step42SourceGeometryAdmission } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-step42-admission.ts";
import type { RealBuildPrefix50Step44ProductionMaterials } from "../e2e/real-build-prefix50-subbuild-return-review-production-materials.ts";
import { completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication } from "../e2e/real-build-prefix50-step44-calibration-directory-transaction.ts";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT } from "../e2e/real-build-prefix50-subbuild-return-review-harness-input.ts";
import {
  RealBuildPrefix50Step44CalibrationPublicationFailureError,
  realBuildPrefix50Step44CalibrationPublicationTestOnly,
} from "../e2e/real-build-prefix50-step44-real-domain-calibration-publication.ts";

type ProductionDependencies =
  typeof realBuildPrefix50Step44CalibrationPublicationTestOnly.productionDependencies;
type GateResult = Awaited<ReturnType<ProductionDependencies["runGate"]>>;

const gateProofBrands = vi.hoisted(() => new WeakSet<object>());
vi.mock("../e2e/real-build-prefix50-step44-calibration-publication-proof.ts", () => ({
  reassertRealBuildPrefix50Step44CalibrationDirectoryPublicationProof(input: {
    publicationProof: { kind: "qualification" | "refusal"; proof: object };
  }) {
    if (!gateProofBrands.has(input.publicationProof.proof))
      throw new TypeError("Calibration publication requires its exact verified gate proof.");
    const refusal = input.publicationProof.kind === "refusal";
    return Object.freeze({
      evidenceStatus: refusal ? "calibration-refused" : "qualified-and-validated",
      persistedCaseCount: refusal ? 2 : 3,
      proofCommitment: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      persistedManifestCommitment:
        "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      evidenceTreeCommitment:
        "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    });
  },
}));

const suffix = `${process.pid}-${Date.now()}`;
const outputs = [
  resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, `calibration-failure-${suffix}`),
  resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, `calibration-race-${suffix}`),
  resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, `calibration-success-${suffix}`),
  resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, `calibration-refusal-${suffix}`),
  resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, `calibration-rollback-${suffix}`),
];
const retainedPaths: string[] = [];
const transactionArtifacts: string[] = [];
const sourceLock = Object.freeze({}) as RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
const sourceGeometryAdmission = Object.freeze({}) as RealBuildPrefix50Step42SourceGeometryAdmission;
const materials = Object.freeze({
  sourceGeometryAdmission,
}) as RealBuildPrefix50Step44ProductionMaterials;
const qualificationManifest = Object.freeze({}) as GateResult["manifest"];
const proof = Object.freeze({}) as GateResult["proof"];
const calibrationSession = Object.freeze({}) as GateResult["calibrationSession"];
const refusalManifest = Object.freeze({
  status: "calibration-refused",
  commitment: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
}) as unknown as PersistedRefusalManifest;
const refusalProof = Object.freeze({}) as RealBuildPrefix50Step44VerifiedRealDomainRefusal;
const refusalSession = Object.freeze({}) as RealBuildPrefix50Step44RealDomainCalibrationSession;
gateProofBrands.add(proof);
gateProofBrands.add(refusalProof);

function dependencies(overrides: Partial<ProductionDependencies>): ProductionDependencies {
  const runGate = overrides.runGate;
  return Object.freeze({
    ...realBuildPrefix50Step44CalibrationPublicationTestOnly.productionDependencies,
    requireIndependentCameraBranch: () => undefined,
    captureSourceLock: () => sourceLock,
    requireSourceLock: (value: RealBuildPrefix50Step44CameraOnlyLiveSourceLock) => value,
    rederiveMaterials: async () => materials,
    beginTransaction: async (
      publication: Parameters<ProductionDependencies["beginTransaction"]>[0],
    ) => {
      const transaction =
        await realBuildPrefix50Step44CalibrationPublicationTestOnly.productionDependencies.beginTransaction(
          publication,
        );
      transactionArtifacts.push(
        transaction.stagingOutputPath,
        transaction.stagingPublicationMarkerPath,
        transaction.finalPublicationMarkerPath,
        transaction.retainedPublicationMarkerPath,
      );
      return transaction;
    },
    assertGateOutputTree: async () => undefined,
    requireQualification: () => qualificationManifest,
    requireRefusal: () => refusalManifest,
    ...overrides,
    ...(runGate === undefined
      ? {}
      : {
          runGate: async (input: Parameters<ProductionDependencies["runGate"]>[0]) => {
            expect(input.sourceGeometryAdmission).toBe(sourceGeometryAdmission);
            return runGate(input);
          },
        }),
  });
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

afterAll(async () => {
  for (const path of [...outputs, ...retainedPaths])
    await rm(path, { recursive: true, force: true });
  for (const path of outputs.map((output) => `${output}.publication.json`))
    await rm(path, { force: true });
  for (const path of transactionArtifacts) await rm(path, { recursive: true, force: true });
});

describe("page44 real-domain private-staging publication", () => {
  // Bound: missing independent camera evidence refuses before expensive material
  // reproduction, source raster access, or any staging directory is created.
  it("checks the real independent-branch prerequisite before rebuilding materials", async () => {
    const rederiveMaterials = vi.fn(async () => {
      throw new Error("preflight skipped: synthetic heavy-material sentinel");
    });
    const preparePublication = vi.fn();
    const runGate = vi.fn();
    await expect(
      realBuildPrefix50Step44CalibrationPublicationTestOnly.execute(
        { repositoryRoot: resolve("."), outputPath: outputs[0]! },
        dependencies({
          requireIndependentCameraBranch:
            realBuildPrefix50Step44CalibrationPublicationTestOnly.productionDependencies
              .requireIndependentCameraBranch,
          rederiveMaterials,
          preparePublication,
          runGate,
        }),
      ),
    ).rejects.toThrow("independent signed branch commitment is available");
    expect(rederiveMaterials).not.toHaveBeenCalled();
    expect(preparePublication).not.toHaveBeenCalled();
    expect(runGate).not.toHaveBeenCalled();
  });

  it("keeps final absent on preflight and post-write failures without deleting any staging byte", async () => {
    const outputPath = outputs[0]!;
    await expect(
      realBuildPrefix50Step44CalibrationPublicationTestOnly.execute(
        { repositoryRoot: resolve("."), outputPath },
        dependencies({
          rederiveMaterials: async () => {
            throw new TypeError("injected pinned batch mismatch");
          },
        }),
      ),
    ).rejects.toThrow("injected pinned batch mismatch");
    expect(await exists(outputPath)).toBe(false);

    const displacedPath = `${outputPath}-displaced`;
    const failure = await realBuildPrefix50Step44CalibrationPublicationTestOnly
      .execute(
        { repositoryRoot: resolve("."), outputPath },
        dependencies({
          runGate: async ({ outputPath: stagingPath }) => {
            await writeFile(
              resolve(stagingPath, "real-domain-camera-gate.json"),
              "foreign expected",
            );
            await writeFile(resolve(stagingPath, "unexpected.foreign"), "foreign unexpected");
            await expect(rename(stagingPath, displacedPath)).rejects.toMatchObject({
              code: expect.stringMatching(/^(?:EACCES|EBUSY|EPERM)$/u),
            });
            throw new TypeError("injected private-staging failure");
          },
        }),
      )
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(RealBuildPrefix50Step44CalibrationPublicationFailureError);
    const retainedPath = (failure as RealBuildPrefix50Step44CalibrationPublicationFailureError)
      .retainedPath!;
    retainedPaths.push(retainedPath);
    expect(await exists(outputPath)).toBe(false);
    expect(await exists(displacedPath)).toBe(false);
    expect(await readFile(resolve(retainedPath, "real-domain-camera-gate.json"), "utf8")).toBe(
      "foreign expected",
    );
    expect(await readFile(resolve(retainedPath, "unexpected.foreign"), "utf8")).toBe(
      "foreign unexpected",
    );
  });

  it("atomically refuses a concurrent final claimant and preserves both identities", async () => {
    const outputPath = outputs[1]!;
    const failure = await realBuildPrefix50Step44CalibrationPublicationTestOnly
      .execute(
        { repositoryRoot: resolve("."), outputPath },
        dependencies({
          runGate: async ({ outputPath: stagingPath }) => {
            await writeFile(resolve(stagingPath, "complete.bin"), "task bytes");
            await mkdir(outputPath);
            await writeFile(resolve(outputPath, "owner.txt"), "other claimant");
            return {
              outputPath: stagingPath,
              proof,
              manifest: qualificationManifest,
              calibrationSession,
            };
          },
        }),
      )
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(RealBuildPrefix50Step44CalibrationPublicationFailureError);
    const retainedPath = (failure as RealBuildPrefix50Step44CalibrationPublicationFailureError)
      .retainedPath!;
    retainedPaths.push(retainedPath);
    expect(await readFile(resolve(outputPath, "owner.txt"), "utf8")).toBe("other claimant");
    expect(await readFile(resolve(retainedPath, "complete.bin"), "utf8")).toBe("task bytes");
  });

  it("publishes one complete staging identity and returns the final logical path", async () => {
    const outputPath = outputs[2]!;
    const result = await realBuildPrefix50Step44CalibrationPublicationTestOnly.execute(
      { repositoryRoot: resolve("."), outputPath },
      dependencies({
        runGate: async ({ outputPath: stagingPath }) => {
          await writeFile(resolve(stagingPath, "complete.bin"), "complete bytes");
          return {
            outputPath: stagingPath,
            proof,
            manifest: qualificationManifest,
            calibrationSession,
          };
        },
      }),
    );
    expect(result.outputPath).toBe(resolve(outputPath));
    expect(await readFile(resolve(outputPath, "complete.bin"), "utf8")).toBe("complete bytes");
    await completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(
      result.committedPublication,
    );
  });

  it("publishes a complete verified refusal before exposing its final-path error", async () => {
    const outputPath = outputs[3]!;
    const error = await realBuildPrefix50Step44CalibrationPublicationTestOnly
      .execute(
        { repositoryRoot: resolve("."), outputPath },
        dependencies({
          runGate: async ({ outputPath: stagingPath }) => {
            await writeFile(resolve(stagingPath, "refusal.bin"), "counterevidence");
            throw new RealBuildPrefix50Step44VerifiedRealDomainRefusalError({
              outputPath: stagingPath,
              manifest: refusalManifest,
              proof: refusalProof,
              calibrationSession: refusalSession,
            });
          },
        }),
      )
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RealBuildPrefix50Step44VerifiedRealDomainRefusalError);
    expect((error as RealBuildPrefix50Step44VerifiedRealDomainRefusalError).outputPath).toBe(
      resolve(outputPath),
    );
    expect(await readFile(resolve(outputPath, "refusal.bin"), "utf8")).toBe("counterevidence");
  });

  it("rolls the exact final identity back if its last strict validation fails", async () => {
    const outputPath = outputs[4]!;
    const failure = await realBuildPrefix50Step44CalibrationPublicationTestOnly
      .execute(
        { repositoryRoot: resolve("."), outputPath },
        dependencies({
          runGate: async ({ outputPath: stagingPath }) => {
            await writeFile(resolve(stagingPath, "complete.bin"), "proved bytes");
            return {
              outputPath: stagingPath,
              proof,
              manifest: qualificationManifest,
              calibrationSession,
            };
          },
          assertGateOutputTree: async ({ outputPath: candidate }) => {
            const mutation = await writeFile(
              resolve(candidate, "raced.bin"),
              "same task final race",
            ).catch((caught: unknown) => caught);
            expect(mutation).toBeInstanceOf(Error);
            throw new TypeError("injected strict final validation failure");
          },
        }),
      )
      .catch((caught: unknown) => caught);
    expect(failure).toBeInstanceOf(RealBuildPrefix50Step44CalibrationPublicationFailureError);
    const retainedPath = (failure as RealBuildPrefix50Step44CalibrationPublicationFailureError)
      .retainedPath!;
    retainedPaths.push(retainedPath);
    expect(await exists(outputPath)).toBe(false);
    expect(await readFile(resolve(retainedPath, "complete.bin"), "utf8")).toBe("proved bytes");
    expect(await exists(resolve(retainedPath, "raced.bin"))).toBe(false);
  });
});
