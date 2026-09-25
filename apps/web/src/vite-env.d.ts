/// <reference types="vite/client" />

interface Window {
  /**
   * The deleted editor's automation bridge (`automation.ts`, milestone 2b)
   * set this; two reading-pipeline specs still poll it through `/editor.html`
   * (`apps/web/e2e/instructions.spec.ts`, `reference-build-playback.spec.ts`).
   * They are reported, not deleted, as coverage to port; this type-only stub
   * keeps them compiling until that port happens, and implements nothing.
   */
  get_model_snapshot?: () => { readonly partCount: number };
}
