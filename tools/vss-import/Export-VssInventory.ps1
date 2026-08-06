[CmdletBinding()]
param(
    [string]$StencilPath = (Join-Path $PSScriptRoot "..\..\lib\circuit.vss"),
    [string]$ReviewManifestPath = (Join-Path $PSScriptRoot "..\..\fixtures\symbols\circuit-vss-review.json"),
    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

$ErrorActionPreference = "Stop"

function Get-ShapeCell {
    param($Shape, [string]$Name)
    try {
        return [ordered]@{
            formula = $Shape.CellsU($Name).FormulaU
            resultIU = $Shape.CellsU($Name).ResultIU
        }
    }
    catch {
        return $null
    }
}

function Get-ShapeRecord {
    param($Shape)

    $cells = [ordered]@{}
    foreach ($cellName in @("PinX", "PinY", "Width", "Height", "LocPinX", "LocPinY", "Angle", "FlipX", "FlipY")) {
        $cell = Get-ShapeCell -Shape $Shape -Name $cellName
        if ($null -ne $cell) {
            $cells[$cellName] = $cell
        }
    }

    $children = @()
    foreach ($child in $Shape.Shapes) {
        $children += Get-ShapeRecord -Shape $child
    }

    $geometry = @()
    if ($children.Count -eq 0) {
        for ($section = 10; $section -lt 64; $section += 1) {
            if (-not $Shape.SectionExists($section, 0)) {
                continue
            }
            $rows = @()
            for ($row = 0; $row -lt $Shape.RowCount($section); $row += 1) {
                $formulas = @()
                for ($cellIndex = 0; $cellIndex -lt 8; $cellIndex += 1) {
                    try {
                        $formulas += $Shape.CellsSRC($section, $row, $cellIndex).FormulaU
                    }
                    catch {
                        $formulas += $null
                    }
                }
                $rows += [ordered]@{
                    index = $row
                    rowType = $Shape.RowType($section, $row)
                    formulas = $formulas
                }
            }
            $geometry += [ordered]@{
                section = $section
                rows = $rows
            }
        }
    }

    return [ordered]@{
        id = $Shape.ID
        nameU = $Shape.NameU
        type = $Shape.Type
        oneD = [bool]$Shape.OneD
        cells = $cells
        geometry = $geometry
        children = $children
    }
}

$resolvedStencil = (Resolve-Path -LiteralPath $StencilPath).Path
$resolvedManifest = (Resolve-Path -LiteralPath $ReviewManifestPath).Path
$review = Get-Content -LiteralPath $resolvedManifest -Raw | ConvertFrom-Json
$hash = (Get-FileHash -LiteralPath $resolvedStencil -Algorithm SHA256).Hash.ToLowerInvariant()
if ($review.source.sha256 -ne $hash) {
    throw "Stencil hash does not match the reviewed source: $hash"
}

$visio = $null
$document = $null
try {
    $visio = New-Object -ComObject Visio.InvisibleApp
    $document = $visio.Documents.OpenEx($resolvedStencil, 66)

    $masters = @()
    foreach ($master in $document.Masters) {
        $masters += [ordered]@{
            nameU = $master.NameU
            name = $master.Name
            topShapeCount = $master.Shapes.Count
        }
    }

    $reviewedMasters = @()
    foreach ($mapping in $review.mappings) {
        $master = $document.Masters.ItemU($mapping.masterNameU)
        $shapes = @()
        foreach ($shape in $master.Shapes) {
            $shapes += Get-ShapeRecord -Shape $shape
        }
        $reviewedMasters += [ordered]@{
            symbolId = $mapping.symbolId
            masterNameU = $mapping.masterNameU
            shapes = $shapes
        }
    }

    $output = [ordered]@{
        schemaVersion = 1
        source = [ordered]@{
            fileName = [IO.Path]::GetFileName($resolvedStencil)
            byteLength = (Get-Item -LiteralPath $resolvedStencil).Length
            sha256 = $hash
            visioVersion = $visio.Version
            masterCount = $document.Masters.Count
        }
        masters = @($masters | Sort-Object nameU)
        reviewedMasters = @($reviewedMasters | Sort-Object symbolId)
    }

    $parent = Split-Path -Parent $OutputPath
    if ($parent) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    $output | ConvertTo-Json -Depth 100 -Compress | Set-Content -LiteralPath $OutputPath -Encoding utf8
    Write-Output "Extracted $($document.Masters.Count) VSS masters and $($reviewedMasters.Count) reviewed geometries to $OutputPath"
}
finally {
    if ($null -ne $document) {
        $document.Close()
    }
    if ($null -ne $visio) {
        $visio.Quit()
        [Runtime.InteropServices.Marshal]::FinalReleaseComObject($visio) | Out-Null
    }
}
