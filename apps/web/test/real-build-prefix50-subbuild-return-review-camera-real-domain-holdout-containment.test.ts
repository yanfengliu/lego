import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createRealBuildPrefix50Step44OneShotGate } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-one-shot.ts";

const E2E = resolve("apps/web/e2e");
const SOURCE = resolve(
  E2E,
  "real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts",
);
const CALIBRATION_RASTER = resolve(
  E2E,
  "real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-raster.ts",
);
const CALIBRATION_RASTER_COMMITMENT = resolve(
  E2E,
  "real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-raster-commitment.ts",
);
const PRE_UNLOCK_RECEIPT = resolve(
  E2E,
  "real-build-prefix50-subbuild-return-review-camera-real-domain-preunlock-receipt.ts",
);
const CROP_RENDERER = resolve(
  E2E,
  "real-build-prefix50-subbuild-return-review-camera-real-domain-pdf-crop.ts",
);
const SOURCE_LOCK = resolve(
  E2E,
  "real-build-prefix50-subbuild-return-review-camera-real-domain-source-lock.ts",
);
const PINNED_PDF = resolve(E2E, "real-build-prefix50-source-pdf-pins.ts");
const SYNTHETIC_SOURCE_SUPPORT =
  "real-build-prefix50-subbuild-return-review-camera-real-domain-synthetic-source-sequence-test-support";

function sourceFile(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function declaration(source: ts.SourceFile, name: string): ts.VariableDeclaration {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const candidate of statement.declarationList.declarations)
      if (ts.isIdentifier(candidate.name) && candidate.name.text === name) return candidate;
  }
  throw new TypeError(`Missing ${name} declaration in ${source.fileName}.`);
}

function functionText(source: ts.SourceFile, name: string): string {
  const found = source.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  if (found === undefined) throw new TypeError(`Missing ${name} in ${source.fileName}.`);
  return found.getText(source);
}

function staticLocalImports(file: string): readonly string[] {
  const source = sourceFile(file);
  const imports: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    const clause = statement.importClause;
    if (clause?.isTypeOnly) continue;
    const named = clause?.namedBindings;
    if (
      named !== undefined &&
      ts.isNamedImports(named) &&
      named.elements.length > 0 &&
      named.elements.every(({ isTypeOnly }) => isTypeOnly)
    )
      continue;
    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith(".")) continue;
    const direct = resolve(dirname(file), specifier);
    const imported = [direct, `${direct}.ts`, direct.replace(/\.js$/u, ".ts")].find(existsSync);
    if (imported === undefined) throw new TypeError(`Cannot resolve ${specifier} from ${file}.`);
    imports.push(imported);
  }
  return imports;
}

function privateStateFields(source: ts.SourceFile): readonly string[] {
  const value = declaration(source, "sourceSequencePrivates");
  if (value.initializer === undefined || !ts.isNewExpression(value.initializer))
    throw new TypeError("Private state is not a WeakMap.");
  const readonlyState = value.initializer.typeArguments?.[1];
  if (
    readonlyState === undefined ||
    !ts.isTypeReferenceNode(readonlyState) ||
    readonlyState.typeArguments?.length !== 1
  )
    throw new TypeError("Private state lacks one explicit Readonly payload type.");
  const payload = readonlyState.typeArguments[0]!;
  if (!ts.isTypeLiteralNode(payload)) throw new TypeError("Private state payload is not explicit.");
  return payload.members.map((member) => {
    if (!ts.isPropertySignature(member) || member.name === undefined)
      throw new TypeError("Private state contains a non-property member.");
    return member.name.getText(source);
  });
}

function nestedTypeScriptFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory()
      ? nestedTypeScriptFiles(path)
      : entry.isFile() && /\.tsx?$/u.test(entry.name)
        ? [path]
        : [];
  });
}

function callsFullPageStep44RendererWithoutCapability(file: string): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "rerenderRealBuildPrefix50Step44PdfPage"
    ) {
      const input = node.arguments[0];
      found =
        input === undefined ||
        !ts.isObjectLiteralExpression(input) ||
        !input.properties.some(
          (property) =>
            ts.isPropertyAssignment(property) && property.name.getText() === "capability",
        );
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile(file));
  return found;
}

