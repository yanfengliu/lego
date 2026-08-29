import { describe, expect, it } from "vitest";

import {
  PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS,
  inspectAppPackageSourceBytes,
  inspectAppPackageSourceCensus,
  inspectPythonLiteralJoinEntries,
} from "./check-bom-source-policy.mjs";
import {
  assertRegularSourcePopulation,
  excludeGitReportedDeletedSourcePaths,
} from "./check-bom-source-population.mjs";
import { parseJsonRejectingDuplicateKeys } from "./check-bom-json.mjs";

const entry = (relativeFile, source) => ({ relativeFile, sourceBytes: Buffer.from(source) });
const census = (...entries) => inspectAppPackageSourceCensus(entries);
const chunks = (count, length = 31) =>
  Array.from({ length: count }, (_, index) =>
    String.fromCharCode(65 + (index % 26)).repeat(length),
  );
describe("encoded-source-literal-risk-census/2", () => {
  it("counts the ten distributed reconstruction classes without pretending to follow dataflow", () => {
    const short = chunks(133);
    const medium = chunks(66, 63);
    const controls = [
      entry("packages/x/src/array.ts", `const x=[${short.map(JSON.stringify)}];x.join("")`),
      entry(
        "packages/x/src/keys.ts",
        `Object.keys({${short.map((value) => `${JSON.stringify(value)}:0`)}}).join("")`,
      ),
      entry(
        "packages/x/src/push.ts",
        `const x=[];${short.map((value, index) => `x.${index % 2 ? "push" : "unshift"}(${JSON.stringify(value)});`).join("")}`,
      ),
      entry(
        "packages/x/src/assignment.ts",
        `let x="";${short
          .map((value, index) =>
            index % 3 === 0
              ? `x+=${JSON.stringify(value)};`
              : index % 3 === 1
                ? `x=x.concat(${JSON.stringify(value)});`
                : `x[${index}]=${JSON.stringify(value)};`,
          )
          .join("")}`,
      ),
      entry("packages/x/src/template.ts", `const x=\`${short.join('${""}')}\``),
      entry(
        "packages/x/src/destructure.ts",
        `const [${medium.map((_, index) => `c${index}`)}]=[${medium.map(JSON.stringify)}];`,
      ),
      entry("packages/x/src/helper.ts", `concatenate(${medium.map(JSON.stringify)})`),
    ];
    for (const [index, control] of controls.entries()) {
      const result = census(control);
      expect(result.totalCharacters).toBe(index < 5 ? 4_123 : 4_158);
      expect(result.issues).toEqual([]);
    }
    const functionEntries = medium.map((value, index) =>
      entry(
        `packages/x/src/function-${index}.ts`,
        `const value=${JSON.stringify(value)};export function c${index}(){return value}`,
      ),
    );
    const functions = census(
      ...functionEntries,
      entry(
        "packages/x/src/function-consumer.ts",
        medium.map((_, index) => `import {c${index}} from "./function-${index}.js"`).join("\n"),
      ),
    );
    expect(functions.totalCharacters).toBe(4_158);
    expect(functions.issues).toEqual([]);

    const leaves = medium.map((value, index) =>
      entry(`packages/x/src/leaf-${index}.ts`, `export default ${JSON.stringify(value)}`),
    );
    const barrelForms = [
      `export {default as c0} from "./leaf-0.js"`,
      `import c1 from "./leaf-1.js";export {c1}`,
      `export * from "./leaf-2.js"`,
      `export * as c3 from "./leaf-3.js"`,
    ].join("\n");
    const barrels = census(...leaves, entry("packages/x/src/barrel.ts", barrelForms));
    expect(barrels.totalCharacters).toBe(4_158);
    expect(barrels.issues).toEqual([]);

    const bareImports = census(
      ...medium.map((value, index) =>
        entry(`packages/x/src/bare-${index}.ts`, `export const c=${JSON.stringify(value)}`),
      ),
      entry(
        "apps/web/src/bare-consumer.ts",
        'import("@lego-studio/x");import("bare-package");import("unresolved-spelling")',
      ),
    );
    expect(bareImports.totalCharacters).toBe(4_158);
    expect(bareImports.issues).toEqual([]);
  });

  it("counts each qualifying literal source span once", () => {
    const one = census(
      entry("packages/x/src/reference.ts", `const x="${"A".repeat(63)}";void [x,x,x,x]`),
    );
    expect(one.totalCharacters).toBe(63);
    expect(one.atomCount).toBe(1);
  });

  it("keeps explicit negative controls for out-of-scope reconstruction", () => {
    const controls = [
      entry(
        "packages/x/src/thirty-character-fragments.ts",
        `const x=[${chunks(200, 30).map(JSON.stringify)}].join("")`,
      ),
      entry("packages/x/src/regex-source.ts", `const x=/${"A".repeat(128)}/.source`),
      entry(
        "packages/x/src/runtime-generation.ts",
        'const x="A".repeat(4096);const y=String.fromCharCode(65)',
      ),
      entry(
        "packages/x/src/numeric-array.ts",
        `const x=Uint8Array.from([${Array.from({ length: 128 }, () => 65).join(",")}])`,
      ),
      entry("packages/x/src/escaped.ts", `const x="${String.raw`\x41`.repeat(128)}"`),
    ];
    for (const control of controls) {
      const result = census(control);
      expect(result.totalCharacters).toBe(0);
      expect(result.issues).toEqual([]);
    }
  });

  it("discloses that splitting a refused atom below 31 characters leaves the census", () => {
    const full = census(entry("packages/x/src/full.ts", `const x="${"A".repeat(128)}"`));
    expect(full.totalCharacters).toBe(128);
    expect(full.issues).toEqual(expect.arrayContaining([expect.stringMatching(/at or above 128/)]));

    const split = census(
      entry("packages/x/src/split.ts", `const x=[${chunks(8, 16).map(JSON.stringify)}].join("")`),
    );
    expect(split.totalCharacters).toBe(0);
    expect(split.issues).toEqual([]);
  });

  it("counts strings, object/class keys, JSX, comments, template fragments, and reviewed text", () => {
    const value = "A".repeat(31);
    const result = census(
      entry(
        "apps/web/src/forms.tsx",
        `const a="${value}";const b={"${value}":0};class C{static "${value}"=0};const c=<x p="${value}">${value}</x>;const d=\`${value}${'${""}'}${value}\`;// ${value}`,
      ),
      entry("scripts/forms.py", `value = "${value}" # ${value}`),
      entry("packages/x/src/forms.txt", value),
    );
    expect(result.totalCharacters).toBe(31 * 10);
    expect(result.ledger.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining([
        "string",
        "jsx-text",
        "template-head-raw",
        "template-tail-raw",
        "comment",
        "reviewed-text",
      ]),
    );
  });

  it("keeps every diagnostic span aligned to the exact raw source atom", () => {
    const value = "A".repeat(31);
    const source = `const a="${String.raw`\x41`}${value}";const b=\`head` + "${0}" + `${value}\`;`;
    const result = census(entry("packages/x/src/spans.ts", source));
    expect(result.ledger).toHaveLength(2);
    for (const atom of result.ledger) {
      const rawAtom = source.slice(atom.start, atom.end);
      expect(rawAtom).toHaveLength(atom.length);
      expect(rawAtom).toMatch(/^[A-Za-z0-9+/]{31,}={0,2}$/u);
    }
    expect(result.ledger.map(({ start, end }) => source.slice(start, end))).toEqual([
      `x41${value}`,
      value,
    ]);
  });

  it("accepts only exact whole-comment terminal metadata", () => {
    const exact = Array.from(
      { length: 80 },
      (_, index) => `// sha256:${(index % 16).toString(16).repeat(64)}`,
    ).join("\n");
    const terminal = census(entry("packages/x/src/comments.ts", exact));
    expect(terminal.totalCharacters).toBe(5_120);
    expect(terminal.atomCount).toBe(80);
    expect(terminal.classificationSubtotals).toEqual({
      "non-exempt": 0,
      "terminal-comment-metadata": 5_120,
    });
    expect(terminal.atomClassSubtotals["exact-64-lower-hex"]).toBe(5_120);
    const labelled = exact.replaceAll("// sha256:", "// artifact sha256:");
    expect(census(entry("packages/x/src/comments.ts", labelled)).totalCharacters).toBe(5_120);
  });

  it("keeps executable digest literals visible instead of routing them through exemptions", () => {
    const result = census(
      entry("packages/x/src/digest.ts", `export const digest="${"a".repeat(64)}"`),
    );
    expect(result.totalCharacters).toBe(64);
    expect(result.classificationSubtotals).toEqual({
      "non-exempt": 64,
      "terminal-comment-metadata": 0,
    });
    expect(result.atomClassSubtotals["exact-64-lower-hex"]).toBe(64);
  });

  it("accepts ordinary short labels, generated repeats, and punctuated prose or paths", () => {
    const source = Array.from({ length: 300 }, (_, index) => `"label-${index}"`).join(";");
    const result = census(
      entry("packages/x/src/ordinary.ts", `${source};"not/base64-like/path.txt";"ordinary prose"`),
    );
    expect(result.totalCharacters).toBe(0);
    expect(result.issues).toEqual([]);
  });

  it("refuses a single 128-character atom immediately", () => {
    const accepted = census(entry("packages/x/src/boundary-127.ts", `"${"A".repeat(127)}"`));
    expect(accepted.totalCharacters).toBe(127);
    expect(accepted.issues).toEqual([]);
    const result = census(entry("packages/x/src/one.ts", `"${"A".repeat(128)}"`));
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.stringMatching(/at or above 128/)]),
    );
  });

  it("reports 4095 and 4096 global characters without turning telemetry into a gate", () => {
    const entriesFor = (count) =>
      Array.from({ length: count }, (_, index) =>
        entry(`packages/x/src/global-${index}.ts`, `"${chunks(1)[0]}"`),
      );
    const accepted = census(
      ...entriesFor(131),
      entry("packages/x/src/remainder.ts", `"${"A".repeat(34)}"`),
    );
    expect(accepted.totalCharacters).toBe(4_095);
    expect(accepted.issues).toEqual([]);
    const reported = census(
      ...entriesFor(131),
      entry("packages/x/src/remainder.ts", `"${"A".repeat(35)}"`),
    );
    expect(reported.totalCharacters).toBe(4_096);
    expect(reported.issues).toEqual([]);
  });

  it("does not lose PowerShell escaped-quote or C# raw-string atoms into code", () => {
    const atom = "A".repeat(128);
    for (const [path, source] of [
      ["scripts/control.ps1", '$x = "prefix`"' + atom + '"'],
      ["scripts/control.cs", `const string x = """${atom}""";`],
    ]) {
      const result = census(entry(path, source));
      expect(result.totalCharacters).toBeGreaterThanOrEqual(128);
      expect(result.ledger).toEqual(
        expect.arrayContaining([expect.objectContaining({ length: 128 })]),
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringMatching(/at or above 128/)]),
      );
    }
  });

  it("conservatively retains atoms nested inside valid interpolation expressions", () => {
    const atom = "A".repeat(128);
    for (const [path, source] of [
      ["scripts/interpolated.py", `value = f"{fn("${atom}")}"`],
      ["scripts/interpolated.cs", `const string value = $"{M("${atom}")}";`],
    ]) {
      const result = census(entry(path, source));
      expect(result.ledger).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            length: 128,
            kind: "lexical-source-overlay",
          }),
        ]),
      );
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.stringMatching(/at or above 128/)]),
      );
    }
  });

  it("conservatively counts code after PowerShell's non-nested block-comment boundary", () => {
    const source = `<# outer <# inner #>\n${"A".repeat(128)}\n#>`;
    const result = census(entry("scripts/non-nested-comment.ps1", source));
    expect(result.totalCharacters).toBe(128);
    expect(result.ledger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ length: 128, kind: "lexical-source-overlay" }),
      ]),
    );
    expect(result.issues).toEqual(
      expect.arrayContaining([expect.stringMatching(/at or above 128/)]),
    );
  });

  it("produces deterministic path/span/context ledgers and subtotals", () => {
    const entries = [
      entry("packages/x/src/z.ts", `"${"Z".repeat(31)}"`),
      entry("apps/x/src/a.ts", `"${"A".repeat(31)}"`),
    ];
    const forward = census(...entries);
    const reverse = census(...entries.reverse());
    expect(reverse.ledgerDigest).toBe(forward.ledgerDigest);
    expect(forward.fileSubtotals).toEqual({
      "apps/x/src/a.ts": 31,
      "packages/x/src/z.ts": 31,
    });
    expect(forward.atomClassSubtotals).toEqual({
      "exact-64-lower-hex": 0,
      "exact-40-lower-hex": 0,
      "exact-32-lower-hex": 0,
      "base64-padding": 0,
      "identifier-like-alnum": 62,
      "base64-symbol": 0,
    });
    expect(forward.ledger[0]).toMatchObject({
      relativeFile: "apps/x/src/a.ts",
      start: 1,
      end: 32,
      length: 31,
      classification: "non-exempt",
    });
    expect(forward.ledger[0].context).toContain("<atom>");
  });
});

