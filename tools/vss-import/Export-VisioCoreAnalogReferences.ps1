[CmdletBinding()]
param(
    [string]$StencilPath = "",
    [string]$ReviewManifestPath = "",
    [string]$OutputDirectory = "",
    [switch]$Check
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($StencilPath)) {
    $StencilPath = Join-Path $PSScriptRoot "..\..\lib\circuit.vss"
}
if ([string]::IsNullOrWhiteSpace($ReviewManifestPath)) {
    $ReviewManifestPath = Join-Path $PSScriptRoot "..\..\fixtures\symbols\circuit-vss-review.json"
}
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $PSScriptRoot "..\..\fixtures\visual-reference\visio-core-analog"
}

$masters = [ordered]@{
    "R" = "resistor.svg"
    "C" = "capacitor.svg"
    "L" = "inductor.svg"
    "Diode1" = "diode.svg"
    "GND" = "ground.svg"
    "I/O" = "port.svg"
    "DC-V" = "voltage-source.svg"
    "DC-I" = "current-source.svg"
}

function Normalize-VisioSvg {
    param([string]$Source, [string]$MasterNameU)

    $normalized = $Source.Replace("`r`n", "`n")
    $normalized = [Regex]::Replace(
        $normalized,
        "<!--[^`n]*Microsoft Visio[^`n]*-->",
        "<!-- Microsoft Visio SVG reference: $MasterNameU -->"
    )
    return $normalized.TrimEnd() + "`n"
}

function Stop-IsolatedVisio {
    param([int[]]$BeforeIds)

    $created = @(
        Get-Process VISIO -ErrorAction SilentlyContinue |
            Where-Object { $_.Id -notin $BeforeIds -and $_.MainWindowHandle -eq 0 }
    )
    if ($created.Count -ne 1) {
        throw "Expected one isolated hidden Visio process, found $($created.Count)"
    }
    Stop-Process -Id $created[0].Id -Force
}

$resolvedStencil = (Resolve-Path -LiteralPath $StencilPath).Path
$resolvedManifest = (Resolve-Path -LiteralPath $ReviewManifestPath).Path
$review = Get-Content -LiteralPath $resolvedManifest -Raw | ConvertFrom-Json
$sourceHash = (Get-FileHash -LiteralPath $resolvedStencil -Algorithm SHA256).Hash.ToLowerInvariant()
if ($review.source.sha256 -ne $sourceHash) {
    throw "Stencil hash does not match the reviewed source: $sourceHash"
}

$resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory)
if (-not $Check) {
    New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
}
$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$temporaryDirectory = [IO.Path]::GetFullPath(
    (Join-Path $temporaryRoot "icm-visio-core-analog-$([Guid]::NewGuid().ToString('N'))")
)
if (-not $temporaryDirectory.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Temporary export directory escaped the system temp root"
}
New-Item -ItemType Directory -Force -Path $temporaryDirectory | Out-Null
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)

try {
    foreach ($entry in $masters.GetEnumerator()) {
        $masterNameU = $entry.Key
        $fileName = $entry.Value
        $rawPath = Join-Path $temporaryDirectory $fileName
        $beforeIds = @(Get-Process VISIO -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
        $visio = $null
        try {
            $visio = New-Object -ComObject Visio.InvisibleApp
            $stencil = $visio.Documents.OpenEx($resolvedStencil, 66)
            $drawing = $visio.Documents.Add("")
            $page = $drawing.Pages.Item(1)
            $master = $stencil.Masters.ItemU($masterNameU)
            $null = $page.Drop($master, 1.0, 1.0)
            $page.ResizeToFitContents()
            $page.Export($rawPath)
        }
        finally {
            Stop-IsolatedVisio -BeforeIds $beforeIds
            if ($null -ne $visio) {
                try {
                    [Runtime.InteropServices.Marshal]::FinalReleaseComObject($visio) | Out-Null
                }
                catch {
                    # The isolated process has already been terminated intentionally.
                }
            }
        }

        $normalized = Normalize-VisioSvg -Source ([IO.File]::ReadAllText($rawPath)) -MasterNameU $masterNameU
        $targetPath = Join-Path $resolvedOutput $fileName
        if ($Check) {
            if (-not (Test-Path -LiteralPath $targetPath)) {
                throw "Missing Visio core-analog reference: $targetPath"
            }
            $expected = [IO.File]::ReadAllText($targetPath).Replace("`r`n", "`n")
            if ($expected -ne $normalized) {
                throw "Visio core-analog reference is stale: $fileName"
            }
        }
        else {
            [IO.File]::WriteAllText($targetPath, $normalized, $utf8WithoutBom)
        }
    }

    $action = if ($Check) { "Validated" } else { "Exported" }
    Write-Output "$action $($masters.Count) isolated Visio core-analog references"
}
finally {
    if (
        $temporaryDirectory.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase) -and
        [IO.Path]::GetFileName($temporaryDirectory).StartsWith("icm-visio-core-analog-") -and
        (Test-Path -LiteralPath $temporaryDirectory)
    ) {
        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
    }
}
