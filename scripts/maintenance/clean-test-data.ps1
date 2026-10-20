[CmdletBinding()]
param([switch]$Execute)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
Set-Location -LiteralPath $repoRoot
$sqlContainer = 'whale-watching-sqlserver'
$apiContainer = 'whale-watching-api'

function Invoke-DatabaseSql([string]$Sql) {
    $result = $Sql | docker exec -i $sqlContainer sh -c 'export SQLCMDPASSWORD=$MSSQL_SA_PASSWORD; exec /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -d WhaleWatching -W'
    if ($LASTEXITCODE -ne 0) {
        $result | ForEach-Object { Write-Host $_ }
        throw 'SQL operation failed; inspect the SQL error above.'
    }
    return $result
}

$inspectText = docker inspect $apiContainer
if ($LASTEXITCODE -ne 0) { throw 'Expected local API container was not found.' }
$api = ($inspectText | ConvertFrom-Json)[0]
$settings = @{}
foreach ($entry in $api.Config.Env) {
    $pair = $entry -split '=', 2
    $settings[$pair[0]] = $pair[1]
}
if ($settings['ASPNETCORE_ENVIRONMENT'] -notin @('Development','Testing')) {
    throw 'Refusing reset outside Development/Testing.'
}
if ($settings['DevelopmentMockData__Enabled'] -ne 'false') {
    throw 'Rebuild the updated API with DevelopmentMockData__Enabled=false before cleanup.'
}
if ($settings['ConnectionStrings__SqlServer'] -notmatch '(?i)Server=sqlserver,1433;' -or
    $settings['ConnectionStrings__SqlServer'] -notmatch '(?i)Database=WhaleWatching;') {
    throw 'Unexpected API SQL target.'
}
$sqlInspect = docker inspect $sqlContainer | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $sqlInspect[0].State.Health.Status -ne 'healthy') {
    throw 'Expected SQL container is not healthy.'
}
if ($api.Config.Labels.'com.docker.compose.project' -ne 'whale-watching' -or
    $sqlInspect[0].Config.Labels.'com.docker.compose.project' -ne 'whale-watching') {
    throw 'Containers do not belong to the expected development Compose project.'
}
$roles = [ordered]@{ Admin='Admin'; Ops='OPS'; Wildlife='Wildlife'; Shore='ShoreCrew'; ShoreWildlife='ShoreWildlife' }
$authorities = @($roles.GetEnumerator() | ForEach-Object {
    $email = $settings["IdentitySeed__$($_.Key)Email"]
    if ([string]::IsNullOrWhiteSpace($email)) { throw 'A main authority email is not explicitly configured.' }
    [ordered]@{ Email=$email; RoleName=$_.Value }
})
$authorities | ConvertTo-Json
if (-not $Execute) {
    Write-Output 'Inspection only. Set ALLOW_TEST_DATA_RESET=true and use -Execute to back up and clean this development database.'
    exit 0
}
if ($env:ALLOW_TEST_DATA_RESET -cne 'true') { throw 'Explicit ALLOW_TEST_DATA_RESET=true is required.' }

$backupRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot 'wwms-maintenance'))
if (-not $backupRoot.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Backup directory escaped the repository.'
}
if (Test-Path -LiteralPath $backupRoot) {
    if ((Get-Item -LiteralPath $backupRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw 'Backup directory must not be a symlink or junction.'
    }
}
$exclude = Join-Path $repoRoot '.git\info\exclude'
if (-not (Select-String -LiteralPath $exclude -Pattern '^/wwms-maintenance/$' -Quiet)) {
    Add-Content -LiteralPath $exclude -Value "`n/wwms-maintenance/"
}
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$runId = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
$backupName = "WhaleWatching-before-cleanup-$runId.bak"
$backupPath = Join-Path $backupRoot $backupName
if (Test-Path -LiteralPath $backupPath) { throw 'Safety backup exists; refusing overwrite.' }

# Quiesce only this application's writer. On failure leave it stopped for inspection.
docker compose stop api
if ($LASTEXITCODE -ne 0) { throw 'Could not stop the API; no cleanup performed.' }
docker exec $sqlContainer mkdir -p /var/opt/mssql/backup
if ($LASTEXITCODE -ne 0) { throw 'Cannot prepare SQL backup directory.' }
docker exec $sqlContainer test '!' -e "/var/opt/mssql/backup/$backupName"
if ($LASTEXITCODE -ne 0) { throw 'Container safety backup exists; refusing overwrite.' }
Invoke-DatabaseSql "BACKUP DATABASE [WhaleWatching] TO DISK=N'/var/opt/mssql/backup/$backupName' WITH COPY_ONLY, INIT, COMPRESSION, CHECKSUM; RESTORE VERIFYONLY FROM DISK=N'/var/opt/mssql/backup/$backupName' WITH CHECKSUM;"
docker cp "${sqlContainer}:/var/opt/mssql/backup/$backupName" $backupPath
if ($LASTEXITCODE -ne 0) { throw 'Safety backup copy failed; no cleanup performed.' }
$backupHash = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash
[ordered]@{ backupFilename=$backupName; sizeBytes=(Get-Item $backupPath).Length; sha256=$backupHash; verified=$true; utc=$runId } |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backupRoot "backup-$runId.json") -Encoding UTF8

$authorityJson = (ConvertTo-Json -InputObject $authorities -Compress).Replace("'", "''")
$environmentName = $settings['ASPNETCORE_ENVIRONMENT']
$sql = @"
EXEC sys.sp_set_session_context @key=N'environment', @value=N'$environmentName';
EXEC sys.sp_set_session_context @key=N'allow_reset', @value=N'true';
EXEC sys.sp_set_session_context @key=N'backup_verified', @value=N'true';
EXEC sys.sp_set_session_context @key=N'authorities', @value=N'$authorityJson';
"@ + [Environment]::NewLine + (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'clean-test-data.sql') -Raw)
$report = Invoke-DatabaseSql $sql
$report | Set-Content -LiteralPath (Join-Path $backupRoot "cleanup-$runId.txt") -Encoding UTF8
$report
Invoke-DatabaseSql 'DBCC CHECKDB ([WhaleWatching]) WITH NO_INFOMSGS;'
Write-Output "Verified safety backup: $backupPath"
Write-Output "SHA-256: $backupHash"
Write-Output 'Cleanup completed. API remains stopped. Start only the rebuilt API with mock seeding disabled, then verify counts and logins.'
