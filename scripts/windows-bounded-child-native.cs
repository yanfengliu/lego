using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Win32.SafeHandles;

namespace Lego.PartIdentification {
  public static partial class BoundedChildJob {
    private const uint CREATE_NO_WINDOW = 0x08000000;
    private const uint EXTENDED_STARTUPINFO_PRESENT = 0x00080000;
    private const uint STARTF_USESTDHANDLES = 0x00000100;
    private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
    private const int JobObjectExtendedLimitInformation = 9;
    private const int ERROR_INSUFFICIENT_BUFFER = 122;
    private const uint INFINITE = 0xffffffff;
    private const uint GENERIC_READ = 0x80000000;
    private const uint FILE_READ_ATTRIBUTES = 0x00000080;
    private const uint FILE_SHARE_READ = 0x00000001;
    private const uint FILE_SHARE_WRITE = 0x00000002;
    private const uint OPEN_EXISTING = 3;
    private const uint FILE_FLAG_OPEN_REPARSE_POINT = 0x00200000;
    private const uint FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;
    private const uint FILE_FLAG_SEQUENTIAL_SCAN = 0x08000000;
    private const uint FILE_ATTRIBUTE_DIRECTORY = 0x00000010;
    private const uint FILE_ATTRIBUTE_REPARSE_POINT = 0x00000400;
    private const uint FILE_TYPE_DISK = 0x0001;
    private const uint DRIVE_FIXED = 3;
    private const uint INVALID_FILE_ATTRIBUTES = 0xffffffff;
    private static readonly IntPtr INVALID_HANDLE_VALUE = new IntPtr(-1);
    // ProcThreadAttributeValue(ProcThreadAttributeJobList=13, false, true, false).
    private static readonly IntPtr PROC_THREAD_ATTRIBUTE_JOB_LIST = new IntPtr(0x0002000d);
    private static readonly Regex Sha256 = new Regex(
      "^sha256:[0-9a-f]{64}$",
      RegexOptions.CultureInvariant);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct STARTUPINFO {
      public int cb;
      public string lpReserved;
      public string lpDesktop;
      public string lpTitle;
      public uint dwX;
      public uint dwY;
      public uint dwXSize;
      public uint dwYSize;
      public uint dwXCountChars;
      public uint dwYCountChars;
      public uint dwFillAttribute;
      public uint dwFlags;
      public short wShowWindow;
      public short cbReserved2;
      public IntPtr lpReserved2;
      public IntPtr hStdInput;
      public IntPtr hStdOutput;
      public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct STARTUPINFOEX {
      public STARTUPINFO StartupInfo;
      public IntPtr lpAttributeList;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROCESS_INFORMATION {
      public IntPtr hProcess;
      public IntPtr hThread;
      public uint dwProcessId;
      public uint dwThreadId;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
      public long PerProcessUserTimeLimit;
      public long PerJobUserTimeLimit;
      public uint LimitFlags;
      public UIntPtr MinimumWorkingSetSize;
      public UIntPtr MaximumWorkingSetSize;
      public uint ActiveProcessLimit;
      public UIntPtr Affinity;
      public uint PriorityClass;
      public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IO_COUNTERS {
      public ulong ReadOperationCount;
      public ulong WriteOperationCount;
      public ulong OtherOperationCount;
      public ulong ReadTransferCount;
      public ulong WriteTransferCount;
      public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
      public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
      public IO_COUNTERS IoInfo;
      public UIntPtr ProcessMemoryLimit;
      public UIntPtr JobMemoryLimit;
      public UIntPtr PeakProcessMemoryUsed;
      public UIntPtr PeakJobMemoryUsed;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct FILETIME {
      public uint Low;
      public uint High;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct BY_HANDLE_FILE_INFORMATION {
      public uint FileAttributes;
      public FILETIME CreationTime;
      public FILETIME LastAccessTime;
      public FILETIME LastWriteTime;
      public uint VolumeSerialNumber;
      public uint FileSizeHigh;
      public uint FileSizeLow;
      public uint NumberOfLinks;
      public uint FileIndexHigh;
      public uint FileIndexLow;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateJobObject(IntPtr attributes, string name);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(
      IntPtr job,
      int informationClass,
      ref JOBOBJECT_EXTENDED_LIMIT_INFORMATION information,
      uint informationLength);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CreateProcess(
      string applicationName,
      StringBuilder commandLine,
      IntPtr processAttributes,
      IntPtr threadAttributes,
      bool inheritHandles,
      uint creationFlags,
      IntPtr environment,
      string currentDirectory,
      ref STARTUPINFOEX startupInfo,
      out PROCESS_INFORMATION processInformation);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool InitializeProcThreadAttributeList(
      IntPtr attributeList,
      int attributeCount,
      int flags,
      ref IntPtr size);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool UpdateProcThreadAttribute(
      IntPtr attributeList,
      uint flags,
      IntPtr attribute,
      IntPtr value,
      IntPtr size,
      IntPtr previousValue,
      IntPtr returnSize);

    [DllImport("kernel32.dll")]
    private static extern void DeleteProcThreadAttributeList(IntPtr attributeList);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateFileW(
      string path,
      uint desiredAccess,
      uint shareMode,
      IntPtr securityAttributes,
      uint creationDisposition,
      uint flagsAndAttributes,
      IntPtr templateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetFileInformationByHandle(
      IntPtr file,
      out BY_HANDLE_FILE_INFORMATION information);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetFinalPathNameByHandle(
      IntPtr file,
      StringBuilder path,
      uint pathLength,
      uint flags);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern uint GetDriveType(string rootPathName);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool GetVolumeInformation(
      string rootPathName,
      StringBuilder volumeName,
      uint volumeNameSize,
      out uint volumeSerialNumber,
      out uint maximumComponentLength,
      out uint fileSystemFlags,
      StringBuilder fileSystemName,
      uint fileSystemNameSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint GetFileType(IntPtr file);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetFileAttributes(string path);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr handle);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetStdHandle(int standardHandle);

    private static void ThrowLastError(string action) {
      throw new Win32Exception(Marshal.GetLastWin32Error(), action);
    }

    private static string Quote(string argument) {
      if (argument.Length > 0 && argument.IndexOfAny(new[] { ' ', '\t', '\n', '\v', '"' }) < 0) {
        return argument;
      }
      StringBuilder result = new StringBuilder();
      result.Append('"');
      int slashes = 0;
      foreach (char character in argument) {
        if (character == '\\') {
          slashes += 1;
          continue;
        }
        if (character == '"') {
          result.Append('\\', slashes * 2 + 1);
          result.Append('"');
          slashes = 0;
          continue;
        }
        result.Append('\\', slashes);
        slashes = 0;
        result.Append(character);
      }
      result.Append('\\', slashes * 2);
      result.Append('"');
      return result.ToString();
    }

    private static BY_HANDLE_FILE_INFORMATION Inspect(IntPtr handle, string action) {
      BY_HANDLE_FILE_INFORMATION information;
      if (!GetFileInformationByHandle(handle, out information)) ThrowLastError(action);
      return information;
    }

    private static ulong FileIndex(BY_HANDLE_FILE_INFORMATION information) {
      return ((ulong)information.FileIndexHigh << 32) | information.FileIndexLow;
    }

    private static ulong FileSize(BY_HANDLE_FILE_INFORMATION information) {
      return ((ulong)information.FileSizeHigh << 32) | information.FileSizeLow;
    }

    private static bool SameIdentity(
      BY_HANDLE_FILE_INFORMATION left,
      BY_HANDLE_FILE_INFORMATION right) {
      return left.VolumeSerialNumber == right.VolumeSerialNumber &&
        FileIndex(left) != 0 &&
        FileIndex(left) == FileIndex(right);
    }

    private static void RequirePinnedLeaf(
      IntPtr handle,
      BY_HANDLE_FILE_INFORMATION information,
      ulong expectedBytes,
      string action) {
      if (GetFileType(handle) != FILE_TYPE_DISK ||
          (information.FileAttributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT)) != 0 ||
          FileIndex(information) == 0 ||
          FileSize(information) != expectedBytes) {
        throw new InvalidOperationException(
          action + " must be one ordinary fixed-disk file with exact byte length " + expectedBytes + ".");
      }
    }

    private static string Hash(IntPtr handle) {
      using (SafeFileHandle safe = new SafeFileHandle(handle, false))
      using (FileStream stream = new FileStream(safe, FileAccess.Read, 1024 * 1024, false))
      using (SHA256 sha = SHA256.Create()) {
        return "sha256:" + BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
      }
    }

    private static string FinalDosPath(IntPtr handle) {
      StringBuilder extended = new StringBuilder(32768);
      uint count = GetFinalPathNameByHandle(handle, extended, (uint)extended.Capacity, 0);
      if (count == 0) ThrowLastError("Cannot resolve the pinned executable handle to its final path");
      if (count >= extended.Capacity) {
        throw new InvalidOperationException("Pinned executable final path exceeds 32767 characters.");
      }
      string value = extended.ToString();
      if (!value.StartsWith(@"\\?\", StringComparison.Ordinal) ||
          value.StartsWith(@"\\?\UNC\", StringComparison.OrdinalIgnoreCase)) {
        throw new InvalidOperationException(
          "Pinned executable must resolve to a local drive-letter DOS path, not a network or device namespace.");
      }
      string path = Path.GetFullPath(value.Substring(4));
      string root = Path.GetPathRoot(path);
      if (String.IsNullOrEmpty(root) || GetDriveType(root) != DRIVE_FIXED) {
        throw new InvalidOperationException("Pinned executable must reside on a fixed local drive.");
      }
      StringBuilder fileSystem = new StringBuilder(32);
      uint serial;
      uint maximumComponentLength;
      uint fileSystemFlags;
      if (!GetVolumeInformation(
        root,
        null,
        0,
        out serial,
        out maximumComponentLength,
        out fileSystemFlags,
        fileSystem,
        (uint)fileSystem.Capacity)) {
        ThrowLastError("Cannot identify the pinned executable filesystem");
      }
      if (!String.Equals(fileSystem.ToString(), "NTFS", StringComparison.OrdinalIgnoreCase)) {
        throw new InvalidOperationException(
          "Pinned executable exact identity is currently supported only on a fixed NTFS volume.");
      }
      return path;
    }

    private static IntPtr OpenPinnedLeaf(string path) {
      IntPtr handle = CreateFileW(
        path,
        GENERIC_READ,
        FILE_SHARE_READ,
        IntPtr.Zero,
        OPEN_EXISTING,
        FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_SEQUENTIAL_SCAN,
        IntPtr.Zero);
      if (handle == INVALID_HANDLE_VALUE) ThrowLastError("Cannot open the pinned executable without write/delete sharing");
      return handle;
    }

    private static List<IntPtr> GuardDirectories(string finalPath) {
      string root = Path.GetPathRoot(finalPath);
      string parent = Path.GetDirectoryName(finalPath);
      List<string> paths = new List<string>();
      paths.Add(root);
      string current = root;
      string remainder = parent.Substring(root.Length);
      foreach (string component in remainder.Split(new[] { '\\' }, StringSplitOptions.RemoveEmptyEntries)) {
        current = Path.Combine(current, component);
        paths.Add(current);
      }
      List<IntPtr> handles = new List<IntPtr>();
      string skippedRestrictedAnchor = null;
      bool guardedRestrictedDescendant = false;
      try {
        foreach (string path in paths) {
          IntPtr handle = CreateFileW(
            path,
            FILE_READ_ATTRIBUTES,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            IntPtr.Zero,
            OPEN_EXISTING,
            FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS,
            IntPtr.Zero);
          if (handle == INVALID_HANDLE_VALUE) {
            int error = Marshal.GetLastWin32Error();
            if (error == 5 && skippedRestrictedAnchor == null && handles.Count > 0) {
              uint attributes = GetFileAttributes(path);
              if (attributes == INVALID_FILE_ATTRIBUTES ||
                  (attributes & FILE_ATTRIBUTE_DIRECTORY) == 0 ||
                  (attributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0) {
                throw new InvalidOperationException(
                  "An access-restricted Windows path anchor is not an ordinary directory.");
              }
              skippedRestrictedAnchor = path;
              continue;
            }
            throw new Win32Exception(error, "Cannot guard pinned executable directory " + path);
          }
          handles.Add(handle);
          if (skippedRestrictedAnchor != null &&
              path.StartsWith(
                skippedRestrictedAnchor + Path.DirectorySeparatorChar,
                StringComparison.OrdinalIgnoreCase)) {
            guardedRestrictedDescendant = true;
          }
          BY_HANDLE_FILE_INFORMATION information = Inspect(
            handle,
            "Cannot inspect pinned executable directory " + path);
          if ((information.FileAttributes & FILE_ATTRIBUTE_DIRECTORY) == 0 ||
              (information.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0 ||
              FileIndex(information) == 0) {
            throw new InvalidOperationException(
              "Pinned executable final path crosses a non-directory, reparse point, or unidentified component.");
          }
        }
        if (skippedRestrictedAnchor != null && !guardedRestrictedDescendant) {
          throw new InvalidOperationException(
            "Pinned executable beneath an access-restricted directory needs at least one strictly guarded descendant directory.");
        }
        return handles;
      } catch {
        CloseAll(handles);
        throw;
      }
    }

    private static void CloseAll(List<IntPtr> handles) {
      for (int index = handles.Count - 1; index >= 0; index -= 1) {
        if (handles[index] != IntPtr.Zero && handles[index] != INVALID_HANDLE_VALUE) {
          CloseHandle(handles[index]);
        }
      }
      handles.Clear();
    }
  }
}
