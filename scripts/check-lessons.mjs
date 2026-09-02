import { readFileSync } from "node:fs";

/**
 * Lessons live in two files on purpose.
 *
 * `lessons.md` is the one-line rule for each lesson and is what a session reads
 * at start. `lessons-evidence.md` holds the war stories and anchors and is
 * opened only when a rule is in doubt. Telling an agent to read part of one
 * large file does not work — reading a file reads all of it — so the split is
 * what actually keeps the session-start cost small.
 *
 * Two files, not one per lesson. Anthropic's progressive-disclosure guidance
 * groups reference material by domain rather than by item, and expects a
 * reference file of a hundred-odd lines to be normal. Split the evidence file by
 * subsystem if it outgrows that; splitting per lesson would trade a cheap read
 * for dozens of files and make reading all the lessons about one subsystem
 * expensive again.
 *
 * Splitting is only safe if the halves cannot drift, which is what this checks:
 * every rule has an entry, every entry has a rule, and every link resolves.
 */
const RULES = "docs/learning/lessons.md";
const EVIDENCE = "docs/learning/lessons-evidence.md";

function fail(message) {
  console.error(`Lessons check failed: ${message}`);
  process.exit(1);
}

function read(path) {
  try {
    return readFileSync(path, "utf8").split(/\r?\n/);
  } catch {
    return fail(`${path} is missing; the rules index and its evidence are both required`);
  }
}

/** GitHub's heading anchor: lowercased, punctuation dropped, spaces hyphenated. */
function slugify(heading) {
  return heading
    .toLowerCase()
    .replace(/[`'’"]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const rulesLines = read(RULES);
const evidenceLines = read(EVIDENCE);

const rulesHeading = rulesLines.indexOf("## Rules");
if (rulesHeading < 0) fail(`${RULES} has no "## Rules" section; session start reads that`);

const rules = rulesLines.slice(rulesHeading + 1).filter((line) => line.startsWith("- "));
// A heading inside a fenced block is a template example, not a lesson.
let fenced = false;
const entries = [];
for (const line of evidenceLines) {
  if (line.trimStart().startsWith("```")) fenced = !fenced;
  else if (!fenced && line.startsWith("## ") && line.slice(3).trim() !== "Entries") {
    entries.push(line.slice(3).trim());
  }
}

if (rules.length === 0) fail(`${RULES} lists no rules`);
if (entries.length === 0) fail(`${EVIDENCE} holds no entries`);
if (rules.length !== entries.length) {
  fail(
    `${RULES} lists ${rules.length} rule(s) but ${EVIDENCE} holds ${entries.length} entr(y|ies). ` +
      `A session reading only the rules would miss the difference. Entries: ${entries
        .map((entry) => `"${entry}"`)
        .join(", ")}`,
  );
}

const anchors = new Set(entries.map(slugify));
for (const rule of rules) {
  const link = /\[evidence\]\(lessons-evidence\.md#([a-z0-9-]+)\)/.exec(rule);
  if (!link) {
    fail(`A rule has no link to its evidence, so nobody can reach it: ${rule.slice(0, 120)}`);
  }
  if (!anchors.has(link[1])) {
    fail(
      `A rule links to "${link[1]}", which no entry heading produces. ` +
        `Available: ${[...anchors].join(", ")}`,
    );
  }
}

/**
 * The claim, without its evidence link and without the gate clause after it.
 *
 * A rule is two things: the transferring claim, which is what a reader has to
 * hold, and the gate it is waiting for, which is what makes the line a queue
 * entry rather than a destination. They are measured separately — a long clause
 * naming a test file must not push a short claim over the index's budget, and an
 * unbounded claim must not hide behind one.
 */
const claimOf = (rule) =>
  rule.replace(/\s*\(\[evidence\].*$/, "").replace(/\s*\*\*Waiting on:\*\*.*$/s, "");

// The index earns its keep only by staying short.
const overlong = rules.filter((rule) => claimOf(rule).length > 160);
if (overlong.length > 0) {
  fail(
    `${overlong.length} rule(s) state a claim longer than 160 characters, which defeats an index. ` +
      `The gate clause after "**Waiting on:**" is not counted against it. ` +
      `First: ${overlong[0].slice(0, 120)}…`,
  );
}

/**
 * Every rule names the gate it is waiting for.
 *
 * A lesson is a queue entry, not a destination: it is deleted in the commit that
 * lands its gate, so it has to say which gate that is, and until then every
 * session in the repo pays to read it. An entry that can name no gate is not a
 * lesson — it is promoted into the fleet constitution through
 * canon-candidates.md, moved to docs/policies/local-rules.md when it binds only
 * here, or dropped. Without this check a line can sit in the queue for months
 * with nothing said about what would let it leave, which is how thirty of them
 * accumulated.
 */
const gateless = rules.filter((rule) => !/\*\*Waiting on:\*\*\s*\S/.test(rule));
if (gateless.length > 0) {
  fail(
    `${gateless.length} rule(s) name no gate. Add "**Waiting on:** <the test, lint rule, schema ` +
      `check or fixed command that would let this line be deleted>" — or promote the entry to ` +
      `canon-candidates.md, move it to docs/policies/local-rules.md, or drop it. ` +
      `First: ${claimOf(gateless[0]).slice(0, 120)}…`,
  );
}

const seen = new Set();
for (const rule of rules) {
  const text = claimOf(rule);
  if (seen.has(text)) fail(`Two rules say the same thing, so two entries teach it: ${text}`);
  seen.add(text);
}

console.log(
  `Lessons check passed: ${rules.length} rules in ${RULES}, each linked to an entry in ${EVIDENCE}.`,
);
