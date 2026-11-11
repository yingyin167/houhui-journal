$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$target = Join-Path $PSScriptRoot '..\public\assets'
New-Item -ItemType Directory -Force -Path $target | Out-Null

function Draw-Cover([string]$name, [bool]$light) {
    $bitmap = New-Object System.Drawing.Bitmap 900,1200
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $green = [System.Drawing.ColorTranslator]::FromHtml('#146C43')
    $white = [System.Drawing.ColorTranslator]::FromHtml('#FCFEFC')
    $pale = [System.Drawing.ColorTranslator]::FromHtml('#B8D3BE')
    $ink = if ($light) { $green } else { $white }
    $g.Clear($(if ($light) { $white } else { $green }))
    $brush = New-Object System.Drawing.SolidBrush $ink
    $quiet = New-Object System.Drawing.SolidBrush $(if ($light) { $green } else { $pale })
    $pen = New-Object System.Drawing.Pen $ink,1
    $titleFont = New-Object System.Drawing.Font 'SimSun',64,([System.Drawing.FontStyle]::Bold),([System.Drawing.GraphicsUnit]::Pixel)
    $subFont = New-Object System.Drawing.Font 'SimSun',33,([System.Drawing.FontStyle]::Regular),([System.Drawing.GraphicsUnit]::Pixel)
    $english = New-Object System.Drawing.Font 'Georgia',20,([System.Drawing.FontStyle]::Regular),([System.Drawing.GraphicsUnit]::Pixel)
    $tiny = New-Object System.Drawing.Font 'Microsoft YaHei',17,([System.Drawing.FontStyle]::Regular),([System.Drawing.GraphicsUnit]::Pixel)
    $number = New-Object System.Drawing.Font 'Georgia',125,([System.Drawing.FontStyle]::Regular),([System.Drawing.GraphicsUnit]::Pixel)
    $g.DrawString('后会有期刊',$titleFont,$brush,65,75)
    $g.DrawString('H O U H U I   J O U R N A L',$english,$quiet,72,167)
    $g.DrawLine($pen,72,218,828,218)
    $g.DrawString('观察 / 研究 / 非虚构文学',$tiny,$quiet,72,245)
    $g.DrawString('001',$number,$brush,62,350)
    $g.DrawString('在 关 系 之 中',$subFont,$brush,72,528)
    $g.DrawString('ON RELATIONSHIPS',$english,$quiet,75,592)

    # An open-page motif gives the original typographic cover a publication-specific visual.
    $pageBrush = New-Object System.Drawing.SolidBrush $(if ($light) { $green } else { [System.Drawing.ColorTranslator]::FromHtml('#EBF3EC') })
    $pagePen = New-Object System.Drawing.Pen $(if ($light) { $white } else { $green }),2
    $leftPage = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(144,745),[System.Drawing.PointF]::new(450,815),
        [System.Drawing.PointF]::new(450,1038),[System.Drawing.PointF]::new(144,967))
    $rightPage = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(466,815),[System.Drawing.PointF]::new(756,725),
        [System.Drawing.PointF]::new(756,949),[System.Drawing.PointF]::new(466,1038))
    $g.FillPolygon($pageBrush,$leftPage)
    $g.FillPolygon($pageBrush,$rightPage)
    for ($i=0; $i -lt 6; $i++) {
        $y=790+$i*25
        $g.DrawLine($pagePen,183,$y,408,($y+52))
        $g.DrawLine($pagePen,510,($y+48),710,($y-14))
    }
    $g.DrawLine($pen,72,1100,828,1100)
    $g.DrawString('2026 / 创刊排版样刊',$tiny,$quiet,72,1128)
    $g.DrawString('SAMPLE EDITION',$english,$quiet,611,1129)
    $bitmap.Save((Join-Path $target $name),[System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bitmap.Dispose()
    $brush.Dispose()
    $quiet.Dispose()
    $pen.Dispose()
    $pageBrush.Dispose()
    $pagePen.Dispose()
    $titleFont.Dispose()
    $subFont.Dispose()
    $english.Dispose()
    $tiny.Dispose()
    $number.Dispose()
}

Draw-Cover 'issue-001.png' $false
Draw-Cover 'issue-002.png' $true
