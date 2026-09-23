import { readFileSync } from "node:fs";

import {
  canonicalBrickDocument,
  createEmptyBrickDocument,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot.ts";
import {
  createRealBuildPrefix50ProductionBaseDocument,
  REAL_BUILD_PREFIX50_PRODUCTION_BASE_DOCUMENT_ID,
  REAL_BUILD_PREFIX50_PRODUCTION_BASE_DOCUMENT_NAME,
} from "../e2e/real-build-prefix50-production-base.ts";

function descendants<T extends ts.Node>(
  root: ts.Node,
  predicate: (node: ts.Node) => node is T,
): T[] {
  const matches: T[] = [];
  const visit = (node: ts.Node): void => {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return matches;
}

function propertyValue(object: ts.Node | undefined, name: string): ts.Expression {
  if (object === undefined || !ts.isObjectLiteralExpression(object))
    throw new Error(`UI replay ${name} must come from its explicit compiler input object.`);
  const properties = object.properties.filter(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) && property.name.getText() === name,
  );
  if (properties.length !== 1)
    throw new Error(`UI replay compiler input must have one explicit ${name} property.`);
  return properties[0]!.initializer;
}

describe("prefix-50 production Step-1 base", () => {
  it("retains the pinned identity and exact canonical bytes used by the diagnostic replay", () => {
    const production = createRealBuildPrefix50ProductionBaseDocument();
    const pinned = createEmptyBrickDocument({
      id: "prefix50-current-diagnostic",
      name: "Prefix 50 current diagnostic",
    });
    expect(production.id).toBe(REAL_BUILD_PREFIX50_PRODUCTION_BASE_DOCUMENT_ID);
    expect(production.name).toBe(REAL_BUILD_PREFIX50_PRODUCTION_BASE_DOCUMENT_NAME);

    const productionSnapshot = createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: canonicalBrickDocument(production),
      expectedDocumentHash: documentStructuralHash(production),
    });
    const pinnedSnapshot = createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: canonicalBrickDocument(pinned),
      expectedDocumentHash: documentStructuralHash(pinned),
    });
    expect(productionSnapshot.canonicalBytes).toBe(pinnedSnapshot.canonicalBytes);
    expect(productionSnapshot.canonicalByteLength).toBe(pinnedSnapshot.canonicalByteLength);
    expect(productionSnapshot.canonicalBytesHash).toBe(pinnedSnapshot.canonicalBytesHash);
    expect(productionSnapshot.canonicalByteLength).toBe(4_906);
    expect(productionSnapshot.canonicalBytesHash).toBe(
      "sha256:0f155126bc975a659b588e074c7af40b7aad19a206f03af1e21e61854c27aab1",
    );
  });

  // Bound: inspect the real UI beforeAll as source, never import or run its protected
  // evidence readers. Bind the shared root call to the actual compiler snapshot;
  // an unused factory import or equal structural hash cannot satisfy this gate.
  it("uses the shared production root in the actual UI replay compiler input", () => {
    const sourcePath = new URL("../e2e/real-build-prefix50-ui-replay.spec.ts", import.meta.url);
    const source = ts.createSourceFile(
      sourcePath.pathname,
      readFileSync(sourcePath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const imports = source.statements.filter(
      (node): node is ts.ImportDeclaration =>
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text.replace(/\.ts$/u, "") === "./real-build-prefix50-production-base",
    );
    expect(imports, "UI replay must import the shared production root factory").toHaveLength(1);
    const bindings = imports[0]!.importClause?.namedBindings;
    expect(bindings !== undefined && ts.isNamedImports(bindings)).toBe(true);
    if (bindings === undefined || !ts.isNamedImports(bindings))
      throw new Error("UI replay requires the named production root factory import.");
    expect(bindings.elements.map((element) => element.getText())).toContain(
      "createRealBuildPrefix50ProductionBaseDocument",
    );

    const setupCalls = descendants(source, ts.isCallExpression).filter(
      (call) => call.expression.getText() === "test.beforeAll",
    );
    expect(setupCalls).toHaveLength(1);
    const setup = setupCalls[0]!.arguments[0]!;
    const roots = descendants(setup, ts.isVariableDeclaration).filter(
      (declaration) => declaration.name.getText() === "emptyDocument",
    );
    expect(roots).toHaveLength(1);
    expect(roots[0]!.initializer?.getText()).toBe(
      "createRealBuildPrefix50ProductionBaseDocument()",
    );
    expect(
      descendants(setup, ts.isIdentifier).filter(
        (identifier) => identifier.text === "emptyDocument",
      ),
      "The production root is used only by its declaration and the two snapshot commitments",
    ).toHaveLength(3);
    const compilerCalls = descendants(setup, ts.isCallExpression).filter(
      (call) =>
        call.expression.getText() === "compileRealBuildPrefix50UiReplayFromPersistedPromotion",
    );
    expect(compilerCalls).toHaveLength(1);
    const snapshot = propertyValue(compilerCalls[0]!.arguments[0], "documentSnapshot");
    expect(ts.isCallExpression(snapshot)).toBe(true);
    if (!ts.isCallExpression(snapshot)) throw new Error("UI replay snapshot must be constructed.");
    expect(snapshot.expression.getText()).toBe("createRealBuildCandidateDocumentSnapshot");
    expect(propertyValue(snapshot.arguments[0], "canonicalDocument").getText()).toBe(
      "canonicalBrickDocument(emptyDocument)",
    );
    expect(propertyValue(snapshot.arguments[0], "expectedDocumentHash").getText()).toBe(
      "documentStructuralHash(emptyDocument)",
    );
  });

  it("does not mistake equal structural hashes for equal canonical root bytes", () => {
    const production = createRealBuildPrefix50ProductionBaseDocument();
    const oldUiRoot = createEmptyBrickDocument({
      id: "prefix50-ui-replay",
      name: "6651557 printed steps 1 through 50",
    });
    expect(documentStructuralHash(oldUiRoot)).toBe(documentStructuralHash(production));
    expect(canonicalBrickDocument(oldUiRoot)).not.toBe(canonicalBrickDocument(production));
    expect({ ...oldUiRoot, id: production.id, name: production.name }).toEqual(production);
  });
});
