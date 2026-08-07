[CmdletBinding()]
param(
    [string]$StencilPath = "",
    [string]$ReviewManifestPath = "",
    [string[]]$MasterNameU = @("NMOS4", "Pmos3.a", "R", "DC-V", "node"),
    [string[]]$CoverageMasterNameU = @("TEXT"),
    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($StencilPath)) {
    $StencilPath = Join-Path $PSScriptRoot "..\..\lib\circuit.vss"
}
if ([string]::IsNullOrWhiteSpace($ReviewManifestPath)) {
    $ReviewManifestPath = Join-Path $PSScriptRoot "..\..\fixtures\symbols\circuit-vss-review.json"
}

# Numeric values follow Microsoft's VisRowTags enumeration. Keep the numeric
# source value in the IR so later decoder versions can extend this map without
# reinterpreting existing evidence.
$rowTypeNames = @{
    137 = "component"
    138 = "moveTo"
    139 = "lineTo"
    140 = "arcTo"
    141 = "infiniteLine"
    143 = "ellipse"
    144 = "ellipticalArcTo"
    165 = "splineStart"
    166 = "splineKnot"
    193 = "polylineTo"
    195 = "nurbsTo"
    236 = "relativeCubicBezierTo"
    237 = "relativeQuadraticBezierTo"
    238 = "relativeMoveTo"
    239 = "relativeLineTo"
    240 = "relativeEllipticalArcTo"
}

$geometryCellNames = @{
    137 = @("noFill", "noLine", "noShow", "noSnap", "path", "noQuickDrag")
    138 = @("x", "y")
    139 = @("x", "y")
    140 = @("x", "y", "bow")
    141 = @("x", "y", "a", "b")
    143 = @("x", "y", "a", "b", "c", "d")
    144 = @("x", "y", "a", "b", "c", "d")
    165 = @("x", "y", "a", "b", "c", "d")
    166 = @("x", "y", "a", "b", "c", "d")
    193 = @("x", "y", "a")
    195 = @("x", "y", "a", "b", "c", "d", "e")
    236 = @("x", "y", "a", "b", "c", "d")
    237 = @("x", "y", "a", "b")
    238 = @("x", "y")
    239 = @("x", "y")
    240 = @("x", "y", "a", "b", "c", "d")
}

$supportedRv1RowTypes = @(137, 138, 139, 143)

function Get-CellValue {
    param($Cell)

    return [ordered]@{
        formulaU = [string]$Cell.FormulaU
        resultIU = [double]$Cell.ResultIU
    }
}

function Get-NamedCells {
    param($Shape, [string[]]$Names)

    $result = [ordered]@{}
    foreach ($name in $Names) {
        if ($Shape.CellExistsU($name, 0)) {
            $result[$name] = Get-CellValue -Cell $Shape.CellsU($name)
        }
    }
    return $result
}

function Get-SectionCellValue {
    param($Shape, [int]$Section, [int]$Row, [int]$Cell)

    try {
        return Get-CellValue -Cell $Shape.CellsSRC($Section, $Row, $Cell)
    }
    catch {
        return $null
    }
}

function Get-RowNameU {
    param($Shape, [int]$Section, [int]$Row)

    try {
        return [string]$Shape.RowNameU($Section, $Row)
    }
    catch {
        return $null
    }
}

function Get-GeometrySections {
    param($Shape, [System.Collections.Generic.List[object]]$Diagnostics)

    $sections = @()
    $section = 10
    while ($Shape.SectionExists($section, 0)) {
        $rows = @()
        for ($row = 0; $row -lt $Shape.RowCount($section); $row += 1) {
            $rowType = [int]$Shape.RowType($section, $row)
            $rowTypeName = if ($rowTypeNames.ContainsKey($rowType)) {
                $rowTypeNames[$rowType]
            }
            else {
                "unsupported"
            }

            if (-not $rowTypeNames.ContainsKey($rowType)) {
                $Diagnostics.Add([ordered]@{
                        severity = "error"
                        code = "unsupported-geometry-row"
                        shapeId = [int]$Shape.ID
                        section = $section
                        row = $row
                        rowType = $rowType
                    })
            }

            $cellNames = if ($geometryCellNames.ContainsKey($rowType)) {
                $geometryCellNames[$rowType]
            }
            else {
                @("x", "y", "a", "b", "c", "d", "e", "f")
            }
            $cells = [ordered]@{}
            for ($cellIndex = 0; $cellIndex -lt $cellNames.Count; $cellIndex += 1) {
                $cell = Get-SectionCellValue -Shape $Shape -Section $section -Row $row -Cell $cellIndex
                if ($null -ne $cell) {
                    $cells[$cellNames[$cellIndex]] = $cell
                }
            }

            $rows += [ordered]@{
                index = $row
                rowType = $rowType
                kind = $rowTypeName
                supportedByRv1 = $rowType -in $supportedRv1RowTypes
                cells = $cells
            }
        }
        $sections += [ordered]@{
            index = $section
            name = "Geometry$($section - 9)"
            rows = $rows
        }
        $section += 1
    }
    return $sections
}

