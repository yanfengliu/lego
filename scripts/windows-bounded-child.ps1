param(
  [switch]$RequireExactPin,
  [long]$ExactByteLength = 0,
  [string]$ExactDigest = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$launcherSourceNames = @(
  "windows-bounded-child-native.cs",
  "windows-bounded-child.cs"
)
$launcherSourcePaths = @($launcherSourceNames | ForEach-Object {
  $sourcePath = Join-Path -Path $PSScriptRoot -ChildPath $_
  $sourceItem = Get-Item -LiteralPath $sourcePath -Force
  if ($sourceItem.PSIsContainer -or
      (($sourceItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
    throw "Bounded-child launcher source $($_) must be one ordinary non-reparse file."
  }
  $sourceItem.FullName
})
Add-Type -Path $launcherSourcePaths

$requestText = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($requestText)) {
  throw "The bounded-child launcher received no JSON command on stdin."
}
$request = $requestText | ConvertFrom-Json
if ($null -eq $request.command -or $null -eq $request.arguments) {
  throw "The bounded-child launcher requires command and arguments fields."
}
$arguments = @($request.arguments | ForEach-Object { [string]$_ })
$hasPin = $request.PSObject.Properties.Name -contains "exactExecutablePin"
if ([bool]$RequireExactPin -ne [bool]$hasPin) {
  throw "The bounded-child command-line launch mode and JSON exact-pin mode disagree; refusing generic fallback."
}
if ($hasPin) {
  $pin = $request.exactExecutablePin
  if ($null -eq $pin -or $null -eq $pin.byteLength -or $null -eq $pin.digest) {
    throw "The bounded-child exact executable pin requires byteLength and digest fields."
  }
  if ([long]$pin.byteLength -ne $ExactByteLength -or [string]$pin.digest -cne $ExactDigest) {
    throw "The bounded-child command-line and JSON exact executable pins disagree."
  }
  $delay = 0
  if ($request.PSObject.Properties.Name -contains "testPostVerificationDelayMs") {
    $delay = [int]$request.testPostVerificationDelayMs
  }
  $atomicDelay = 0
  if ($request.PSObject.Properties.Name -contains "testPostAtomicCreationDelayMs") {
    $atomicDelay = [int]$request.testPostAtomicCreationDelayMs
  }
  $exitCode = [Lego.PartIdentification.BoundedChildJob]::RunExact(
    [string]$request.command,
    [string[]]$arguments,
    [string](Get-Location).ProviderPath,
    $ExactByteLength,
    $ExactDigest,
    $delay,
    $atomicDelay
  )
} else {
  $resolved = Get-Command -CommandType Application -Name ([string]$request.command) -ErrorAction Stop
  $exitCode = [Lego.PartIdentification.BoundedChildJob]::Run(
    [string]$resolved.Source,
    [string[]]$arguments,
    [string](Get-Location).ProviderPath
  )
}
exit $exitCode
