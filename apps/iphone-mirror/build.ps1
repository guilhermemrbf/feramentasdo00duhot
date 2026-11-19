param([string]$Python, [string]$Makensis)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not $Python) {
    if (-not (Test-Path -LiteralPath '.venv/Scripts/python.exe')) {
        py -3.12 -m venv .venv
        if ($LASTEXITCODE) { throw 'Não foi possível criar o ambiente Python 3.12.' }
    }
    $Python = (Resolve-Path -LiteralPath '.venv/Scripts/python.exe').Path
    & $Python -m pip install -r requirements.txt
    if ($LASTEXITCODE) { throw 'Não foi possível instalar as dependências.' }
}
$version = (& $Python -c "import ast,pathlib; print(next(ast.literal_eval(n.value) for n in ast.parse(pathlib.Path('espelho.py').read_text(encoding='utf-8')).body if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name) and n.targets[0].id=='VERSION'))").Trim()
if ($LASTEXITCODE -or $version -notmatch '^\d+\.\d+\.\d+$') { throw 'Versão inválida.' }
$name = "Fazenda-de-Celulares-$version"
if (-not $Makensis) {
    $compiler = Get-Command makensis.exe -ErrorAction SilentlyContinue
    if ($compiler) { $Makensis = $compiler.Source }
    else { $Makensis = Join-Path $env:LOCALAPPDATA 'tauri/NSIS/Bin/makensis.exe' }
}
if (-not (Test-Path -LiteralPath $Makensis -PathType Leaf)) {
    throw 'Instale o NSIS 3 ou informe o caminho de makensis.exe em -Makensis.'
}

New-Item -ItemType Directory -Force .build | Out-Null
& $Python -c "from PIL import Image; im=Image.open('../../public/brand/mark.png').convert('RGBA'); im.thumbnail((192,192)); im.save('.build/mark.png'); im.resize((128,128)).save('.build/fazenda.ico', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128)])"
if ($LASTEXITCODE) { throw 'Falha ao preparar o logotipo.' }

$brandImage = (Resolve-Path -LiteralPath '.build/mark.png').Path
$brandIcon = (Resolve-Path -LiteralPath '.build/fazenda.ico').Path
& $Python -m PyInstaller --noconfirm --onedir --windowed --name $name --distpath dist --workpath .build --specpath .build --icon $brandIcon --add-data ($brandImage + ':.') --collect-data pymobiledevice3 --collect-all pytun_pmd3 --copy-metadata pyimg4 --copy-metadata pymobiledevice3 espelho.py
if ($LASTEXITCODE) { throw 'Falha ao gerar o aplicativo Windows.' }

$exe = (Resolve-Path -LiteralPath "dist/$name/$name.exe").Path
$report = Join-Path $PSScriptRoot ".build/$name-diagnostico.json"
if (Test-Path -LiteralPath $report) { Remove-Item -LiteralPath $report }
$diagnostic = Start-Process -FilePath $exe -ArgumentList "--diagnostico `"$report`"" -PassThru -Wait -WindowStyle Hidden
if ($diagnostic.ExitCode -or -not (Test-Path -LiteralPath $report)) { throw 'O executável não gerou o diagnóstico.' }
$result = Get-Content -LiteralPath $report -Raw | ConvertFrom-Json
if ($result.version -ne $version -or -not $result.hevc -or $result.usb_error) { throw 'O diagnóstico do executável falhou.' }
Write-Output "Executável: $exe"
Get-Content -LiteralPath $report -Raw

& $Makensis "/DAPP_VERSION=$version" "installer.nsi"
if ($LASTEXITCODE) { throw 'Falha ao gerar o instalador Windows.' }
$setup = (Resolve-Path -LiteralPath "dist/$name-Setup-Windows-x64.exe").Path
Write-Output "Instalador: $setup"
Get-FileHash -LiteralPath $setup -Algorithm SHA256
