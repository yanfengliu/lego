/* eslint-disable -- Static-analysis fixture: deliberately forbidden syntax and never executed. */
// @ts-nocheck Static-analysis fixture: deliberately invalid and never executed.
import * as childProcesses from "node:child_process";
import {
  exec,
  execFile,
  execFileSync,
  execSync,
  execFile as aliasedExecFile,
  fork,
  fork as aliasedFork,
  spawn,
  spawn as aliasedSpawn,
  spawnSync,
} from "node:child_process";
import childProcessEquals = require("node:child_process");
import processDefault from "node:process";
import * as processNamespace from "process";
import { watch } from "node:fs";
import "https://attacker.invalid/runtime.mjs";
import "unrostered-runtime-package";
import "./real-build-prefix50-step44-source-reader-closure-missing.fixture.ts";

export { spawn as escapedSpawn };

const computedModule = "./computed-local-module.ts";
const computedCommand = process.execPath;
const computedArguments = [computedModule];
const extractedImportedAlias = spawn;
const extractedNamespaceAlias = childProcesses.spawnSync;
const processAlias = process;
const processThroughComma = (0, process);
const boundSpawn = spawn.bind(undefined, computedCommand, computedArguments);
const constructorAlias = (() => undefined).constructor;
if (true) {
  var leakedSpawn = spawn;
}
void import(computedModule);
void module.require(computedModule);
void process["getBuiltinModule"]("node:fs");
void process.getBuiltinModule("node:child_process").spawn(computedCommand, computedArguments);
void processAlias.getBuiltinModule("node:child_process");
void processThroughComma;
void processDefault.getBuiltinModule("node:fs");
void processNamespace.getBuiltinModule("node:fs");
void childProcessEquals;
void eval("require('node:fs')");
void new Function("return import('./hidden.ts')");
void constructorAlias("return require('node:fs')")();
void (() => undefined)["constructor"]("return require('node:fs')")();
void (() => undefined)["con" + "structor"]("return require('node:fs')")();
void Reflect.get(() => undefined, "constructor")("return require('node:fs')")();
void watch;
spawnSync(process.execPath, ["./real-build-prefix50-step44-source-reader-missing-child.ts"]);
spawnSync(process.execPath, [computedModule]);
spawnSync(computedCommand, computedArguments);
spawn(computedCommand, computedArguments);
childProcesses.spawnSync(computedCommand, computedArguments);
extractedImportedAlias(computedCommand, computedArguments);
extractedNamespaceAlias(computedCommand, computedArguments);
leakedSpawn(computedCommand, computedArguments);
spawn.call(undefined, computedCommand, computedArguments);
spawn.apply(undefined, [computedCommand, computedArguments]);
void boundSpawn;
execFile(computedCommand, computedArguments);
execFileSync(computedCommand, computedArguments);
exec(computedCommand);
execSync(computedCommand);
fork(computedCommand, computedArguments);
void aliasedExecFile;
void aliasedFork;
