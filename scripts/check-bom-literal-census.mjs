import { createHash } from "node:crypto";

import ts from "typescript";

export const ENCODED_SOURCE_LITERAL_CENSUS_SCHEMA = "encoded-source-literal-risk-census/2";
export const executableSourceExtension = /\.(?:js|jsx|mjs|mts|ts|tsx)$/iu;
const lexicallyReviewedExecutableExtension = /\.(?:cs|ps1|py)$/iu;
export const encodedAtomPattern = /[A-Za-z0-9+/]{31,}={0,2}/gu;

const maximumAstNodes = 1_000_000;
const singleAtomLimit = 128;

const normalizePath = (value) => value.replaceAll("\\", "/");
const codeUnitCompare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const atomKey = ({ start, end }) => `${start}:${end}`;
const classifyAtomValue = (value) => {
  if (/^[0-9a-f]{64}$/u.test(value)) return "exact-64-lower-hex";
  if (/^[0-9a-f]{40}$/u.test(value)) return "exact-40-lower-hex";
  if (/^[0-9a-f]{32}$/u.test(value)) return "exact-32-lower-hex";
  if (/={1,2}$/u.test(value)) return "base64-padding";
  if (/^[A-Za-z0-9]+$/u.test(value)) return "identifier-like-alnum";
  return "base64-symbol";
};

const scriptKindFor = (relativeFile) => {
  if (/\.tsx$/iu.test(relativeFile)) return ts.ScriptKind.TSX;
  if (/\.jsx$/iu.test(relativeFile)) return ts.ScriptKind.JSX;
  if (/\.mts$/iu.test(relativeFile)) return ts.ScriptKind.TS;
  if (/\.ts$/iu.test(relativeFile)) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
};

const addMatches = (atoms, value, base, kind, relativeFile, source, owner) => {
  for (const match of value.matchAll(encodedAtomPattern)) {
    const start = base + match.index;
    const end = start + match[0].length;
    const prefix = source.slice(Math.max(0, start - 32), start).replace(/\s+/gu, " ");
    const suffix = source.slice(end, Math.min(source.length, end + 32)).replace(/\s+/gu, " ");
    atoms.push({
      relativeFile,
      start,
      end,
      length: match[0].length,
      value: match[0],
      kind,
      context: `${prefix}<atom>${suffix}`,
      owner,
    });
  }
};

const literalBase = (node, sourceFile, source) => {
  const start = node.getStart(sourceFile);
  const raw = source.slice(start, node.getEnd());
  if (raw.startsWith('"') || raw.startsWith("'") || raw.startsWith("`") || raw.startsWith("}")) {
    return start + 1;
  }
  return start;
};

const collectComments = (atoms, relativeFile, source) => {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    source,
  );
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
    const kind = scanner.getToken();
    if (
      kind !== ts.SyntaxKind.SingleLineCommentTrivia &&
      kind !== ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      continue;
    }
    const tokenStart = scanner.getTokenPos();
    const token = scanner.getTokenText();
    const opener = kind === ts.SyntaxKind.SingleLineCommentTrivia ? 2 : 2;
    const closer = kind === ts.SyntaxKind.MultiLineCommentTrivia ? 2 : 0;
    const body = token.slice(opener, token.length - closer);
    const bodyStart = tokenStart + opener;
    const trimmed = body.trim();
    const terminalMetadata = /^(?:sha256:[0-9a-f]{64}|git:[0-9a-f]{40}|md5:[0-9a-f]{32})$/u.test(
      trimmed,
    );
    const beforeTrim = body.length - body.trimStart().length;
    const commentAtoms = [];
    addMatches(commentAtoms, body, bodyStart, "comment", relativeFile, source, undefined);
    for (const atom of commentAtoms) {
      atom.terminalCommentExempt =
        terminalMetadata &&
        atom.start >= bodyStart + beforeTrim &&
        atom.end <= bodyStart + beforeTrim + trimmed.length;
      atoms.push(atom);
    }
  }
};

