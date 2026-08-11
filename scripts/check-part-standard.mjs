/**
 * The gate for the catalog part standard.
 *
 * Run it whenever a part is added or changed. It prints every violation rather
 * than stopping at the first, because the shape of the gap is the useful thing:
 * a rule broken by one part is a modelling slip, and a rule broken by seventy is
 * a standard the catalog never had.
 *
 * This gate is part of `npm run verify`. New or changed catalog geometry must
 * leave the whole catalog green; there is no grandfathered declaration debt.
 */
import { BUILTIN_CATALOG } from "../packages/catalog/src/index.ts";
import { catalogStandardViolations } from "../packages/catalog/src/part-standard.ts";

const parts = Array.isArray(BUILTIN_CATALOG) ? BUILTIN_CATALOG : BUILTIN_CATALOG.parts;
const violations = catalogStandardViolations(parts);

if (violations.length === 0) {
  process.stdout.write(`Part standard passed: ${parts.length} parts, no violations.\n`);
  process.exit(0);
}

const byRule = new Map();
for (const violation of violations) {
  const list = byRule.get(violation.rule) ?? [];
  list.push(violation);
  byRule.set(violation.rule, list);
}

process.stderr.write(
  `Part standard failed: ${violations.length} violation(s) across ${parts.length} part(s).\n\n`,
);
for (const [rule, list] of [...byRule].sort((a, b) => b[1].length - a[1].length)) {
  process.stderr.write(`${rule} — ${list.length} part(s)\n`);
  const byDetail = new Map();
  for (const violation of list) {
    const matching = byDetail.get(violation.detail) ?? [];
    matching.push(violation.partId);
    byDetail.set(violation.detail, matching);
  }
  for (const [detail, partIds] of byDetail) {
    process.stderr.write(`  ${detail}\n`);
    process.stderr.write(`  parts: ${partIds.join(", ")}\n`);
  }
  process.stderr.write("\n");
}
process.stderr.write(
  "Fix the part, or change the rule in packages/catalog/src/part-standard.ts and write down " +
    "why there. Never exempt a part quietly - a pixel comparison against an unmodelled face " +
    "measures the wrong thing precisely.\n",
);
process.exit(1);