describe("bounded source bytes", () => {
  it("rejects literal-only binary + in JS, TS, and Python when a leaf is census-sized", () => {
    for (const [relativeFile, source] of [
      ["apps/x/src/fragment.ts", 'const value = "narrowingSubjectRenderBudgetLedger" + " suffix";'],
      [
        "apps/x/src/nested.mjs",
        'const value = ("prefix " + "resolveRealBuildPanelCameraFrontier") + ".";',
      ],
      ["scripts/fragment.py", 'value = "worstAbsoluteDeviationFromPublishedRows" + "=0.25"'],
    ]) {
      expect(inspectAppPackageSourceBytes(relativeFile, Buffer.from(source))).toEqual(
        expect.arrayContaining([expect.stringMatching(/binary \+ expression.*census-size atom/u)]),
      );
    }
  });

  it("cannot be bypassed with transparent TypeScript wrappers or nested plus trees", () => {
    for (const [relativeFile, source] of [
      [
        "apps/x/src/as-const.ts",
        'const value = (("narrowingSubjectRenderBudgetLedger" as const) + " suffix") as string;',
      ],
      [
        "apps/x/src/type-assertion.ts",
        'const value = <string>("resolveRealBuildPanelCameraFrontier" + ".suffix");',
      ],
      [
        "apps/x/src/satisfies.ts",
        'const value = (("worstAbsoluteDeviationFromPublishedRows" satisfies string) + ".")!;',
      ],
      [
        "apps/x/src/nested.ts",
        'const value = (("prefix." + ("narrowingSubjectRenderBudgetLedger" as const)) satisfies string) + ("." + "suffix");',
      ],
    ]) {
      expect(inspectAppPackageSourceBytes(relativeFile, Buffer.from(source))).toEqual(
        expect.arrayContaining([expect.stringMatching(/binary \+ expression.*census-size atom/u)]),
      );
    }
  });

  it("distinguishes Python binary + from implicit adjacent string literals", () => {
    for (const source of [
      'value = ("worstAbsoluteDeviationFromPublishedRows") + ("=0.25")',
      'value = (("prefix=" + "worstAbsoluteDeviationFromPublishedRows") + "=0.25")',
    ]) {
      expect(inspectAppPackageSourceBytes("scripts/fragment.py", Buffer.from(source))).toEqual(
        expect.arrayContaining([expect.stringMatching(/binary \+ expression.*census-size atom/u)]),
      );
    }
    for (const source of [
      'value = ("worstAbsoluteDeviationFromPublishedRows" "=0.25")',
      'value = (r"worstAbsoluteDeviationFromPublishedRows" "=0.25")',
    ]) {
      expect(inspectAppPackageSourceBytes("scripts/fragment.py", Buffer.from(source))).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/implicit adjacent string literals.*census-size atom/u),
        ]),
      );
    }
  });

  it("judges literal-only joins from census-visible raw token bodies, not decoded escapes", () => {
    const escapedLeaf = String.raw`\x41`.repeat(31);
    for (const [relativeFile, source] of [
      ["apps/x/src/escaped-plus.ts", `const value = "${escapedLeaf}" + "z";`],
      ["scripts/escaped-plus.py", `value = "${escapedLeaf}" + "z"`],
      ["scripts/escaped-adjacent.py", `value = ("${escapedLeaf}" "z")`],
    ]) {
      const result = census(entry(relativeFile, source));
      expect(result.totalCharacters, relativeFile).toBe(0);
      expect(result.issues, relativeFile).toEqual([]);
    }

    for (const [relativeFile, source] of [
      ["apps/x/src/plain-plus.ts", `const value = "${"A".repeat(31)}" + "z";`],
      ["scripts/plain-plus.py", `value = "${"A".repeat(31)}" + "z"`],
      ["scripts/plain-adjacent.py", `value = ("${"A".repeat(31)}" "z")`],
    ]) {
      expect(census(entry(relativeFile, source)).issues, relativeFile).toEqual(
        expect.arrayContaining([expect.stringMatching(/census-size atom/u)]),
      );
    }
  });

  it("keeps dynamic composition, short literals, and quoted Python examples out of the guard", () => {
    for (const [relativeFile, source] of [
      [
        "apps/x/src/dynamic.ts",
        'const left = ("narrowingSubjectRenderBudgetLedger" as const) + suffix; const right = prefix + ("resolveRealBuildPanelCameraFrontier" satisfies string);',
      ],
      ["apps/x/src/short.ts", 'const value = "ordinary short" + " labels";'],
      [
        "scripts/dynamic.py",
        'left = ("worstAbsoluteDeviationFromPublishedRows") + suffix\nright = prefix + ("narrowingSubjectRenderBudgetLedger")\ninterpolated = "worstAbsoluteDeviationFromPublishedRows=" + f"{value}"\nadjacent_dynamic = f"{value}" "resolveRealBuildPanelCameraFrontier"',
      ],
      [
        "scripts/quoted.py",
        'example = \'"narrowingSubjectRenderBudgetLedger" + " suffix"\'\n# "resolveRealBuildPanelCameraFrontier" + "."',
      ],
    ]) {
      expect(inspectAppPackageSourceBytes(relativeFile, Buffer.from(source))).toEqual([]);
    }
  });

  it("does not claim to reject other constant composition syntax", () => {
    for (const [relativeFile, source] of [
      [
        "apps/x/src/concat.ts",
        'const a = "narrowingSubjectRenderBudgetLedger".concat("Suffix"); const b = ["resolveRealBuildPanelCameraFrontier", "Suffix"].join("");',
      ],
      [
        "apps/x/src/template.ts",
        'const a = `worstAbsoluteDeviationFromPublishedRows${"Suffix"}`; const b = true ? "resolveRealBuildPanelCameraFrontier" : "Suffix";',
      ],
      [
        "scripts/other-composition.py",
        'a = "worstAbsoluteDeviationFromPublishedRows".__add__("Suffix")\nb = "".join(["narrowingSubjectRenderBudgetLedger", "Suffix"])\nc = "%sSuffix" % "resolveRealBuildPanelCameraFrontier"\nd = "{}Suffix".format("worstAbsoluteDeviationFromPublishedRows")\ne = f"narrowingSubjectRenderBudgetLedger{\'Suffix\'}"',
      ],
    ]) {
      expect(inspectAppPackageSourceBytes(relativeFile, Buffer.from(source))).toEqual([]);
    }
  });

  it("runs deterministic bounded Python batches with explicit timeout and output caps", () => {
    const calls = [];
    const entries = Array.from({ length: 70 }, (_, index) => ({
      relativeFile: `scripts/${String(69 - index).padStart(3, "0")}.py`,
      source: `value_${index} = "short"`,
    }));
    const issues = inspectPythonLiteralJoinEntries(entries, (payload, limits) => {
      calls.push({ payload, limits });
      return { status: 0, stdout: '{"issues":[]}', stderr: "" };
    });
    expect(issues).toEqual([]);
    expect(calls).toHaveLength(3);
    expect(calls.map(({ payload }) => JSON.parse(payload).length)).toEqual([32, 32, 6]);
    expect(
      calls.flatMap(({ payload }) => JSON.parse(payload).map(({ relativeFile }) => relativeFile)),
    ).toEqual([...entries].map(({ relativeFile }) => relativeFile).sort());
    for (const { payload, limits } of calls) {
      expect(Buffer.byteLength(payload, "utf8")).toBeLessThanOrEqual(
        PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS.maximumBatchInputBytes,
      );
      expect(limits.timeoutMilliseconds).toBe(10_000);
      expect(limits.maximumOutputBytes).toBe(1024 * 1024);
    }
  });

  it("fails closed on Python analyzer file, aggregate, timeout, output, and schema bounds", () => {
    expect(
      inspectPythonLiteralJoinEntries([
        {
          relativeFile: "scripts/too-large.py",
          source: "A".repeat(PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS.maximumFileBytes + 1),
        },
      ]),
    ).toEqual([expect.stringMatching(/per-file cap/u)]);

    expect(
      inspectPythonLiteralJoinEntries(
        Array.from(
          { length: PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS.maximumAggregateEntries + 1 },
          (_, index) => ({ relativeFile: `scripts/${index}.py`, source: "" }),
        ),
      ),
    ).toEqual([expect.stringMatching(/aggregate.*entry cap/u)]);

    const maximumFile = "A".repeat(PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS.maximumFileBytes);
    expect(
      inspectPythonLiteralJoinEntries([
        ...Array.from({ length: 8 }, (_, index) => ({
          relativeFile: `scripts/aggregate-${index}.py`,
          source: maximumFile,
        })),
        { relativeFile: "scripts/aggregate-overflow.py", source: "A" },
      ]),
    ).toEqual([expect.stringMatching(/aggregate.*byte cap/u)]);

    expect(
      inspectPythonLiteralJoinEntries([
        {
          relativeFile: "scripts/serialized-overflow.py",
          source: "\\".repeat(PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS.maximumFileBytes),
        },
      ]),
    ).toEqual([expect.stringMatching(/analyzer-input cap/u)]);

    const oneEntry = [{ relativeFile: "scripts/one.py", source: "value = 1" }];
    expect(
      inspectPythonLiteralJoinEntries(oneEntry, () => ({
        status: null,
        stdout: "",
        stderr: "",
        error: Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }),
      })),
    ).toEqual([expect.stringMatching(/timed out after 10000 ms/u)]);
    expect(
      inspectPythonLiteralJoinEntries(oneEntry, () => ({
        status: 0,
        stdout: "x".repeat(PYTHON_LITERAL_JOIN_ANALYSIS_LIMITS.maximumOutputBytes + 1),
        stderr: "",
      })),
    ).toEqual([expect.stringMatching(/stdout exceeds.*output cap/u)]);
    expect(
      inspectPythonLiteralJoinEntries(oneEntry, () => ({
        status: 0,
        stdout: '{"issues":[],"unchecked":true}',
        stderr: "",
      })),
    ).toEqual([expect.stringMatching(/malformed or non-exact JSON output/u)]);
  });

  it("rejects duplicate JSON keys after decoding escape spellings", () => {
    expect(() => parseJsonRejectingDuplicateKeys('{"a":1,"\\u0061":2}')).toThrow(/duplicate key/);
    expect(() => parseJsonRejectingDuplicateKeys('{"$id":"one","\\u0024id":"two"}')).toThrow(
      /duplicate key/,
    );
    expect(() => parseJsonRejectingDuplicateKeys('{"x":"}","a":1,"a":2}')).toThrow(/duplicate key/);
    expect(() =>
      parseJsonRejectingDuplicateKeys('{"outer":{"x":"}","a":1,"\\u0061":2},"after":true}'),
    ).toThrow(/duplicate key/);
  });

  it("refuses symlink-like Git population entries before any read follows them", () => {
    expect(() =>
      assertRegularSourcePopulation("C:/repo", ["apps/x/src/link.ts"], () => ({
        isSymbolicLink: () => true,
        isFile: () => false,
      })),
    ).toThrow(/symbolic links.*refused/);
  });

  it("excludes only Git-confirmed deletions and still refuses a disappearing live path", () => {
    expect(
      excludeGitReportedDeletedSourcePaths(
        ["apps/x/src/live.ts", "apps/x/src/deleted.ts", "apps/x/src/live.ts"],
        ["apps/x/src/deleted.ts"],
      ),
    ).toEqual(["apps/x/src/live.ts"]);
    expect(() =>
      assertRegularSourcePopulation("C:/repo", ["apps/x/src/live.ts"], () => {
        throw new Error("disappeared");
      }),
    ).toThrow(/regular file could not be read/);
  });

  it("rejects unsupported/raw extensions, binary signatures, invalid UTF-8, and controls", () => {
    expect(inspectAppPackageSourceBytes("packages/x/src/raw.dat", Buffer.from("0 raw"))[0]).toMatch(
      /raw or compiled source extension/,
    );
    expect(inspectAppPackageSourceBytes("packages/x/src/raw.exe", Buffer.from("MZ"))[0]).toMatch(
      /file type that is not reviewed/,
    );
    expect(
      inspectAppPackageSourceBytes(
        "packages/x/src/image.ts",
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )[0],
    ).toMatch(/PNG binary signature/);
    expect(
      inspectAppPackageSourceBytes("packages/x/src/bad.ts", Buffer.from([0xc3, 0x28]))[0],
    ).toMatch(/not valid UTF-8/);
    expect(
      inspectAppPackageSourceBytes(
        "packages/x/src/control.txt",
        Buffer.concat([Buffer.from("x"), Buffer.alloc(9)]),
      )[0],
    ).toMatch(/9 binary control bytes/);
  });

  it("rejects parse failure and a file one byte above the four-MiB cap", () => {
    expect(
      inspectAppPackageSourceBytes("packages/x/src/bad.ts", Buffer.from("const = ;"))[0],
    ).toMatch(/could not be parsed/);
    expect(
      inspectAppPackageSourceBytes("packages/x/src/large.ts", Buffer.alloc(4_194_305, 0x20))[0],
    ).toMatch(/4194305 bytes.*4194304-byte/);
  });
});
