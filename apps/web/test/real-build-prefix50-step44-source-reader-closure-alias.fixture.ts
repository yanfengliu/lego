/* eslint-disable -- Static-analysis fixture: deliberately forbidden syntax and never executed. */
// @ts-nocheck Static-analysis fixture: never imported or executed by the product.
import { spawnSync as launch } from "node:child_process";
import { readFileSync as aliasedRead } from "node:fs";

import { readContainedBoundedRegularFile as boundedAlias } from "../e2e/bounded-file-read.ts";

const fsNamespace = process.getBuiltinModule("node:fs");
const { readFile: promisedAlias } = await import("node:fs/promises");
const { lstatSync: requiredAlias } = module.require("node:fs");
const { realpathSync: commonJsAlias } = require("node:fs");

void aliasedRead;
void fsNamespace.readFileSync;
void promisedAlias;
void requiredAlias;
void commonJsAlias;
void boundedAlias;
void import("pdfjs-dist/legacy/build/pdf.mjs");
void import("playwright");
void import("./real-build-prefix50-step44-source-reader-closure-child.fixture.ts");
void "pdftoppm";
launch(process.execPath, ["./real-build-prefix50-step44-source-reader-closure-child.fixture.ts"]);
