param(
  [Parameter(Mandatory = $true)][string]$Root,
  [Parameter(Mandatory = $true)][string]$Manifest,
  [Parameter(Mandatory = $true)][string]$ExpectedDigest,
  [string]$ReadyFile = "",
  [string]$ReleaseFile = "",
  [string]$ErrorFile = "",
  [string]$CleanupDirectory = "",
  [int]$ParentPid = 0
)

$ErrorActionPreference = "Stop"
$maximumFiles = 10021
[long]$maximumAggregateBytes = 512 * 1024 * 1024 + 32
$maximumManifestBytes = 16 * 1024 * 1024

Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using Microsoft.Win32.SafeHandles;

public static class LegoRealBuildSnapshotLock {
    private const uint GenericRead = 0x80000000;
    private const uint ReadAttributes = 0x00000080;
    private const uint ShareRead = 0x00000001;
    private const uint OpenExisting = 3;
    private const uint OpenReparsePoint = 0x00200000;
    private const uint BackupSemantics = 0x02000000;
    private const uint DirectoryAttribute = 0x00000010;
    private const uint ReparsePointAttribute = 0x00000400;

    [StructLayout(LayoutKind.Sequential)]
    private struct FileTime {
        public uint Low;
        public uint High;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ByHandleFileInformation {
        public uint FileAttributes;
        public FileTime CreationTime;
        public FileTime LastAccessTime;
        public FileTime LastWriteTime;
        public uint VolumeSerialNumber;
        public uint FileSizeHigh;
        public uint FileSizeLow;
        public uint NumberOfLinks;
        public uint FileIndexHigh;
        public uint FileIndexLow;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateFileW(
        string path,
        uint desiredAccess,
        uint shareMode,
        IntPtr securityAttributes,
        uint creationDisposition,
        uint flagsAndAttributes,
        IntPtr templateFile
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetFileInformationByHandle(
        IntPtr file,
        out ByHandleFileInformation information
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);

    private static ByHandleFileInformation Information(IntPtr handle, string path) {
        ByHandleFileInformation information;
        if (!GetFileInformationByHandle(handle, out information)) {
            throw new Win32Exception(
                Marshal.GetLastWin32Error(),
                "Cannot inspect exact real-build snapshot handle " + path
            );
        }
        return information;
    }

    public static IntPtr OpenDirectory(string path) {
        IntPtr handle = CreateFileW(
            path,
            ReadAttributes,
            ShareRead,
            IntPtr.Zero,
            OpenExisting,
            OpenReparsePoint | BackupSemantics,
            IntPtr.Zero
        );
        if (handle == new IntPtr(-1)) {
            throw new Win32Exception(
                Marshal.GetLastWin32Error(),
                "Cannot lock exact real-build snapshot directory " + path
            );
        }
        try {
            ByHandleFileInformation information = Information(handle, path);
            bool ordinaryDirectory =
                (information.FileAttributes & DirectoryAttribute) != 0 &&
                (information.FileAttributes & ReparsePointAttribute) == 0;
            if (!ordinaryDirectory) {
                throw new InvalidOperationException(
                    "Real-build snapshot directory is a reparse point or non-directory: " + path
                );
            }
            return handle;
        } catch {
            CloseHandle(handle);
            throw;
        }
    }

    public static IntPtr OpenExact(string path, long expectedBytes, string expectedDigest) {
        IntPtr handle = CreateFileW(
            path,
            GenericRead,
            ShareRead,
            IntPtr.Zero,
            OpenExisting,
            OpenReparsePoint,
            IntPtr.Zero
        );
        if (handle == new IntPtr(-1)) {
            throw new Win32Exception(
                Marshal.GetLastWin32Error(),
                "Cannot lock exact real-build snapshot file " + path
            );
        }
        try {
            ByHandleFileInformation information = Information(handle, path);
            if ((information.FileAttributes & (DirectoryAttribute | ReparsePointAttribute)) != 0) {
                throw new InvalidOperationException(
                    "Real-build snapshot file is a directory or reparse point: " + path
                );
            }
            long observedBytes = (long)(((ulong)information.FileSizeHigh << 32) | information.FileSizeLow);
            if (expectedBytes >= 0 && observedBytes != expectedBytes) {
                throw new InvalidOperationException(
                    "Real-build snapshot file " + path + " has " + observedBytes +
                    " bytes; expected " + expectedBytes + "."
                );
            }
            string observedDigest;
            using (SafeFileHandle safe = new SafeFileHandle(handle, false))
            using (FileStream stream = new FileStream(safe, FileAccess.Read, 65536, false))
            using (SHA256 sha = SHA256.Create()) {
                observedDigest = "sha256:" + BitConverter.ToString(sha.ComputeHash(stream))
                    .Replace("-", "").ToLowerInvariant();
            }
            if (!String.Equals(observedDigest, expectedDigest, StringComparison.Ordinal)) {
                throw new InvalidOperationException(
                    "Real-build snapshot file differs from its exact digest: " + path
                );
            }
            return handle;
        } catch {
            CloseHandle(handle);
            throw;
        }
    }

    public static byte[] ReadAll(IntPtr handle, int maximumBytes) {
        using (SafeFileHandle safe = new SafeFileHandle(handle, false))
        using (FileStream stream = new FileStream(safe, FileAccess.Read, 65536, false)) {
            if (stream.Length < 1 || stream.Length > maximumBytes) {
                throw new InvalidOperationException(
                    "Real-build snapshot manifest length is outside its bound: " + stream.Length
                );
            }
            byte[] bytes = new byte[(int)stream.Length];
            stream.Position = 0;
            int offset = 0;
            while (offset < bytes.Length) {
                int count = stream.Read(bytes, offset, bytes.Length - offset);
                if (count == 0) {
                    throw new EndOfStreamException(
                        "Real-build snapshot manifest ended after " + offset + " of " + bytes.Length + " bytes."
                    );
                }
                offset += count;
            }
            return bytes;
        }
    }

    public static void CloseExact(IntPtr handle) {
        if (!CloseHandle(handle)) {
            throw new Win32Exception(
                Marshal.GetLastWin32Error(),
                "Cannot release exact real-build snapshot lock"
            );
        }
    }
}
"@

$held = New-Object 'System.Collections.Generic.List[IntPtr]'
$directories = New-Object 'System.Collections.Generic.Dictionary[string,IntPtr]' ([System.StringComparer]::OrdinalIgnoreCase)
$readyPublished = $false

function Lock-Directory([string]$Path) {
  $full = [System.IO.Path]::GetFullPath($Path).TrimEnd("\")
  if (-not $directories.ContainsKey($full)) {
    $handle = [LegoRealBuildSnapshotLock]::OpenDirectory($full)
    $directories.Add($full, $handle)
    $held.Add($handle)
  }
}

function Lock-DirectoryAncestors([string]$RootPath, [string]$RelativePath) {
  $segments = $RelativePath.Replace("/", "\").Split("\")
  $cursor = [System.IO.Path]::GetFullPath($RootPath).TrimEnd("\")
  for ($index = 0; $index -lt $segments.Length - 1; $index += 1) {
    $cursor = [System.IO.Path]::Combine($cursor, $segments[$index])
    Lock-Directory $cursor
  }
}

try {
  $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd("\")
  $manifestFull = [System.IO.Path]::GetFullPath($Manifest)
  if ($ExpectedDigest -notmatch '^sha256:[0-9a-f]{64}$') {
    throw "Snapshot lock expected digest is malformed."
  }
  Lock-Directory $rootFull
  $manifestHandle = [LegoRealBuildSnapshotLock]::OpenExact($manifestFull, -1, $ExpectedDigest)
  $held.Add($manifestHandle)
  $manifestBytes = [LegoRealBuildSnapshotLock]::ReadAll(
    $manifestHandle,
    $maximumManifestBytes
  )
  $strictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
  $parsed = ($strictUtf8.GetString($manifestBytes) | ConvertFrom-Json)
  if ($parsed.schemaVersion -cne "lego.real-build-source-lock/1" -or $null -eq $parsed.files) {
    throw "Snapshot lock manifest schema is invalid."
  }
  if ($parsed.files.Count -gt $maximumFiles) {
    throw "Snapshot lock manifest declares $($parsed.files.Count) files; maximum is $maximumFiles."
  }
  $count = 0
  [long]$totalBytes = 0
  foreach ($entry in $parsed.files) {
    $relative = [string]$entry.path
    $expectedBytes = [long]$entry.bytes
    $expectedFileDigest = [string]$entry.digest
    if (
      $relative -notmatch '^[A-Za-z0-9._@/-]+$' -or
      $relative.Split('/') -contains '..' -or
      $expectedBytes -lt 0 -or
      $expectedFileDigest -notmatch '^sha256:[0-9a-f]{64}$'
    ) {
      throw "Snapshot lock entry is malformed: $relative"
    }
    Lock-DirectoryAncestors $rootFull $relative
    $full = [System.IO.Path]::GetFullPath(
      [System.IO.Path]::Combine($rootFull, $relative.Replace("/", "\"))
    )
    if (-not $full.StartsWith($rootFull + "\", [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Snapshot lock path escaped its root: $relative"
    }
    $handle = [LegoRealBuildSnapshotLock]::OpenExact(
      $full,
      $expectedBytes,
      $expectedFileDigest
    )
    $held.Add($handle)
    $count += 1
    $totalBytes += $expectedBytes
    if ($totalBytes -gt $maximumAggregateBytes) {
      throw "Snapshot lock files exceed the $maximumAggregateBytes-byte aggregate bound at $relative."
    }
  }
  $readyLine = "READY $ExpectedDigest $count $totalBytes"
  if (-not [String]::IsNullOrEmpty($ReadyFile)) {
    if ([String]::IsNullOrEmpty($ReleaseFile) -or $ParentPid -le 0) {
      throw "File-controlled snapshot locking requires release file and positive parent PID."
    }
    $readyFull = [System.IO.Path]::GetFullPath($ReadyFile)
    $releaseFull = [System.IO.Path]::GetFullPath($ReleaseFile)
    $readyTemporary = "$readyFull.tmp-$PID"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false, $true)
    [System.IO.File]::WriteAllText($readyTemporary, "$readyLine`n", $utf8NoBom)
    [System.IO.File]::Move($readyTemporary, $readyFull)
    $readyPublished = $true
    while ($true) {
      if ([System.IO.File]::Exists($releaseFull)) { break }
      $parent = Get-Process -Id $ParentPid -ErrorAction SilentlyContinue
      if ($null -eq $parent) { break }
      Start-Sleep -Milliseconds 100
    }
  } else {
    [Console]::Out.WriteLine($readyLine)
    [Console]::Out.Flush()
    [Console]::In.ReadLine() | Out-Null
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.ToString())
  if (-not [String]::IsNullOrEmpty($ErrorFile)) {
    try {
      $errorFull = [System.IO.Path]::GetFullPath($ErrorFile)
      $errorUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
      [System.IO.File]::WriteAllText($errorFull, $_.Exception.ToString(), $errorUtf8)
    } catch {
      [Console]::Error.WriteLine($_.Exception.ToString())
    }
  }
  exit 1
} finally {
  for ($index = $held.Count - 1; $index -ge 0; $index -= 1) {
    [LegoRealBuildSnapshotLock]::CloseExact($held[$index])
  }
  if ($readyPublished -and -not [String]::IsNullOrEmpty($CleanupDirectory)) {
    $cleanupFull = [System.IO.Path]::GetFullPath($CleanupDirectory).TrimEnd("\")
    $temporaryRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd("\")
    $controlParents = @(
      @($Manifest, $ReadyFile, $ReleaseFile, $ErrorFile) |
        ForEach-Object { [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($_)).TrimEnd("\") } |
        Select-Object -Unique
    )
    if (
      [System.IO.Path]::GetDirectoryName($cleanupFull).TrimEnd("\") -cne $temporaryRoot -or
      [System.IO.Path]::GetFileName($cleanupFull) -notlike "lego-real-build-bootstrap-*" -or
      $controlParents.Count -ne 1 -or
      $controlParents[0] -cne $cleanupFull
    ) {
      throw "Refusing unsafe pre-discovery source-lock cleanup target: $cleanupFull"
    }
    Remove-Item -LiteralPath $cleanupFull -Recurse -Force
  }
}
