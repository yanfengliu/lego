$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

namespace Lego.PartIdentification {
  public static class BoundedChildJob {
    private const uint CREATE_SUSPENDED = 0x00000004;
    private const uint CREATE_NO_WINDOW = 0x08000000;
    private const uint STARTF_USESTDHANDLES = 0x00000100;
    private const uint JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
    private const int JobObjectExtendedLimitInformation = 9;
    private const uint INFINITE = 0xffffffff;

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
      ref STARTUPINFO startupInfo,
      out PROCESS_INFORMATION processInformation);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint ResumeThread(IntPtr thread);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool TerminateProcess(IntPtr process, uint exitCode);

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

    public static int Run(string application, string[] arguments, string currentDirectory) {
      IntPtr job = IntPtr.Zero;
      PROCESS_INFORMATION process = new PROCESS_INFORMATION();
      bool created = false;
      bool assigned = false;
      try {
        job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero) ThrowLastError("Cannot create the bounded-child Job Object");
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if (!SetInformationJobObject(
          job,
          JobObjectExtendedLimitInformation,
          ref limits,
          (uint)Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION)))) {
          ThrowLastError("Cannot set kill-on-close on the bounded-child Job Object");
        }

        StringBuilder commandLine = new StringBuilder(Quote(application));
        foreach (string argument in arguments) {
          commandLine.Append(' ');
          commandLine.Append(Quote(argument));
        }
        STARTUPINFO startup = new STARTUPINFO();
        startup.cb = Marshal.SizeOf(typeof(STARTUPINFO));
        startup.dwFlags = STARTF_USESTDHANDLES;
        startup.hStdInput = GetStdHandle(-10);
        startup.hStdOutput = GetStdHandle(-11);
        startup.hStdError = GetStdHandle(-12);
        if (!CreateProcess(
          application,
          commandLine,
          IntPtr.Zero,
          IntPtr.Zero,
          true,
          CREATE_SUSPENDED | CREATE_NO_WINDOW,
          IntPtr.Zero,
          currentDirectory,
          ref startup,
          out process)) {
          ThrowLastError("Cannot create the bounded child suspended");
        }
        created = true;
        if (!AssignProcessToJobObject(job, process.hProcess)) {
          ThrowLastError("Cannot assign the bounded child to its Job Object before execution");
        }
        assigned = true;
        if (ResumeThread(process.hThread) == 0xffffffff) {
          ThrowLastError("Cannot resume the bounded child after Job Object assignment");
        }
        if (WaitForSingleObject(process.hProcess, INFINITE) == 0xffffffff) {
          ThrowLastError("Cannot wait for the bounded child");
        }
        uint exitCode;
        if (!GetExitCodeProcess(process.hProcess, out exitCode)) {
          ThrowLastError("Cannot read the bounded child's exit code");
        }
        return unchecked((int)exitCode);
      } finally {
        if (created && !assigned) TerminateProcess(process.hProcess, 1);
        if (process.hThread != IntPtr.Zero) CloseHandle(process.hThread);
        if (process.hProcess != IntPtr.Zero) CloseHandle(process.hProcess);
        if (job != IntPtr.Zero) CloseHandle(job);
      }
    }
  }
}
'@

$requestText = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($requestText)) {
  throw "The bounded-child launcher received no JSON command on stdin."
}
$request = $requestText | ConvertFrom-Json
if ($null -eq $request.command -or $null -eq $request.arguments) {
  throw "The bounded-child launcher requires command and arguments fields."
}
$resolved = Get-Command -CommandType Application -Name ([string]$request.command) -ErrorAction Stop
$arguments = @($request.arguments | ForEach-Object { [string]$_ })
$exitCode = [Lego.PartIdentification.BoundedChildJob]::Run(
  [string]$resolved.Source,
  [string[]]$arguments,
  [string](Get-Location).ProviderPath
)
exit $exitCode
