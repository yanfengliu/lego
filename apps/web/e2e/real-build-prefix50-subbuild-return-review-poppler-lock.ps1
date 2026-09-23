$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ExpectedToolchainRoot = "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library"
$ExpectedToolchainCommitment = "sha256:ad3675e883db5966ee288583783841777cd63d908789ec4d2f77247f7433824f"
$ExpectedLauncherDigest = "sha256:10b825ba6ff6dff1866cb90927798ee9884ef2e3a351388ba31eb2fadff11c8b"
$MaximumHeaderBytes = 262144
$MaximumSourceBytes = 100663296

function Read-ExactBytes {
  param(
    [Parameter(Mandatory = $true)][IO.Stream]$Stream,
    [Parameter(Mandatory = $true)][int]$Count
  )
  $bytes = [byte[]]::new($Count)
  $offset = 0
  while ($offset -lt $Count) {
    $read = $Stream.Read($bytes, $offset, $Count - $offset)
    if ($read -le 0) { throw "framed input ended before its declared byte count" }
    $offset += $read
  }
  return ,$bytes
}

function Get-Sha256 {
  param([Parameter(Mandatory = $true)]$InputValue)
  $sha256 = [Security.Cryptography.SHA256]::Create()
  try {
    if ($InputValue -is [IO.Stream]) {
      $InputValue.Position = 0
      $hash = $sha256.ComputeHash($InputValue)
    }
    else { $hash = $sha256.ComputeHash([byte[]]$InputValue) }
    return "sha256:" + ([BitConverter]::ToString($hash)).Replace("-", "").ToLowerInvariant()
  }
  finally { $sha256.Dispose() }
}

function Assert-ExactProperties {
  param(
    [Parameter(Mandatory = $true)]$Value,
    [Parameter(Mandatory = $true)][string[]]$Names,
    [Parameter(Mandatory = $true)][string]$Label
  )
  $actual = @($Value.PSObject.Properties.Name | Sort-Object)
  $expected = @($Names | Sort-Object)
  if (($actual -join "`n") -cne ($expected -join "`n")) { throw "$Label properties drifted" }
}

function Get-RelativeToolName {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$Path
  )
  $prefix = $Root + [IO.Path]::DirectorySeparatorChar
  if (-not $Path.StartsWith($prefix, [StringComparison]::Ordinal)) {
    throw "toolchain entry escaped its exact root"
  }
  return $Path.Substring($prefix.Length).Replace("\", "/")
}

function Get-ExactTree {
  param([Parameter(Mandatory = $true)][string]$Root)
  $directories = [Collections.Generic.List[string]]::new()
  $files = [Collections.Generic.List[string]]::new()
  foreach ($item in Get-ChildItem -LiteralPath $Root -Force -Recurse) {
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "toolchain tree may not contain reparse points"
    }
    $name = Get-RelativeToolName -Root $Root -Path $item.FullName
    if ($item.PSIsContainer) { $directories.Add($name) }
    elseif ($item -is [IO.FileInfo]) { $files.Add($name) }
    else { throw "toolchain tree may contain only files and directories" }
  }
  $directories.Sort([StringComparer]::Ordinal)
  $files.Sort([StringComparer]::Ordinal)
  return [PSCustomObject]@{ Directories = $directories; Files = $files }
}

function Assert-ExactTree {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string[]]$Directories,
    [Parameter(Mandatory = $true)][string[]]$Files
  )
  $actual = Get-ExactTree -Root $Root
  [string[]]$expectedDirectories = @($Directories)
  [string[]]$expectedFiles = @($Files)
  [Array]::Sort($expectedDirectories, [StringComparer]::Ordinal)
  [Array]::Sort($expectedFiles, [StringComparer]::Ordinal)
  if (($actual.Directories -join "`n") -cne ($expectedDirectories -join "`n")) {
    throw "toolchain directory set drifted from its authenticated roster"
  }
  if (($actual.Files -join "`n") -cne ($expectedFiles -join "`n")) {
    throw "toolchain file set drifted from its authenticated roster"
  }
}

