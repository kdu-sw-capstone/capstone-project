$ErrorActionPreference='Stop'
$package=Split-Path -Parent $PSScriptRoot
$python=Join-Path $package 'vendor/python/python.exe'
if(-not (Test-Path -LiteralPath $python)){$python=Join-Path (Split-Path -Parent $package) 'runtimes/python/python.exe'}
& $python -I -B -X utf8 (Join-Path $package 'installer/install_core.py') verify
exit $LASTEXITCODE
