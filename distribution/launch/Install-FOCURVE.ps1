param([Parameter(Mandatory=$true)][string]$Configuration,[switch]$ApproveNewInstallation,[switch]$ApproveCurrentUserCertificateTrust)
$ErrorActionPreference='Stop'
if(-not $ApproveNewInstallation -or -not $ApproveCurrentUserCertificateTrust){throw '새 전용 설치와 현재 사용자 인증서 등록 승인이 필요합니다.'}
$package=Split-Path -Parent $PSScriptRoot
& (Join-Path $package 'vendor/python/python.exe') -I -B -X utf8 (Join-Path $package 'installer/install_core.py') install --config $Configuration --approve-install --approve-current-user-certificate
exit $LASTEXITCODE
