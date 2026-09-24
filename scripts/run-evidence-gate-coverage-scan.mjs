/**
 * Finds a describe/it/test gate (JS) or a `@unittest.skip*` decorator
 * (Python) whose condition checks an ignored path's existence directly,
 * bypassing `scripts/run-evidence-gate.mjs` / `scripts/run_evidence_gate.py`'s
 * `LEGO_RUN_EVIDENCE` opt-in. This is the defect class of
 * `scripts/part-identification-2453-builder-identity.test.mjs`'s
 * `describe.runIf(realEvidencePresent)` (`realEvidencePresent` an
 * `existsSync` check over ignored `output/` and external `C:/tmp` paths,
 * with no `LEGO_RUN_EVIDENCE` wiring): the default gate silently varies with
 * whatever a machine's ignored files happen to hold.
 *
 * Bound: this reads only the given file's own text, resolving a bare
 * identifier condition one hop to its own local `const`/`let` declaration.
 * A condition built from an imported identifier, from more than one hop of
 * local indirection, or from a helper function whose body lives in another
 * module, is invisible to it. `real-build-builder-proper-world-contract
 * .test.ts`'s nested `it.skipIf(!hasBuilder2453IdentityEvidence)` is exactly
 * that shape (the identifier is imported, not locally declared) and is
 * verified safe by hand, not by this scan, because it sits inside an outer
 * evidence-gated describe. `real-build-step7-gate3-diagnostic.spec.ts`'s
 * `sampleBookletAvailable: hasSampleBooklet` argument to
 * `resolveStep7Gate3InvocationPolicy` is the same shape one hop further away
 * (through a function call, not a direct condition) and is likewise verified
 * safe by hand: that policy skips by default for an unrelated reason and only
 * consults the booklet's presence once a diagnostic mode is explicitly
 * requested, where it throws rather than skips. Platform gates
 * (`process.platform`, `os.name`) are excluded on sight.
 *
 * Playwright's own idiom is a plain `test.skip(condition, reason)` call
 * inside the test body rather than vitest's `.runIf`/`.skipIf` chain, so this
 * also matches a bare `test.skip(` call and resolves only its first
 * (condition) argument, split at the top-level comma before `reason` — never
 * the whole two-argument span, which would let an innocent word in the
 * description string produce a false match. `findEvidenceGateScanTargets`
 * reads Playwright's spec population from `playwright.config.ts` itself.
 */

/**
 * `hasSampleBooklet` (`apps/web/e2e/sample-booklet.ts`) is named directly,
 * not just matched through `existsSync`, because it is always imported —
 * never declared locally in the file that gates on it — so the one-hop local
 * `const`/`let` resolution below can never see through it back to the
 * `existsSync` call inside `sample-booklet.ts`. It is exactly the flag the
 * whole G3f-3 conversion (`apps/web/e2e/run-evidence-gate.ts`'s
 * `skipWithoutRunEvidence`) exists to keep out of a raw `test.skip`/`.runIf`/
 * `.skipIf` condition, so it is named on sight rather than left to a general
 * resolution rule that cannot reach it.
 */
const EXISTENCE_TOKENS_JS = ["existsSync", "hasSampleBooklet"];
const EXISTENCE_TOKENS_PY = [".is_file(", ".is_dir(", ".exists(", "os.path.exists("];
const PLATFORM_TOKENS = ["process.platform", "os.name"];

/** Returns the text strictly between the parenthesis at `openParenIndex` and its match, or null. */
function balancedParenSpan(text, openParenIndex) {
  let depth = 0;
  for (let index = openParenIndex; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(openParenIndex + 1, index);
    }
  }
  return null;
}

/**
 * Splits `argsText` at its first top-level comma (outside nested brackets and
 * string literals) and returns the text before it, or the whole text if there
 * is none. Used to isolate `test.skip(condition, reason)`'s first argument so
 * a description string cannot itself trigger a false match.
 */
