param(
    [ValidateSet("Query", "Own")]
    [string]$Mode,
    [int]$TargetProcessId,
    [string]$ExpectedCreationIdentity = "",
    [string]$Nonce = "",
    [ValidateSet("normal", "hang")]
    [string]$TestOnlyStopMode = "normal"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$source = @"
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Threading;

public sealed class Step44JobOwner : IDisposable
{
    private const uint PROCESS_TERMINATE = 0x00000001;
    private const uint PROCESS_SET_QUOTA = 0x00000100;
    private const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x00001000;
    private const uint SYNCHRONIZE = 0x00100000;
    private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
    private const int JobObjectBasicAccountingInformation = 1;
    private const int JobObjectExtendedLimitInformation = 9;
    private IntPtr job = IntPtr.Zero;
    private IntPtr root = IntPtr.Zero;

    [StructLayout(LayoutKind.Sequential)]
    private struct FILETIME
    {
        public uint Low;
        public uint High;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct IO_COUNTERS
    {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_BASIC_LIMIT_INFORMATION
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
    private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    {
        public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
        public IO_COUNTERS IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct JOBOBJECT_BASIC_ACCOUNTING_INFORMATION
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

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint access, bool inherit, uint processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetProcessTimes(
        IntPtr process,
        out FILETIME creation,
        out FILETIME exit,
        out FILETIME kernel,
        out FILETIME user);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr CreateJobObject(IntPtr attributes, string name);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetInformationJobObject(
        IntPtr job,
        int informationClass,
        ref JOBOBJECT_EXTENDED_LIMIT_INFORMATION information,
        uint length);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool QueryInformationJobObject(
        IntPtr job,
        int informationClass,
        out JOBOBJECT_BASIC_ACCOUNTING_INFORMATION information,
        uint length,
        IntPtr returnLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool TerminateJobObject(IntPtr job, uint exitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr handle);

    private static ulong CreationIdentity(IntPtr process)
    {
        FILETIME creation;
        FILETIME exit;
        FILETIME kernel;
        FILETIME user;
        if (!GetProcessTimes(process, out creation, out exit, out kernel, out user))
            throw new Win32Exception(Marshal.GetLastWin32Error());
        ulong value = ((ulong)creation.High << 32) | creation.Low;
        if (value == 0)
            throw new InvalidOperationException("Step-44 process returned no creation identity.");
        return value;
    }

    public static ulong QueryCreationIdentity(uint processId)
    {
        IntPtr process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, processId);
        if (process == IntPtr.Zero)
            throw new Win32Exception(Marshal.GetLastWin32Error());
        try { return CreationIdentity(process); }
        finally { CloseHandle(process); }
    }

    public uint Assign(uint processId, ulong expectedCreationIdentity)
    {
        job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero)
            throw new Win32Exception(Marshal.GetLastWin32Error());
        var limits = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if (!SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            ref limits,
            (uint)Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION))))
            throw new Win32Exception(Marshal.GetLastWin32Error());
        root = OpenProcess(
            PROCESS_TERMINATE | PROCESS_SET_QUOTA | PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE,
            false,
            processId);
        if (root == IntPtr.Zero)
            throw new Win32Exception(Marshal.GetLastWin32Error());
        ulong actual = CreationIdentity(root);
        if (actual != expectedCreationIdentity)
            throw new InvalidOperationException(
                "Step-44 Job Object refused creation identity mismatch: expected " +
                expectedCreationIdentity.ToString(CultureInfo.InvariantCulture) +
                ", observed " + actual.ToString(CultureInfo.InvariantCulture) + ".");
        if (!AssignProcessToJobObject(job, root))
            throw new Win32Exception(Marshal.GetLastWin32Error());
        uint active = ActiveProcesses();
        if (active != 1)
            throw new InvalidOperationException(
                "Step-44 inert bootstrap Job Object expected one active process before GO, observed " +
                active.ToString(CultureInfo.InvariantCulture) + ".");
        return active;
    }

    public uint ActiveProcesses()
    {
        JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting;
        if (!QueryInformationJobObject(
            job,
            JobObjectBasicAccountingInformation,
            out accounting,
            (uint)Marshal.SizeOf(typeof(JOBOBJECT_BASIC_ACCOUNTING_INFORMATION)),
            IntPtr.Zero))
            throw new Win32Exception(Marshal.GetLastWin32Error());
        return accounting.ActiveProcesses;
    }

    public string StopAndClose(int timeoutMilliseconds)
    {
        uint before = ActiveProcesses();
        if (!TerminateJobObject(job, 197))
            throw new Win32Exception(Marshal.GetLastWin32Error());
        Stopwatch timer = Stopwatch.StartNew();
        uint active = ActiveProcesses();
        while (active != 0 && timer.ElapsedMilliseconds < timeoutMilliseconds)
        {
            Thread.Sleep(10);
            active = ActiveProcesses();
        }
        if (active != 0)
            throw new TimeoutException(
                "Step-44 Job Object retained " + active.ToString(CultureInfo.InvariantCulture) +
                " active processes after " + timeoutMilliseconds.ToString(CultureInfo.InvariantCulture) + "ms.");
        Dispose();
        return before.ToString(CultureInfo.InvariantCulture) + ",0";
    }

    public void Dispose()
    {
        if (root != IntPtr.Zero) { CloseHandle(root); root = IntPtr.Zero; }
        if (job != IntPtr.Zero) { CloseHandle(job); job = IntPtr.Zero; }
    }
}
"@

Add-Type -TypeDefinition $source -Language CSharp
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

if ($TargetProcessId -le 4) {
    throw "Step-44 Job Object helper requires a process ID greater than four."
}

if ($Mode -eq "Query") {
    [Console]::WriteLine([Step44JobOwner]::QueryCreationIdentity(
        [System.UInt32]$TargetProcessId).ToString([System.Globalization.CultureInfo]::InvariantCulture))
    [Console]::Out.Flush()
    exit 0
}

[System.UInt64]$expectedIdentity = 0
if (-not [System.UInt64]::TryParse($ExpectedCreationIdentity, [ref]$expectedIdentity) -or $expectedIdentity -eq 0) {
    throw "Step-44 Job Object helper requires a positive expected creation identity."
}
if ($Nonce -notmatch "^[a-f0-9]{64}$") {
    throw "Step-44 Job Object helper requires its exact 256-bit nonce."
}

$owner = [Step44JobOwner]::new()
try {
    $active = $owner.Assign([System.UInt32]$TargetProcessId, $expectedIdentity)
    [Console]::WriteLine("STEP44_JOB_READY,$Nonce,$TargetProcessId,$ExpectedCreationIdentity,$active")
    [Console]::Out.Flush()
    $command = [Console]::In.ReadLine()
    if ($command -cne "STOP,$Nonce") {
        throw "Step-44 Job Object helper received an invalid STOP capability."
    }
    if ($TestOnlyStopMode -ceq "hang") {
        while ($true) { Start-Sleep -Seconds 60 }
    }
    $quiescence = $owner.StopAndClose(5000)
    [Console]::WriteLine("STEP44_JOB_QUIESCENT,$Nonce,$quiescence")
    [Console]::Out.Flush()
}
finally {
    $owner.Dispose()
}