const addCommentBody = (atoms, body, bodyStart, relativeFile, source) => {
  const trimmed = body.trim();
  const terminalMetadata = /^(?:sha256:[0-9a-f]{64}|git:[0-9a-f]{40}|md5:[0-9a-f]{32})$/u.test(
    trimmed,
  );
  const beforeTrim = body.length - body.trimStart().length;
  const commentAtoms = [];
  addMatches(commentAtoms, body, bodyStart, "comment", relativeFile, source, undefined);
  for (const atom of commentAtoms) {
    atom.terminalCommentExempt =
      terminalMetadata &&
      atom.start >= bodyStart + beforeTrim &&
      atom.end <= bodyStart + beforeTrim + trimmed.length;
    atoms.push(atom);
  }
};

const collectLexicallyReviewedExecutable = (relativeFile, source) => {
  const atoms = [];
  const python = /\.py$/iu.test(relativeFile);
  const powershell = /\.ps1$/iu.test(relativeFile);
  const csharp = /\.cs$/iu.test(relativeFile);
  let index = 0;
  while (index < source.length) {
    const lineMarker =
      (python || powershell) && source[index] === "#"
        ? "#"
        : source.startsWith("//", index)
          ? "//"
          : null;
    if (lineMarker !== null) {
      const bodyStart = index + lineMarker.length;
      const end = source.indexOf("\n", bodyStart);
      const limit = end === -1 ? source.length : end;
      addCommentBody(atoms, source.slice(bodyStart, limit), bodyStart, relativeFile, source);
      index = limit;
      continue;
    }
    const blockStart = source.startsWith("/*", index)
      ? ["/*", "*/"]
      : powershell && source.startsWith("<#", index)
        ? ["<#", "#>"]
        : null;
    if (blockStart !== null) {
      const bodyStart = index + 2;
      const end = source.indexOf(blockStart[1], bodyStart);
      if (end === -1) {
        return {
          atoms,
          issue: `${relativeFile} contains an unterminated block comment; correct it before relying on ${ENCODED_SOURCE_LITERAL_CENSUS_SCHEMA}`,
        };
      }
      addCommentBody(atoms, source.slice(bodyStart, end), bodyStart, relativeFile, source);
      index = end + 2;
      continue;
    }
    const quote = source[index];
    if (quote !== '"' && quote !== "'") {
      index += 1;
      continue;
    }
    if (
      powershell &&
      source[index - 1] === "@" &&
      (source.slice(index + 1, index + 3) === "\r\n" || source[index + 1] === "\n")
    ) {
      const bodyStart = source[index + 1] === "\n" ? index + 2 : index + 3;
      const terminator = `\n${quote}@`;
      const end = source.indexOf(terminator, bodyStart);
      if (end === -1) {
        return {
          atoms,
          issue: `${relativeFile} contains an unterminated PowerShell here-string; correct it before relying on ${ENCODED_SOURCE_LITERAL_CENSUS_SCHEMA}`,
        };
      }
      addMatches(
        atoms,
        source.slice(bodyStart, end),
        bodyStart,
        "string",
        relativeFile,
        source,
        undefined,
      );
      index = end + terminator.length;
      continue;
    }
    let openerLength = 1;
    if (python && source.slice(index, index + 3) === quote.repeat(3)) openerLength = 3;
    if (csharp && quote === '"') {
      while (source[index + openerLength] === '"') openerLength += 1;
      if (openerLength < 3) openerLength = 1;
    }
    const delimiter = quote.repeat(openerLength);
    const verbatim = !python && source[index - 1] === "@";
    const bodyStart = index + openerLength;
    let end = bodyStart;
    while (end < source.length) {
      if (!powershell && !verbatim && source[end] === "\\") {
        end += 2;
        continue;
      }
      if (powershell && source[end] === "`") {
        end += 2;
        continue;
      }
      if (powershell && source.startsWith(quote.repeat(2), end)) {
        end += 2;
        continue;
      }
      if (verbatim && source.startsWith(quote.repeat(2), end)) {
        end += 2;
        continue;
      }
      if (source.startsWith(delimiter, end)) break;
      end += 1;
    }
    if (end >= source.length) {
      return {
        atoms,
        issue: `${relativeFile} contains an unterminated quoted literal; correct it before relying on ${ENCODED_SOURCE_LITERAL_CENSUS_SCHEMA}`,
      };
    }
    addMatches(
      atoms,
      source.slice(bodyStart, end),
      bodyStart,
      "string",
      relativeFile,
      source,
      undefined,
    );
    index = end + openerLength;
  }
  // These languages can nest same-quote literals inside interpolation expressions
  // (for example, Python 3.12+ f-strings and C# interpolated strings). The small
  // lexer above classifies ordinary strings and comments, while this conservative
  // overlay guarantees that no qualifying contiguous run disappears when a nested
  // language construct makes the outer delimiter ambiguous. Existing classified
  // spans win, so exact whole-comment terminal metadata keeps its narrow status.
  const classifiedSpans = new Set(atoms.map(atomKey));
  const conservativeAtoms = [];
  addMatches(
    conservativeAtoms,
    source,
    0,
    "lexical-source-overlay",
    relativeFile,
    source,
    undefined,
  );
  atoms.push(...conservativeAtoms.filter((atom) => !classifiedSpans.has(atomKey(atom))));
  return { atoms, sourceFile: undefined, issue: undefined };
};