$standardInput = [Console]::OpenStandardInput()
$prefix = Read-ExactBytes -Stream $standardInput -Count 4
$headerLength = [BitConverter]::ToUInt32($prefix, 0)
if ($headerLength -lt 1 -or $headerLength -gt $MaximumHeaderBytes) {
  throw "framed header exceeded its exact bound"
}
$headerBytes = Read-ExactBytes -Stream $standardInput -Count $headerLength
$utf8 = [Text.UTF8Encoding]::new($false, $true)
$header = ConvertFrom-Json -InputObject $utf8.GetString($headerBytes)
Assert-ExactProperties -Value $header -Names @(
  "arguments",
  "launcherAssemblyBase64",
  "schemaVersion",
  "sourceBytes",
  "timeoutMilliseconds",
  "toolchainBodyBase64",
  "toolchainCommitment"
) -Label "framed header"
if (
  $header.schemaVersion -cne "lego.real-build-prefix50-step44-poppler-request/1" -or
  $header.toolchainCommitment -cne $ExpectedToolchainCommitment -or
  $header.sourceBytes -isnot [int] -or
  $header.sourceBytes -lt 1 -or
  $header.sourceBytes -gt $MaximumSourceBytes -or
  $header.timeoutMilliseconds -isnot [int] -or
  $header.timeoutMilliseconds -lt 1 -or
  $header.timeoutMilliseconds -gt 60000 -or
  $header.toolchainBodyBase64 -isnot [string] -or
  $header.toolchainBodyBase64.Length -gt 262144 -or
  $header.launcherAssemblyBase64 -isnot [string] -or
  $header.launcherAssemblyBase64.Length -gt 32768
) { throw "invalid framed Poppler request" }
$arguments = @($header.arguments)
if ($arguments.Count -lt 1 -or $arguments.Count -gt 32) { throw "invalid argument count" }
foreach ($argument in $arguments) {
  if ($argument -isnot [string] -or $argument.Length -lt 1 -or $argument.Length -gt 4096 -or $argument.Contains([char]0)) {
    throw "invalid bounded Poppler argument"
  }
}
$toolchainBodyBytes = [Convert]::FromBase64String($header.toolchainBodyBase64)
if ((Get-Sha256 -InputValue $toolchainBodyBytes) -cne $ExpectedToolchainCommitment) {
  throw "toolchain body failed its embedded commitment"
}
$launcherBytes = [Convert]::FromBase64String($header.launcherAssemblyBase64)
if ((Get-Sha256 -InputValue $launcherBytes) -cne $ExpectedLauncherDigest) {
  throw "job launcher failed its embedded commitment"
}
$toolchain = ConvertFrom-Json -InputObject $utf8.GetString($toolchainBodyBytes)
Assert-ExactProperties -Value $toolchain -Names @(
  "directories",
  "files",
  "loaderEnvironment",
  "root",
  "version"
) -Label "toolchain body"
if ($toolchain.root -cne $ExpectedToolchainRoot -or $toolchain.version -cne "26.05.0") {
  throw "toolchain identity drifted from the reviewed configuration"
}
$launcherAssembly = [Reflection.Assembly]::Load($launcherBytes)
$launcherType = $launcherAssembly.GetType("Step44PopplerJobLauncher", $true, $false)
$launcherMethod = $launcherType.GetMethod("Run", [Reflection.BindingFlags]::Public -bor [Reflection.BindingFlags]::Static)
if ($null -eq $launcherMethod) { throw "authenticated job launcher omitted its finite Run entrypoint" }
$sourceBytes = Read-ExactBytes -Stream $standardInput -Count $header.sourceBytes
if ($standardInput.ReadByte() -ne -1) { throw "framed input contained undeclared trailing bytes" }

$rootItem = Get-Item -LiteralPath $ExpectedToolchainRoot -Force
if (
  -not $rootItem.PSIsContainer -or
  $rootItem.FullName -cne $ExpectedToolchainRoot -or
  ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
) { throw "toolchain root is not its exact reviewed real directory" }
$expectedDirectories = @($toolchain.directories | ForEach-Object { [string]$_ })
$expectedFiles = @($toolchain.files | ForEach-Object { [string]$_.relativePath })
Assert-ExactTree -Root $ExpectedToolchainRoot -Directories $expectedDirectories -Files $expectedFiles

$locks = [Collections.Generic.List[object]]::new()
try {
  foreach ($file in $toolchain.files) {
    Assert-ExactProperties -Value $file -Names @("bytes", "digest", "relativePath") -Label "tool file"
    $relativePath = [string]$file.relativePath
    if ($relativePath.Length -lt 1 -or $relativePath.Contains("..") -or $relativePath.Contains([char]0)) {
      throw "invalid tool file path"
    }
    $path = [IO.Path]::GetFullPath([IO.Path]::Combine($ExpectedToolchainRoot, $relativePath.Replace("/", "\")))
    if ((Get-RelativeToolName -Root $ExpectedToolchainRoot -Path $path) -cne $relativePath) {
      throw "tool file escaped or aliased its reviewed path"
    }
    $item = Get-Item -LiteralPath $path -Force
    if (
      $item -isnot [IO.FileInfo] -or
      ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
      ($null -ne $item.LinkType -and [string]$item.LinkType -ne "") -or
      $item.Length -ne [long]$file.bytes
    ) { throw "tool file is not one exact regular single-name file" }
    $stream = [IO.File]::Open($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    if ($stream.Length -ne [long]$file.bytes -or (Get-Sha256 -InputValue $stream) -cne [string]$file.digest) {
      $stream.Dispose()
      throw "locked tool file failed its exact digest"
    }
    $locks.Add([PSCustomObject]@{ Stream = $stream; Digest = [string]$file.digest })
  }
  Assert-ExactTree -Root $ExpectedToolchainRoot -Directories $expectedDirectories -Files $expectedFiles
  $childEnvironment = [Collections.Generic.Dictionary[string, string]]::new([StringComparer]::Ordinal)
  foreach ($property in $toolchain.loaderEnvironment.PSObject.Properties) {
    $childEnvironment.Add([string]$property.Name, [string]$property.Value)
  }
  $result = $launcherMethod.Invoke($null, @(
    [IO.Path]::Combine($ExpectedToolchainRoot, "bin", "pdftoppm.exe"),
    [IO.Path]::Combine($ExpectedToolchainRoot, "bin"),
    [string[]]$arguments,
    $childEnvironment,
    [byte[]]$sourceBytes,
    [int]$header.timeoutMilliseconds
  ))
  if ($result.ExitCode -ne 0) { throw "job-contained Poppler failed with a withheld diagnostic" }
  Assert-ExactTree -Root $ExpectedToolchainRoot -Directories $expectedDirectories -Files $expectedFiles
  foreach ($lock in $locks) {
    if ((Get-Sha256 -InputValue $lock.Stream) -cne $lock.Digest) {
      throw "locked tool file changed during job-contained execution"
    }
  }
  [Console]::Out.Write('{"schemaVersion":"lego.real-build-prefix50-step44-poppler-result/1","totalProcesses":' + [string]$result.TotalProcesses + ',"activeProcesses":0}')
}
finally {
  foreach ($lock in $locks) { $lock.Stream.Dispose() }
}
