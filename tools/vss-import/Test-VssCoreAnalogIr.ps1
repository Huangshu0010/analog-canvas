[CmdletBinding()]
param(
    [string]$FixturePath = (Join-Path $PSScriptRoot "..\..\fixtures\symbols\vss-ir\razavi-rv6-core-analog-master-ir.json"),
    [string]$ReviewManifestPath = (Join-Path $PSScriptRoot "..\..\fixtures\symbols\circuit-vss-review.json")
)

$ErrorActionPreference = "Stop"

$expectedTargets = @(
    "Arrow", "C", "Crystal", "DC-I", "DC-V", "Diode1", "GND", "I/O",
    "L", "LED", "NMOS4", "Nmos3.a", "OP.68", "PMOS4", "Pmos3.a", "R",
    "SW.off", "SW.on", "Transform", "VDD", "V_AC", "V_Pulse", "node",
    "npn", "pnp", "schottky", "zener"
)

function Visit-VssShape {
    param($Shape, [hashtable]$Counts, [hashtable]$Kinds)

    $Counts.shapes += 1
    $Counts.connectionPoints += @($Shape.connectionPoints).Count
    if (-not [string]::IsNullOrEmpty([string]$Shape.text.value)) {
        $Counts.textShapes += 1
    }
    foreach ($section in @($Shape.geometry)) {
        foreach ($row in @($section.rows)) {
            $Counts.geometryRows += 1
            $kind = [string]$row.kind
            if (-not $Kinds.ContainsKey($kind)) {
                $Kinds[$kind] = 0
            }
            $Kinds[$kind] += 1
        }
    }
    foreach ($child in @($Shape.children)) {
        Visit-VssShape -Shape $child -Counts $Counts -Kinds $Kinds
    }
}

$resolvedFixture = (Resolve-Path -LiteralPath $FixturePath).Path
$temporaryPath = Join-Path ([IO.Path]::GetTempPath()) "icm-vss-rv6-$([Guid]::NewGuid().ToString('N')).json"
try {
    & (Join-Path $PSScriptRoot "Export-VssMasterIr.ps1") `
        -MasterNameU $expectedTargets `
        -CoverageMasterNameU @() `
        -OutputPath $temporaryPath

    $expectedHash = (Get-FileHash -LiteralPath $resolvedFixture -Algorithm SHA256).Hash.ToLowerInvariant()
    $actualHash = (Get-FileHash -LiteralPath $temporaryPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $expectedHash) {
        throw "Core analog VSS IR is not deterministic or the fixture is stale. Expected $expectedHash, got $actualHash"
    }

    $ir = Get-Content -LiteralPath $resolvedFixture -Raw | ConvertFrom-Json
    if ($ir.schemaVersion -ne 1 -or $ir.decoder.id -ne "icm-vss-master-ir" -or $ir.decoder.version -ne "0.1.0") {
        throw "Unexpected core analog VSS IR schema or decoder identity"
    }
    if ($ir.source.masterCount -ne 101) {
        throw "Expected 101 source Masters, got $($ir.source.masterCount)"
    }
    if (($ir.targetMasterNameU -join "|") -ne ($expectedTargets -join "|")) {
        throw "Core analog target Master ordering changed"
    }
    if (@($ir.coverageMasterNameU).Count -ne 0) {
        throw "RV-6 core analog evidence must not contain coverage-only Masters"
    }
    if (@($ir.masters).Count -ne $expectedTargets.Count) {
        throw "Expected $($expectedTargets.Count) Master records, got $(@($ir.masters).Count)"
    }
    $recordNames = @($ir.masters | ForEach-Object { $_.nameU })
    if (($recordNames | Select-Object -Unique).Count -ne $expectedTargets.Count) {
        throw "Core analog evidence contains duplicate Master records"
    }
    if (($recordNames -join "|") -ne ($expectedTargets -join "|")) {
        throw "Master records do not match the requested target order"
    }
    if (@($ir.masters | Where-Object { $_.role -ne "target" }).Count -ne 0) {
        throw "Every RV-6 core analog Master must have the target role"
    }
    if (@($ir.diagnostics).Count -ne 0) {
        throw "Core analog extraction emitted $(@($ir.diagnostics).Count) diagnostic(s)"
    }

    $review = Get-Content -LiteralPath $ReviewManifestPath -Raw | ConvertFrom-Json
    $reviewTargets = @(
        @($review.mappings | ForEach-Object { $_.masterNameU }) +
        @($review.migrationCandidates | ForEach-Object { $_.masterNameU })
    )
    foreach ($nameU in $reviewTargets) {
        if ($nameU -notin $recordNames) {
            throw "Review manifest Master is missing from core analog evidence: $nameU"
        }
    }
    $semanticTargets = @("node", "Arrow")
    $unexpected = @($recordNames | Where-Object { $_ -notin $reviewTargets -and $_ -notin $semanticTargets })
    if ($unexpected.Count -ne 0) {
        throw "Unexpected core analog evidence Master(s): $($unexpected -join ', ')"
    }

    $counts = @{ shapes = 0; geometryRows = 0; connectionPoints = 0; textShapes = 0 }
    $kinds = @{}
    foreach ($master in @($ir.masters)) {
        foreach ($shape in @($master.shapes)) {
            Visit-VssShape -Shape $shape -Counts $counts -Kinds $kinds
        }
    }
    if ($counts.shapes -ne 175 -or $counts.geometryRows -ne 504 -or $counts.connectionPoints -ne 45) {
        throw "Unexpected evidence totals: $($counts | ConvertTo-Json -Compress)"
    }
    $expectedKinds = @("component", "ellipse", "ellipticalArcTo", "lineTo", "moveTo")
    if ((@($kinds.Keys | Sort-Object) -join "|") -ne ($expectedKinds -join "|")) {
        throw "Unexpected geometry kinds: $(@($kinds.Keys | Sort-Object) -join ', ')"
    }

    [ordered]@{
        sha256 = $actualHash
        masters = $recordNames.Count
        shapes = $counts.shapes
        geometryRows = $counts.geometryRows
        connectionPoints = $counts.connectionPoints
        textShapes = $counts.textShapes
        geometryKinds = [ordered]@{
            component = $kinds.component
            ellipse = $kinds.ellipse
            ellipticalArcTo = $kinds.ellipticalArcTo
            lineTo = $kinds.lineTo
            moveTo = $kinds.moveTo
        }
        diagnostics = @($ir.diagnostics).Count
    } | ConvertTo-Json -Compress
}
finally {
    if (Test-Path -LiteralPath $temporaryPath) {
        Remove-Item -LiteralPath $temporaryPath -Force
    }
}