describe("real-domain pre-unlock Step-43 pixel and vector containment", () => {
  it("stores only PDF/source-lock/calibration commitments and no page raster bytes", () => {
    const source = sourceFile(SOURCE);
    const text = source.getFullText();
    expect([...privateStateFields(source)].sort()).toEqual(
      [
        "repositoryRoot",
        "sourcePdfArtifactPath",
        "sourcePdfDigest",
        "calibrationRasterCommitment",
        "sourceLockCommitment",
        "calibrationCasesCommitment",
        "calibrationCaseIdentities",
        "sharedOrientationAnchorCommitment",
      ].sort(),
    );
    expect(text).not.toMatch(/\bpageRgba\b|\bpageWidth\b/u);
    expect(text).not.toContain("rerenderRealBuildPrefix50Step44PdfPage");
    expect(text).not.toContain("camera-real-domain-source-vector");
    expect(text).not.toContain("ingestPhysicalPage44Prefix");
    expect(text).not.toContain("sampleBookletCalloutBoxes");
    expect(text).not.toContain("REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.pageRaster");

    const commitment = readFileSync(CALIBRATION_RASTER_COMMITMENT, "utf8");
    expect(commitment).toContain("lego.real-build-prefix50-step44-bounded-calibration-crop-set/1");
    expect(commitment).toContain('kind: "bounded-calibration-crop-set"');
    expect(commitment).toContain("rendererPngDigest");
    expect(commitment).toContain("canonicalPngDigest");
    expect(commitment).toContain("pixelDigest");
    expect(commitment).not.toContain("pageRaster");
  });

  it("keeps full-page PDF.js/vector and held-out raster modules out of static pre-unlock imports", () => {
    const pending = [
      SOURCE,
      CALIBRATION_RASTER,
      CALIBRATION_RASTER_COMMITMENT,
      PRE_UNLOCK_RECEIPT,
      CROP_RENDERER,
      SOURCE_LOCK,
    ];
    const visited = new Set<string>();
    const forbidden =
      /(?:camera-real-domain-source-vector|camera-real-domain-heldout-raster|camera-real-domain-heldout\.ts|subbuild-return-review-pdf\.ts|ingest-pdf|booklet-fixture)/u;
    while (pending.length > 0) {
      const file = pending.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);
      expect(forbidden.test(file), `forbidden pre-unlock source ${file}`).toBe(false);
      for (const imported of staticLocalImports(file)) {
        expect(forbidden.test(imported), `forbidden pre-unlock import ${imported}`).toBe(false);
        pending.push(imported);
      }
    }
    expect(visited.has(PINNED_PDF)).toBe(true);
    expect(visited.has(CROP_RENDERER)).toBe(true);
  });

  it("rehashes the pinned source and validates its live lock before each crop set", () => {
    const source = sourceFile(SOURCE);
    const prepare = functionText(source, "prepareRealBuildPrefix50Step44RealDomainSourceSequence");
    const requiredLock = prepare.indexOf("requireRealBuildPrefix50Step44RealDomainSourceLock");
    const admittedReceipt = prepare.indexOf("requireRealBuildPrefix50Step44PreUnlockSourceReceipt");
    const renderedSet = prepare.indexOf("rerenderRealBuildPrefix50Step44CalibrationSourceCrops");
    expect(requiredLock).toBeGreaterThanOrEqual(0);
    expect(admittedReceipt).toBeGreaterThan(requiredLock);
    expect(renderedSet).toBeGreaterThan(admittedReceipt);

    const calibration = functionText(
      sourceFile(CALIBRATION_RASTER),
      "rerenderRealBuildPrefix50Step44CalibrationSourceCrops",
    );
    const rehashed = calibration.indexOf('requirePinnedPdf("before")');
    const firstCrop = calibration.indexOf("render(step41)");
    const secondCrop = calibration.indexOf("render(step42)");
    const reverified = calibration.indexOf('requirePinnedPdf("after")');
    expect(rehashed).toBeGreaterThanOrEqual(0);
    expect(firstCrop).toBeGreaterThan(rehashed);
    expect(secondCrop).toBeGreaterThan(firstCrop);
    expect(reverified).toBeGreaterThan(secondCrop);
  });

  it("has no test that invokes the full-page Step-44 renderer without a capability", () => {
    const callers = nestedTypeScriptFiles(resolve("apps/web/test")).filter(
      callsFullPageStep44RendererWithoutCapability,
    );
    expect(callers).toEqual([]);
  });

  it("keeps the separately branded synthetic source sequence outside production imports", () => {
    const productionImporters = nestedTypeScriptFiles(E2E).filter((file) =>
      readFileSync(file, "utf8").includes(SYNTHETIC_SOURCE_SUPPORT),
    );
    expect(productionImporters).toEqual([]);
  });

  it("requires capability before loading held-out code and claims at the lowest PDF-read boundary", () => {
    const source = sourceFile(SOURCE);
    const prepare = functionText(source, "prepareRealBuildPrefix50Step44RealDomainSourceSequence");
    const materialize = functionText(source, "materializeRealBuildPrefix50Step44HeldOutSourceCase");
    const authorize = functionText(sourceFile(CROP_RENDERER), "requireReadAuthorization");
    const crop = functionText(sourceFile(CROP_RENDERER), "rerenderRealBuildPrefix50Step44PdfCrop");
    expect(prepare).toContain("rerenderRealBuildPrefix50Step44CalibrationSourceCrops");
    expect(prepare).not.toMatch(/heldout|Step-43|1040|620/u);
    const required = materialize.indexOf("requireRealBuildPrefix50Step44HeldOutUnlockCapability");
    const loaded = materialize.indexOf("await import(");
    const rendered = materialize.indexOf("rerenderRealBuildPrefix50Step44HeldOutSourceCrop");
    expect(required).toBeGreaterThanOrEqual(0);
    expect(loaded).toBeGreaterThan(required);
    expect(rendered).toBeGreaterThan(loaded);
    const verified = authorize.indexOf("requireRealBuildPrefix50Step44HeldOutUnlockCapability");
    const claimed = authorize.indexOf("heldOutReadGate.add");
    const verifiedRead = crop.indexOf("readRealBuildPrefix50Step44ReviewArtifact");
    expect(verified).toBeGreaterThanOrEqual(0);
    expect(claimed).toBeGreaterThan(verified);
    expect(verifiedRead).toBeGreaterThanOrEqual(0);
    expect(crop.indexOf("await requireReadAuthorization")).toBeLessThan(verifiedRead);
    expect(materialize.match(/camera-real-domain-heldout-raster\.ts/gu)).toHaveLength(1);
    expect(materialize).not.toMatch(/pageNumber:\s*45|page45/iu);
  });

  it("refuses replay through the exact one-shot gate used by source materialization", () => {
    const gate = createRealBuildPrefix50Step44OneShotGate("already opened");
    const first = Object.freeze({ id: "first" });
    const second = Object.freeze({ id: "second" });
    expect(() => gate.claim(first)).not.toThrow();
    expect(() => {
      throw new TypeError("simulated held-out render failure after claim");
    }).toThrow("simulated held-out render failure after claim");
    expect(() => gate.claim(first)).toThrow("already opened");
    expect(() => gate.claim(second)).not.toThrow();
  });
});
