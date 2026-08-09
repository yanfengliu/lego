/**
 * The gate for the catalog part standard.
 *
 * Run it whenever a part is added or changed. It prints every violation rather
 * than stopping at the first, because the shape of the gap is the useful thing:
 * a rule broken by one part is a modelling slip, and a rule broken by seventy is
 * a standard the catalog never had.
 *
 * This gate is not yet in `npm run verify`, and that is a deliberate, temporary
 * statement rather than an oversight - the catalog does not meet its own
 * standard today, so wiring it into verify would make every unrelated change
 * red. `docs/design/building-system.md` records the count that must reach zero.
 * When it does, this belongs in the chain beside the other :check scripts, and
 * the note there comes out.
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
  process.stderr.write(`  ${list[0].detail}\n`);
  process.stderr.write(`  parts: ${list.map((entry) => entry.partId).join(", ")}\n\n`);
}
process.stderr.write(
  "Fix the part, or change the rule in packages/catalog/src/part-standard.ts and write down " +
    "why there. Never exempt a part quietly - a pixel comparison against an unmodelled face " +
    "measures the wrong thing precisely.\n",
);
process.exit(1);
