import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import ts from "typescript";

import {
  ENCODED_SOURCE_LITERAL_CENSUS_SCHEMA,
  collectEncodedSourceLiteralCensus,
  executableSourceExtension,
} from "./check-bom-literal-census.mjs";

const maximumReviewedSourceBytes = 4_194_304;
export const PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS = Object.freeze({
  maximumAggregateBytes: 32 * 1024 * 1024,
  maximumAggregateEntries: 4_096,
  maximumBatchEntries: 32,
  maximumBatchInputBytes: 8 * 1024 * 1024,
  maximumFileBytes: maximumReviewedSourceBytes,
  maximumOutputBytes: 1024 * 1024,
  timeoutMilliseconds: 10_000,
});
const forbiddenRawSourceExtension = /\.(?:bin|bundle|dat|glb|gltf|ldr|lxf|lxfml|mpd|pyc|xml)$/iu;
const reviewedTextSourceExtension = /\.(?:cs|css|html|js|json|jsx|md|mjs|mts|ps1|py|ts|tsx|txt)$/iu;
const forbiddenBinarySignatures = [
  ["ZIP", Buffer.from([0x50, 0x4b, 0x03, 0x04])],
  ["empty ZIP", Buffer.from([0x50, 0x4b, 0x05, 0x06])],
  ["spanned ZIP", Buffer.from([0x50, 0x4b, 0x07, 0x08])],
  ["PNG", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ["JPEG", Buffer.from([0xff, 0xd8, 0xff])],
  ["GIF87a", Buffer.from("GIF87a")],
  ["GIF89a", Buffer.from("GIF89a")],
  ["little-endian TIFF", Buffer.from([0x49, 0x49, 0x2a, 0x00])],
  ["big-endian TIFF", Buffer.from([0x4d, 0x4d, 0x00, 0x2a])],
  ["ICO", Buffer.from([0x00, 0x00, 0x01, 0x00])],
  ["gzip", Buffer.from([0x1f, 0x8b])],
  ["7-Zip", Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])],
  ["RAR", Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])],
];

const normalizePath = (value) => value.replaceAll("\\", "/");
const censusSizedAtomPattern = /[A-Za-z0-9+/]{31,}={0,2}/u;

const scriptKindFor = (relativeFile) => {
  if (/\.tsx$/iu.test(relativeFile)) return ts.ScriptKind.TSX;
  if (/\.jsx$/iu.test(relativeFile)) return ts.ScriptKind.JSX;
  if (/\.mts$/iu.test(relativeFile)) return ts.ScriptKind.TS;
  if (/\.ts$/iu.test(relativeFile)) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
};

