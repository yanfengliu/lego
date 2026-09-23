import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

// esquery regular expressions for the answer-key guard below, written raw: [\\\/]
// is a backslash or a slash, and a path matches only as whole segments.
const HARNESS_PATH = String.raw`/(^|[\\\/])tools[\\\/]booklet([\\\/]|$)/`;
const OFFICIAL_MODEL_PATH = String.raw`/(^|[\\\/])official-model([\\\/]|$)/`;

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "packages/protocol/src/generated/**",
      // The artifact roots AGENTS.md declares for task-run evidence. A run that
      // snapshots repository sources into its own output directory would
      // otherwise be linted as if it were repository source, and one probe
      // left behind turns the lint gate red for a reason unrelated to the code.
      "output/**",
      // The whole of var/, matching .gitignore's `/var/` rather than only the
      // two children the spec names. Naming runs/ and state/ alone left every
      // other subdirectory linted: five browser-drive probes dropped in
      // var/audit/ used `window` and `document` from plain .mjs and turned the
      // lint gate red on evidence that is not repository source and never
      // enters Git.
      "var/**",
      "tmp/**",
      // Agent worktrees are whole checkouts of this repository nested inside it,
      // each carrying its own tsconfig. Left visible they do not merely add
      // files: the type-aware parser finds several candidate project roots and
      // refuses every file in the repo, so one abandoned worktree fails the lint
      // gate on sources it does not contain. They are working copies, never
      // repository source.
      ".claude/worktrees/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // The answer-key guard. LEGO's official model of the set scores the booklet
    // harness (tools/booklet); a product that could read it could no longer be
    // scored by it. So product code may not load anything under tools/booklet
    // (the harness, whose answer-key/ module is how it reads the official
    // model) nor name output/official-model as a path. Tests, e2e, tools and
    // scripts stay free to: 17 files under scripts/ read output/official-model
    // today, legitimately. tools/booklet/answer-key-guard.test.ts keeps this
    // rule honest by linting each construct below through this very config.
    //
    // Product code is every source root that ships: packages/*/src, apps/*/src,
    // and the config roots beside them (apps/web/vite.config.ts), in every
    // script extension. A path matches only as whole segments, so
    // ./tools/booklet-panel and "the official-model render" are not caught.
    // Bound: a path assembled at run time ("official-" + "model", a variable
    // passed to import()) is invisible to a linter.
    files: [
      "packages/*/src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
      "apps/*/src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
      "packages/*/*.{ts,mts,cts,js,mjs,cjs}",
      "apps/*/*.{ts,mts,cts,js,mjs,cjs}",
    ],
    ignores: [
      "**/*.test.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
      "**/*.spec.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
      // Test-only data: its logicalLocator strings name the official-model files
      // as provenance, and nothing but set-6651557-coverage-ledger.test.ts and
      // set-6651557-ldraw-source-audit.test.ts imports it (the catalog index
      // does not export quarantine/). If a product module ever imports it, this
      // exemption has to go and the ledger has to move out of src.
      "packages/catalog/src/quarantine/set-6651557-coverage-ledger.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...[
          // Module syntax: static imports, re-exports, `import x = require()`, `typeof import()`.
          `ImportDeclaration[source.value=${HARNESS_PATH}]`,
          `ExportAllDeclaration[source.value=${HARNESS_PATH}]`,
          `ExportNamedDeclaration[source.value=${HARNESS_PATH}]`,
          `TSExternalModuleReference > Literal[value=${HARNESS_PATH}]`,
          `TSImportType Literal[value=${HARNESS_PATH}]`,
          // Loads and path uses: import() with a string, a template or new URL(...),
          // require(), createRequire(...)(...), and any call or constructor given the path.
          `:matches(ImportExpression, CallExpression, NewExpression) Literal[value=${HARNESS_PATH}]`,
          `:matches(ImportExpression, CallExpression, NewExpression) TemplateElement[value.raw=${HARNESS_PATH}]`,
        ].map((selector) => ({
          selector,
          message:
            "Product code must not load the booklet harness or its official-model answer key (tools/booklet); move shared logic into a package and import it from there.",
        })),
        ...[
          `Literal[value=${OFFICIAL_MODEL_PATH}]`,
          `TemplateElement[value.raw=${OFFICIAL_MODEL_PATH}]`,
        ].map((selector) => ({
          selector,
          message:
            "Product code must not read output/official-model: LEGO's official model is the harness's answer key, never a product input. Take the data from the booklet or the catalog instead.",
        })),
      ],
    },
  },
);
