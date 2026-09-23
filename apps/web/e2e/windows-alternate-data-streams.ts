import { execFileSync } from "node:child_process";
import { lstatSync, realpathSync } from "node:fs";
import { join, parse } from "node:path";

const STREAM_INSPECTOR = String.raw`
$ErrorActionPreference = "Stop"
$paths = ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:LEGO_STREAM_PATHS)))
foreach ($path in $paths) {
  $streams = @(Get-Item -LiteralPath ([string]$path) -Stream * -ErrorAction Stop | ForEach-Object { $_.Stream })
  $foreign = @($streams | Where-Object { $_ -ne ':$DATA' })
  if ($foreign.Count -ne 0) {
    throw "Alternate data stream found at $path."
  }
}
`;

function systemPowerShellPath(): string {
  const root = parse(process.execPath).root;
  const path = join(root, "Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const state = lstatSync(path);
  if (
    state.isSymbolicLink() ||
    !state.isFile() ||
    realpathSync.native(path).toLocaleLowerCase("en-US") !== path.toLocaleLowerCase("en-US")
  )
    throw new TypeError(`Alternate-stream verification requires system PowerShell at ${path}.`);
  return path;
}

export function assertWindowsPathsHaveOnlyDefaultDataStreams(
  paths: readonly string[],
  label: string,
): void {
  if (process.platform !== "win32") return;
  const executable = systemPowerShellPath();
  const systemRoot = join(parse(executable).root, "Windows");
  try {
    execFileSync(
      executable,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        Buffer.from(STREAM_INSPECTOR, "utf16le").toString("base64"),
      ],
      {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 64 * 1024,
        env: {
          SystemRoot: systemRoot,
          WINDIR: systemRoot,
          PSModulePath: join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "Modules"),
          LEGO_STREAM_PATHS: Buffer.from(JSON.stringify(paths), "utf8").toString("base64"),
        },
      },
    );
  } catch (error) {
    throw new TypeError(`${label} contains an alternate data stream or could not be inspected.`, {
      cause: error,
    });
  }
}
