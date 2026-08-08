// What a `--check` gate says when a generated file stops matching its generator.
//
// Every such gate here compares whole formatted bytes, and that is the right
// comparison: it is the only one that catches everything. But it answers a
// single bit — same or different — and each gate then reported that bit as the
// domain change it usually means. `pin:check` said the run digest moved and
// printed the held and the produced digest side by side; on a CRLF checkout
// they were the same digest twice, so the message argued against its own
// verdict and sent the reader to regenerate something that had not moved.
//
// So the comparison stays and the reporting splits. Each gate names the domain
// values that moved when any did, and otherwise says plainly that only the
// bytes moved and hands over the first line that differs — which is the only
// thing a byte comparison actually knows.
//
// These gates live here together because they are one class of message, and a
// class is what the repository asks to be audited: the wording, the axis and
// the fix line stay in step across them by being written once. `pin:check` is
// named above as the incident rather than as a caller — it went with
// `packages/generation` when the AI copilot was cut.

/** Long enough to recognise a line, short enough not to wrap a terminal. */
const MAX_QUOTED_LINE = 120;

function countLines(count) {
  return `${count} line${count === 1 ? "" : "s"}`;
}

function describeLineEndings(text) {
  const crlf = text.match(/\r\n/g)?.length ?? 0;
  const lf = text.match(/(?<!\r)\n/g)?.length ?? 0;
  if (crlf > 0 && lf > 0) return `mixed endings (${crlf} CRLF, ${lf} LF)`;
  if (crlf > 0) return "CRLF endings";
  if (lf > 0) return "LF endings";
  return "no line ending at all";
}

// Quoted rather than printed raw: the difference is often a tab, a trailing
// space or a byte-order mark, and a bare paste renders those invisible.
//
// Exported because a refused model reply wants the same treatment for the same
// reason, and more strongly: that text is untrusted, so an escape or a control
// character in it has to be visible rather than rendered. The limit is a
// parameter because a quoted source line and a quoted JSON reply want different
// amounts — cutting a reply at 120 characters hides the key that broke it.
export function quoteLine(line, maxLength = MAX_QUOTED_LINE) {
  if (line === undefined) return "no such line";
  return JSON.stringify(line.length > maxLength ? `${line.slice(0, maxLength)}…` : line);
}

/**
 * Where two texts first stop agreeing, in terms a reader can act on.
 *
 * Returns null when they are identical, so a caller can use it as the staleness
 * test as well as the explanation.
 */
export function describeTextDifference(actual, expected) {
  if (actual === expected) return null;

  const actualLines = actual.split(/\r\n|\n/);
  const expectedLines = expected.split(/\r\n|\n/);
  const sharedLines = Math.min(actualLines.length, expectedLines.length);
  let index = 0;
  while (index < sharedLines && actualLines[index] === expectedLines[index]) index += 1;

  // Splitting drops the endings, so equal lines at equal counts leaves the
  // endings as the only thing left to differ. Worth its own sentence: that is a
  // checkout artifact rather than an edit, and no amount of reading the diff
  // will show it.
  if (index === sharedLines && actualLines.length === expectedLines.length) {
    return `only the line endings differ — on disk ${describeLineEndings(actual)}, generated ${describeLineEndings(expected)}`;
  }

  const onDisk = actualLines[index];
  const generated = expectedLines[index];
  const counts =
    actualLines.length === expectedLines.length
      ? `${countLines(actualLines.length)} either way`
      : `${countLines(actualLines.length)} on disk against ${countLines(expectedLines.length)} generated`;
  const whitespaceOnly =
    onDisk !== undefined && generated !== undefined && onDisk.trimEnd() === generated.trimEnd();
  return `line ${index + 1} is the first that differs, ${counts}: on disk ${quoteLine(onDisk)}, generated ${quoteLine(generated)}${whitespaceOnly ? " — they differ only in trailing whitespace" : ""}`;
}

/**
 * Name the items, or the first few and how many were not named.
 *
 * A gate that drops a lockfile can list a thousand names; a reader needs enough
 * to recognise the change and a count for the rest.
 */
export function nameSome(items, limit = 8) {
  const named = items.slice(0, limit);
  const tail = items.length > limit ? `${items.length - limit} more` : named.pop();
  if (named.length === 0) return tail ?? "";
  return `${named.join(", ")} and ${tail}`;
}

const NOTICES_PATH = "THIRD_PARTY_NOTICES.md";
const NOTICES_FIX = `Run \`npm run notices:generate\` and commit ${NOTICES_PATH}.`;

