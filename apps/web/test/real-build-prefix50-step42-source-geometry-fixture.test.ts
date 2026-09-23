import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { canonicalDigest } from "@lego-studio/brick-kernel";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  loadCurrentPrefix50Step42SourceGeometryFixture,
  requireStep42CatalogOrientationMutationRefusalForTest,
  rebuildStep42SourceGeometryWithCompositionDriftForTest,
} from "../../../scripts/part-identification-prefix50-verified-projection-step42-source-geometry-test-support.mjs";
import {
  readRealBuildPrefix50Step42ActionBinding,
  readRealBuildPrefix50Step42SourceGeometryReceipt,
} from "../e2e/real-build-prefix50-projection-step42";
import {
  admitRealBuildPrefix50Step42SourceGeometry,
  deriveRealBuildPrefix50Step42LocalTopology,
  requireRealBuildPrefix50Step42SourceGeometryAdmission,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-step42-admission";
import {
  REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING,
  REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING_COMMITMENT,
  REAL_BUILD_PREFIX50_STEP42_SEMANTIC_GEOMETRY_COMMITMENT,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-step42-binding";
import { reproduceRealBuildPrefix50Step42SourceGeometryAuthority } from "../e2e/real-build-prefix50-step42-source-geometry-reproduction";

function sha256File(path: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableJson((value as Record<string, unknown>)[key])]),
    );
  return value;
}

function independentStableDigest(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(stableJson(value)))
    .digest("hex")}`;
}

function withoutReceiptCommitment<T extends { readonly receiptCommitment: string }>(value: T) {
  const { receiptCommitment, ...body } = value;
  void receiptCommitment;
  return body;
}

function staticRelativeImportClosure(entry: string): ReadonlySet<string> {
  const visited = new Set<string>();
  const resolveRelativeModule = (from: string, specifier: string): string => {
    const base = resolve(dirname(from), specifier);
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.mts`,
      `${base}.tsx`,
      `${base}.js`,
      `${base}.mjs`,
      `${base}.cjs`,
      resolve(base, "index.ts"),
      resolve(base, "index.mts"),
      resolve(base, "index.tsx"),
      resolve(base, "index.js"),
      resolve(base, "index.mjs"),
      resolve(base, "index.cjs"),
    ];
    const resolved = candidates.find((candidate) => existsSync(candidate));
    if (resolved === undefined) {
      throw new Error(`Static import ${specifier} from ${from} did not resolve`);
    }
    return resolved;
  };
  const visit = (file: string): void => {
    const path = resolve(file);
    if (visited.has(path)) return;
    visited.add(path);
    const source = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const visitNode = (node: ts.Node): void => {
      let specifier: string | undefined;
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier))
        specifier = node.moduleSpecifier.text;
      else if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier !== undefined &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      )
        specifier = node.moduleSpecifier.text;
      else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteralLike(node.arguments[0]!)
      )
        specifier = node.arguments[0].text;
      if (specifier?.startsWith(".")) visit(resolveRelativeModule(path, specifier));
      ts.forEachChild(node, visitNode);
    };
    visitNode(source);
  };
  visit(entry);
  return visited;
}

