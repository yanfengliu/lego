import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { join, parse } from "node:path";
import { createInterface } from "node:readline";

const HOLDER = String.raw`
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
using System; using System.ComponentModel; using System.Runtime.InteropServices;
public static class LegoCalibrationAdversarialHandle {
    private const uint GenericRead = 0x80000000, GenericWrite = 0x40000000;
    private const uint Delete = 0x00010000, ListDirectory = 0x00000001, AddFile = 0x00000002;
    private const uint ShareAll = 7, OpenExisting = 3, BackupSemantics = 0x02000000;
    private const uint PageReadWrite = 0x04, FileMapWrite = 0x0002;
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateFileW(string path, uint access, uint share,
        IntPtr security, uint creation, uint flags, IntPtr template);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateFileMappingW(IntPtr file, IntPtr attributes,
        uint protection, uint maximumHigh, uint maximumLow, string name);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr MapViewOfFile(IntPtr mapping, uint access,
        uint offsetHigh, uint offsetLow, UIntPtr bytes);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool FlushViewOfFile(IntPtr address, UIntPtr bytes);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnmapViewOfFile(IntPtr address);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);

    public static IntPtr Open(string mode, string path) {
        uint access = mode == "directory" ? ListDirectory | AddFile | Delete
            : GenericRead | GenericWrite;
        uint flags = mode == "directory" ? BackupSemantics : 0;
        IntPtr handle = CreateFileW(path, access, ShareAll, IntPtr.Zero,
            OpenExisting, flags, IntPtr.Zero);
        if (handle == new IntPtr(-1))
            throw new Win32Exception(Marshal.GetLastWin32Error(),
                "Cannot open adversarial " + mode + " handle");
        return handle;
    }
    public static IntPtr Map(IntPtr file) {
        IntPtr mapping = CreateFileMappingW(file, IntPtr.Zero, PageReadWrite, 0, 0, null);
        if (mapping == IntPtr.Zero)
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot create writable mapping");
        return mapping;
    }
    public static IntPtr View(IntPtr mapping) {
        IntPtr view = MapViewOfFile(mapping, FileMapWrite, 0, 0, UIntPtr.Zero);
        if (view == IntPtr.Zero)
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot map writable view");
        return view;
    }
    public static void Mutate(IntPtr view) {
        Marshal.WriteByte(view, 0, 0x58);
        if (!FlushViewOfFile(view, new UIntPtr(1)))
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot flush mapped mutation");
    }
    public static void CloseView(IntPtr view) { if (view != IntPtr.Zero) UnmapViewOfFile(view); }
    public static void Close(IntPtr handle) { if (handle != IntPtr.Zero) CloseHandle(handle); }
}
"@
$mode = [string]$env:LEGO_HANDLE_MODE
$handle = [IntPtr]::Zero
$mapping = [IntPtr]::Zero
$view = [IntPtr]::Zero
try {
  $handle = [LegoCalibrationAdversarialHandle]::Open($mode, [string]$env:LEGO_HANDLE_PATH)
  if ($mode -eq "mapping") {
    $mapping = [LegoCalibrationAdversarialHandle]::Map($handle)
    $view = [LegoCalibrationAdversarialHandle]::View($mapping)
    [LegoCalibrationAdversarialHandle]::Close($handle)
    $handle = [IntPtr]::Zero
  }
  [Console]::Out.WriteLine("READY")
  [Console]::Out.Flush()
  while ($true) {
    $command = [Console]::In.ReadLine()
    if ($command -eq "MUTATE" -and $mode -eq "mapping") {
      [LegoCalibrationAdversarialHandle]::Mutate($view)
      [Console]::Out.WriteLine("MUTATED")
      [Console]::Out.Flush()
    } elseif ($command -eq "RELEASE" -or $null -eq $command) { break }
    else { throw "Unknown adversarial handle command." }
  }
} finally {
  [LegoCalibrationAdversarialHandle]::CloseView($view)
  [LegoCalibrationAdversarialHandle]::Close($mapping)
  [LegoCalibrationAdversarialHandle]::Close($handle)
}
`;

export interface WindowsAdversarialHandle {
  readonly child: ChildProcess;
  mutate(): Promise<void>;
  release(): Promise<void>;
}

export async function holdWindowsCalibrationAdversarialHandle(
  mode: "directory" | "mapping",
  path: string,
): Promise<WindowsAdversarialHandle> {
  const drive = parse(process.execPath).root;
  const executable = join(
    drive,
    "Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const child = spawn(
    executable,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      Buffer.from(HOLDER, "utf16le").toString("base64"),
    ],
    {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, LEGO_HANDLE_MODE: mode, LEGO_HANDLE_PATH: path },
    },
  );
  let stderr = "";
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const lines = createInterface({ input: child.stdout! })[Symbol.asyncIterator]();
  const next = async () => {
    const line = await lines.next();
    if (line.done) throw new Error(`Adversarial handle exited early: ${stderr}.`);
    return line.value;
  };
  if ((await next()) !== "READY") throw new Error("Adversarial handle did not become ready.");
  return {
    child,
    async mutate() {
      child.stdin!.write("MUTATE\n");
      if ((await next()) !== "MUTATED") throw new Error("Mapped mutation was not acknowledged.");
    },
    async release() {
      child.stdin!.end("RELEASE\n");
      if (child.exitCode === null && child.signalCode === null) await once(child, "exit");
      if (child.exitCode !== 0)
        throw new Error(`Adversarial handle exited with ${String(child.exitCode)}: ${stderr}.`);
    },
  };
}
