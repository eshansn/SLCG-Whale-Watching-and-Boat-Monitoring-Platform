# Development database cleanup

This is an offline, destructive maintenance operation, never an HTTP endpoint.
It preserves the five explicitly configured main authority users and their complete
Identity rows and roles. All other users and all transactional data are removed.
Role definitions, role claims, migrations, code-based document requirements,
country lists, and application assets are preserved.

First rebuild the API with `DevelopmentMockData__Enabled=false`. The running
container must identify itself as Development or Testing, target the local
`sqlserver,1433` / `WhaleWatching` database, and belong to the expected Compose
project. Inspect the configured authority emails before execution:

```powershell
./scripts/maintenance/clean-test-data.ps1
$env:ALLOW_TEST_DATA_RESET='true'
./scripts/maintenance/clean-test-data.ps1 -Execute
Remove-Item Env:ALLOW_TEST_DATA_RESET
docker compose up -d api
```

The command stops only the API, creates and verifies a timestamped COPY_ONLY SQL
backup, copies it into locally Git-excluded `wwms-maintenance`, and records its
SHA-256. It then runs one transaction, deletes children before parents according
to the live foreign keys, and compares complete authority rows and role assignments
before committing. Unknown tables, missing authority roles, and non-demo GPS
assignments cause refusal/rollback. Failure leaves the API stopped for inspection.
Do not use this command once real operational records have been registered.

Uploads are stored in database binary columns (documents, complaint evidence,
profile photos) or inline image/signature fields. These disappear with their owning
records in the same transaction. Static gallery images are application assets and
are not deleted. There is no separate notification table: portal notifications are
derived from operational records. Inspect new storage implementations before
extending this script.

`IdentitySeeder` always provisions required roles and missing configured main
authorities; existing authority identities and passwords are never reset. Demo
users, supervisor/harbour examples, boats, trips, crew, and telemetry require both
Development environment and explicit `DevelopmentMockData:Enabled=true`; it is
false by default. Leave it false for real-user testing.

To recover, stop the API, preserve any newer data with another verified backup,
inspect the safety backup using RESTORE FILELISTONLY, then restore WhaleWatching
with CHECKSUM and correct MOVE paths. Use WITH REPLACE only after that newer
safety backup and return the database to MULTI_USER. Recheck DBCC CHECKDB.
Backups contain personal records, password/token hashes, and documents: store and
transfer them only using encrypted storage in an authorized environment.
