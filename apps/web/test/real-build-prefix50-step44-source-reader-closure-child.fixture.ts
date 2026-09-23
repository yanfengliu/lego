/* eslint-disable -- Static-analysis fixture: deliberately forbidden syntax and never executed. */
// @ts-nocheck Static-analysis fixture: reached only as a literal child target.
import { readFileSync } from "node:fs";

export function readChildFixture(path: string): Buffer {
  return readFileSync(path);
}