const collectExecutable = (relativeFile, source) => {
  const scriptKind = scriptKindFor(relativeFile);
  const sourceFile = ts.createSourceFile(
    relativeFile,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  if (sourceFile.parseDiagnostics.length > 0) {
    const diagnostic = sourceFile.parseDiagnostics[0];
    return {
      atoms: [],
      sourceFile,
      issue: `${relativeFile} could not be parsed for ${ENCODED_SOURCE_LITERAL_CENSUS_SCHEMA} at offset ${diagnostic.start ?? 0}; correct the syntax before relying on the encoded-source census`,
    };
  }
  const atoms = [];
  let nodeCount = 0;
  let overNodeLimit = false;
  const visit = (node) => {
    nodeCount += 1;
    if (nodeCount > maximumAstNodes) {
      overNodeLimit = true;
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const nodeStart = node.getStart(sourceFile);
      const rawLiteral = source.slice(nodeStart, node.getEnd());
      const value = ts.isNoSubstitutionTemplateLiteral(node)
        ? (node.rawText ?? node.text)
        : rawLiteral.slice(1, -1);
      addMatches(
        atoms,
        value,
        ts.isNoSubstitutionTemplateLiteral(node)
          ? literalBase(node, sourceFile, source)
          : nodeStart + 1,
        ts.isNoSubstitutionTemplateLiteral(node) ? "template-raw" : "string",
        relativeFile,
        source,
        node,
      );
      return;
    }
    if (ts.isTemplateExpression(node)) {
      addMatches(
        atoms,
        node.head.rawText ?? node.head.text,
        literalBase(node.head, sourceFile, source),
        "template-head-raw",
        relativeFile,
        source,
        node.head,
      );
      for (const span of node.templateSpans) {
        visit(span.expression);
        addMatches(
          atoms,
          span.literal.rawText ?? span.literal.text,
          literalBase(span.literal, sourceFile, source),
          "template-tail-raw",
          relativeFile,
          source,
          span.literal,
        );
      }
      return;
    }
    if (ts.isJsxText(node)) {
      addMatches(
        atoms,
        node.getText(sourceFile),
        node.getStart(sourceFile),
        "jsx-text",
        relativeFile,
        source,
        node,
      );
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  collectComments(atoms, relativeFile, source);
  return {
    atoms,
    sourceFile,
    issue: overNodeLimit
      ? `${relativeFile} exceeds the ${maximumAstNodes}-node ${ENCODED_SOURCE_LITERAL_CENSUS_SCHEMA} review limit; split the source before relying on the encoded-source census`
      : undefined,
  };
};

export const collectFileEncodedAtoms = (relativeFile, source) => {
  const normalizedFile = normalizePath(relativeFile);
  if (lexicallyReviewedExecutableExtension.test(normalizedFile)) {
    return collectLexicallyReviewedExecutable(normalizedFile, source);
  }
  if (!executableSourceExtension.test(normalizedFile)) {
    const atoms = [];
    addMatches(atoms, source, 0, "reviewed-text", normalizedFile, source, undefined);
    return { atoms, sourceFile: undefined, issue: undefined };
  }
  return collectExecutable(normalizedFile, source);
};

export function collectEncodedSourceLiteralCensus(entries) {
  const issues = [];
  const ledger = [];
  const sourcesByPath = new Map();
  for (const entry of [...entries].sort((left, right) =>
    codeUnitCompare(normalizePath(left.relativeFile), normalizePath(right.relativeFile)),
  )) {
    const relativeFile = normalizePath(entry.relativeFile);
    if (!sourcesByPath.has(relativeFile)) sourcesByPath.set(relativeFile, entry.source);
  }
  for (const [relativeFile, source] of sourcesByPath) {
    const { atoms, issue } = collectFileEncodedAtoms(relativeFile, source);
    if (issue !== undefined) {
      issues.push(issue);
      continue;
    }
    const unique = new Map(atoms.map((atom) => [atomKey(atom), atom]));
    for (const atom of unique.values()) {
      const classification = atom.terminalCommentExempt
        ? "terminal-comment-metadata"
        : "non-exempt";
      ledger.push({ ...atom, classification });
    }
  }
  ledger.sort(
    (left, right) =>
      codeUnitCompare(left.relativeFile, right.relativeFile) ||
      left.start - right.start ||
      left.end - right.end,
  );
  const nonExempt = ledger.filter(({ classification }) => classification === "non-exempt");
  const totalCharacters = ledger.reduce((total, atom) => total + atom.length, 0);
  const overlong = nonExempt.filter(({ length }) => length >= singleAtomLimit);
  if (overlong.length > 0) {
    issues.push(
      `${ENCODED_SOURCE_LITERAL_CENSUS_SCHEMA} refuses ${overlong.length} non-exempt atom(s) at or above ${singleAtomLimit} characters; replace embedded bytes with a digest-bound external artifact`,
    );
  }
  const diagnosticLedger = ledger.map(
    ({ relativeFile, start, end, length, kind, context, classification, value }) => ({
      relativeFile,
      start,
      end,
      length,
      kind,
      context,
      classification,
      atomClass: classifyAtomValue(value),
      valueDigest: createHash("sha256").update(value).digest("hex"),
    }),
  );
  const ledgerDigest = createHash("sha256").update(JSON.stringify(diagnosticLedger)).digest("hex");
  const fileSubtotals = Object.fromEntries(
    [...new Set(diagnosticLedger.map(({ relativeFile }) => relativeFile))]
      .sort()
      .map((relativeFile) => [
        relativeFile,
        diagnosticLedger
          .filter((atom) => atom.relativeFile === relativeFile)
          .reduce((total, atom) => total + atom.length, 0),
      ]),
  );
  const classificationSubtotals = Object.fromEntries(
    ["non-exempt", "terminal-comment-metadata"].map((classification) => [
      classification,
      ledger
        .filter((atom) => atom.classification === classification)
        .reduce((total, atom) => total + atom.length, 0),
    ]),
  );
  const atomClassSubtotals = Object.fromEntries(
    [
      "exact-64-lower-hex",
      "exact-40-lower-hex",
      "exact-32-lower-hex",
      "base64-padding",
      "identifier-like-alnum",
      "base64-symbol",
    ].map((atomClass) => [
      atomClass,
      diagnosticLedger
        .filter((atom) => atom.atomClass === atomClass)
        .reduce((total, atom) => total + atom.length, 0),
    ]),
  );
  if (overlong.length > 0) {
    const leadingCandidates = diagnosticLedger
      .filter(
        ({ classification, length }) =>
          classification === "non-exempt" && length >= singleAtomLimit,
      )
      .slice(0, 20)
      .map(
        ({ relativeFile, start, end, length, kind, context }) =>
          `${relativeFile}:${start}-${end} len=${length} kind=${kind} context=${context}`,
      )
      .join(" | ");
    const leadingFiles = Object.entries(fileSubtotals)
      .sort((left, right) => right[1] - left[1] || codeUnitCompare(left[0], right[0]))
      .slice(0, 20)
      .map(([relativeFile, characters]) => `${relativeFile}=${characters}`)
      .join(", ");
    issues.push(
      `${ENCODED_SOURCE_LITERAL_CENSUS_SCHEMA} deterministic candidate ledger sha256:${ledgerDigest}; leading file subtotals: ${leadingFiles}; first candidate spans: ${leadingCandidates}`,
    );
  }
  return {
    schema: ENCODED_SOURCE_LITERAL_CENSUS_SCHEMA,
    issues,
    ledger: diagnosticLedger,
    totalCharacters,
    atomCount: ledger.length,
    ledgerDigest,
    fileSubtotals,
    classificationSubtotals,
    atomClassSubtotals,
  };
}
