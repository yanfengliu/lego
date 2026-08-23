using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace Lego.PartIdentification {
  public static partial class BoundedChildJob {
    private static int RunProcess(
      string application,
      string[] arguments,
      string currentDirectory,
      int postAtomicCreationDelayMs) {
      IntPtr job = IntPtr.Zero;
      IntPtr attributeList = IntPtr.Zero;
      IntPtr jobListValue = IntPtr.Zero;
      bool attributeListInitialized = false;
      PROCESS_INFORMATION process = new PROCESS_INFORMATION();
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

        // PROC_THREAD_ATTRIBUTE_JOB_LIST makes Job assignment part of process
        // creation. There is no successful CreateProcess return at which the
        // child exists but is not already covered by kill-on-close.
        IntPtr attributeListBytes = IntPtr.Zero;
        bool sizingResult = InitializeProcThreadAttributeList(
          IntPtr.Zero,
          1,
          0,
          ref attributeListBytes);
        int sizingError = Marshal.GetLastWin32Error();
        if (sizingResult || sizingError != ERROR_INSUFFICIENT_BUFFER || attributeListBytes == IntPtr.Zero) {
          throw new Win32Exception(
            sizingError,
            "Cannot size the bounded-child atomic Job Object attribute list");
        }
        attributeList = Marshal.AllocHGlobal(attributeListBytes);
        if (!InitializeProcThreadAttributeList(attributeList, 1, 0, ref attributeListBytes)) {
          ThrowLastError("Cannot initialize the bounded-child atomic Job Object attribute list");
        }
        attributeListInitialized = true;
        jobListValue = Marshal.AllocHGlobal(IntPtr.Size);
        Marshal.WriteIntPtr(jobListValue, job);
        if (!UpdateProcThreadAttribute(
          attributeList,
          0,
          PROC_THREAD_ATTRIBUTE_JOB_LIST,
          jobListValue,
          new IntPtr(IntPtr.Size),
          IntPtr.Zero,
          IntPtr.Zero)) {
          ThrowLastError("Cannot bind the bounded-child Job Object into atomic process creation");
        }

        StringBuilder commandLine = new StringBuilder(Quote(application));
        foreach (string argument in arguments) {
          commandLine.Append(' ');
          commandLine.Append(Quote(argument));
        }
        STARTUPINFOEX startup = new STARTUPINFOEX();
        startup.StartupInfo.cb = Marshal.SizeOf(typeof(STARTUPINFOEX));
        startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
        startup.StartupInfo.hStdInput = GetStdHandle(-10);
        startup.StartupInfo.hStdOutput = GetStdHandle(-11);
        startup.StartupInfo.hStdError = GetStdHandle(-12);
        startup.lpAttributeList = attributeList;
        if (!CreateProcess(
          application,
          commandLine,
          IntPtr.Zero,
          IntPtr.Zero,
          true,
          CREATE_NO_WINDOW | EXTENDED_STARTUPINFO_PRESENT,
          IntPtr.Zero,
          currentDirectory,
          ref startup,
          out process)) {
          ThrowLastError("Cannot create the bounded child atomically inside its Job Object from the explicit application path");
        }
        if (postAtomicCreationDelayMs > 0) {
          Console.Error.WriteLine(
            "LEGO_ATOMIC_JOB_ATTACHED_V1 " + process.dwProcessId);
          Console.Error.Flush();
          Thread.Sleep(postAtomicCreationDelayMs);
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
        if (process.hThread != IntPtr.Zero) CloseHandle(process.hThread);
        if (process.hProcess != IntPtr.Zero) CloseHandle(process.hProcess);
        if (attributeListInitialized) DeleteProcThreadAttributeList(attributeList);
        if (jobListValue != IntPtr.Zero) Marshal.FreeHGlobal(jobListValue);
        if (attributeList != IntPtr.Zero) Marshal.FreeHGlobal(attributeList);
        if (job != IntPtr.Zero) CloseHandle(job);
      }
    }

    public static int Run(string application, string[] arguments, string currentDirectory) {
      return RunProcess(application, arguments, currentDirectory, 0);
    }

    public static int RunExact(
      string application,
      string[] arguments,
      string currentDirectory,
      long expectedBytesInput,
      string expectedDigest,
      int postVerificationDelayMs,
      int postAtomicCreationDelayMs) {
      if (!Path.IsPathRooted(application) || expectedBytesInput < 1 ||
          expectedBytesInput > 402653184 || !Sha256.IsMatch(expectedDigest) ||
          postVerificationDelayMs < 0 || postVerificationDelayMs > 5000 ||
          postAtomicCreationDelayMs < 0 || postAtomicCreationDelayMs > 5000) {
        throw new InvalidOperationException(
          "Exact executable launch requires an absolute path, a 1..402653184 byte pin, a lowercase SHA-256, and 0..5000 ms test delays.");
      }
      ulong expectedBytes = (ulong)expectedBytesInput;
      IntPtr original = IntPtr.Zero;
      IntPtr reopened = IntPtr.Zero;
      List<IntPtr> guards = new List<IntPtr>();
      try {
        original = OpenPinnedLeaf(Path.GetFullPath(application));
        BY_HANDLE_FILE_INFORMATION before = Inspect(original, "Cannot inspect the pinned executable before hashing");
        RequirePinnedLeaf(original, before, expectedBytes, "Pinned executable");
        string observedDigest = Hash(original);
        BY_HANDLE_FILE_INFORMATION after = Inspect(original, "Cannot inspect the pinned executable after hashing");
        RequirePinnedLeaf(original, after, expectedBytes, "Pinned executable after hashing");
        if (!SameIdentity(before, after) || !String.Equals(observedDigest, expectedDigest, StringComparison.Ordinal)) {
          throw new InvalidOperationException(
            "Pinned executable identity or SHA-256 did not match the exact launch contract; no child was created.");
        }

        string finalPath = FinalDosPath(original);
        guards = GuardDirectories(finalPath);
        reopened = OpenPinnedLeaf(finalPath);
        BY_HANDLE_FILE_INFORMATION rebound = Inspect(
          reopened,
          "Cannot inspect the final-path pinned executable binding");
        RequirePinnedLeaf(reopened, rebound, expectedBytes, "Final-path pinned executable");
        string finalPathAgain = FinalDosPath(original);
        if (!SameIdentity(after, rebound) ||
            !String.Equals(finalPath, finalPathAgain, StringComparison.OrdinalIgnoreCase)) {
          throw new InvalidOperationException(
            "Pinned executable final path no longer names the exact hashed file; no child was created.");
        }

        Console.Error.WriteLine(
          "LEGO_EXACT_EXECUTABLE_V1 " + expectedBytesInput + " " + expectedDigest);
        Console.Error.Flush();
        if (postVerificationDelayMs > 0) Thread.Sleep(postVerificationDelayMs);

        BY_HANDLE_FILE_INFORMATION launchReady = Inspect(
          reopened,
          "Cannot revalidate the pinned executable immediately before process creation");
        if (!SameIdentity(after, launchReady) ||
            !String.Equals(finalPath, FinalDosPath(original), StringComparison.OrdinalIgnoreCase)) {
          throw new InvalidOperationException(
            "Pinned executable identity changed after final-path locking; no child was created.");
        }
        return RunProcess(finalPath, arguments, currentDirectory, postAtomicCreationDelayMs);
      } finally {
        if (reopened != IntPtr.Zero && reopened != INVALID_HANDLE_VALUE) CloseHandle(reopened);
        CloseAll(guards);
        if (original != IntPtr.Zero && original != INVALID_HANDLE_VALUE) CloseHandle(original);
      }
    }
  }
}