function Get-ConnectionPoints {
    param($Shape)

    if (-not $Shape.SectionExists(7, 0)) {
        return @()
    }

    $cellNames = @("x", "y", "directionX", "directionY", "type", "d")
    $rows = @()
    for ($row = 0; $row -lt $Shape.RowCount(7); $row += 1) {
        $cells = [ordered]@{}
        for ($cellIndex = 0; $cellIndex -lt $cellNames.Count; $cellIndex += 1) {
            $cell = Get-SectionCellValue -Shape $Shape -Section 7 -Row $row -Cell $cellIndex
            if ($null -ne $cell) {
                $cells[$cellNames[$cellIndex]] = $cell
            }
        }
        $rows += [ordered]@{
            index = $row
            rowType = [int]$Shape.RowType(7, $row)
            nameU = Get-RowNameU -Shape $Shape -Section 7 -Row $row
            cells = $cells
        }
    }
    return $rows
}

function Get-TextRows {
    param($Shape, [int]$Section, [System.Collections.IDictionary]$CellMap)

    if (-not $Shape.SectionExists($Section, 0)) {
        return @()
    }

    $rows = @()
    for ($row = 0; $row -lt $Shape.RowCount($Section); $row += 1) {
        $cells = [ordered]@{}
        foreach ($entry in $CellMap.GetEnumerator()) {
            $cell = Get-SectionCellValue -Shape $Shape -Section $Section -Row $row -Cell $entry.Value
            if ($null -ne $cell) {
                $cells[$entry.Key] = $cell
            }
        }
        $rows += [ordered]@{
            index = $row
            cells = $cells
        }
    }
    return $rows
}