function firstTopLevelArg(argsText) {
  let depth = 0;
  let stringDelimiter = null;
  for (let index = 0; index < argsText.length; index += 1) {
    const char = argsText[index];
    if (stringDelimiter !== null) {
      if (char === "\\") {
        index += 1;
      } else if (char === stringDelimiter) {
        stringDelimiter = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      stringDelimiter = char;
    } else if (char === "(" || char === "[" || char === "{") {
      depth += 1;
    } else if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
    } else if (char === "," && depth === 0) {
      return argsText.slice(0, index);
    }
  }
  return argsText;
}

function localDeclarationRhs(text, identifier) {
  const declaration = new RegExp(`(?:^|[^.\\w])(?:const|let)\\s+${identifier}\\s*=\\s*`, "u");
  const match = declaration.exec(text);
  if (match === null) return null;
  const rhsStart = match.index + match[0].length;
  const semicolon = text.indexOf(";", rhsStart);
  return text.slice(rhsStart, semicolon === -1 ? text.length : semicolon);
}

function resolvesToExistenceCheck(conditionText, fileText, tokens) {
  const trimmed = conditionText.trim();
  if (tokens.some((token) => trimmed.includes(token))) return true;
  const bareIdentifier = /^[!\s]*([A-Za-z_$][\w$]*)\s*(?:\(\s*\))?\s*(?:!==?\s*null)?$/u.exec(
    trimmed,
  );
  if (bareIdentifier === null) return false;
  const rhs = localDeclarationRhs(fileText, bareIdentifier[1]);
  return rhs !== null && tokens.some((token) => rhs.includes(token));
}

/**
 * @param {string} path repository-relative path, forward-slash separated
 * @param {string} text the file's own source text
 * @returns {{ path: string, condition: string }[]}
 */
export function findUnwiredExistenceGates(path, text) {
  const violations = [];

  if (path.endsWith(".py")) {
    const decoratorStart = /@unittest\.skip(?:Unless|If)\(/gu;
    for (
      let decoratorMatch = decoratorStart.exec(text);
      decoratorMatch !== null;
      decoratorMatch = decoratorStart.exec(text)
    ) {
      const args = balancedParenSpan(text, decoratorStart.lastIndex - 1);
      if (args === null) continue;
      if (PLATFORM_TOKENS.some((token) => args.includes(token))) continue;
      if (EXISTENCE_TOKENS_PY.some((token) => args.includes(token))) {
        violations.push({ path, condition: args.trim().slice(0, 200) });
      }
    }
    return violations;
  }

  const gateCall = /\b(?:describe|it|test)\.(?:runIf|skipIf)\(/gu;
  for (let gateMatch = gateCall.exec(text); gateMatch !== null; gateMatch = gateCall.exec(text)) {
    const args = balancedParenSpan(text, gateCall.lastIndex - 1);
    if (args === null) continue;
    if (PLATFORM_TOKENS.some((token) => args.includes(token))) continue;
    if (resolvesToExistenceCheck(args, text, EXISTENCE_TOKENS_JS)) {
      violations.push({ path, condition: args.trim().slice(0, 200) });
    }
  }

  const bareSkipCall = /\btest\.skip\(/gu;
  for (
    let skipMatch = bareSkipCall.exec(text);
    skipMatch !== null;
    skipMatch = bareSkipCall.exec(text)
  ) {
    const args = balancedParenSpan(text, bareSkipCall.lastIndex - 1);
    if (args === null) continue;
    const condition = firstTopLevelArg(args);
    if (PLATFORM_TOKENS.some((token) => condition.includes(token))) continue;
    if (resolvesToExistenceCheck(condition, text, EXISTENCE_TOKENS_JS)) {
      violations.push({ path, condition: condition.trim().slice(0, 200) });
    }
  }

  const ternaryGate = /=\s*([^;\n]+?)\s*\?\s*(describe|it|test)\s*:\s*\2\.skip\s*;/gu;
  for (
    let ternaryMatch = ternaryGate.exec(text);
    ternaryMatch !== null;
    ternaryMatch = ternaryGate.exec(text)
  ) {
    const condition = ternaryMatch[1];
    if (PLATFORM_TOKENS.some((token) => condition.includes(token))) continue;
    if (resolvesToExistenceCheck(condition, text, EXISTENCE_TOKENS_JS)) {
      violations.push({ path, condition: condition.trim().slice(0, 200) });
    }
  }

  return violations;
}
