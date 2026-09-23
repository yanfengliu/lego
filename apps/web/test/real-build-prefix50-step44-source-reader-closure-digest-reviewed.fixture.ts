/* eslint-disable -- Static-analysis fixture: deliberately forbidden syntax and never executed. */
// @ts-nocheck Static-analysis fixture: never imported or executed by the product.
import { spawn } from "node:child_process";

const executable = process.execPath;
const childArguments = ["./real-build-prefix50-step44-source-reader-closure-child.fixture.ts"];

export function launchDigestBoundChild(): void {
  spawn(executable, childArguments);
}
