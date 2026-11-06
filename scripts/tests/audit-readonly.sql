-- Read-only health/data audit. Returns aggregate counts and schema metadata only.
SET NOCOUNT ON;
SELECT DB_NAME() AS DatabaseName, compatibility_level AS CompatibilityLevel,
    state_desc AS State FROM sys.databases WHERE name = DB_NAME();
SELECT COUNT(*) AS AppliedMigrations, MAX(MigrationId) AS LatestMigration FROM __EFMigrationsHistory;
SELECT 'Tables' AS Metric, COUNT_BIG(*) AS Value FROM sys.tables
UNION ALL SELECT 'DisabledOrUntrustedForeignKeys', COUNT_BIG(*) FROM sys.foreign_keys WHERE is_disabled = 1 OR is_not_trusted = 1
UNION ALL SELECT 'DisabledOrUntrustedChecks', COUNT_BIG(*) FROM sys.check_constraints WHERE is_disabled = 1 OR is_not_trusted = 1
UNION ALL SELECT 'DisabledIndexes', COUNT_BIG(*) FROM sys.indexes WHERE is_disabled = 1;
SELECT 'Users' AS Metric, COUNT_BIG(*) AS Value FROM AspNetUsers
UNION ALL SELECT 'Boats', COUNT_BIG(*) FROM Boats
UNION ALL SELECT 'Trips', COUNT_BIG(*) FROM Trips
UNION ALL SELECT 'PassengerProfiles', COUNT_BIG(*) FROM PassengerProfiles
UNION ALL SELECT 'TripPassengers', COUNT_BIG(*) FROM TripPassengers
UNION ALL SELECT 'GpsTelemetry', COUNT_BIG(*) FROM GpsTelemetry;
SELECT 'DuplicateNormalizedEmails' AS Metric, COUNT_BIG(*) AS Value FROM (
    SELECT NormalizedEmail FROM AspNetUsers WHERE NormalizedEmail IS NOT NULL GROUP BY NormalizedEmail HAVING COUNT(*) > 1) d
UNION ALL SELECT 'DuplicatePassengerIdentities', COUNT_BIG(*) FROM (
    SELECT NormalizedIdentificationNumber FROM PassengerProfiles GROUP BY NormalizedIdentificationNumber HAVING COUNT(*) > 1) d
UNION ALL SELECT 'DuplicateLiveGpsDevices', COUNT_BIG(*) FROM (
    SELECT GpsDeviceId FROM Boats WHERE IsDeleted = 0 AND GpsDeviceId IS NOT NULL GROUP BY GpsDeviceId HAVING COUNT(*) > 1) d
UNION ALL SELECT 'DuplicateTripPassengers', COUNT_BIG(*) FROM (
    SELECT TripId, PassengerId FROM TripPassengers GROUP BY TripId, PassengerId HAVING COUNT(*) > 1) d;
SELECT 'PassengerGroupsWithoutPrimaryOnSameTrip' AS Metric, COUNT_BIG(*) AS Value
FROM TripPassengers p WHERE NOT EXISTS (SELECT 1 FROM TripPassengers q WHERE q.TripId = p.TripId AND q.PassengerId = p.PrimaryPassengerId)
UNION ALL SELECT 'OrphanTripPassengers', COUNT_BIG(*) FROM TripPassengers p
WHERE NOT EXISTS (SELECT 1 FROM Trips t WHERE t.Id = p.TripId) OR NOT EXISTS (SELECT 1 FROM PassengerProfiles q WHERE q.Id = p.PassengerId)
UNION ALL SELECT 'CompletedTripsWithoutArrival', COUNT_BIG(*) FROM Trips WHERE Status = 3 AND ActualArrivalUtc IS NULL
UNION ALL SELECT 'OngoingTripsWithoutDepartureOrWithArrival', COUNT_BIG(*) FROM Trips WHERE Status = 2 AND (ActualDepartureUtc IS NULL OR ActualArrivalUtc IS NOT NULL)
UNION ALL SELECT 'BoatsWithMultipleOngoingTrips', COUNT_BIG(*) FROM (
    SELECT BoatId FROM Trips WHERE Status = 2 GROUP BY BoatId HAVING COUNT(*) > 1) d
UNION ALL SELECT 'InvalidTripStatus', COUNT_BIG(*) FROM Trips WHERE Status NOT IN (0,1,2,3,4,5,6)
UNION ALL SELECT 'InvalidBoatApproval', COUNT_BIG(*) FROM Boats WHERE Approval NOT IN (0,1,2) OR WildlifeApproval NOT IN (0,1,2)
UNION ALL SELECT 'InvalidCoordinates', COUNT_BIG(*) FROM GpsTelemetry WHERE Latitude NOT BETWEEN -90 AND 90 OR Longitude NOT BETWEEN -180 AND 180
UNION ALL SELECT 'FutureTelemetryOverFiveMinutes', COUNT_BIG(*) FROM GpsTelemetry WHERE RecordedAtUtc > DATEADD(minute, 5, SYSDATETIMEOFFSET());
-- Scheduled trip counters may include owner estimates; these are discrepancies for review, not automatic repair instructions.
SELECT 'TripPassengerCountDiffersFromRegistrations' AS Metric, COUNT_BIG(*) AS Value FROM Trips t
WHERE t.PassengerCount <> (SELECT COUNT(*) FROM TripPassengers p WHERE p.TripId = t.Id)
UNION ALL SELECT 'TripChildrenCountDiffersFromRegistrations', COUNT_BIG(*) FROM Trips t
WHERE t.ChildrenCount <> (SELECT COUNT(*) FROM TripPassengers p JOIN PassengerProfiles q ON p.PassengerId = q.Id WHERE p.TripId = t.Id AND q.AgeCategory = 'child')
UNION ALL SELECT 'TripSpecialNeedsCountDiffersFromRegistrations', COUNT_BIG(*) FROM Trips t
WHERE t.SpecialNeedsCount <> (SELECT COUNT(*) FROM TripPassengers p JOIN PassengerProfiles q ON p.PassengerId = q.Id WHERE p.TripId = t.Id AND q.AgeCategory = 'specialneeds');
SELECT 'CertifiedCrewWithoutStoredCertificate' AS Metric, COUNT_BIG(*) AS Value FROM AspNetUsers u
WHERE u.IsCrewCertified = 1 AND NOT EXISTS (SELECT 1 FROM CrewCertificates c WHERE c.CrewUserId = u.Id AND DATALENGTH(c.Content) > 0);
SELECT 'UnindexedForeignKeysByLeadingColumn' AS Metric, COUNT_BIG(*) AS Value FROM sys.foreign_key_columns f
WHERE f.constraint_column_id = 1 AND NOT EXISTS (
    SELECT 1 FROM sys.index_columns i JOIN sys.indexes ix ON ix.object_id = i.object_id AND ix.index_id = i.index_id
    WHERE i.object_id = f.parent_object_id AND i.column_id = f.parent_column_id AND i.key_ordinal = 1 AND ix.is_disabled = 0);
