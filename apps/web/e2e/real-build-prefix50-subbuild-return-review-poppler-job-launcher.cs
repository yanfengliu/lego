using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Microsoft.Win32.SafeHandles;

public static class Step44PopplerJobLauncher
{
    const uint CREATE_SUSPENDED = 0x00000004;
    const uint CREATE_NO_WINDOW = 0x08000000;
    const uint CREATE_UNICODE_ENVIRONMENT = 0x00000400;
    const uint STARTF_USESTDHANDLES = 0x00000100;
    const uint HANDLE_FLAG_INHERIT = 0x00000001;
    const uint GENERIC_WRITE = 0x40000000;
    const uint FILE_SHARE_READ = 0x00000001;
    const uint FILE_SHARE_WRITE = 0x00000002;
    const uint OPEN_EXISTING = 3;
    const uint FILE_ATTRIBUTE_NORMAL = 0x00000080;
    const uint WAIT_OBJECT_0 = 0;
    const uint THREAD_TERMINATE = 0x00000001;
    const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
    const int JobObjectBasicAccountingInformation = 1;
    const int JobObjectExtendedLimitInformation = 9;

    [StructLayout(LayoutKind.Sequential)]
    struct SECURITY_ATTRIBUTES
    {
        public int nLength;
        public IntPtr lpSecurityDescriptor;
        [MarshalAs(UnmanagedType.Bool)] public bool bInheritHandle;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct STARTUPINFO
    {
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

    [StructLayout(LayoutKind.Sequential)]
    struct PROCESS_INFORMATION
    {
        public IntPtr hProcess;
        public IntPtr hThread;
        public uint dwProcessId;
        public uint dwThreadId;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct JOBOBJECT_BASIC_LIMIT_INFORMATION
    {
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
    struct IO_COUNTERS
    {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct JOBOBJECT_BASIC_ACCOUNTING_INFORMATION
    {
        public long TotalUserTime;
        public long TotalKernelTime;
        public long ThisPeriodTotalUserTime;
        public long ThisPeriodTotalKernelTime;
        public uint TotalPageFaultCount;
        public uint TotalProcesses;
        public uint ActiveProcesses;
        public uint TotalTerminatedProcesses;
    }

    public sealed class Result
    {
        public int ExitCode { get; private set; }
        public uint TotalProcesses { get; private set; }
        public uint ActiveProcesses { get; private set; }

        internal Result(int exitCode, uint totalProcesses, uint activeProcesses)
        {
            ExitCode = exitCode;
            TotalProcesses = totalProcesses;
            ActiveProcesses = activeProcesses;
        }
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr CreateJobObject(IntPtr attributes, string name);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetInformationJobObject(IntPtr job, int infoClass, ref JOBOBJECT_EXTENDED_LIMIT_INFORMATION info, uint length);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool QueryInformationJobObject(IntPtr job, int infoClass, ref JOBOBJECT_BASIC_ACCOUNTING_INFORMATION info, uint length, IntPtr returnLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool TerminateJobObject(IntPtr job, uint exitCode);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CreateProcess(string applicationName, StringBuilder commandLine, IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment, string currentDirectory, ref STARTUPINFO startupInfo, out PROCESS_INFORMATION processInformation);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool CreatePipe(out IntPtr readPipe, out IntPtr writePipe, ref SECURITY_ATTRIBUTES attributes, uint size);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr CreateFile(string path, uint access, uint share, ref SECURITY_ATTRIBUTES attributes, uint disposition, uint flags, IntPtr template);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern uint ResumeThread(IntPtr thread);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool CloseHandle(IntPtr handle);

    [DllImport("kernel32.dll")]
    static extern uint GetCurrentThreadId();

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr OpenThread(uint desiredAccess, bool inheritHandle, uint threadId);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool CancelSynchronousIo(IntPtr thread);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool TerminateProcess(IntPtr process, uint exitCode);

    static void Require(bool condition, string label)
    {
        if (!condition) throw new Win32Exception(Marshal.GetLastWin32Error(), label);
    }

    static string Quote(string value)
    {
        if (value.IndexOf('\0') >= 0 || value.Length > 4096) throw new ArgumentException("invalid native argument");
        if (value.Length > 0 && value.IndexOfAny(new[] { ' ', '\t', '\n', '\v', '"' }) < 0) return value;
        var result = new StringBuilder("\"");
        int slashes = 0;
        foreach (char character in value)
        {
            if (character == '\\')
            {
                slashes++;
                continue;
            }
            if (character == '"')
            {
                result.Append('\\', slashes * 2 + 1).Append('"');
                slashes = 0;
                continue;
            }
            result.Append('\\', slashes).Append(character);
            slashes = 0;
        }
        result.Append('\\', slashes * 2).Append('"');
        return result.ToString();
    }

    static IntPtr EnvironmentBlock(IDictionary<string, string> environment)
    {
        var rows = new List<string>();
        foreach (var pair in environment)
        {
            if (pair.Key.Length == 0 || pair.Key.IndexOfAny(new[] { '=', '\0' }) >= 0 || pair.Value.IndexOf('\0') >= 0)
                throw new ArgumentException("invalid child environment");
            rows.Add(pair.Key + "=" + pair.Value);
        }
        rows.Sort(StringComparer.OrdinalIgnoreCase);
        return Marshal.StringToHGlobalUni(string.Join("\0", rows.ToArray()) + "\0\0");
    }

    // A created child is owned even when job assignment fails. Keep this handle open through the wait.
    static void ConfirmCreatedProcessExit(IntPtr process)
    {
        uint before = WaitForSingleObject(process, 0);
        if (before == WAIT_OBJECT_0) return;
        int beforeError = before == 0xffffffff ? Marshal.GetLastWin32Error() : 0;
        bool terminated = TerminateProcess(process, 1);
        int terminateError = terminated ? 0 : Marshal.GetLastWin32Error();
        uint after = WaitForSingleObject(process, 5000);
        if (after == WAIT_OBJECT_0) return; // A racing exit can make TerminateProcess fail with access denied.
        int waitError = after == 0xffffffff ? Marshal.GetLastWin32Error() : 0;
        throw new InvalidOperationException(
            "Created child exit remains unconfirmed after its 5000 ms cleanup wait: initialWait=" + before +
            ", initialWin32Error=" + beforeError + ", terminationSucceeded=" + terminated +
            ", terminationWin32Error=" + terminateError + ", finalWait=" + after +
            ", finalWin32Error=" + waitError + ". Preserve the launch failure and resolve child cleanup before another launch.");
    }

    static void CloseCleanupHandle(IntPtr handle, string label, List<Exception> failures)
    {
        if (handle == IntPtr.Zero || handle == new IntPtr(-1)) return;
        try { Require(CloseHandle(handle), label); }
        catch (Exception error) { failures.Add(error); }
    }

    public static Result Run(string executable, string workingDirectory, string[] arguments, IDictionary<string, string> environment, byte[] stdin, int timeoutMilliseconds)
    {
        if (arguments == null || arguments.Length < 1 || arguments.Length > 32 || stdin == null || stdin.Length < 1 || timeoutMilliseconds < 1 || timeoutMilliseconds > 60000)
            throw new ArgumentException("invalid bounded launch request");
        IntPtr job = IntPtr.Zero;
        IntPtr readPipe = IntPtr.Zero;
        IntPtr writePipe = IntPtr.Zero;
        IntPtr nullHandle = IntPtr.Zero;
        IntPtr environmentBlock = IntPtr.Zero;
        var process = new PROCESS_INFORMATION();
        bool processCreated = false;
        bool processExited = false;
        FileStream stdinStream = null;
        ManualResetEvent stdinWriterCompleted = null;
        Thread stdinWriter = null;
        uint stdinWriterThreadId = 0;
        Exception stdinWriterFailure = null;
        Exception operationFailure = null;
        try
        {
            job = CreateJobObject(IntPtr.Zero, null);
            Require(job != IntPtr.Zero, "CreateJobObject");
            var limits = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            Require(SetInformationJobObject(job, JobObjectExtendedLimitInformation, ref limits, (uint)Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION))), "SetInformationJobObject");
            var security = new SECURITY_ATTRIBUTES { nLength = Marshal.SizeOf(typeof(SECURITY_ATTRIBUTES)), bInheritHandle = true };
            Require(CreatePipe(out readPipe, out writePipe, ref security, 0), "CreatePipe");
            Require(SetHandleInformation(writePipe, HANDLE_FLAG_INHERIT, 0), "SetHandleInformation");
            nullHandle = CreateFile("NUL", GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, ref security, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, IntPtr.Zero);
            Require(nullHandle != new IntPtr(-1), "CreateFile(NUL)");
            var startup = new STARTUPINFO
            {
                cb = Marshal.SizeOf(typeof(STARTUPINFO)),
                dwFlags = STARTF_USESTDHANDLES,
                hStdInput = readPipe,
                hStdOutput = nullHandle,
                hStdError = nullHandle
            };
            var command = new StringBuilder(Quote(executable));
            foreach (string argument in arguments) command.Append(' ').Append(Quote(argument));
            environmentBlock = EnvironmentBlock(environment);
            Require(CreateProcess(executable, command, IntPtr.Zero, IntPtr.Zero, true, CREATE_SUSPENDED | CREATE_NO_WINDOW | CREATE_UNICODE_ENVIRONMENT, environmentBlock, workingDirectory, ref startup, out process), "CreateProcess");
            processCreated = true;
            Require(AssignProcessToJobObject(job, process.hProcess), "AssignProcessToJobObject");
            Require(ResumeThread(process.hThread) != 0xFFFFFFFF, "ResumeThread");
            CloseHandle(readPipe);
            readPipe = IntPtr.Zero;
            stdinStream = new FileStream(new SafeFileHandle(writePipe, true), FileAccess.Write, 65536, false);
            writePipe = IntPtr.Zero;
            stdinWriterCompleted = new ManualResetEvent(false);
            stdinWriter = new Thread(delegate()
            {
                stdinWriterThreadId = GetCurrentThreadId();
                try
                {
                    stdinStream.Write(stdin, 0, stdin.Length);
                }
                catch (Exception error)
                {
                    stdinWriterFailure = error;
                }
                finally
                {
                    stdinStream.Dispose();
                    stdinWriterCompleted.Set();
                }
            });
            stdinWriter.IsBackground = true;
            stdinWriter.Start();
            uint wait = WaitForSingleObject(process.hProcess, (uint)timeoutMilliseconds);
            if (wait != WAIT_OBJECT_0)
            {
                TerminateJobObject(job, 1460);
                WaitForSingleObject(process.hProcess, 5000);
                stdinWriterCompleted.WaitOne(5000);
                throw new TimeoutException("job-contained Poppler timed out");
            }
            processExited = true;
            if (!stdinWriterCompleted.WaitOne(5000) || !stdinWriter.Join(5000))
                throw new TimeoutException("job-contained Poppler stdin writer did not quiesce");
            if (stdinWriterFailure != null)
                throw new IOException("job-contained Poppler rejected the bounded stdin stream", stdinWriterFailure);
            uint rawExitCode;
            Require(GetExitCodeProcess(process.hProcess, out rawExitCode), "GetExitCodeProcess");
            var accounting = new JOBOBJECT_BASIC_ACCOUNTING_INFORMATION();
            for (int attempt = 0; attempt < 500; attempt++)
            {
                Require(QueryInformationJobObject(job, JobObjectBasicAccountingInformation, ref accounting, (uint)Marshal.SizeOf(typeof(JOBOBJECT_BASIC_ACCOUNTING_INFORMATION)), IntPtr.Zero), "QueryInformationJobObject");
                if (accounting.ActiveProcesses == 0) break;
                Thread.Sleep(10);
            }
            if (accounting.ActiveProcesses != 0 || accounting.TotalProcesses < 1 || accounting.TotalProcesses > 4)
            {
                TerminateJobObject(job, 1);
                throw new InvalidOperationException(
                    "Poppler job did not prove one bounded quiescent process tree: total=" +
                    accounting.TotalProcesses + ", active=" + accounting.ActiveProcesses);
            }
            return new Result(unchecked((int)rawExitCode), accounting.TotalProcesses, accounting.ActiveProcesses);
        }
        catch (Exception error)
        {
            operationFailure = error;
            throw; // Keep the original exception and stack when cleanup succeeds.
        }
        finally
        {
            var cleanupFailures = new List<Exception>();
            try
            {
                if (processCreated && !processExited && job != IntPtr.Zero)
                    Require(TerminateJobObject(job, 1), "TerminateJobObject during cleanup");
            }
            catch (Exception error) { cleanupFailures.Add(error); }
            // Job failure, writer failure, and later handle-close failure cannot skip exact-child cleanup.
            if (processCreated)
            {
                try { ConfirmCreatedProcessExit(process.hProcess); }
                catch (Exception error) { cleanupFailures.Add(error); }
            }
            try
            {
                if (stdinWriter != null && stdinWriter.IsAlive)
                {
                    IntPtr nativeWriter = stdinWriterThreadId == 0
                        ? IntPtr.Zero
                        : OpenThread(THREAD_TERMINATE, false, stdinWriterThreadId);
                    if (nativeWriter != IntPtr.Zero)
                    {
                        CancelSynchronousIo(nativeWriter);
                        CloseHandle(nativeWriter);
                    }
                    if (stdinStream != null) stdinStream.Dispose();
                    stdinWriter.Join(5000);
                }
            }
            catch (Exception error) { cleanupFailures.Add(error); }
            try { if (stdinWriterCompleted != null) stdinWriterCompleted.Dispose(); }
            catch (Exception error) { cleanupFailures.Add(error); }
            CloseCleanupHandle(process.hThread, "CloseHandle created thread during cleanup", cleanupFailures);
            CloseCleanupHandle(process.hProcess, "CloseHandle created process during cleanup", cleanupFailures);
            CloseCleanupHandle(readPipe, "CloseHandle stdin read pipe during cleanup", cleanupFailures);
            CloseCleanupHandle(writePipe, "CloseHandle stdin write pipe during cleanup", cleanupFailures);
            CloseCleanupHandle(nullHandle, "CloseHandle NUL during cleanup", cleanupFailures);
            try { if (environmentBlock != IntPtr.Zero) Marshal.FreeHGlobal(environmentBlock); }
            catch (Exception error) { cleanupFailures.Add(error); }
            CloseCleanupHandle(job, "CloseHandle job during cleanup", cleanupFailures);
            if (cleanupFailures.Count > 0)
            {
                if (operationFailure != null) cleanupFailures.Insert(0, operationFailure);
                throw new AggregateException(
                    "Poppler launch cleanup failed; inspect every retained error before another launch. The original launch error, if any, is first.",
                    cleanupFailures);
            }
        }
    }
}
