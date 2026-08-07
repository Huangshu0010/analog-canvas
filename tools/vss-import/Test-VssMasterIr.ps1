[CmdletBinding()]
param(
    [string]$FixturePath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($FixturePath)) {
    $FixturePath = Join-Path $PSScriptRoot "..\..\fixtures\symbols\vss-ir\razavi-rv1-master-ir.json"
}

function Get-AllShapes {
    param($Shapes)

    $result = @()
    foreach ($shape in $Shapes) {
        $result += $shape
        $result += Get-AllShapes -Shapes $shape.children
    }
    return $result
}

$resolvedFixture = (Resolve-Path -LiteralPath $FixturePath).Path
$temporaryPath = Join-Path ([IO.Path]::GetTempPath()) "icm-razavi-rv1-$([guid]::NewGuid().ToString('N')).json"
try {
    & (Join-Path $PSScriptRoot "Export-VssMasterIr.ps1") -OutputPath $temporaryPath

    $expectedHash = (Get-FileHash -LiteralPath $resolvedFixture -Algorithm SHA256).Hash
    $actualHash = (Get-FileHash -LiteralPath $temporaryPath -Algorithm SHA256).Hash
    if ($expectedHash -ne $actualHash) {
        throw "VSS Master IR is not deterministic or the fixture is stale. Expected $expectedHash, got $actualHash"
    }

    $ir = Get-Content -LiteralPath $temporaryPath -Raw | ConvertFrom-Json
    if ($ir.schemaVersion -ne 1 -or $ir.decoder.id -ne "icm-vss-master-ir") {
        throw "Unexpected VSS Master IR schema or decoder identity"
    }
    if ($ir.source.masterCount -ne 101) {
        throw "Expected 101 source Masters, got $($ir.source.masterCount)"
    }

    $expectedTargets = @("NMOS4", "Pmos3.a", "R", "DC-V", "node")
    if (($ir.targetMasterNameU -join "|") -ne ($expectedTargets -join "|")) {
        throw "RV-1 target Master ordering or coverage changed"
    }
    if (($ir.coverageMasterNameU -join "|") -ne "TEXT") {
        throw "TEXT must remain the RV-1 coverage-only Master"
    }
    if ($ir.diagnostics.Count -ne 0) {
        throw "RV-1 extraction produced diagnostics: $($ir.diagnostics | ConvertTo-Json -Compress)"
    }

    $allShapes = Get-AllShapes -Shapes $ir.masters.shapes
    $geometryRows = @(
        $allShapes |
            ForEach-Object { $_.geometry } |
            ForEach-Object { $_.rows } |
            Where-Object { $null -ne $_ }
    )
    $lineWeights = @(
        $allShapes.line.LineWeight.resultIU |
            Where-Object { $null -ne $_ } |
            ForEach-Object { [Math]::Round([double]$_, 9) } |
            Sort-Object -Unique
    )
    $connectionPoints = @($allShapes.connectionPoints | Where-Object { $null -ne $_ })
    $arrowShapes = @($allShapes | Where-Object {
            $_.line.BeginArrow.resultIU -gt 0 -or $_.line.EndArrow.resultIU -gt 0
        })
    $textShapes = @($allShapes | Where-Object { -not [string]::IsNullOrEmpty($_.text.value) })

    $assertions = [ordered]@{
        groups = @($allShapes | Where-Object { $_.kind -eq "group" }).Count -gt 0
        moveRows = @($geometryRows | Where-Object { $_.kind -eq "moveTo" }).Count -gt 0
        lineRows = @($geometryRows | Where-Object { $_.kind -eq "lineTo" }).Count -gt 0
        ellipseRows = @($geometryRows | Where-Object { $_.kind -eq "ellipse" }).Count -gt 0
        arrows = $arrowShapes.Count -gt 0
        text = $textShapes.Count -gt 0
        characterFormatting = @($textShapes.text.characterRows).Count -gt 0
        connectionPoints = $connectionPoints.Count -gt 0
        lineWeightHierarchy = $lineWeights.Count -ge 3
        allRowsSupported = @($geometryRows | Where-Object { -not $_.supportedByRv1 }).Count -eq 0
        noElectricalPinInference = $null -eq $ir.PSObject.Properties["electricalPins"]
    }
    $failed = @($assertions.GetEnumerator() | Where-Object { -not $_.Value })
    if ($failed.Count -gt 0) {
        throw "RV-1 feature assertions failed: $(($failed.Name) -join ', ')"
    }

    [ordered]@{
        fixtureSha256 = $expectedHash.ToLowerInvariant()
        targets = $ir.targetMasterNameU
        coverageOnly = $ir.coverageMasterNameU
        masters = $ir.masters.Count
        shapes = $allShapes.Count
        geometryRows = $geometryRows.Count
        connectionPoints = $connectionPoints.Count
        arrowShapes = $arrowShapes.Count
        textShapes = $textShapes.Count
        lineWeightsIU = $lineWeights
        assertions = $assertions
        passed = $true
    } | ConvertTo-Json -Depth 10
}
finally {
    if (Test-Path -LiteralPath $temporaryPath) {
        Remove-Item -LiteralPath $temporaryPath -Force
    }
}