/**
 * The dependency rows, keyed by the identity each row is about.
 *
 * The notices file is generated whole, so a byte comparison decides staleness.
 * This is what a stale verdict has to be reported against: the reader's
 * question is which dependency moved, and the heading, the preamble and the
 * line endings can all move the bytes while the answer to it is "none".
 */
export function noticeRows(notices) {
  const rows = new Map();
  for (const line of notices.split(/\r\n|\n/)) {
    if (!line.startsWith("|")) continue;
    // Split on the unescaped delimiters only; the generator escapes the rest.
    const cells = line.slice(1, -1).split(/(?<!\\)\|/);
    if (cells.length !== 4) continue;
    const [name, version, license, source] = cells.map((cell) => cell.trim());
    if (name === "Package" || name.startsWith("---")) continue;
    rows.set(`${name}@${version}`, `${license} from ${source}`);
  }
  return rows;
}

/** Which dependencies moved, or that none did and the bytes moved anyway. */
export function describeStaleNotices(actual, expected) {
  if (actual === null || actual === undefined) {
    return `${NOTICES_PATH} does not exist. ${NOTICES_FIX}`;
  }

  const held = noticeRows(actual);
  const produced = noticeRows(expected);
  const added = [...produced.keys()].filter((key) => !held.has(key));
  const removed = [...held.keys()].filter((key) => !produced.has(key));
  const relicensed = [...produced.keys()].filter(
    (key) => held.has(key) && held.get(key) !== produced.get(key),
  );

  if (added.length + removed.length + relicensed.length === 0) {
    return [
      `${NOTICES_PATH} is stale in its file bytes only: ${describeTextDifference(actual, expected)}.`,
      `All ${produced.size} dependency rows already match package-lock.json, so nothing was added, removed or relicensed and regenerating rewrites the file without changing a notice.`,
      NOTICES_FIX,
    ].join("\n");
  }

  const counts = [];
  if (added.length > 0) counts.push(`${added.length} added (${nameSome(added)})`);
  if (removed.length > 0) counts.push(`${removed.length} removed (${nameSome(removed)})`);
  if (relicensed.length > 0) {
    counts.push(
      `${relicensed.length} with a changed license or registry source (${nameSome(relicensed)})`,
    );
  }
  return [
    `${NOTICES_PATH} is stale against package-lock.json: ${counts.join(", ")}.`,
    ...relicensed
      .slice(0, 8)
      .map((key) => `  ${key}: file holds ${held.get(key)}, the lockfile has ${produced.get(key)}`),
    NOTICES_FIX,
  ].join("\n");
}

const PROTOCOL_FIX = "Run `npm run schema:generate` and commit packages/protocol/src/generated/.";

/** Every name an artifact publishes, which is what a consumer can see move. */
export function exportedNames(source) {
  return [...source.matchAll(/^export (?:const|function|interface|type) (\w+)/gm)].map(
    (match) => match[1],
  );
}

/**
 * Why `schema:check` failed on one artifact, at the altitude the reader works at.
 *
 * Staleness is a byte comparison over four whole files, and "is stale" on its
 * own leaves the reader to diff several thousand generated lines to learn
 * whether the schema gained a definition or the checkout gained a line ending.
 * The first differing line and the exported-name delta are both free here.
 */
export function describeStaleProtocolArtifact(filename, actual, expected) {
  if (actual === null || actual === undefined) {
    return `Generated protocol artifact does not exist: ${filename} has never been written. ${PROTOCOL_FIX}`;
  }

  const held = exportedNames(actual);
  const produced = exportedNames(expected);
  const added = produced.filter((name) => !held.includes(name));
  const removed = held.filter((name) => !produced.includes(name));
  const lines = [
    `Generated protocol artifact is stale: ${filename} — ${describeTextDifference(actual, expected)}.`,
  ];
  if (added.length + removed.length === 0) {
    lines.push(
      `  Its ${produced.length} exported names are unchanged, so the schema added and removed nothing: the difference is inside a declaration, in the banner, or in the formatting.`,
    );
  } else {
    const counts = [];
    if (added.length > 0) counts.push(`${added.length} added (${nameSome(added)})`);
    if (removed.length > 0) counts.push(`${removed.length} removed (${nameSome(removed)})`);
    lines.push(`  Exported names moved: ${counts.join(", ")}.`);
  }
  lines.push(`  ${PROTOCOL_FIX}`);
  return lines.join("\n");
}