const transparentExpressionChild = (node) => {
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

const rawLiteralBody = (node, sourceFile, source) => {
  const raw = source.slice(node.getStart(sourceFile), node.getEnd());
  return raw.slice(1, -1);
};

const constantStringLeaves = (node, sourceFile, source) => {
  const transparentChild = transparentExpressionChild(node);
  if (transparentChild !== undefined) {
    return constantStringLeaves(transparentChild, sourceFile, source);
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return [{ rawBody: rawLiteralBody(node, sourceFile, source) }];
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = constantStringLeaves(node.left, sourceFile, source);
    const right = constantStringLeaves(node.right, sourceFile, source);
    if (left !== undefined && right !== undefined) return [...left, ...right];
  }
  return undefined;
};

const hasContainingConstantStringConcatenation = (node, sourceFile, source) => {
  let expression = node;
  while (
    expression.parent !== undefined &&
    transparentExpressionChild(expression.parent) === expression
  ) {
    expression = expression.parent;
  }
  return (
    expression.parent !== undefined &&
    ts.isBinaryExpression(expression.parent) &&
    expression.parent.operatorToken.kind === ts.SyntaxKind.PlusToken &&
    constantStringLeaves(expression.parent, sourceFile, source) !== undefined
  );
};

const jsLiteralOnlyPlusIssues = (relativeFile, source) => {
  const sourceFile = ts.createSourceFile(
    relativeFile,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(relativeFile),
  );
  if (sourceFile.parseDiagnostics.length > 0) return [];
  const issues = [];
  const visit = (node) => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const leaves = constantStringLeaves(node, sourceFile, source);
      if (
        leaves !== undefined &&
        leaves.length > 1 &&
        !hasContainingConstantStringConcatenation(node, sourceFile, source) &&
        leaves.some(({ rawBody }) => censusSizedAtomPattern.test(rawBody))
      ) {
        issues.push(
          `${relativeFile}:${node.getStart(sourceFile)} has a binary + expression made only from string literal leaves, one of which contains a census-size atom; write the resulting string as one canonical literal instead of fragmenting census-visible source`,
        );
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return issues;
};

const pythonLiteralJoinProgram = String.raw`
import ast
import io
import json
import re
import sys
import tokenize

CENSUS_ATOM = re.compile(r"[A-Za-z0-9+/]{31,}={0,2}")

def raw_literal_token_body(spelling):
    match = re.match(r"(?is)^[rubf]*(\"\"\"|'''|\"|')", spelling)
    if match is None:
        raise ValueError("unsupported Python string-token spelling")
    delimiter = match.group(1)
    if not spelling.endswith(delimiter):
        raise ValueError("unterminated Python string-token spelling")
    return spelling[match.end():len(spelling) - len(delimiter)]

def literal_tokens(source, node):
    segment = ast.get_source_segment(source, node)
    if segment is None:
        raise ValueError("Python AST omitted a raw string-literal source segment")
    values = []
    try:
        tokens = tokenize.generate_tokens(io.StringIO(segment).readline)
        for token in tokens:
            if token.type != tokenize.STRING:
                continue
            values.append({"rawBody": raw_literal_token_body(token.string)})
    except (IndentationError, SyntaxError, tokenize.TokenError):
        raise ValueError("Python tokenizer could not recover raw string-literal bodies")
    if not values:
        raise ValueError("Python tokenizer found no raw string-literal body")
    return values

def constant_string_leaves(source, node):
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return literal_tokens(source, node)
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        left = constant_string_leaves(source, node.left)
        right = constant_string_leaves(source, node.right)
        if left is not None and right is not None:
            return left + right
    return None

def analyze(entry):
    relative_file = entry["relativeFile"]
    source = entry["source"]
    try:
        tree = ast.parse(source, filename=relative_file)
    except SyntaxError as error:
        return [
            f"{relative_file}:{error.lineno or 1}:{error.offset or 0} could not be parsed for the Python literal-only binary + and implicit-adjacency policy; correct the Python syntax before relying on the encoded-source census"
        ]
    parents = {}
    for parent in ast.walk(tree):
        for child in ast.iter_child_nodes(parent):
            parents[child] = parent
    issues = []
    for node in ast.walk(tree):
        leaves = None
        composition = None
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
            leaves = constant_string_leaves(source, node)
            composition = "binary + expression made only from string literal leaves"
        elif isinstance(node, ast.Constant) and isinstance(node.value, str):
            if isinstance(parents.get(node), ast.JoinedStr):
                continue
            candidate = literal_tokens(source, node)
            if len(candidate) > 1:
                leaves = candidate
                composition = "implicit adjacent string literals"
        if leaves is None or len(leaves) < 2:
            continue
        parent = parents.get(node)
        if (
            isinstance(parent, ast.BinOp)
            and isinstance(parent.op, ast.Add)
            and constant_string_leaves(source, parent) is not None
        ):
            continue
        if any(CENSUS_ATOM.search(leaf["rawBody"]) for leaf in leaves):
            issues.append(
                f"{relative_file}:{getattr(node, 'lineno', 1)}:{getattr(node, 'col_offset', 0)} has {composition}, one of which contains a census-size atom; write the resulting string as one canonical literal instead of fragmenting census-visible source"
            )
    return issues

payload = json.load(sys.stdin)
print(json.dumps({"issues": [issue for entry in payload for issue in analyze(entry)]}))
`;

const runPythonLiteralJoinBatch = (payload) =>
  spawnSync("python", ["-B", "-c", pythonLiteralJoinProgram], {
    encoding: "utf8",
    input: payload,
    maxBuffer: PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS.maximumOutputBytes,
    timeout: PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS.timeoutMilliseconds,
    windowsHide: true,
  });

const pythonAnalysisFailure = (label, detail) =>
  `Python AST analysis failed closed for the literal-only binary + and implicit-adjacency policy in ${label} (${detail}); restore the pinned Python runtime or reduce the bounded input before relying on the encoded-source census`;

const serializedBatchBytes = (entries) => Buffer.byteLength(JSON.stringify(entries), "utf8");

const planPythonLiteralJoinBatches = (entries) => {
  const limits = PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS;
  const ordered = [...entries].sort((left, right) =>
    left.relativeFile < right.relativeFile ? -1 : left.relativeFile > right.relativeFile ? 1 : 0,
  );
  if (ordered.length > limits.maximumAggregateEntries) {
    return {
      batches: [],
      issues: [
        pythonAnalysisFailure(
          "the aggregate Python source population",
          `${ordered.length} entries exceed the ${limits.maximumAggregateEntries}-entry cap`,
        ),
      ],
    };
  }

  let aggregateBytes = 0;
  for (const entry of ordered) {
    const fileBytes = Buffer.byteLength(entry.source, "utf8");
    if (fileBytes > limits.maximumFileBytes) {
      return {
        batches: [],
        issues: [
          pythonAnalysisFailure(
            entry.relativeFile,
            `${fileBytes} UTF-8 bytes exceed the ${limits.maximumFileBytes}-byte per-file cap`,
          ),
        ],
      };
    }
    aggregateBytes += fileBytes;
    if (aggregateBytes > limits.maximumAggregateBytes) {
      return {
        batches: [],
        issues: [
          pythonAnalysisFailure(
            "the aggregate Python source population",
            `${aggregateBytes} UTF-8 bytes exceed the ${limits.maximumAggregateBytes}-byte cap`,
          ),
        ],
      };
    }
  }

  const batches = [];
  let batch = [];
  for (const entry of ordered) {
    const singletonBytes = serializedBatchBytes([entry]);
    if (singletonBytes > limits.maximumBatchInputBytes) {
      return {
        batches: [],
        issues: [
          pythonAnalysisFailure(
            entry.relativeFile,
            `${singletonBytes} serialized bytes exceed the ${limits.maximumBatchInputBytes}-byte analyzer-input cap`,
          ),
        ],
      };
    }
    const candidate = [...batch, entry];
    if (
      batch.length > 0 &&
      (candidate.length > limits.maximumBatchEntries ||
        serializedBatchBytes(candidate) > limits.maximumBatchInputBytes)
    ) {
      batches.push(batch);
      batch = [entry];
    } else {
      batch = candidate;
    }
  }
  if (batch.length > 0) batches.push(batch);
  return { batches, issues: [] };
};

export const inspectPythonLiteralJoinEntries = (entries, runBatch = runPythonLiteralJoinBatch) => {
  if (entries.length === 0) return [];
  const planned = planPythonLiteralJoinBatches(entries);
  if (planned.issues.length > 0) return planned.issues;
  const issues = [];
  for (const [index, batch] of planned.batches.entries()) {
    const payload = JSON.stringify(batch);
    const first = batch[0].relativeFile;
    const last = batch.at(-1).relativeFile;
    const label = `batch ${index + 1}/${planned.batches.length} (${first}..${last})`;
    let python;
    try {
      python = runBatch(payload, PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS);
    } catch (error) {
      issues.push(
        pythonAnalysisFailure(label, error instanceof Error ? error.message : String(error)),
      );
      continue;
    }
    const stdout = typeof python.stdout === "string" ? python.stdout : "";
    const stderr = typeof python.stderr === "string" ? python.stderr : "";
    if (
      Buffer.byteLength(stdout, "utf8") > PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS.maximumOutputBytes
    ) {
      issues.push(
        pythonAnalysisFailure(
          label,
          `stdout exceeds the ${PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS.maximumOutputBytes}-byte output cap`,
        ),
      );
      continue;
    }
    if (
      Buffer.byteLength(stderr, "utf8") > PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS.maximumOutputBytes
    ) {
      issues.push(
        pythonAnalysisFailure(
          label,
          `stderr exceeds the ${PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS.maximumOutputBytes}-byte output cap`,
        ),
      );
      continue;
    }
    if (python.error !== undefined || python.status !== 0 || stderr.trim() !== "") {
      const detail =
        python.error?.code === "ETIMEDOUT"
          ? `timed out after ${PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS.timeoutMilliseconds} ms`
          : (python.error?.message ?? (stderr.trim() || `exit ${python.status}`));
      issues.push(pythonAnalysisFailure(label, detail));
      continue;
    }
    try {
      const parsed = JSON.parse(stdout);
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        Object.keys(parsed).length === 1 &&
        Array.isArray(parsed.issues) &&
        parsed.issues.every((issue) => typeof issue === "string")
      ) {
        issues.push(...parsed.issues);
        continue;
      }
    } catch {
      // The bounded fail-closed diagnostic below is safer than malformed output.
    }
    issues.push(
      pythonAnalysisFailure(label, "the analyzer returned malformed or non-exact JSON output"),
    );
  }
  return issues;
};

const binarySignature = (bytes) => {
  const firstKilobyte = bytes.subarray(0, 1_024).toString("latin1");
  if (/^\s*%PDF-/u.test(firstKilobyte)) return "PDF";
  const known = forbiddenBinarySignatures.find(([, signature]) =>
    bytes.subarray(0, signature.length).equals(signature),
  );
  if (known !== undefined) return known[0];
  if (
    bytes.subarray(0, 4).equals(Buffer.from("RIFF")) &&
    bytes.subarray(8, 12).equals(Buffer.from("WEBP"))
  ) {
    return "WebP";
  }
  const boxSize = bytes.length >= 8 ? bytes.readUInt32BE(0) : 0;
  if (bytes.subarray(4, 8).equals(Buffer.from("ftyp")) && boxSize >= 8 && boxSize <= bytes.length) {
    return "ISO-BMFF";
  }
  const bmpSize = bytes.length >= 14 ? bytes.readUInt32LE(2) : 0;
  const bmpOffset = bytes.length >= 14 ? bytes.readUInt32LE(10) : 0;
  if (
    bytes.subarray(0, 2).equals(Buffer.from("BM")) &&
    bmpSize >= 14 &&
    bmpSize <= bytes.length &&
    bmpOffset >= 14 &&
    bmpOffset <= bmpSize
  ) {
    return "BMP";
  }
  return undefined;
};

const inspectBytes = (relativeFile, sourceBytes) => {
  const normalizedFile = normalizePath(relativeFile);
  const issues = [];
  if (forbiddenRawSourceExtension.test(normalizedFile)) {
    issues.push(
      `${normalizedFile} has a raw or compiled source extension forbidden from the ${ENCODED_SOURCE_LITERAL_CENSUS_SCHEMA} population; remove it or bind it to a separately reviewed artifact policy outside apps/packages/scripts`,
    );
    return { issues };
  }
  if (!reviewedTextSourceExtension.test(normalizedFile)) {
    issues.push(
      `${normalizedFile} has a file type that is not reviewed by ${ENCODED_SOURCE_LITERAL_CENSUS_SCHEMA}; add an explicit bounded text policy before including it`,
    );
    return { issues };
  }
  if (sourceBytes.length > maximumReviewedSourceBytes) {
    issues.push(
      `${normalizedFile} is ${sourceBytes.length} bytes, above the ${maximumReviewedSourceBytes}-byte ${ENCODED_SOURCE_LITERAL_CENSUS_SCHEMA} review limit; split the source`,
    );
    return { issues };
  }
  const signature = binarySignature(sourceBytes);
  if (signature !== undefined) {
    issues.push(
      `${normalizedFile} contains a ${signature} binary signature under a reviewed text extension; retain only bounded metadata or use a separately reviewed artifact policy`,
    );
    return { issues };
  }
  const controlCount = sourceBytes.reduce(
    (total, byte) =>
      total + (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d ? 1 : 0),
    0,
  );
  if (controlCount > 8) {
    issues.push(
      `${normalizedFile} contains ${controlCount} binary control bytes under a reviewed text extension; retain only bounded metadata or use a separately reviewed artifact policy`,
    );
    return { issues };
  }
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes);
  } catch {
    issues.push(
      `${normalizedFile} is not valid UTF-8 despite using a reviewed text extension; use a separately reviewed artifact policy`,
    );
    return { issues };
  }
  return { issues, source };
};

