param([Parameter(Mandatory=$true)][string]$Installation,[ValidateRange(3,480)][int]$Minutes=60,[switch]$ApproveLaunch)
$ErrorActionPreference='Stop'
if(-not $ApproveLaunch){throw '새 설치의 실행 승인 범위를 먼저 확인하세요.'}
$package=Split-Path -Parent $PSScriptRoot
$python=Join-Path $package 'vendor/python/python.exe'
if(-not (Test-Path -LiteralPath $python)){$python=Join-Path (Split-Path -Parent $package) 'runtimes/python/python.exe'}
& $python -I -B -X utf8 (Join-Path $package 'installer/install_core.py') start --instance $Installation --minutes $Minutes --approve-launch
exit $LASTEXITCODE
