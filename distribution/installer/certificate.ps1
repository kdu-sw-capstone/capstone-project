param([Parameter(Mandatory=$true)][string]$Directory,[Parameter(Mandatory=$true)][string]$InstallationId,[switch]$ApproveCurrentUserTrust,[ValidateSet('Create','Trust','Inspect','CreateAndTrust')][string]$Phase='CreateAndTrust',[string]$ExpectedThumbprint='')
$ErrorActionPreference='Stop'
$securityModule=Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1'
Import-Module $securityModule -ErrorAction Stop
if((Get-AuthenticodeSignature $securityModule).Status -ne 'Valid'){throw 'WINDOWS_SECURITY_MODULE_SIGNATURE_UNCONFIRMED'}
if(-not $ApproveCurrentUserTrust){throw 'CURRENT_USER_CERTIFICATE_TRUST_APPROVAL_REQUIRED'}
if($InstallationId -notmatch '^[a-f0-9]{32}$'){throw 'INVALID_INSTALLATION_ID'}
if($Phase -in @('Trust','Inspect')){
 if($ExpectedThumbprint -notmatch '^[A-F0-9]{40}$'){throw 'EXPECTED_CERTIFICATE_THUMBPRINT_REQUIRED'}
 $cert=[System.Security.Cryptography.X509Certificates.X509Certificate2]::new((Join-Path $Directory 'localhost.cer'))
 if($cert.Thumbprint -ne $ExpectedThumbprint -or $cert.Subject -ne "CN=FOCURVE Local $InstallationId" -or $cert.Issuer -ne $cert.Subject){throw 'CERTIFICATE_IDENTITY_MISMATCH'}
 if(-not (Test-Path -LiteralPath ('Cert:\CurrentUser\My\'+$cert.Thumbprint))){throw 'CURRENT_USER_CERTIFICATE_NOT_PRESENT'}
 if($cert.NotBefore -gt (Get-Date) -or $cert.NotAfter -le (Get-Date)){throw 'CERTIFICATE_VALIDITY_UNCONFIRMED'}
 if(-not (Get-Item -LiteralPath ('Cert:\CurrentUser\My\'+$cert.Thumbprint)).HasPrivateKey){throw 'CURRENT_USER_PRIVATE_KEY_NOT_PRESENT'}
}else{
if(Test-Path -LiteralPath (Join-Path $Directory 'localhost.pfx')){throw 'CERTIFICATE_ALREADY_EXISTS'}
$secure=ConvertTo-SecureString -String $env:FOCURVE_NEW_PFX_PASSWORD -AsPlainText -Force
if(-not $env:FOCURVE_NEW_PFX_PASSWORD){throw 'NEW_PFX_PASSWORD_REQUIRED'}
[Console]::Error.WriteLine('FOCURVE_CERT_STAGE=CREATE_CURRENT_USER_CERTIFICATE')
$cert=New-SelfSignedCertificate -DnsName 'localhost' -Subject "CN=FOCURVE Local $InstallationId" -CertStoreLocation 'Cert:\CurrentUser\My' -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 -KeyExportPolicy Exportable -NotAfter (Get-Date).AddYears(1) -FriendlyName "FOCURVE $InstallationId"
[Console]::Error.WriteLine('FOCURVE_CERT_STAGE=EXPORT_CURRENT_USER_CERTIFICATE')
Export-PfxCertificate -Cert $cert -FilePath (Join-Path $Directory 'localhost.pfx') -Password $secure | Out-Null
Export-Certificate -Cert $cert -FilePath (Join-Path $Directory 'localhost.cer') | Out-Null

}
if($Phase -eq 'Create'){
 [pscustomobject]@{thumbprint=$cert.Thumbprint;store='CurrentUser';subject=$cert.Subject} | ConvertTo-Json -Compress
 return
}
if($Phase -eq 'Inspect'){
 if(-not (Test-Path -LiteralPath ('Cert:\CurrentUser\Root\'+$cert.Thumbprint))){throw 'CURRENT_USER_ROOT_TRUST_NOT_CONFIRMED'}
 [pscustomobject]@{thumbprint=$cert.Thumbprint;store='CurrentUser';subject=$cert.Subject} | ConvertTo-Json -Compress
 return
}
[Console]::Error.WriteLine('FOCURVE_CERT_STAGE=REQUEST_CURRENT_USER_ROOT_TRUST')
Write-Progress -Activity 'FOCURVE 인증서 신뢰 확인' -Status "Windows 보안 경고에서 FOCURVE Local $InstallationId 이름을 확인해 주세요."
Import-Certificate -FilePath (Join-Path $Directory 'localhost.cer') -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
Write-Progress -Activity 'FOCURVE 인증서 신뢰 확인' -Completed
if(-not (Test-Path -LiteralPath ('Cert:\CurrentUser\Root\'+$cert.Thumbprint))){throw 'CURRENT_USER_ROOT_TRUST_NOT_CONFIRMED'}
[Console]::Error.WriteLine('FOCURVE_CERT_STAGE=CURRENT_USER_ROOT_TRUST_CONFIRMED')
[pscustomobject]@{thumbprint=$cert.Thumbprint;store='CurrentUser';subject=$cert.Subject} | ConvertTo-Json -Compress
