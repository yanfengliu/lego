import { registerHooks } from "node:module";

let registered = false;

/** Let Node 24's type stripping resolve this repository's relative TS imports. */
export function registerRepositoryTypeScriptImports() {
  if (registered) return;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      try {
        return nextResolve(specifier, context);
      } catch (error) {
        if (
          error?.code === "ERR_MODULE_NOT_FOUND" &&
          (specifier.startsWith("./") || specifier.startsWith("../")) &&
          !/\.[cm]?[jt]sx?$/u.test(specifier)
        ) {
          return nextResolve(`${specifier}.ts`, context);
        }
        throw error;
      }
    },
  });
  registered = true;
}

export async function importRepositoryTypeScript(url) {
  registerRepositoryTypeScriptImports();
  return import(url);
}
