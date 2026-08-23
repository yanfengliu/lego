import { isAbsolute, resolve } from "node:path";

const capturedWindowsRoot = process.env.SystemRoot ?? process.env.WINDIR;

if (
  process.platform === "win32" &&
  (typeof capturedWindowsRoot !== "string" ||
    !isAbsolute(capturedWindowsRoot) ||
    capturedWindowsRoot.includes("\0"))
) {
  throw new Error(
    "Windows exact-process helpers require an absolute startup SystemRoot/WINDIR trust anchor.",
  );
}

/** Captured once at module initialization; later environment mutation cannot redirect it. */
export const TRUSTED_WINDOWS_POWERSHELL =
  process.platform === "win32"
    ? resolve(capturedWindowsRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    : "powershell.exe";
