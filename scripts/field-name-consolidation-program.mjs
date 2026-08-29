import path from "node:path";

import ts from "typescript";

const normalizePath = (value) => value.replaceAll("\\", "/");

const resolvedSymbol = (checker, symbol) => {
  let current = symbol;
  const seen = new Set();
  while (current !== undefined && current.flags & ts.SymbolFlags.Alias && !seen.has(current)) {
    seen.add(current);
    current = checker.getAliasedSymbol(current);
  }
  return current;
};

const canonicalOwnerSymbols = (checker, field, ownerSourceFiles) =>
  new Set(
    ownerSourceFiles.map((ownerSourceFile) => {
      const moduleSymbol = checker.getSymbolAtLocation(ownerSourceFile);
      const exported =
        moduleSymbol === undefined
          ? undefined
          : checker.getExportsOfModule(moduleSymbol).find(({ name }) => name === field);
      const canonical = resolvedSymbol(checker, exported);
      if (canonical === undefined) {
        throw new Error(`${ownerSourceFile.fileName} must export canonical ${field}`);
      }
      return canonical;
    }),
  );

export const canonicalImports = (sourceFile, checker, field, ownerSourceFiles) => {
  const ownerSymbols = canonicalOwnerSymbols(checker, field, ownerSourceFiles);
  const imports = [];
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      statement.importClause?.namedBindings === undefined ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      continue;
    }
    for (const element of statement.importClause.namedBindings.elements) {
      const localSymbol = checker.getSymbolAtLocation(element.name);
      if (localSymbol === undefined || !(localSymbol.flags & ts.SymbolFlags.Alias)) continue;
      if (!ownerSymbols.has(resolvedSymbol(checker, localSymbol))) continue;
      imports.push({ element, localName: element.name.text, localSymbol });
    }
  }
  return imports;
};

export const createInMemoryProgram = (sources, repositoryRoot, compilerOptions) => {
  const virtualRoot = path.join(repositoryRoot, ".field-name-binding-controls");
  const normalizedSources = new Map(
    Object.entries(sources).map(([relativeFile, text]) => [
      normalizePath(path.join(virtualRoot, relativeFile)).toLowerCase(),
      text,
    ]),
  );
  const host = ts.createCompilerHost(compilerOptions, true);
  const defaultFileExists = host.fileExists.bind(host);
  const defaultReadFile = host.readFile.bind(host);
  const defaultGetSourceFile = host.getSourceFile.bind(host);
  const defaultDirectoryExists = host.directoryExists?.bind(host);
  const normalizedVirtualRoot = normalizePath(path.resolve(virtualRoot)).toLowerCase();
  const lookup = (fileName) =>
    normalizedSources.get(normalizePath(path.resolve(fileName)).toLowerCase());
  host.fileExists = (fileName) => lookup(fileName) !== undefined || defaultFileExists(fileName);
  host.directoryExists = (directoryName) =>
    normalizePath(path.resolve(directoryName)).toLowerCase().startsWith(normalizedVirtualRoot) ||
    defaultDirectoryExists?.(directoryName) === true;
  host.readFile = (fileName) => lookup(fileName) ?? defaultReadFile(fileName);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const text = lookup(fileName);
    if (text !== undefined) {
      return ts.createSourceFile(fileName, text, languageVersion, true, ts.ScriptKind.TS);
    }
    return defaultGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };
  const program = ts.createProgram({
    rootNames: Object.keys(sources).map((relativeFile) => path.join(virtualRoot, relativeFile)),
    options: compilerOptions,
    host,
  });
  return {
    checker: program.getTypeChecker(),
    program,
    sourceFile(relativeFile) {
      const expected = normalizePath(path.join(virtualRoot, relativeFile)).toLowerCase();
      const sourceFile = program
        .getSourceFiles()
        .find(
          (candidate) => normalizePath(path.resolve(candidate.fileName)).toLowerCase() === expected,
        );
      if (sourceFile === undefined) throw new Error(`${relativeFile} was not loaded`);
      return sourceFile;
    },
  };
};

export const transparentExpressionChild = (node) => {
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    return node.expression;
  }
  return undefined;
};

export const unwrapTransparentExpression = (node) => {
  let expression = node;
  let child;
  while ((child = transparentExpressionChild(expression)) !== undefined) expression = child;
  return expression;
};

export const variableInitializers = (sourceFile, name) => {
  const initializers = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        initializers.push(declaration.initializer);
      }
    }
  }
  return initializers;
};

