export const REAL_BUILD_PREFIX50_STEP44_CALIBRATION_DIRECTORY_NATIVE = String.raw`
using System; using System.ComponentModel; using System.Diagnostics; using System.IO;
using System.Runtime.InteropServices; using System.Threading.Tasks;

public static class LegoCalibrationDirectoryTransaction {
    private const uint Delete = 0x00010000, ReadAttributes = 0x00000080;
    private const uint GenericRead = 0x80000000, ListDirectory = 0x00000001;
    private const uint Synchronize = 0x00100000, ShareRead = 0x00000001;
    private const uint ShareWrite = 0x00000002, OpenExisting = 3;
    private const uint BackupSemantics = 0x02000000, OpenReparsePoint = 0x00200000;
    private const uint DirectoryAttribute = 0x00000010, ReparseAttribute = 0x00000400;
    private const uint ObjectCaseInsensitive = 0x00000040, FileCreate = 2;
    private const uint FileDirectoryFile = 0x00000001;
    private const uint FileSynchronousIoNonAlert = 0x00000020;
    private const uint FileDispositionInformation = 13, MoveFileWriteThrough = 0x00000008;

    [StructLayout(LayoutKind.Sequential)]
    private struct UnicodeString { public ushort Length, MaximumLength; public IntPtr Buffer; }
    [StructLayout(LayoutKind.Sequential)]
    private struct ObjectAttributes {
        public uint Length;
        public IntPtr RootDirectory, ObjectName;
        public uint Attributes;
        public IntPtr SecurityDescriptor, SecurityQualityOfService;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct IoStatusBlock { public IntPtr Status; public UIntPtr Information; }
    [StructLayout(LayoutKind.Sequential)]
    private struct FileTime { public uint Low, High; }
    [StructLayout(LayoutKind.Sequential)]
    private struct ByHandleFileInformation {
        public uint FileAttributes; public FileTime CreationTime, LastAccessTime, LastWriteTime;
        public uint VolumeSerialNumber, FileSizeHigh, FileSizeLow, NumberOfLinks;
        public uint FileIndexHigh, FileIndexLow;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateFileW(string path, uint access, uint share, IntPtr security,
        uint creation, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetFileInformationByHandle(IntPtr handle,
        out ByHandleFileInformation information);
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll", EntryPoint = "MoveFileTransactedW", CharSet = CharSet.Unicode,
        SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool MoveFileTransacted(string existing, string destination,
        IntPtr progress, IntPtr data, uint flags, IntPtr transaction);
    [DllImport("KtmW32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateTransaction(IntPtr attributes, IntPtr uow, uint options,
        uint isolationLevel, uint isolationFlags, uint timeoutMilliseconds, string description);
    [DllImport("KtmW32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CommitTransaction(IntPtr transaction);
    [DllImport("KtmW32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool RollbackTransaction(IntPtr transaction);
    [DllImport("KtmW32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetTransactionInformation(IntPtr transaction, out uint outcome,
        out uint isolationLevel, out uint isolationFlags, out uint timeout,
        uint descriptionLength, IntPtr description);
    [DllImport("ntdll.dll")]
    private static extern int NtCreateFile(out IntPtr handle, uint access,
        ref ObjectAttributes attributes, ref IoStatusBlock status, IntPtr allocationSize,
        uint fileAttributes, uint shareAccess, uint createDisposition, uint createOptions,
        IntPtr eaBuffer, uint eaLength);
    [DllImport("ntdll.dll")]
    private static extern int NtSetInformationFile(IntPtr handle, ref IoStatusBlock status,
        IntPtr information, uint size, uint informationClass);

    private static ByHandleFileInformation Information(IntPtr handle, string label) {
        ByHandleFileInformation information;
        if (!GetFileInformationByHandle(handle, out information))
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot identify " + label);
        return information;
    }

    private static void AssertOrdinaryDirectory(IntPtr handle, string label) {
        ByHandleFileInformation information = Information(handle, label);
        if ((information.FileAttributes & DirectoryAttribute) == 0 ||
            (information.FileAttributes & ReparseAttribute) != 0)
            throw new InvalidOperationException(label + " is not a real non-reparse directory.");
    }

    public static IntPtr OpenRoot(string root) {
        IntPtr handle = CreateFileW(root, ListDirectory | ReadAttributes,
            ShareRead | ShareWrite, IntPtr.Zero, OpenExisting,
            BackupSemantics | OpenReparsePoint, IntPtr.Zero);
        if (handle == new IntPtr(-1))
            throw new Win32Exception(Marshal.GetLastWin32Error(),
                "Cannot open calibration output root with delete-denying protection");
        AssertOrdinaryDirectory(handle, "calibration output root");
        return handle;
    }

    public static IntPtr CreateGuardedDirectory(IntPtr root, string name) {
        IntPtr nameBuffer = Marshal.StringToHGlobalUni(name);
        IntPtr unicodeBuffer = IntPtr.Zero;
        try {
            UnicodeString unicode = new UnicodeString {
                Length = checked((ushort)(name.Length * 2)),
                MaximumLength = checked((ushort)((name.Length + 1) * 2)), Buffer = nameBuffer
            };
            unicodeBuffer = Marshal.AllocHGlobal(Marshal.SizeOf<UnicodeString>());
            Marshal.StructureToPtr(unicode, unicodeBuffer, false);
            ObjectAttributes attributes = new ObjectAttributes {
                Length = (uint)Marshal.SizeOf<ObjectAttributes>(), RootDirectory = root,
                ObjectName = unicodeBuffer, Attributes = ObjectCaseInsensitive,
                SecurityDescriptor = IntPtr.Zero, SecurityQualityOfService = IntPtr.Zero
            };
            IoStatusBlock status = new IoStatusBlock();
            IntPtr handle;
            int result = NtCreateFile(out handle, Delete | ReadAttributes | ListDirectory | Synchronize,
                ref attributes, ref status, IntPtr.Zero, DirectoryAttribute, ShareRead | ShareWrite,
                FileCreate, FileDirectoryFile | FileSynchronousIoNonAlert, IntPtr.Zero, 0);
            if (result < 0)
                throw new IOException("Atomic calibration staging creation returned NTSTATUS 0x" +
                    result.ToString("x8") + ".");
            AssertOrdinaryDirectory(handle, "calibration staging directory");
            return handle;
        } finally {
            if (unicodeBuffer != IntPtr.Zero) Marshal.FreeHGlobal(unicodeBuffer);
            Marshal.FreeHGlobal(nameBuffer);
        }
    }

    public static IntPtr OpenTrackingDirectory(string path) {
        IntPtr handle = CreateFileW(path, ReadAttributes, ShareRead | ShareWrite | 4,
            IntPtr.Zero, OpenExisting, BackupSemantics | OpenReparsePoint, IntPtr.Zero);
        if (handle == new IntPtr(-1))
            throw new Win32Exception(Marshal.GetLastWin32Error(),
                "Cannot open calibration staging identity tracker");
        AssertOrdinaryDirectory(handle, "calibration tracked directory");
        return handle;
    }

    public static void WriteIntentFile(string path, byte[] bytes) {
        using (FileStream stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write,
                FileShare.Read | FileShare.Delete, 4096, FileOptions.WriteThrough)) {
            stream.Write(bytes, 0, bytes.Length); stream.Flush(true);
        }
    }

    public static IntPtr OpenTrackingFile(string path) {
        IntPtr handle = CreateFileW(path, ReadAttributes, ShareRead | ShareWrite | 4,
            IntPtr.Zero, OpenExisting, OpenReparsePoint, IntPtr.Zero);
        if (handle == new IntPtr(-1))
            throw new Win32Exception(Marshal.GetLastWin32Error(),
                "Cannot open calibration publication intent tracker");
        ByHandleFileInformation information = Information(handle, "calibration publication intent");
        if ((information.FileAttributes & (DirectoryAttribute | ReparseAttribute)) != 0 ||
            information.NumberOfLinks != 1) {
            Close(handle);
            throw new InvalidOperationException(
                "Calibration publication intent must be singly linked and regular.");
        }
        return handle;
    }

    public static string Identity(IntPtr handle) {
        ByHandleFileInformation information = Information(handle, "calibration directory");
        ulong index = ((ulong)information.FileIndexHigh << 32) | information.FileIndexLow;
        return information.VolumeSerialNumber.ToString() + "\t" + index.ToString();
    }

    public static void AssertIdentity(IntPtr handle, string device, string inode, string label) {
        if (Identity(handle) != device + "\t" + inode)
            throw new InvalidOperationException(label + " identity changed during publication.");
    }

    public static void AssertSameIdentity(IntPtr expected, IntPtr observed, string label) {
        if (Identity(expected) != Identity(observed))
            throw new InvalidOperationException(label + " identity changed during publication.");
    }

    public static void ReassertRoot(IntPtr expected, string root) {
        IntPtr observed = OpenRoot(root);
        try { AssertSameIdentity(expected, observed, "Calibration output root"); }
        finally { Close(observed); }
    }

    public static string ContainedPath(string root, string relative) {
        if (String.IsNullOrWhiteSpace(relative) || Path.IsPathRooted(relative))
            throw new InvalidOperationException("Calibration guard roster path is not relative.");
        string prefix = Path.GetFullPath(root).TrimEnd('\\') + "\\";
        string path = Path.GetFullPath(Path.Combine(root, relative));
        if (!path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Calibration guard roster path escaped its root.");
        return path;
    }

    public static IntPtr OpenProtectedPath(string root, string relative, string kind,
        string device, string inode, string size) {
        bool directory = kind == "directory";
        if (!directory && kind != "file")
            throw new InvalidOperationException("Calibration guard roster kind is invalid.");
        uint access = directory ? ListDirectory | ReadAttributes | Synchronize
            : GenericRead | ReadAttributes | Synchronize;
        uint flags = OpenReparsePoint | (directory ? BackupSemantics : 0);
        IntPtr handle = CreateFileW(ContainedPath(root, relative), access, ShareRead,
            IntPtr.Zero, OpenExisting, flags, IntPtr.Zero);
        if (handle == new IntPtr(-1))
            throw new Win32Exception(Marshal.GetLastWin32Error(),
                "Cannot acquire deny-write/delete calibration roster protection for " + relative);
        try {
            ByHandleFileInformation information = Information(handle, relative);
            bool observedDirectory = (information.FileAttributes & DirectoryAttribute) != 0;
            if ((information.FileAttributes & ReparseAttribute) != 0 ||
                observedDirectory != directory || (!directory && information.NumberOfLinks != 1))
                throw new InvalidOperationException(relative + " is not an exact ordinary roster entry.");
            AssertIdentity(handle, device, inode, relative);
            ulong observedSize = ((ulong)information.FileSizeHigh << 32) | information.FileSizeLow;
            if (!directory && observedSize.ToString() != size)
                throw new InvalidOperationException(relative + " size changed before protection.");
            return handle;
        } catch { Close(handle); throw; }
    }

    public static IntPtr NewTransaction(uint timeoutMilliseconds, string description) {
        IntPtr transaction = CreateTransaction(IntPtr.Zero, IntPtr.Zero, 0, 0, 0,
            timeoutMilliseconds, description);
        if (transaction == new IntPtr(-1))
            throw new Win32Exception(Marshal.GetLastWin32Error(),
                "Transactional NTFS is unavailable for calibration publication");
        return transaction;
    }

    public static void MoveInTransaction(string source, string destination, IntPtr transaction) {
        if (!MoveFileTransacted(source, destination, IntPtr.Zero, IntPtr.Zero,
                MoveFileWriteThrough, transaction)) {
            int error = Marshal.GetLastWin32Error();
            throw new Win32Exception(error,
                "Transactional calibration directory reservation failed with Win32 " + error);
        }
    }

    public static void Commit(IntPtr transaction) {
        if (!CommitTransaction(transaction))
            throw new Win32Exception(Marshal.GetLastWin32Error(),
                "Transactional calibration directory commit failed");
    }

    public static void Rollback(IntPtr transaction) {
        if (!RollbackTransaction(transaction))
            throw new Win32Exception(Marshal.GetLastWin32Error(),
                "Transactional calibration directory rollback failed");
    }

    public static bool TransactionActive(IntPtr transaction) {
        uint outcome, level, flags, timeout;
        if (transaction == IntPtr.Zero || !GetTransactionInformation(transaction, out outcome,
                out level, out flags, out timeout, 0, IntPtr.Zero))
            throw new Win32Exception(Marshal.GetLastWin32Error(),
                "Cannot reassert calibration guard transaction outcome");
        return outcome == 1;
    }

    public static string ReadCommandOrOwnerExit(Process owner) {
        Task<string> read = Console.In.ReadLineAsync();
        while (!read.Wait(100)) { owner.Refresh(); if (owner.HasExited) return null; }
        return read.GetAwaiter().GetResult();
    }

    public static void DeleteExactOnClose(IntPtr handle) {
        IntPtr buffer = Marshal.AllocHGlobal(1);
        try {
            Marshal.WriteByte(buffer, 0, 1); IoStatusBlock status = new IoStatusBlock();
            int result = NtSetInformationFile(handle, ref status, buffer, 1,
                FileDispositionInformation);
            if (result < 0)
                throw new IOException("Exact calibration staging deletion returned NTSTATUS 0x" +
                    result.ToString("x8") + ".");
        } finally { Marshal.FreeHGlobal(buffer); }
    }

    public static void Close(IntPtr handle) {
        if (handle != IntPtr.Zero && !CloseHandle(handle))
            throw new Win32Exception(Marshal.GetLastWin32Error(),
                "Cannot close calibration native handle");
    }
}
`;