describe("Step-42 camera geometry fixture admission", () => {
  it("admits every static field from a three-row opaque composition receipt", async () => {
    const fixture = await loadCurrentPrefix50Step42SourceGeometryFixture();
    const action = readRealBuildPrefix50Step42ActionBinding(fixture.reader);
    const receipt = readRealBuildPrefix50Step42SourceGeometryReceipt(fixture.reader);
    const expected = REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING;

    expect(action).toEqual({
      schemaVersion: "lego.real-build-prefix50-step42-action-binding/1",
      sourceSetId: expected.sourceSetId,
      actionPreparationDigest: expected.actionPreparationDigest,
      officialModelPhaseDigest: expected.officialModelPhaseDigest,
      sourcePdfDigest: expected.sourcePdfDigest,
      stepActionDigest: expected.stepActionDigest,
      printedStepNumber: expected.printedStepNumber,
      phaseSequence: expected.phaseSequence,
      phaseKind: expected.phaseKind,
      phaseId: expected.phaseId,
      phaseSourceDigest: expected.phaseSourceDigest,
      stepUuid: expected.stepUuid,
      subBuildPath: expected.subBuildPath,
      callout: expected.callout,
      members: expected.members.map(
        ({
          occurrenceOrdinal,
          phaseMemberOrdinal,
          builderBrickRef,
          officialDesignId,
          designRevision,
        }) => ({
          occurrenceOrdinal,
          phaseMemberOrdinal,
          builderBrickRef,
          officialDesignId,
          designRevision,
        }),
      ),
    });

    expect(receipt).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-step42-source-geometry-admission/2",
      authority: "offline-opaque-source-geometry-diagnostic",
      sourceSetId: "6651557",
      actionPreparationDigest: expected.actionPreparationDigest,
      authorityLimits: {
        placement: false,
        documentLegality: false,
        acceptance: false,
        completion: false,
      },
    });
    expect(receipt.admittedBinding).toEqual(expected);
    expect(receipt.rows).toHaveLength(3);
    expect(
      receipt.rows.map((row) => ({
        occurrenceOrdinal: row.occurrenceOrdinal,
        phaseMemberOrdinal: row.phaseMemberOrdinal,
        builderBrickRef: row.builderBrickRef,
        officialDesignId: row.partIdentity.officialDesignId,
        designRevision: row.partIdentity.officialDesignRevision,
        catalogPartId: row.partIdentity.reconciledCatalogPartId,
        catalogWorldTransform: row.catalogWorldTransform,
        printedStepNumber: row.printedStepNumber,
        phaseSequence: row.phaseSequence,
      })),
    ).toEqual(
      expected.members.map((member) => ({
        occurrenceOrdinal: member.occurrenceOrdinal,
        phaseMemberOrdinal: member.phaseMemberOrdinal,
        builderBrickRef: member.builderBrickRef,
        officialDesignId: member.officialDesignId,
        designRevision: member.designRevision,
        catalogPartId: member.catalogPartId,
        catalogWorldTransform: member.catalogWorldTransform,
        printedStepNumber: 42,
        phaseSequence: 68,
      })),
    );
    expect(receipt.rows.every((row) => Object.isFrozen(row))).toBe(true);
    expect(receipt.rows.every((row) => Object.isFrozen(row.sourceWorldProposal))).toBe(true);
    expect(receipt.rows.every((row) => Object.isFrozen(row.catalogFrameEvidence))).toBe(true);
    expect(receipt.rows.every((row) => Object.isFrozen(row.catalogWorldTransform))).toBe(true);

    expect(
      sha256File(resolve("scripts/part-identification-prefix50-verified-projection-step42.mjs")),
    ).toBe(expected.sourceModuleDigest);
    expect(receipt.admittedBindingCommitment).toBe(canonicalDigest(expected));
    expect(REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING_COMMITMENT).toBe(
      receipt.admittedBindingCommitment,
    );
    expect(receipt.receiptCommitment).toBe(canonicalDigest(withoutReceiptCommitment(receipt)));
    expect(receipt.officialWorldReconciliationDigest).toBe(
      "sha256:47d186212999081a715b8594d40f06fce31b5278d89a84cef8f364619073c756",
    );
    expect(receipt.occurrenceCommitment).toEqual({
      algorithm: "sha256-json-array-v1",
      rowCount: 320,
      order: "sourceBuilderIdentityOrdinal-ascending",
      digest: "sha256:2b6fb7d9557c976db8adf7bfba7aeb28e1ce15b3c79d0541cbb19d159e7a06f3",
    });
    expect(receipt.worldTransformCommitment).toEqual({
      algorithm: "sha256-json-array-v1",
      rowCount: 320,
      order: "sourceBuilderIdentityOrdinal-ascending",
      digest: "sha256:a0297d0b4700c30f8e1af1c077b4920b09e7e12f378a4f09fd7d4ff35f5a90e5",
    });
    expect(receipt.independentCatalogOrientationTruth).toEqual({
      schemaVersion: "lego.step42-independent-catalog-orientation-truth/1",
      transformPolicyVersion: "part-scoped-proper-orientations-negative-y-up/2",
      rosterDigest: "sha256:57446894cd2b917eb5463672655baa012d7c03539ba4147cd89e9c774a309201",
      algebraControlCommitment:
        "sha256:58de4c32f1420988310cd3661f4674c3db7b7458a53f32b644a529e621915904",
      compositionLaw:
        "catalog-world=source-world*transpose(source-to-catalog);position=source-position-catalog-world*frame-translation",
    });
    expect(receipt.verifierManifest).toEqual({
      schemaVersion: "lego.step42-source-geometry-verifier-manifest/2",
      algorithm: "sha256-exact-file-bytes-v1",
      files: [
        {
          role: "source-geometry-verifier",
          relativePath:
            "part-identification-prefix50-verified-projection-step42-source-geometry.mjs",
          bytes: 20_215,
          digest: "sha256:da9634ca59ba503b568ed3629e1947982f8193555e24f1e7a18e7ddee5ad2f2c",
        },
        {
          role: "independent-transform-law",
          relativePath: "part-identification-prefix50-step42-independent-transform-law.mjs",
          bytes: 8_872,
          digest: "sha256:4568cd7cf984b0c5b3df71d67f72f892fa7d73d584f641170fac5a9ab1a80cd6",
        },
        {
          role: "official-world-reconciliation-consumer-inspection",
          relativePath:
            "part-identification-prefix50-official-world-reconciliation-verification.mjs",
          bytes: 3_679,
          digest: "sha256:ca6027d2444a28593634eaee8dc705ebae25146d45d9d5eaf71e5a08f674a0a0",
        },
        {
          role: "official-world-reconciliation-projection",
          relativePath: "part-identification-prefix50-official-world-reconciliation-projection.mjs",
          bytes: 3_860,
          digest: "sha256:af394ebaf4eb12b238ccd5c435e25e0403ed7e39bc3dc09b20e0125a0d968c2c",
        },
        {
          role: "manifest-checker",
          relativePath:
            "part-identification-prefix50-step42-source-geometry-verifier-manifest-check.mjs",
          bytes: 1_702,
          digest: "sha256:a64919347718d221801c3976925fe26ea5924ba04b473dc16fa57983e2138742",
        },
      ],
    });
    for (const row of receipt.verifierManifest.files) {
      const path = resolve("scripts", row.relativePath);
      expect(readFileSync(path)).toHaveLength(row.bytes);
      expect(sha256File(path)).toBe(row.digest);
    }
    expect(independentStableDigest(receipt.verifierManifest)).toBe(
      receipt.verifierManifestCommitment,
    );
    expect(receipt.verifierManifestCommitment).toBe(
      "sha256:6b7eb5c97520b50172f6f2365048cbd8810721535ae734a5c13f4d51f57aace3",
    );
    expect(receipt.semanticGeometryCommitment).toBe(
      "sha256:cfd9678202a6459644721638610e17c7b284e9fe4d329f1c8c1705ef186ad9d8",
    );
    expect(REAL_BUILD_PREFIX50_STEP42_SEMANTIC_GEOMETRY_COMMITMENT).toBe(
      receipt.semanticGeometryCommitment,
    );
    expect(receipt.admittedBindingCommitment).toBe(
      "sha256:069e451e6d730ae96373578c4f1bf8f60ffd1428a8af7d02172cd4e1dca3f78d",
    );
    expect(receipt.receiptCommitment).toBe(
      "sha256:e21689ec52fafc98c93a3ef2159f7cc837238301628ae5c2f0b82461959fe6df",
    );
  }, 180_000);

  it("rejects forged readers and independently detects composition drift", async () => {
    const forged = Object.freeze({ readVerifiedPrefix50Projection: () => Object.freeze({}) });
    expect(() => readRealBuildPrefix50Step42SourceGeometryReceipt(forged)).toThrow(
      /caller-shaped readers/u,
    );

    const fixture = await loadCurrentPrefix50Step42SourceGeometryFixture();
    expect(() => rebuildStep42SourceGeometryWithCompositionDriftForTest(fixture, 274)).toThrow(
      /independently composed catalog-world transform/u,
    );
    expect(() => requireStep42CatalogOrientationMutationRefusalForTest()).toThrow(
      /independent catalog orientation truth drifted/u,
    );
    expect(
      readFileSync(
        resolve(
          "scripts/part-identification-prefix50-verified-projection-step42-source-geometry.mjs",
        ),
        "utf8",
      ),
    ).not.toContain("part-identification-prefix50-official-world-reconciliation-math.mjs");
    const closure = staticRelativeImportClosure(
      resolve(
        "scripts/part-identification-prefix50-verified-projection-step42-source-geometry.mjs",
      ),
    );
    expect(closure).not.toContain(
      resolve("scripts/part-identification-prefix50-official-world-reconciliation.mjs"),
    );
    expect(closure).not.toContain(
      resolve("scripts/part-identification-prefix50-official-world-reconciliation-math.mjs"),
    );
    expect(closure).not.toContain(
      resolve("scripts/part-identification-prefix50-official-world-reconciliation-occurrence.mjs"),
    );
    expect(closure).not.toContain(
      resolve("scripts/part-identification-prefix50-official-world-reconciliation-topology.mjs"),
    );
    expect(closure).toContain(
      resolve(
        "scripts/part-identification-prefix50-official-world-reconciliation-verification.mjs",
      ),
    );
    expect(closure).toContain(
      resolve("scripts/part-identification-prefix50-step42-independent-transform-law.mjs"),
    );
    expect(closure).toContain(
      resolve("scripts/part-identification-prefix50-step42-source-geometry-verifier-manifest.mjs"),
    );
    expect(closure).toContain(
      resolve(
        "scripts/part-identification-prefix50-step42-source-geometry-verifier-manifest-check.mjs",
      ),
    );
    const producerClosure = staticRelativeImportClosure(
      resolve("scripts/part-identification-prefix50-official-world-reconciliation.mjs"),
    );
    expect(producerClosure).toContain(
      resolve("scripts/part-identification-prefix50-official-world-reconciliation-occurrence.mjs"),
    );
    expect(producerClosure).toContain(
      resolve("scripts/part-identification-prefix50-official-world-reconciliation-topology.mjs"),
    );
    expect(producerClosure).toContain(
      resolve("scripts/part-identification-prefix50-official-world-reconciliation-math.mjs"),
    );
  }, 180_000);

  it("requires a process-local opaque admission before downstream topology can consume geometry", async () => {
    const fixture = await loadCurrentPrefix50Step42SourceGeometryFixture();
    const admission = admitRealBuildPrefix50Step42SourceGeometry(fixture.reader);
    const receipt = requireRealBuildPrefix50Step42SourceGeometryAdmission(admission);
    expect(receipt.admittedBindingCommitment).toBe(
      REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING_COMMITMENT,
    );
    expect(deriveRealBuildPrefix50Step42LocalTopology(admission)).toMatchObject({
      sourceGeometryBindingCommitment:
        REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING_COMMITMENT,
      semanticGeometryCommitment: REAL_BUILD_PREFIX50_STEP42_SEMANTIC_GEOMETRY_COMMITMENT,
      spatialLengthRoster: [6, 4, 2],
      totalLengthStuds: 12,
      middleStudCount: 4,
    });
    expect(() => requireRealBuildPrefix50Step42SourceGeometryAdmission({ ...admission })).toThrow(
      /process-local opaque admission/u,
    );
    expect(() => deriveRealBuildPrefix50Step42LocalTopology({} as never)).toThrow(
      /process-local opaque admission/u,
    );
  }, 180_000);

  it("replays the production verifier path to mint its own process-local admission", async () => {
    const reproduced = await reproduceRealBuildPrefix50Step42SourceGeometryAuthority();
    const receipt = requireRealBuildPrefix50Step42SourceGeometryAdmission(
      reproduced.sourceGeometryAdmission,
    );
    expect(readRealBuildPrefix50Step42SourceGeometryReceipt(reproduced.projectionReader)).toBe(
      receipt,
    );
    expect(receipt.admittedBindingCommitment).toBe(
      REAL_BUILD_PREFIX50_STEP42_SOURCE_GEOMETRY_BINDING_COMMITMENT,
    );
    expect(deriveRealBuildPrefix50Step42LocalTopology(reproduced.sourceGeometryAdmission)).toEqual(
      expect.objectContaining({
        semanticGeometryCommitment: REAL_BUILD_PREFIX50_STEP42_SEMANTIC_GEOMETRY_COMMITMENT,
        spatialLengthRoster: [6, 4, 2],
      }),
    );
  }, 180_000);

  it("keeps the drift injector unreachable outside test mode", () => {
    const supportUrl = pathToFileURL(
      resolve(
        "scripts/part-identification-prefix50-verified-projection-step42-source-geometry-test-support.mjs",
      ),
    ).href;
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", `await import(${JSON.stringify(supportUrl)})`],
      {
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: "production" },
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("may load only under NODE_ENV=test");
  });
});
