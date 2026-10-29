param(
  [ValidateSet('All','Web','Server','Extension')][string]$Area = 'All',
  [switch]$Install,
  [switch]$FreshCaches
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location $taskRoot
$oldNpmCache = $env:npm_config_cache
$oldNpmConfig = $env:npm_config_userconfig
$oldMavenHome = $env:MAVEN_USER_HOME
try {
  New-Item -ItemType Directory -Force -Path .local/team-check | Out-Null
  function Invoke-Checked([string]$Label, [scriptblock]$Action) {
    Write-Host "== $Label =="
    & $Action *> (Join-Path $taskRoot ".local/team-check/$Label.log")
    if ($LASTEXITCODE -ne 0) { throw "$Label failed; see .local/team-check/$Label.log" }
    Write-Host "$Label PASS"
  }
  $nodeVersion = & node -p 'process.versions.node'
  if ($LASTEXITCODE -ne 0 -or [version]$nodeVersion -lt [version]'24.19.0' -or ([version]$nodeVersion).Major -ne 24) {
    throw 'Use Node 24.19.x (see .nvmrc), npm 11.x. Node is missing or incompatible.'
  }
  if ($FreshCaches) {
    $env:npm_config_cache = Join-Path $taskRoot '.local/team-check/npm-cache'
    $env:npm_config_userconfig = Join-Path $taskRoot '.local/team-check/npmrc'
    [IO.File]::WriteAllText($env:npm_config_userconfig, '')
    $env:MAVEN_USER_HOME = Join-Path $taskRoot '.local/team-check/maven-user-home'
    [IO.File]::WriteAllText((Join-Path $taskRoot '.local/team-check/maven-settings.xml'), '<settings xmlns="http://maven.apache.org/SETTINGS/1.2.0"/>')
  }
  if ($Area -in @('All','Web')) {
    if ($Install) { Invoke-Checked 'web-install' { npm.cmd --prefix frontend ci --no-audit --no-fund } }
    Invoke-Checked 'web-tests' { npm.cmd --prefix frontend test -- --reporter=dot }
    Invoke-Checked 'web-build' { npm.cmd --prefix frontend run build }
  }
  if ($Area -in @('All','Extension')) {
    if ($Install) { Invoke-Checked 'extension-install' { npm.cmd --prefix extension ci --no-audit --no-fund } }
    Push-Location extension
    try {
      Invoke-Checked 'extension-syntax' { npm.cmd run check }
      # Concurrency limits fixture port/memory contention; test cases and expectations are unchanged.
      Invoke-Checked 'member-worker-build' { node scripts/build-member-worker.js }
      Invoke-Checked 'a1-build' { node scripts/build-a1.mjs }
      Invoke-Checked 'member-a1-build' { node scripts/build-member-a1.mjs }
      Invoke-Checked 'harness-build' { npm.cmd run build:harness }
      Invoke-Checked 'extension-tests' { node --test --test-concurrency=2 tests/*.test.js tests/*.test.mjs tests/*.test.cjs }
      Invoke-Checked 'content-pure-tests' { node --test content-tests/changes.test.mjs content-tests/detection.test.mjs }
    } finally { Pop-Location }
  }
  if ($Area -in @('All','Server')) {
    $javaVersion = (& java -version 2>&1 | Out-String)
    if ($javaVersion -notmatch 'version "21\.') { throw 'Install JDK 21 and set JAVA_HOME/PATH; see backend/README.md.' }
    $mavenCacheArgs = @()
    if ($FreshCaches) { $mavenCacheArgs = @('-s', "$taskRoot/.local/team-check/maven-settings.xml", "-Dmaven.repo.local=$taskRoot/.local/team-check/maven-repository") }
    Invoke-Checked 'backend-unit-package' {
      & ./backend/mvnw.cmd -f backend/pom.xml -B -ntp @mavenCacheArgs '-Dtest=AuthRateTimingTest,ConsentBoundaryTest,HostEventValidationTest,PolicyContractTest,SmtpMailDeliveryTest,SocialProviderValidationTest' verify
    }
    Invoke-Checked 'runtime-server-verify' { & ./backend/mvnw.cmd -f runtime-server/pom.xml -B -ntp @mavenCacheArgs verify }
    Invoke-Checked 'distribution-contracts' { python -B -m unittest discover -s distribution/tests -p 'test_*.py' }
  }
  Write-Host 'Selected automatic checks PASS. Actual Chrome/Native/DB integration is NOT_RUN.'
} finally {
  $env:npm_config_cache = $oldNpmCache
  $env:npm_config_userconfig = $oldNpmConfig
  $env:MAVEN_USER_HOME = $oldMavenHome
  Pop-Location
}
