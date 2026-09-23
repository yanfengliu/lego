/* eslint-disable -- Static-analysis fixture: deliberately forbidden syntax and never executed. */
// @ts-nocheck Static-analysis fixture: deliberately hostile and never executed.
import cluster from "node:cluster";
import inspector from "node:inspector";
import { createRequire } from "node:module";
import vm from "node:vm";
import { Worker as ThreadWorker } from "node:worker_threads";
import processDefault from "node:process";
import nativeAddon from "./hostile-addon.node";

const computedGlobal = "process";
const workerSource = "export default 1";

void cluster;
void inspector;
void createRequire;
void vm;
void ThreadWorker;
void processDefault;
void nativeAddon;
void new Worker(workerSource);
void new SharedWorker("./hostile-worker.js");
void WebAssembly.compile(new Uint8Array());
void process.binding("fs");
void process._linkedBinding("fs");
void process.dlopen({}, "./hostile.node");
void process["getBuiltinModule"]("node:fs");
void process?.["binding"]("fs");
void globalThis[computedGlobal];
void globalThis?.process;
void (0, eval)("require('node:fs')");
void eval.call(undefined, "0");
void (() => undefined).constructor("return require('node:fs')")();
void (() => undefined)["constructor"]("return require('node:fs')")();
