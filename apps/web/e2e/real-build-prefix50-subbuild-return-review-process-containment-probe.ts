import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const grandchildPath = fileURLToPath(
  new URL(
    "./real-build-prefix50-subbuild-return-review-process-containment-grandchild.ts",
    import.meta.url,
  ),
);
const [detach] = process.argv.slice(2);
if (detach !== "detached" && detach !== "attached")
  throw new TypeError("Step-44 containment probe requires detached or attached mode.");

const started = process.hrtime.bigint();
const grandchild = spawn(
  process.execPath,
  ["--experimental-strip-types", grandchildPath],
  detach === "detached"
    ? { detached: true, windowsHide: true, stdio: "ignore" }
    : { windowsHide: true, stdio: "ignore" },
);
if (detach === "detached") grandchild.unref();
const elapsed = Number((process.hrtime.bigint() - started) / 1_000_000n);
process.stdout.write(
  `GRANDCHILD:${String(grandchild.pid)}\nTRANSIENT_MS:${String(elapsed)}\n`,
  () => process.exit(0),
);