export const variableInitializer = (sourceFile, name) => variableInitializers(sourceFile, name)[0];

const ancestor = (node, predicate) => {
  let current = node.parent;
  while (current !== undefined) {
    if (predicate(current)) return current;
    current = current.parent;
  }
  return undefined;
};

const within = (node, possibleAncestor) => {
  let current = node;
  while (current !== undefined) {
    if (current === possibleAncestor) return true;
    current = current.parent;
  }
  return false;
};

const enclosingFunction = (node) =>
  ancestor(
    node,
    (candidate) =>
      ts.isFunctionDeclaration(candidate) ||
      ts.isMethodDeclaration(candidate) ||
      ts.isArrowFunction(candidate) ||
      ts.isFunctionExpression(candidate),
  );

export const bindingReferences = (sourceFile, checker, bindingSymbol, excludeExports = false) => {
  const references = [];
  const visit = (node) => {
    if (
      ts.isIdentifier(node) &&
      checker.getSymbolAtLocation(node) === bindingSymbol &&
      ancestor(node, ts.isImportSpecifier) === undefined &&
      (!excludeExports || ancestor(node, ts.isExportSpecifier) === undefined) &&
      !(ts.isVariableDeclaration(node.parent) && node.parent.name === node)
    ) {
      references.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return references;
};

const symbolIsWritten = (node) => {
  const parent = node.parent;
  if (
    ts.isBinaryExpression(parent) &&
    ts.isAssignmentOperator(parent.operatorToken.kind) &&
    within(node, parent.left)
  ) {
    return true;
  }
  if (
    (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) &&
    (parent.operator === ts.SyntaxKind.PlusPlusToken ||
      parent.operator === ts.SyntaxKind.MinusMinusToken)
  ) {
    return true;
  }
  if (ts.isDeleteExpression(parent)) return true;
  return (
    (ts.isForInStatement(parent) || ts.isForOfStatement(parent)) && within(node, parent.initializer)
  );
};

const stableModuleFunction = (sourceFile, checker, name) => {
  const declarations = sourceFile.statements.filter(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  if (declarations.length !== 1) return undefined;
  const symbol = checker.getSymbolAtLocation(declarations[0].name);
  if (symbol === undefined) return undefined;
  return bindingReferences(sourceFile, checker, symbol).some(symbolIsWritten) ? undefined : symbol;
};

const callsStableModuleFunction = (call, sourceFile, checker, name) => {
  if (!ts.isIdentifier(call.expression)) return false;
  const stable = stableModuleFunction(sourceFile, checker, name);
  return stable !== undefined && checker.getSymbolAtLocation(call.expression) === stable;
};

const nearestStatement = (node) => {
  let current = node;
  while (current !== undefined) {
    if (ts.isStatement(current) && !ts.isBlock(current)) return current;
    current = current.parent;
  }
  return undefined;
};

const FALLTHROUGH = "fallthrough";
const RETURN = "return";
const THROW = "throw";
const BREAK = "break";
const CONTINUE = "continue";
const UNKNOWN = "unknown";
const UNKNOWN_VALUE = Symbol("unknown-value");

const outcomeUnion = (...sets) => new Set(sets.flatMap((set) => [...set]));

const constantScalar = (node) => {
  const expression = unwrapTransparentExpression(node);
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (expression.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  if (ts.isPrefixUnaryExpression(expression)) {
    const value = constantScalar(expression.operand);
    if (value === UNKNOWN_VALUE) return UNKNOWN_VALUE;
    if (expression.operator === ts.SyntaxKind.ExclamationToken) return !value;
    if (expression.operator === ts.SyntaxKind.PlusToken) return +value;
    if (expression.operator === ts.SyntaxKind.MinusToken) return -value;
  }
  if (ts.isBinaryExpression(expression)) {
    const operator = expression.operatorToken.kind;
    if (
      operator === ts.SyntaxKind.AmpersandAmpersandToken ||
      operator === ts.SyntaxKind.BarBarToken
    ) {
      const left = constantTruth(expression.left);
      const right = constantTruth(expression.right);
      if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
        if (left === false || right === false) return false;
        return left === true && right === true ? true : UNKNOWN_VALUE;
      }
      if (left === true || right === true) return true;
      return left === false && right === false ? false : UNKNOWN_VALUE;
    }
    const left = constantScalar(expression.left);
    const right = constantScalar(expression.right);
    if (left === UNKNOWN_VALUE || right === UNKNOWN_VALUE) return UNKNOWN_VALUE;
    if (
      operator === ts.SyntaxKind.EqualsEqualsToken ||
      operator === ts.SyntaxKind.EqualsEqualsEqualsToken
    ) {
      return left === right;
    }
    if (
      operator === ts.SyntaxKind.ExclamationEqualsToken ||
      operator === ts.SyntaxKind.ExclamationEqualsEqualsToken
    ) {
      return left !== right;
    }
  }
  return UNKNOWN_VALUE;
};

const constantTruth = (node) => {
  const value = constantScalar(node);
  return value === UNKNOWN_VALUE ? UNKNOWN_VALUE : Boolean(value);
};

const summarizeSequence = (statements) => {
  let outcomes = new Set([FALLTHROUGH]);
  for (const statement of statements) {
    if (!outcomes.has(FALLTHROUGH)) break;
    outcomes.delete(FALLTHROUGH);
    outcomes = outcomeUnion(outcomes, summarizeStatement(statement));
  }
  return outcomes;
};

const summarizeLoop = (statement) => {
  const body = summarizeStatement(statement.statement);
  const condition = ts.isForStatement(statement)
    ? statement.condition === undefined
      ? true
      : constantTruth(statement.condition)
    : UNKNOWN_VALUE;
  if (condition === false) return new Set([FALLTHROUGH]);
  const outcomes = new Set();
  if (!ts.isForStatement(statement) || condition === UNKNOWN_VALUE || body.has(BREAK)) {
    outcomes.add(FALLTHROUGH);
  }
  for (const outcome of [RETURN, THROW, UNKNOWN]) {
    if (body.has(outcome)) outcomes.add(outcome);
  }
  return outcomes.size === 0 ? new Set([UNKNOWN]) : outcomes;
};

const applyFinally = (outcomes, finallyBlock) => {
  if (finallyBlock === undefined) return outcomes;
  const finalOutcomes = summarizeSequence(finallyBlock.statements);
  const result = new Set([...finalOutcomes].filter((outcome) => outcome !== FALLTHROUGH));
  if (finalOutcomes.has(FALLTHROUGH)) {
    for (const outcome of outcomes) result.add(outcome);
  }
  return result;
};

const summarizeStatement = (statement) => {
  if (ts.isBlock(statement)) return summarizeSequence(statement.statements);
  if (ts.isReturnStatement(statement)) return new Set([RETURN]);
  if (ts.isThrowStatement(statement)) return new Set([THROW]);
  if (ts.isBreakStatement(statement)) return new Set([BREAK]);
  if (ts.isContinueStatement(statement)) return new Set([CONTINUE]);
  if (ts.isIfStatement(statement)) {
    const condition = constantTruth(statement.expression);
    const whenTrue = summarizeStatement(statement.thenStatement);
    const whenFalse =
      statement.elseStatement === undefined
        ? new Set([FALLTHROUGH])
        : summarizeStatement(statement.elseStatement);
    return condition === true
      ? whenTrue
      : condition === false
        ? whenFalse
        : outcomeUnion(whenTrue, whenFalse);
  }
  if (
    ts.isForStatement(statement) ||
    ts.isForInStatement(statement) ||
    ts.isForOfStatement(statement)
  ) {
    return summarizeLoop(statement);
  }
  if (ts.isWhileStatement(statement)) {
    const condition = constantTruth(statement.expression);
    if (condition === false) return new Set([FALLTHROUGH]);
    const body = summarizeStatement(statement.statement);
    const outcomes = new Set();
    if (condition === UNKNOWN_VALUE || body.has(BREAK)) outcomes.add(FALLTHROUGH);
    for (const outcome of [RETURN, THROW, UNKNOWN]) {
      if (body.has(outcome)) outcomes.add(outcome);
    }
    return outcomes.size === 0 ? new Set([UNKNOWN]) : outcomes;
  }
  if (ts.isTryStatement(statement)) {
    const attempted = summarizeSequence(statement.tryBlock.statements);
    const outcomes = new Set([...attempted].filter((outcome) => outcome !== THROW));
    if (statement.catchClause === undefined) {
      outcomes.add(THROW);
    } else {
      for (const outcome of summarizeSequence(statement.catchClause.block.statements)) {
        outcomes.add(outcome);
      }
    }
    return applyFinally(outcomes, statement.finallyBlock);
  }
  if (
    ts.isDoStatement(statement) ||
    ts.isSwitchStatement(statement) ||
    ts.isLabeledStatement(statement) ||
    ts.isWithStatement(statement)
  ) {
    return new Set([UNKNOWN]);
  }
  return new Set([FALLTHROUGH]);
};

const prefixAdmits = (statements, target) => {
  const index = statements.indexOf(target);
  if (index < 0) return false;
  const outcomes = summarizeSequence(statements.slice(0, index));
  return (
    outcomes.has(FALLTHROUGH) &&
    !outcomes.has(RETURN) &&
    !outcomes.has(BREAK) &&
    !outcomes.has(CONTINUE) &&
    !outcomes.has(UNKNOWN)
  );
};

const hasLazyAncestor = (node, statement) => {
  let current = node;
  while (current !== statement) {
    if (
      ts.isConditionalExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isFunctionExpression(current) ||
      ts.isClassExpression(current) ||
      ts.isClassDeclaration(current) ||
      (ts.isBinaryExpression(current) &&
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(current.operatorToken.kind)) ||
      ts.isOptionalChain(current)
    ) {
      return true;
    }
    current = current.parent;
    if (current === undefined) return true;
  }
  return false;
};

const firstLevelTryRole = (statement, owner) => {
  const block = statement.parent;
  const control = ts.isBlock(block) ? block.parent : undefined;
  if (
    !ts.isBlock(block) ||
    !ts.isTryStatement(control) ||
    control.tryBlock !== block ||
    control.parent !== owner.body ||
    control.catchClause === undefined ||
    control.finallyBlock !== undefined ||
    !prefixAdmits(owner.body.statements, control) ||
    !prefixAdmits(block.statements, statement)
  ) {
    return undefined;
  }
  const caught = summarizeSequence(control.catchClause.block.statements);
  return caught.has(FALLTHROUGH) || caught.has(UNKNOWN) ? undefined : control;
};

const canonicalLiveNode = (node, sourceFile, functionName) => {
  const owner = enclosingFunction(node);
  const statement = nearestStatement(node);
  if (
    owner === undefined ||
    !ts.isFunctionDeclaration(owner) ||
    owner.parent !== sourceFile ||
    owner.name?.text !== functionName ||
    owner.body === undefined ||
    statement === undefined ||
    hasLazyAncestor(node, statement)
  ) {
    return false;
  }
  return statement.parent === owner.body
    ? prefixAdmits(owner.body.statements, statement)
    : firstLevelTryRole(statement, owner) !== undefined;
};

const consumedTryResult = (call, sourceFile, checker, functionName) => {
  const statement = nearestStatement(call);
  const owner = enclosingFunction(call);
  if (
    statement === undefined ||
    owner === undefined ||
    !ts.isFunctionDeclaration(owner) ||
    owner.name?.text !== functionName ||
    !ts.isVariableStatement(statement) ||
    statement.declarationList.declarations.length !== 1 ||
    !(statement.declarationList.flags & ts.NodeFlags.Const) ||
    firstLevelTryRole(statement, owner) === undefined
  ) {
    return false;
  }
  const [declaration] = statement.declarationList.declarations;
  if (
    !ts.isIdentifier(declaration.name) ||
    declaration.initializer === undefined ||
    unwrapTransparentExpression(declaration.initializer) !== call
  ) {
    return false;
  }
  const symbol = checker.getSymbolAtLocation(declaration.name);
  if (symbol === undefined) return false;
  const block = statement.parent;
  return bindingReferences(sourceFile, checker, symbol).some(
    (reference) =>
      reference.pos > statement.end &&
      within(reference, block) &&
      canonicalLiveNode(reference, sourceFile, functionName) &&
      !symbolIsWritten(reference),
  );
};

const directArrayElement = (node, array) =>
  array.elements.some((element) => unwrapTransparentExpression(element) === node);

const consumedKeyArrayReference = (node, sourceFile, checker, usage) => {
  const initializer = variableInitializer(sourceFile, usage.owner);
  const array = initializer === undefined ? undefined : unwrapTransparentExpression(initializer);
  if (
    array === undefined ||
    !ts.isArrayLiteralExpression(array) ||
    !directArrayElement(node, array)
  ) {
    return false;
  }
  const ownerSymbol = checker.getSymbolAtLocation(initializer.parent.name);
  if (ownerSymbol === undefined) return false;
  const ownerReferences = bindingReferences(sourceFile, checker, ownerSymbol);
  if (ownerReferences.length !== 1) return false;
  const [ownerReference] = ownerReferences;
  const call = ownerReference.parent;
  if (
    !ts.isCallExpression(call) ||
    !callsStableModuleFunction(call, sourceFile, checker, usage.callee) ||
    call.arguments[1] === undefined ||
    unwrapTransparentExpression(call.arguments[1]) !== ownerReference ||
    !canonicalLiveNode(call, sourceFile, usage.functionName)
  ) {
    return false;
  }
  const owner = enclosingFunction(call);
  const statement = nearestStatement(call);
  if (owner === undefined || statement === undefined) return false;
  if (usage.directExecution) {
    return (
      ts.isExpressionStatement(statement) &&
      statement.expression === call &&
      statement.parent === owner.body
    );
  }
  return (
    statement.parent === owner.body ||
    consumedTryResult(call, sourceFile, checker, usage.functionName)
  );
};

const returnedFieldPair = (node, sourceFile, checker, bindingSymbol, usage) => {
  let pair = node.parent;
  while (pair !== undefined) {
    if (ts.isArrayLiteralExpression(pair) && pair.elements.length === 2) {
      const key = unwrapTransparentExpression(pair.elements[0]);
      if (ts.isIdentifier(key) && checker.getSymbolAtLocation(key) === bindingSymbol) break;
    }
    pair = pair.parent;
  }
  if (pair === undefined || !ts.isArrayLiteralExpression(pair)) return undefined;
  const fields = pair.parent;
  const call = fields?.parent;
  if (
    !ts.isArrayLiteralExpression(fields) ||
    !ts.isCallExpression(call) ||
    !callsStableModuleFunction(call, sourceFile, checker, usage.callee) ||
    call.arguments[0] !== fields ||
    !ts.isReturnStatement(call.parent) ||
    call.parent.expression !== call ||
    !canonicalLiveNode(call, sourceFile, usage.owner)
  ) {
    return undefined;
  }
  return pair;
};

export const referenceMatchesProductionPath = (node, sourceFile, checker, bindingSymbol, usage) => {
  if (usage.kind === "consumed-key-array") {
    return consumedKeyArrayReference(node, sourceFile, checker, usage);
  }
  if (usage.kind === "validation-loop-key") {
    const array = node.parent;
    const loop = array?.parent;
    return (
      ts.isArrayLiteralExpression(array) &&
      directArrayElement(node, array) &&
      ts.isForOfStatement(loop) &&
      loop.expression === array &&
      canonicalLiveNode(node, sourceFile, usage.functionName)
    );
  }
  if (usage.kind === "digest-label") {
    const template = ancestor(node, ts.isTemplateExpression);
    const call = template?.parent;
    return (
      template !== undefined &&
      ts.isCallExpression(call) &&
      callsStableModuleFunction(call, sourceFile, checker, "digestValue") &&
      call.arguments[1] === template &&
      canonicalLiveNode(node, sourceFile, usage.functionName)
    );
  }
  const pair = returnedFieldPair(node, sourceFile, checker, bindingSymbol, usage);
  if (pair === undefined) return false;
  if (usage.kind === "returned-field-pair-key") {
    return (
      unwrapTransparentExpression(pair.elements[0]) === node &&
      canonicalLiveNode(node, sourceFile, usage.owner)
    );
  }
  if (usage.kind === "returned-field-pair-own-data") {
    const call = node.parent;
    return (
      ts.isCallExpression(call) &&
      callsStableModuleFunction(call, sourceFile, checker, "ownData") &&
      call.arguments[1] === node &&
      within(call, pair.elements[1]) &&
      canonicalLiveNode(node, sourceFile, usage.owner)
    );
  }
  if (usage.kind === "returned-field-pair-label") {
    const template = ancestor(node, ts.isTemplateExpression);
    return (
      template !== undefined &&
      within(template, pair.elements[1]) &&
      canonicalLiveNode(node, sourceFile, usage.owner)
    );
  }
  return false;
};

export const exactReferenceInventory = (
  sourceFile,
  checker,
  bindingSymbol,
  expected,
  excludeExports = false,
) => {
  const remaining = bindingReferences(sourceFile, checker, bindingSymbol, excludeExports);
  if (remaining.length !== expected.length) return false;
  for (const usage of expected) {
    const match = remaining.findIndex((node) =>
      referenceMatchesProductionPath(node, sourceFile, checker, bindingSymbol, usage),
    );
    if (match < 0) return false;
    remaining.splice(match, 1);
  }
  return remaining.length === 0;
};
