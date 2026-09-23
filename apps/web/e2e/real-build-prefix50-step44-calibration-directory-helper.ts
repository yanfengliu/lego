import { REAL_BUILD_PREFIX50_STEP44_CALIBRATION_DIRECTORY_NATIVE } from "./real-build-prefix50-step44-calibration-directory-native.ts";

export const REAL_BUILD_PREFIX50_STEP44_CALIBRATION_DIRECTORY_HELPER = String.raw`
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
${REAL_BUILD_PREFIX50_STEP44_CALIBRATION_DIRECTORY_NATIVE}
"@

$spec = ConvertFrom-Json ([Text.Encoding]::UTF8.GetString(
  [Convert]::FromBase64String($env:LEGO_CALIBRATION_DIRECTORY_SPEC)))
$rootHandle = [IntPtr]::Zero
$directoryHandle = [IntPtr]::Zero
$trackingHandle = [IntPtr]::Zero
$intentHandle = [IntPtr]::Zero
$publishTransaction = [IntPtr]::Zero
$guardTransaction = [IntPtr]::Zero
$protectedHandles = [Collections.Generic.List[IntPtr]]::new()
$publicationMutex = [Threading.Mutex]::new($false, [string]$spec.rootMutexName)
$publicationMutexHeld = $false
$script:injectProtectedCloseFailure = $false
$owner = $null

function Write-Line([string]$line) {
  [Console]::Out.WriteLine($line)
  [Console]::Out.Flush()
}
function Reassert-Root {
  [LegoCalibrationDirectoryTransaction]::ReassertRoot(
    $rootHandle, [string]$spec.root)
}
function Acquire-PublicationMutex {
  try {
    $script:publicationMutexHeld = $publicationMutex.WaitOne(
      [int]$spec.rootMutexTimeoutMilliseconds)
  } catch [Threading.AbandonedMutexException] {
    $script:publicationMutexHeld = $true
  }
  if (!$script:publicationMutexHeld) {
    throw "Another page44 calibration publication owns this exact output root."
  }
}
function Release-PublicationMutex {
  if ($script:publicationMutexHeld) {
    $publicationMutex.ReleaseMutex()
    $script:publicationMutexHeld = $false
  }
}
function Close-ProtectedHandles {
  $firstFailure = $null
  for ($index = $protectedHandles.Count - 1; $index -ge 0; $index--) {
    try {
      [LegoCalibrationDirectoryTransaction]::Close($protectedHandles[$index])
      if ($script:injectProtectedCloseFailure) {
        $script:injectProtectedCloseFailure = $false
        throw "Injected calibration native-close failure after exact handle close."
      }
    } catch {
      if ($null -eq $firstFailure) { $firstFailure = $_ }
    }
  }
  $protectedHandles.Clear()
  if ($null -ne $firstFailure) { throw $firstFailure }
}
function Invoke-Cleanup([scriptblock]$action) {
  try { & $action }
  catch { if ($null -eq $script:cleanupFailure) { $script:cleanupFailure = $_ } }
}
function Rollback-Publish([IntPtr]$transaction) {
  if ($transaction -ne [IntPtr]::Zero) {
    try { [LegoCalibrationDirectoryTransaction]::Rollback($transaction) }
    finally { [LegoCalibrationDirectoryTransaction]::Close($transaction) }
  }
}
function Rollback-Guard([IntPtr]$transaction) {
  if ($transaction -ne [IntPtr]::Zero) {
    try {
      if ([LegoCalibrationDirectoryTransaction]::TransactionActive($transaction)) {
        [LegoCalibrationDirectoryTransaction]::Rollback($transaction)
      }
    } finally { [LegoCalibrationDirectoryTransaction]::Close($transaction) }
  }
}

try {
  $owner = [Diagnostics.Process]::GetProcessById([int]$spec.ownerPid)
  $rootHandle = [LegoCalibrationDirectoryTransaction]::OpenRoot([string]$spec.root)
  [LegoCalibrationDirectoryTransaction]::AssertIdentity(
    $rootHandle, [string]$spec.rootDevice, [string]$spec.rootInode,
    "Prepared calibration output root")
  Reassert-Root
  $directoryHandle = [LegoCalibrationDirectoryTransaction]::CreateGuardedDirectory(
    $rootHandle, [string]$spec.stagingName)
  Write-Line ("READY" + [char]9 +
    [LegoCalibrationDirectoryTransaction]::Identity($rootHandle) + [char]9 +
    [LegoCalibrationDirectoryTransaction]::Identity($directoryHandle))
  $command = [LegoCalibrationDirectoryTransaction]::ReadCommandOrOwnerExit($owner)
  $commandParts = @($command -split ([char]9), 2)
  if ($commandParts[0] -eq "PREPARE" -and $commandParts.Count -eq 2) {
    Write-Line "WAITING_ROOT_MUTEX"
    Acquire-PublicationMutex
    Reassert-Root
    $stagingPath = [IO.Path]::Combine([string]$spec.root, [string]$spec.stagingName)
    $finalPath = [IO.Path]::Combine([string]$spec.root, [string]$spec.finalName)
    $retainedPath = [IO.Path]::Combine([string]$spec.root, [string]$spec.rollbackName)
    $intentPath = [IO.Path]::Combine([string]$spec.root, [string]$spec.intentName)
    $markerPath = [IO.Path]::Combine([string]$spec.root, [string]$spec.markerName)
    $retainedMarkerPath = [IO.Path]::Combine(
      [string]$spec.root, [string]$spec.retainedMarkerName)
    [LegoCalibrationDirectoryTransaction]::WriteIntentFile(
      $intentPath, [Convert]::FromBase64String($commandParts[1]))
    $intentHandle = [LegoCalibrationDirectoryTransaction]::OpenTrackingFile($intentPath)
    $trackingHandle = [LegoCalibrationDirectoryTransaction]::OpenTrackingDirectory($stagingPath)
    [LegoCalibrationDirectoryTransaction]::AssertSameIdentity(
      $directoryHandle, $trackingHandle, "Calibration staging directory")
    [LegoCalibrationDirectoryTransaction]::Close($directoryHandle)
    $directoryHandle = [IntPtr]::Zero
    $publishTransaction = [LegoCalibrationDirectoryTransaction]::NewTransaction(
      [uint32]$spec.transactionTimeoutMilliseconds, "LEGO page44 calibration publish")
    [LegoCalibrationDirectoryTransaction]::MoveInTransaction(
      $stagingPath, $finalPath, $publishTransaction)
    [LegoCalibrationDirectoryTransaction]::MoveInTransaction(
      $intentPath, $markerPath, $publishTransaction)
    $reservedPathHandle = [LegoCalibrationDirectoryTransaction]::OpenTrackingDirectory($stagingPath)
    try {
      [LegoCalibrationDirectoryTransaction]::AssertSameIdentity(
        $trackingHandle, $reservedPathHandle, "Calibration staging directory")
    } finally { [LegoCalibrationDirectoryTransaction]::Close($reservedPathHandle) }
    $reservedIntentHandle = [LegoCalibrationDirectoryTransaction]::OpenTrackingFile($intentPath)
    try {
      [LegoCalibrationDirectoryTransaction]::AssertSameIdentity(
        $intentHandle, $reservedIntentHandle, "Calibration publication intent")
    } finally { [LegoCalibrationDirectoryTransaction]::Close($reservedIntentHandle) }
    Reassert-Root
    Write-Line "PREPARED"
    $completion = [LegoCalibrationDirectoryTransaction]::ReadCommandOrOwnerExit($owner)
    if ($completion -eq "PUBLISH" -or $completion -eq "PUBLISH_PAUSE") {
      Reassert-Root
      [LegoCalibrationDirectoryTransaction]::Commit($publishTransaction)
      [LegoCalibrationDirectoryTransaction]::Close($publishTransaction)
      $publishTransaction = [IntPtr]::Zero
      Reassert-Root
      if ($completion -eq "PUBLISH_PAUSE") {
        Write-Line "COMMITTED_UNGUARDED"
        if ([LegoCalibrationDirectoryTransaction]::ReadCommandOrOwnerExit($owner) -ne
            "CONTINUE_GUARD") { throw "Calibration publication guard continuation was refused." }
      }
      Reassert-Root
      $guardTransaction = [LegoCalibrationDirectoryTransaction]::NewTransaction(
        [uint32]0, "LEGO page44 calibration live authority guard")
      [LegoCalibrationDirectoryTransaction]::MoveInTransaction(
        $finalPath, $retainedPath, $guardTransaction)
      [LegoCalibrationDirectoryTransaction]::MoveInTransaction(
        $markerPath, $retainedMarkerPath, $guardTransaction)
      Reassert-Root
      $guardedMarkerHandle = [LegoCalibrationDirectoryTransaction]::OpenTrackingFile($markerPath)
      try {
        [LegoCalibrationDirectoryTransaction]::AssertSameIdentity(
          $intentHandle, $guardedMarkerHandle, "Calibration publication marker")
      } finally { [LegoCalibrationDirectoryTransaction]::Close($guardedMarkerHandle) }
      [LegoCalibrationDirectoryTransaction]::Close($intentHandle)
      $intentHandle = [IntPtr]::Zero
      [LegoCalibrationDirectoryTransaction]::Close($trackingHandle)
      $trackingHandle = [IntPtr]::Zero
      Write-Line "GUARDED"
      while ($true) {
        $decision = [LegoCalibrationDirectoryTransaction]::ReadCommandOrOwnerExit($owner)
        $decisionParts = @($decision -split ([char]9), 2)
        if ($decisionParts[0] -eq "LOCK" -and $decisionParts.Count -eq 2) {
          if ($protectedHandles.Count -ne 0) { throw "Calibration roster was already protected." }
          $rosterJson = [Text.Encoding]::UTF8.GetString(
            [Convert]::FromBase64String($decisionParts[1]))
          $roster = [object[]]($rosterJson | ConvertFrom-Json)
          if ($roster.Count -lt 2 -or $roster.Count -gt 512) {
            throw ("Calibration guard roster count " + $roster.Count + " is outside its bound.")
          }
          $seen = [Collections.Generic.HashSet[string]]::new(
            [StringComparer]::OrdinalIgnoreCase)
          foreach ($entry in $roster) {
            if (!$seen.Add([string]$entry.relativePath)) {
              throw "Calibration guard roster contains a duplicate path."
            }
            $handle = [LegoCalibrationDirectoryTransaction]::OpenProtectedPath(
              [string]$spec.root, [string]$entry.relativePath, [string]$entry.kind,
              [string]$entry.device, [string]$entry.inode, [string]$entry.size)
            $protectedHandles.Add($handle)
          }
          Reassert-Root
          Write-Line "LOCKED"
        } elseif ($decision -eq "REASSERT") {
          Reassert-Root
          if ($protectedHandles.Count -eq 0 -or
              ![LegoCalibrationDirectoryTransaction]::TransactionActive($guardTransaction)) {
            Write-Line "INACTIVE"
          } else { Write-Line "ACTIVE" }
        } elseif ($decision -eq "TEST_ROLLBACK_GUARD" -and $spec.testMode -eq $true) {
          if ([LegoCalibrationDirectoryTransaction]::TransactionActive($guardTransaction)) {
            [LegoCalibrationDirectoryTransaction]::Rollback($guardTransaction)
          }
          Write-Line "TEST_GUARD_ROLLED_BACK"
        } elseif ($decision -eq "TEST_FAIL_PROTECTED_CLOSE" -and $spec.testMode -eq $true) {
          $script:injectProtectedCloseFailure = $true
          Write-Line "TEST_PROTECTED_CLOSE_WILL_FAIL"
        } elseif ($decision -eq "ACCEPT") {
          Rollback-Guard $guardTransaction
          $guardTransaction = [IntPtr]::Zero
          Write-Line "FINALIZED"
          break
        } elseif ($decision -eq "RETAIN") {
          Close-ProtectedHandles
          [LegoCalibrationDirectoryTransaction]::Commit($guardTransaction)
          [LegoCalibrationDirectoryTransaction]::Close($guardTransaction)
          $guardTransaction = [IntPtr]::Zero
          Write-Line ("RETAINED" + [char]9 + [string]$spec.rollbackName + [char]9 +
            [string]$spec.retainedMarkerName)
          if ([LegoCalibrationDirectoryTransaction]::ReadCommandOrOwnerExit($owner) -ne "RELEASE") {
            throw "Calibration retained identity was not released by its owner."
          }
          break
        } elseif ($decision -eq "RELEASE_FOREIGN") {
          Rollback-Guard $guardTransaction
          $guardTransaction = [IntPtr]::Zero
          Write-Line "FOREIGN_RELEASED"
          break
        } elseif ($null -eq $decision) { break }
        else { throw "Unknown calibration guard decision." }
      }
    } elseif ($completion -eq "ROLLBACK") {
      Rollback-Publish $publishTransaction
      $publishTransaction = [IntPtr]::Zero
      Write-Line ("ROLLED_BACK" + [char]9 + [string]$spec.stagingName + [char]9 +
        [string]$spec.intentName)
      if ([LegoCalibrationDirectoryTransaction]::ReadCommandOrOwnerExit($owner) -ne "RELEASE") {
        throw "Calibration rollback identity was not released by its owner."
      }
    } elseif ($null -ne $completion) { throw "Unknown calibration reservation command." }
  } elseif ($command -eq "DISCARD") {
    [LegoCalibrationDirectoryTransaction]::DeleteExactOnClose($directoryHandle)
    Write-Line "DISCARDED"
  } elseif ($command -eq "ABANDON" -or $null -eq $command) {
    Write-Line "ABANDONED"
  } else { throw "Unknown calibration transaction command." }
} finally {
  $script:cleanupFailure = $null
  Invoke-Cleanup { Close-ProtectedHandles }
  Invoke-Cleanup { Rollback-Guard $guardTransaction }
  Invoke-Cleanup { Rollback-Publish $publishTransaction }
  Invoke-Cleanup { [LegoCalibrationDirectoryTransaction]::Close($intentHandle) }
  Invoke-Cleanup { [LegoCalibrationDirectoryTransaction]::Close($trackingHandle) }
  Invoke-Cleanup { [LegoCalibrationDirectoryTransaction]::Close($directoryHandle) }
  Invoke-Cleanup { [LegoCalibrationDirectoryTransaction]::Close($rootHandle) }
  Invoke-Cleanup { Release-PublicationMutex }
  Invoke-Cleanup { $publicationMutex.Dispose() }
  Invoke-Cleanup { if ($null -ne $owner) { $owner.Dispose() } }
  if ($null -ne $script:cleanupFailure) {
    [Console]::Error.WriteLine([string]$script:cleanupFailure)
    exit 1
  }
}
`;
