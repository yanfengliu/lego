$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Security

function Read-ExactBytes {
  param(
    [Parameter(Mandatory = $true)][IO.Stream]$Stream,
    [Parameter(Mandatory = $true)][int]$Count
  )
  $bytes = [byte[]]::new($Count)
  $offset = 0
  while ($offset -lt $Count) {
    $read = $Stream.Read($bytes, $offset, $Count - $offset)
    if ($read -le 0) { throw "DPAPI frame ended before its declared byte count" }
    $offset += $read
  }
  return ,$bytes
}

$inputStream = [Console]::OpenStandardInput()
$lengthBytes = Read-ExactBytes -Stream $inputStream -Count 4
$length = [BitConverter]::ToUInt32($lengthBytes, 0)
if ($length -lt 1 -or $length -gt 16384) { throw "DPAPI frame exceeded 16 KiB" }
$utf8 = [Text.UTF8Encoding]::new($false, $true)
$request = ConvertFrom-Json -InputObject $utf8.GetString(
  (Read-ExactBytes -Stream $inputStream -Count $length)
)
if ($inputStream.ReadByte() -ne -1) { throw "DPAPI frame contained trailing bytes" }
$names = @($request.PSObject.Properties.Name | Sort-Object)
if (($names -join "`n") -cne "action`ndataBase64`nentropyBase64") {
  throw "DPAPI request properties drifted"
}
if (
  @("protect", "unprotect") -cnotcontains $request.action -or
  $request.dataBase64 -isnot [string] -or
  $request.dataBase64.Length -lt 1 -or
  $request.dataBase64.Length -gt 8192 -or
  $request.entropyBase64 -isnot [string] -or
  $request.entropyBase64.Length -lt 1 -or
  $request.entropyBase64.Length -gt 256
) { throw "DPAPI request was not one bounded closed-schema operation" }
$data = [Convert]::FromBase64String($request.dataBase64)
$entropy = [Convert]::FromBase64String($request.entropyBase64)
if ($data.Length -lt 1 -or $data.Length -gt 4096 -or $entropy.Length -ne 32) {
  throw "DPAPI request byte bounds were invalid"
}
if ($request.action -ceq "protect") {
  if ($data.Length -ne 32) { throw "DPAPI protects exactly one 256-bit ledger key" }
  $result = [Security.Cryptography.ProtectedData]::Protect(
    $data,
    $entropy,
    [Security.Cryptography.DataProtectionScope]::CurrentUser
  )
}
else {
  $result = [Security.Cryptography.ProtectedData]::Unprotect(
    $data,
    $entropy,
    [Security.Cryptography.DataProtectionScope]::CurrentUser
  )
  if ($result.Length -ne 32) { throw "DPAPI unsealed an invalid ledger key size" }
}
[Console]::Out.Write('{"schemaVersion":"lego.real-build-prefix50-step44-dpapi-result/1","dataBase64":"' + [Convert]::ToBase64String($result) + '"}')