function Get-ShapeRecord {
    param($Shape, [System.Collections.Generic.List[object]]$Diagnostics)

    $transformNames = @(
        "PinX", "PinY", "Width", "Height", "LocPinX", "LocPinY", "Angle",
        "FlipX", "FlipY", "ResizeMode", "BeginX", "BeginY", "EndX", "EndY"
    )
    $lineNames = @(
        "LineWeight", "LineColor", "LineColorTrans", "LinePattern", "LineCap",
        "BeginArrow", "EndArrow", "BeginArrowSize", "EndArrowSize", "Rounding"
    )
    $fillNames = @(
        "FillForegnd", "FillBkgnd", "FillPattern", "FillForegndTrans", "FillBkgndTrans"
    )
    $textBlockNames = @(
        "TxtPinX", "TxtPinY", "TxtWidth", "TxtHeight", "TxtLocPinX", "TxtLocPinY",
        "TxtAngle", "LeftMargin", "RightMargin", "TopMargin", "BottomMargin",
        "VerticalAlign", "TextBkgnd", "TextBkgndTrans", "DefaultTabStop", "TextDirection"
    )
    $characterCells = [ordered]@{
        font = 0; color = 1; style = 2; case = 3; position = 4; fontScale = 5;
        size = 7; doubleUnderline = 8; overline = 9; strikethrough = 10;
        doubleStrikethrough = 13; letterspace = 16; colorTransparency = 17;
        asianFont = 51; complexScriptFont = 52; complexScriptSize = 54; languageId = 57
    }
    $paragraphCells = [ordered]@{
        firstIndent = 0; leftIndent = 1; rightIndent = 2; lineSpacing = 3;
        spaceBefore = 4; spaceAfter = 5; horizontalAlign = 6; bullet = 7;
        bulletString = 8; bulletFont = 9; bulletFontSize = 11;
        textPositionAfterBullet = 12; flags = 13
    }

    $text = ""
    try {
        $text = [string]$Shape.Text
    }
    catch {
        $Diagnostics.Add([ordered]@{
                severity = "warning"
                code = "text-read-failed"
                shapeId = [int]$Shape.ID
            })
    }

    $children = @()
    foreach ($child in @($Shape.Shapes | Sort-Object ID)) {
        $children += Get-ShapeRecord -Shape $child -Diagnostics $Diagnostics
    }

    $shapeType = switch ([int]$Shape.Type) {
        1 { "foreign" }
        2 { "group" }
        3 { "shape" }
        4 { "guide" }
        default { "unknown" }
    }

    $characterRows = @()
    $paragraphRows = @()
    if (-not [string]::IsNullOrEmpty($text)) {
        $characterRows = @(Get-TextRows -Shape $Shape -Section 3 -CellMap $characterCells)
        $paragraphRows = @(Get-TextRows -Shape $Shape -Section 4 -CellMap $paragraphCells)
    }

    return [ordered]@{
        id = [int]$Shape.ID
        nameU = [string]$Shape.NameU
        name = [string]$Shape.Name
        type = [int]$Shape.Type
        kind = $shapeType
        oneD = [bool]$Shape.OneD
        transform = Get-NamedCells -Shape $Shape -Names $transformNames
        line = Get-NamedCells -Shape $Shape -Names $lineNames
        fill = Get-NamedCells -Shape $Shape -Names $fillNames
        text = [ordered]@{
            value = $text
            block = Get-NamedCells -Shape $Shape -Names $textBlockNames
            characterRows = @($characterRows)
            paragraphRows = @($paragraphRows)
        }
        connectionPoints = @(Get-ConnectionPoints -Shape $Shape)
        geometry = @(Get-GeometrySections -Shape $Shape -Diagnostics $Diagnostics)
        children = @($children)
    }
}

function Get-MasterRecord {
    param($Document, [string]$NameU, [string]$Role, [System.Collections.Generic.List[object]]$Diagnostics)

    $master = $Document.Masters.ItemU($NameU)
    $shapes = @()
    foreach ($shape in @($master.Shapes | Sort-Object ID)) {
        $shapes += Get-ShapeRecord -Shape $shape -Diagnostics $Diagnostics
    }
    return [ordered]@{
        nameU = [string]$master.NameU
        name = [string]$master.Name
        role = $Role
        topShapeCount = [int]$master.Shapes.Count
        shapes = @($shapes)
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
    $diagnostics = [System.Collections.Generic.List[object]]::new()
    $masters = @()
    foreach ($nameU in $MasterNameU) {
        $masters += Get-MasterRecord -Document $document -NameU $nameU -Role "target" -Diagnostics $diagnostics
    }
    foreach ($nameU in $CoverageMasterNameU) {
        if ($nameU -notin $MasterNameU) {
            $masters += Get-MasterRecord -Document $document -NameU $nameU -Role "coverage-only" -Diagnostics $diagnostics
        }
    }

    $output = [ordered]@{
        schemaVersion = 1
        decoder = [ordered]@{
            id = "icm-vss-master-ir"
            version = "0.1.0"
        }
        source = [ordered]@{
            fileName = [IO.Path]::GetFileName($resolvedStencil)
            byteLength = (Get-Item -LiteralPath $resolvedStencil).Length
            sha256 = $hash
            visioVersion = [string]$visio.Version
            masterCount = [int]$document.Masters.Count
        }
        targetMasterNameU = @($MasterNameU)
        coverageMasterNameU = @($CoverageMasterNameU | Where-Object { $_ -notin $MasterNameU })
        masters = @($masters)
        diagnostics = @($diagnostics)
    }

    $parent = Split-Path -Parent $OutputPath
    if ($parent) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    $json = $output | ConvertTo-Json -Depth 100
    $normalizedJson = $json.Replace("`r`n", "`n") + "`n"
    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath), $normalizedJson, $utf8WithoutBom)
    Write-Output "Extracted $($masters.Count) structured VSS Masters to $OutputPath"
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
