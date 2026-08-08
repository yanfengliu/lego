import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

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
);
