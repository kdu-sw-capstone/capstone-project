# Run from the repository root. Creates one disposable DB; never reuses an installation.
param([Parameter(Mandatory=$true)][string]$BinaryDirectory,[Parameter(Mandatory=$true)][string]$MavenCommand,[int]$Port=33339,[string]$Tests="AdditionalConfigMysqlTest,AdditionalConfigContractTest")
$ErrorActionPreference='Stop'
$taskRoot=(Get-Location).Path
$binaryRoot=(Resolve-Path -LiteralPath $BinaryDirectory).Path
$serverExe=[IO.Path]::GetFullPath((Join-Path $binaryRoot 'bin/mysqld.exe'))
if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw 'Independent test port occupied'}
$suffix=[Guid]::NewGuid().ToString('N').Substring(0,12)
$sandbox=[IO.Path]::GetFullPath((Join-Path $taskRoot ".local/amvp-mysql-$suffix"))
if(-not $sandbox.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar) -or (Test-Path -LiteralPath $sandbox)){throw 'Disposable path invalid or already exists'}
New-Item -ItemType Directory -Path $sandbox | Out-Null
$data=Join-Path $sandbox 'data';$database="amvp_test_$suffix"
$testSecret=[Guid]::NewGuid().ToString('N')+[Guid]::NewGuid().ToString('N')
$bootstrap=Join-Path $sandbox 'bootstrap.sql';$control=Join-Path $sandbox 'control.ini'
@"
CREATE DATABASE $database CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
CREATE USER 'amvp_test'@'127.0.0.1' IDENTIFIED BY '$testSecret';
GRANT ALL ON $database.* TO 'amvp_test'@'127.0.0.1';
CREATE USER 'amvp_control'@'127.0.0.1' IDENTIFIED BY '$testSecret';
GRANT SHUTDOWN ON *.* TO 'amvp_control'@'127.0.0.1';
ALTER USER 'root'@'localhost' IDENTIFIED BY '$testSecret';
"@ | Set-Content -LiteralPath $bootstrap -Encoding utf8
@"
[client]
user=amvp_control
password=$testSecret
host=127.0.0.1
port=$Port
"@ | Set-Content -LiteralPath $control -Encoding utf8
$init=Start-Process -FilePath $serverExe -ArgumentList @('--no-defaults','--initialize-insecure',"--basedir=`"$binaryRoot`"","--datadir=`"$data`"") -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput (Join-Path $sandbox 'init.stdout') -RedirectStandardError (Join-Path $sandbox 'init.stderr')
if($init.ExitCode -ne 0){throw 'Test initialization failed; evidence retained'}
$owned=$null;$result=1
try {
 $owned=Start-Process -FilePath $serverExe -ArgumentList @('--no-defaults',"--basedir=`"$binaryRoot`"","--datadir=`"$data`"",'--bind-address=127.0.0.1',"--port=$Port",'--mysqlx=OFF','--skip-name-resolve','--default-time-zone=+00:00',"--init-file=`"$bootstrap`"",'--console') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $sandbox 'server.stdout') -RedirectStandardError (Join-Path $sandbox 'server.stderr')
 $ready=$false
 for($n=0;$n -lt 45;$n++) {
  # Confirm the exact fresh datadir over an authenticated SQL connection. Windows
  # network compartment enumeration can omit a native process's listener.
  $observedData=& (Join-Path $binaryRoot 'bin/mysql.exe') "--defaults-extra-file=$control" --protocol=tcp --batch --skip-column-names --execute='SELECT @@datadir' 2> (Join-Path $sandbox 'readiness.stderr')
  if($LASTEXITCODE -eq 0 -and $observedData) {
   $normalized=[IO.Path]::GetFullPath($observedData.Trim()).TrimEnd('\','/')
   if($normalized -ne $data.TrimEnd('\','/')){throw 'SQL datadir ownership mismatch'}
   $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($owned.Id)"
   if(-not $process -or [IO.Path]::GetFullPath($process.ExecutablePath) -ne $serverExe -or -not $process.CommandLine.Replace('/','\').Contains($data.Replace('/','\'))){throw 'Process datadir ownership mismatch'}
   $listenerPid=$owned.Id
   @{launcher_pid=$owned.Id;verified_datadir=$normalized;executable=$serverExe;port=$Port} | ConvertTo-Json | Set-Content (Join-Path $sandbox 'ownership.json')
   $ready=$true;break
  }
  Start-Sleep -Seconds 1
 }
 if(-not $ready){throw 'Test DB readiness failed'}
 $env:FOCURVE_AMVP_TEST_URL="jdbc:mysql://127.0.0.1:$Port/$database`?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&useSSL=false&allowPublicKeyRetrieval=true"
 $env:FOCURVE_AMVP_TEST_USER='amvp_test';$env:FOCURVE_AMVP_TEST_PASSWORD=$testSecret
 & $MavenCommand -q -f runtime-server/pom.xml "-Dtest=$Tests" test *> (Join-Path $sandbox 'tests.log')
 $result=$LASTEXITCODE
 if($result -ne 0){Write-Output "Test failure; retained log: $sandbox/tests.log"}
} finally {
 Remove-Item Env:FOCURVE_AMVP_TEST_URL,Env:FOCURVE_AMVP_TEST_USER,Env:FOCURVE_AMVP_TEST_PASSWORD -ErrorAction SilentlyContinue
 if($owned) {
  $shutdownPid=if($listenerPid){$listenerPid}else{$owned.Id}
  $current=Get-CimInstance Win32_Process -Filter "ProcessId=$shutdownPid"
  if($current) {
   if([IO.Path]::GetFullPath($current.ExecutablePath) -ne $serverExe -or -not $current.CommandLine.Replace('/','\').Contains($data.Replace('/','\'))){throw 'Shutdown ownership mismatch'}
   & (Join-Path $binaryRoot 'bin/mysqladmin.exe') "--defaults-extra-file=$control" --protocol=tcp shutdown *> (Join-Path $sandbox 'shutdown.log')
   if((Get-Process -Id $shutdownPid -ErrorAction SilentlyContinue) -and -not (Get-Process -Id $shutdownPid).WaitForExit(15000)){throw 'Graceful test DB shutdown unconfirmed; evidence retained'}
  }
 }
 Write-Output "Independent test DB stopped; evidence: $sandbox"
}
exit $result
