param(
  [Parameter(Mandatory = $true)]
  [string]$Path,
  [Parameter(Mandatory = $true)]
  [UInt64]$Inode,
  [Parameter(Mandatory = $true)]
  [UInt64]$Device,
  [Parameter(Mandatory = $true)]
  [UInt64]$ExpectedSize
)

$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class LegoExactFileDeletion {
    private const uint Delete = 0x00010000;
    private const uint ReadAttributes = 0x00000080;
    private const uint ShareRead = 0x00000001;
    private const uint ShareWrite = 0x00000002;
    private const uint ShareDelete = 0x00000004;
    private const uint OpenExisting = 3;
    private const uint OpenReparsePoint = 0x00200000;
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

    public static void DeleteExact(string path, ulong expectedIndex, ulong expectedDevice, ulong expectedSize) {
        IntPtr file = CreateFileW(
            path,
            Delete | ReadAttributes,
            ShareRead | ShareWrite | ShareDelete,
            IntPtr.Zero,
            OpenExisting,
            OpenReparsePoint,
            IntPtr.Zero
        );
        if (file == new IntPtr(-1)) {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot open the rejected file for exact-handle deletion");
        }
        try {
            ByHandleFileInformation observed;
            if (!GetFileInformationByHandle(file, out observed)) {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot identify the exact rejected file handle");
            }
            ulong index = ((ulong)observed.FileIndexHigh << 32) | observed.FileIndexLow;
            ulong size = ((ulong)observed.FileSizeHigh << 32) | observed.FileSizeLow;
            bool ordinaryFile = (observed.FileAttributes & (DirectoryAttribute | ReparsePointAttribute)) == 0;
            bool sameDevice = expectedDevice == 0 || observed.VolumeSerialNumber == expectedDevice;
            if (!ordinaryFile || index != expectedIndex || !sameDevice || size != expectedSize) {
                throw new InvalidOperationException(
                    "The cleanup path no longer names the exact ordinary file opened by the publisher; no replacement was deleted"
                );
            }
            FileDispositionInfo disposition = new FileDispositionInfo { DeleteFile = true };
            if (!SetFileInformationByHandle(file, 4, ref disposition, 1)) {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot mark the exact rejected file handle for deletion");
            }
        } finally {
            CloseHandle(file);
        }
    }
}
"@

[LegoExactFileDeletion]::DeleteExact($Path, $Inode, $Device, $ExpectedSize)
