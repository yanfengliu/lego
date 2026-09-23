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
 * evidence-gated describe. Platform gates (`process.platform`, `os.name`) are
 * excluded on sight. Playwright's `apps/web/e2e` `.spec.ts` population is out
 * of this scan's file list entirely (see `findEvidenceGateScanTargets`): a
 * separate, unconverted population flagged for its own pass, not silently
 * approved by this gate's silence.
 */

const EXISTENCE_TOKENS_JS = ["existsSync"];
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
