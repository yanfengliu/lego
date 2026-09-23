/* eslint-disable -- Static-analysis fixture: deliberately forbidden syntax and never executed. */
// @ts-nocheck Static-analysis fixture: deliberately invalid and never executed.
import { spawn } from "node:child_process";

const executable = process.argv[2];
const childArguments = process.argv.slice(3);

export function launchDigestBoundChild(): void {
  spawn(executable, childArguments);
}
