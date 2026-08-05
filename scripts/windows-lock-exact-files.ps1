param(
  [Parameter(Mandatory = $true)]
  [string]$Specification
)

$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using Microsoft.Win32.SafeHandles;

public static class LegoExactReadLock {
    private const uint GenericRead = 0x80000000;
    private const uint Delete = 0x00010000;
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

    [StructLayout(LayoutKind.Sequential)]
    private struct FileDispositionInfo {
        [MarshalAs(UnmanagedType.U1)]
        public bool DeleteFile;
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
    private static extern bool SetFileInformationByHandle(
        IntPtr file,
        int informationClass,
        ref FileDispositionInfo information,
        uint bufferSize
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);

    public static IntPtr OpenExact(string path, string expectedDigest) {
        IntPtr file = CreateFileW(
            path,
            GenericRead | Delete,
            ShareRead,
            IntPtr.Zero,
            OpenExisting,
            OpenReparsePoint,
            IntPtr.Zero
        );
        if (file == new IntPtr(-1)) {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot lock the exact vision-card snapshot");
        }
        try {
            ByHandleFileInformation information;
            if (!GetFileInformationByHandle(file, out information)) {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot inspect the locked vision-card snapshot");
            }
            if ((information.FileAttributes & (DirectoryAttribute | ReparsePointAttribute)) != 0) {
                throw new InvalidOperationException("Vision-card snapshot is a directory or reparse point");
            }
            string observed;
            using (SafeFileHandle safe = new SafeFileHandle(file, false))
            using (FileStream stream = new FileStream(safe, FileAccess.Read, 65536, false))
            using (SHA256 sha = SHA256.Create()) {
                observed = "sha256:" + BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
            }
            if (!String.Equals(observed, expectedDigest, StringComparison.Ordinal)) {
                throw new InvalidOperationException("Vision-card snapshot digest changed before its exact read lock was acquired");
            }
            return file;
        } catch {
            CloseHandle(file);
            throw;
        }
    }

    public static IntPtr OpenDirectoryExact(string path, ulong expectedIndex, ulong expectedDevice) {
        IntPtr directory = CreateFileW(
            path,
            Delete | ReadAttributes,
            ShareRead,
            IntPtr.Zero,
            OpenExisting,
            OpenReparsePoint | BackupSemantics,
            IntPtr.Zero
        );
        if (directory == new IntPtr(-1)) {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot lock the exact vision-call snapshot directory");
        }
        try {
            ByHandleFileInformation information;
            if (!GetFileInformationByHandle(directory, out information)) {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot identify the vision-call snapshot directory");
            }
            ulong index = ((ulong)information.FileIndexHigh << 32) | information.FileIndexLow;
            bool ordinaryDirectory =
                (information.FileAttributes & DirectoryAttribute) != 0 &&
                (information.FileAttributes & ReparsePointAttribute) == 0;
            bool sameDevice = expectedDevice == 0 || information.VolumeSerialNumber == expectedDevice;
            if (!ordinaryDirectory || index != expectedIndex || !sameDevice) {
                throw new InvalidOperationException("Vision-call snapshot directory changed identity before its exact lock was acquired");
            }
            return directory;
        } catch {
            CloseHandle(directory);
            throw;
        }
    }

    public static void MarkDelete(IntPtr file) {
        FileDispositionInfo disposition = new FileDispositionInfo { DeleteFile = true };
        if (!SetFileInformationByHandle(file, 4, ref disposition, 1)) {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot mark the exact vision-call snapshot handle for deletion");
        }
    }

    public static void CloseExact(IntPtr file) {
        if (!CloseHandle(file)) {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot release an exact vision-card snapshot lock");
        }
    }
}
"@

$json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Specification))
$spec = ConvertFrom-Json $json
$handles = New-Object System.Collections.Generic.List[IntPtr]
$rootHandle = [LegoExactReadLock]::OpenDirectoryExact(
  $spec.root.path,
  $spec.root.inode,
  $spec.root.device
)
try {
  foreach ($record in $spec.files) {
    $handles.Add([LegoExactReadLock]::OpenExact($record.path, $record.digest))
  }
  [Console]::Out.WriteLine("READY")
  [Console]::Out.Flush()
  [Console]::In.ReadToEnd() | Out-Null
  foreach ($handle in $handles) {
    [LegoExactReadLock]::MarkDelete($handle)
  }
  foreach ($handle in $handles) {
    [LegoExactReadLock]::CloseExact($handle)
  }
  $handles.Clear()
  [LegoExactReadLock]::MarkDelete($rootHandle)
} finally {
  foreach ($handle in $handles) {
    [LegoExactReadLock]::CloseExact($handle)
  }
  [LegoExactReadLock]::CloseExact($rootHandle)
}
