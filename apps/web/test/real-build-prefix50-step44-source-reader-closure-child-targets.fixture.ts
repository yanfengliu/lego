/* eslint-disable -- Static-analysis fixture: deliberately forbidden syntax and never executed. */
// @ts-nocheck Static-analysis fixture: never imported or executed by the product.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const typescriptTarget = fileURLToPath(
  new URL("./real-build-prefix50-step44-source-reader-target.fixture.ts", import.meta.url),
);
const javascriptTarget = fileURLToPath(
  new URL("./real-build-prefix50-step44-source-reader-target.fixture.js", import.meta.url),
);
const moduleTarget = fileURLToPath(
  new URL("./real-build-prefix50-step44-source-reader-target.fixture.mjs", import.meta.url),
);
const powershellTarget = fileURLToPath(
  new URL("./real-build-prefix50-step44-source-reader-target.fixture.ps1", import.meta.url),
);

spawn(process.execPath, ["--experimental-strip-types", typescriptTarget]);
spawn(process.execPath, [javascriptTarget]);
spawn(process.execPath, [moduleTarget]);
spawn("powershell.exe", ["-File", powershellTarget]);