export function inspectAppPackageSourceCensus(entries, dependencyEntries = []) {
  const issues = [];
  const censusEntries = [];
  const pythonEntries = [];
  const seen = new Set();
  for (const entry of [...entries, ...dependencyEntries]) {
    const relativeFile = normalizePath(entry.relativeFile);
    if (seen.has(relativeFile)) continue;
    seen.add(relativeFile);
    const inspected = inspectBytes(relativeFile, entry.sourceBytes);
    issues.push(...inspected.issues);
    if (inspected.source !== undefined) {
      censusEntries.push({ relativeFile, source: inspected.source });
      if (/\.py$/iu.test(relativeFile)) {
        pythonEntries.push({ relativeFile, source: inspected.source });
      } else if (executableSourceExtension.test(relativeFile)) {
        issues.push(...jsLiteralOnlyPlusIssues(relativeFile, inspected.source));
      }
    }
  }
  issues.push(...inspectPythonLiteralJoinEntries(pythonEntries));
  const census = collectEncodedSourceLiteralCensus(censusEntries);
  issues.push(...census.issues);
  return { ...census, issues };
}

export function inspectAppPackageSourceBytes(relativeFile, sourceBytes) {
  return inspectAppPackageSourceCensus([{ relativeFile, sourceBytes }]).issues;
}

export function inspectAppPackageSourceEntries(entries, dependencyEntries = []) {
  return inspectAppPackageSourceCensus(entries, dependencyEntries).issues;
}

export function inspectAppPackageSourceFiles(files, dependencyFiles = []) {
  const convert = ({ relativeFile, absoluteFile }) => ({
    relativeFile,
    sourceBytes: readFileSync(absoluteFile),
  });
  return inspectAppPackageSourceEntries(files.map(convert), dependencyFiles.map(convert));
}

export function inspectAppPackageSourceFilesCensus(files, dependencyFiles = []) {
  const convert = ({ relativeFile, absoluteFile }) => ({
    relativeFile,
    sourceBytes: readFileSync(absoluteFile),
  });
  return inspectAppPackageSourceCensus(files.map(convert), dependencyFiles.map(convert));
}
