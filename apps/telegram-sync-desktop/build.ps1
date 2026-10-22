$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path '.venv-build/Scripts/python.exe')) {
    py -3.12 -m venv .venv-build
    if ($LASTEXITCODE -ne 0) { throw 'Instale Python 3.12 de python.org, incluindo Tcl/Tk.' }
}
$Python = Join-Path $PSScriptRoot '.venv-build/Scripts/python.exe'
& $Python -m pip install -r requirements-build.txt
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível instalar dependências.' }
& $Python -m unittest discover -s tests -v
if ($LASTEXITCODE -ne 0) { throw 'Os testes falharam.' }
& $Python -m PyInstaller --noconfirm --clean --onefile --windowed --name TelegramSync --collect-all telethon main.py
if ($LASTEXITCODE -ne 0) { throw 'A criação do executável falhou.' }
$Process = Start-Process -FilePath 'dist/TelegramSync.exe' -ArgumentList '--self-test' -Wait -PassThru
if ($Process.ExitCode -ne 0) { throw 'O autoteste do executável falhou.' }
Get-FileHash 'dist/TelegramSync.exe' -Algorithm SHA256 | Format-List
Write-Host 'Pronto: dist/TelegramSync.exe'
