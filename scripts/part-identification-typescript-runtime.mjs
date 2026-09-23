import { registerRepositoryTypeScriptImports } from "./part-identification-typescript-hooks.mjs";

export { registerRepositoryTypeScriptImports } from "./part-identification-typescript-hooks.mjs";

export async function importRepositoryTypeScript(url) {
  registerRepositoryTypeScriptImports();
  return import(url);
}
