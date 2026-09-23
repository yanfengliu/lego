/* eslint-disable -- Static-analysis fixture: deliberately forbidden syntax and never executed. */
// @ts-nocheck Static-analysis fixture: deliberately invalid and never executed.
import { spawn } from "node:child_process";

export function spawnJob(selected: { jobKind: string }): void {
  switch (selected.jobKind) {
    case "first":
      spawn(process.execPath, ["./first.fixture.ts"]);
    case "second":
      spawn(process.execPath, ["./second.fixture.ts"]);
  }
}
