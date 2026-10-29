param([Parameter(Mandatory=$true)][string]$BinaryDirectory,[int]$Port=33327)
$ErrorActionPreference='Stop'
$taskRoot=(Get-Location).Path
$binaryRoot=(Resolve-Path -LiteralPath $BinaryDirectory).Path
$serverExe=Join-Path $binaryRoot 'bin/mysqld.exe'
if(-not(Test-Path -LiteralPath $serverExe)){throw 'MySQL executable missing'}
if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw 'Independent test port occupied'}
$suffix=[Guid]::NewGuid().ToString('N').Substring(0,12)
$taskSandbox=[IO.Path]::GetFullPath((Join-Path $taskRoot ".local/contract-mysql-$suffix"))
if(-not $taskSandbox.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar)){throw 'Private data path must be within this Worktree'}
if(Test-Path -LiteralPath $taskSandbox){throw 'Existing data will never be reused'}
New-Item -ItemType Directory -Path $taskSandbox | Out-Null
$data=Join-Path $taskSandbox 'data'
$backendDb="contract_backend_$suffix";$runtimeDb="contract_runtime_$suffix"
$taskPassword=[Guid]::NewGuid().ToString('N')+[Guid]::NewGuid().ToString('N')
$controlPassword=[Guid]::NewGuid().ToString('N')+[Guid]::NewGuid().ToString('N')
$bootstrap=Join-Path $taskSandbox 'bootstrap.sql';$client=Join-Path $taskSandbox 'client.ini';$control=Join-Path $taskSandbox 'control.ini'
@"
CREATE DATABASE $backendDb CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
CREATE DATABASE $runtimeDb CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;
CREATE USER 'contract_probe'@'127.0.0.1' IDENTIFIED BY '$taskPassword';
GRANT ALL ON $backendDb.* TO 'contract_probe'@'127.0.0.1';
GRANT ALL ON $runtimeDb.* TO 'contract_probe'@'127.0.0.1';
CREATE USER 'contract_control'@'127.0.0.1' IDENTIFIED BY '$controlPassword';
GRANT SHUTDOWN ON *.* TO 'contract_control'@'127.0.0.1';
ALTER USER 'root'@'localhost' IDENTIFIED BY '$controlPassword';
"@ | Set-Content -LiteralPath $bootstrap -Encoding utf8
@"
[client]
user=contract_probe
password=$taskPassword
host=127.0.0.1
port=$Port
"@ | Set-Content -LiteralPath $client -Encoding utf8
@"
[client]
user=contract_control
password=$controlPassword
host=127.0.0.1
port=$Port
"@ | Set-Content -LiteralPath $control -Encoding utf8
$init=Start-Process -FilePath $serverExe -ArgumentList @('--no-defaults','--initialize-insecure',"--basedir=`"$binaryRoot`"","--datadir=`"$data`"") -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput (Join-Path $taskSandbox 'init.stdout') -RedirectStandardError (Join-Path $taskSandbox 'init.stderr')
if($init.ExitCode -ne 0){throw 'Independent initialization failed; private logs retained'}
$ownedPid=$null
try{
 $server=Start-Process -FilePath $serverExe -ArgumentList @('--no-defaults',"--basedir=`"$binaryRoot`"","--datadir=`"$data`"",'--bind-address=127.0.0.1',"--port=$Port",'--mysqlx=OFF','--skip-name-resolve','--default-time-zone=+00:00',"--init-file=`"$bootstrap`"",'--console') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskSandbox 'server.stdout') -RedirectStandardError (Join-Path $taskSandbox 'server.stderr')
 $ready=$false
 for($i=0;$i -lt 45;$i++){
  $listener=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if($listener){
   $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
   if($process.ExecutablePath -ne $serverExe -or -not $process.CommandLine.Contains($data)){throw 'Listener ownership mismatch'}
   $ownedPid=$listener.OwningProcess
   & (Join-Path $binaryRoot 'bin/mysql.exe') "--defaults-extra-file=$client" --protocol=tcp --execute='SELECT 1' *> $null
   if($LASTEXITCODE -eq 0){$ready=$true;break}
  }
  Start-Sleep -Seconds 1
 }
 if(-not $ready){throw 'Independent server not ready'}
 & '.\.local\contract-venv\Scripts\python.exe' 'contracts/additional-mvp/rc1/tools/mysql_probe.py' --mysql (Join-Path $binaryRoot 'bin/mysql.exe') --client $client --backend-db $backendDb --runtime-db $runtimeDb --output (Join-Path $taskSandbox 'result.json')
 if($LASTEXITCODE -ne 0){throw 'SQL probe failed; private evidence retained'}
 Copy-Item -LiteralPath (Join-Path $taskSandbox 'result.json') -Destination 'contracts/additional-mvp/rc1/mysql-result.json'
 @{mysql_version='8.4.8';binary_sha256=(Get-FileHash -LiteralPath $serverExe -Algorithm SHA256).Hash;private_profile='NEW_WORKTREE_LOCAL_ONLY';credentials_published=$false;port=$Port} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskSandbox 'environment.json') -Encoding utf8
}finally{
 if($ownedPid){
  $current=Get-CimInstance Win32_Process -Filter "ProcessId=$ownedPid"
  if($current -and $current.ExecutablePath -eq $serverExe -and $current.CommandLine.Contains($data)){
   & (Join-Path $binaryRoot 'bin/mysqladmin.exe') "--defaults-extra-file=$control" --protocol=tcp shutdown *> $null
   $owned=Get-Process -Id $ownedPid -ErrorAction SilentlyContinue
   if($owned -and -not $owned.WaitForExit(15000)){throw 'Owned MySQL did not shut down; report retained process instead of deleting data'}
  }
  if(Get-Process -Id $ownedPid -ErrorAction SilentlyContinue){throw 'Owned server still running'}
 }
 Write-Output 'Owned independent MySQL exit verified; all private data/evidence retained.'
}
