-- Invoked only by clean-test-data.ps1, never exposed as an API.
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
IF DB_NAME() <> N'WhaleWatching'
    THROW 51000, 'Unexpected database.', 1;
IF COALESCE(CONVERT(nvarchar(20), SESSION_CONTEXT(N'environment')), '') NOT IN ('Development', 'Testing')
    THROW 51000, 'Development or Testing environment required.', 1;
IF COALESCE(CONVERT(nvarchar(5), SESSION_CONTEXT(N'allow_reset')), '') <> 'true'
    THROW 51000, 'ALLOW_TEST_DATA_RESET=true is required.', 1;
IF COALESCE(CONVERT(nvarchar(5), SESSION_CONTEXT(N'backup_verified')), '') <> 'true'
    THROW 51000, 'A verified native safety backup is required.', 1;

BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lockResult int;
 EXEC @lockResult = sys.sp_getapplock @Resource=N'WWMS-test-data-cleanup', @LockMode='Exclusive', @LockOwner='Transaction';
 IF @lockResult < 0 THROW 51000, 'Cannot acquire maintenance lock.', 1;

 CREATE TABLE #ExpectedAuthorities (Email nvarchar(256) PRIMARY KEY, RoleName nvarchar(256));
 INSERT #ExpectedAuthorities
 SELECT Email, RoleName FROM OPENJSON(CONVERT(nvarchar(max), SESSION_CONTEXT(N'authorities')))
 WITH (Email nvarchar(256), RoleName nvarchar(256));
 IF (SELECT COUNT(*) FROM #ExpectedAuthorities) <> 5
    THROW 51000, 'Exactly five explicitly configured main authority accounts are required.', 1;
 IF EXISTS (SELECT 1 FROM #ExpectedAuthorities e WHERE NOT EXISTS
    (SELECT 1 FROM dbo.AspNetUsers u JOIN dbo.AspNetUserRoles ur ON ur.UserId=u.Id
     JOIN dbo.AspNetRoles r ON r.Id=ur.RoleId WHERE u.Email=e.Email AND r.Name=e.RoleName))
    THROW 51000, 'A configured authority account or its expected role is missing.', 1;
 SELECT u.* INTO #Authorities FROM dbo.AspNetUsers u JOIN #ExpectedAuthorities e ON e.Email=u.Email;
 IF (SELECT COUNT(*) FROM #Authorities) <> 5 THROW 51000, 'Authority identities are ambiguous.', 1;
 SELECT ur.* INTO #AuthorityRoles FROM dbo.AspNetUserRoles ur JOIN #Authorities a ON a.Id=ur.UserId;
 IF EXISTS (SELECT 1 FROM #AuthorityRoles ar JOIN dbo.AspNetRoles r ON r.Id=ar.RoleId
            WHERE r.Name IN ('BoatOwner','BoatCrew','Passenger'))
    THROW 51000, 'Authority has an operational user role; inspect before cleanup.', 1;
 SELECT * INTO #Roles FROM dbo.AspNetRoles;
 SELECT * INTO #RoleClaims FROM dbo.AspNetRoleClaims;
 SELECT * INTO #Migrations FROM dbo.__EFMigrationsHistory;

 -- Reviewed against EF and live SQL foreign keys. Unknown tables fail closed.
 CREATE TABLE #ClearTables (Name sysname PRIMARY KEY, DeletedCount bigint NOT NULL DEFAULT 0, Done bit NOT NULL DEFAULT 0);
 INSERT #ClearTables(Name) VALUES
 ('BoatDocuments'),('Boats'),('ComplaintImages'),('CrewAssignments'),('GpsTelemetry'),
 ('OwnerCrewMemberships'),('PassengerAttendanceAudits'),('PassengerComplaints'),
 ('PassengerProfiles'),('PassengerSessions'),('SosActions'),('SosEvents'),
 ('TripCrewAssignments'),('TripPassengerAttendances'),('TripPassengers'),('Trips'),
 ('TripTransferItems'),('TripTransfers'),('WildlifeMonitoringRecords'),('WildlifeSignatureRequests');
 IF EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id
            WHERE t.is_ms_shipped=0 AND (s.name <> 'dbo' OR
            (t.name NOT IN (SELECT Name FROM #ClearTables) AND t.name NOT IN
            ('AspNetUsers','AspNetUserRoles','AspNetUserClaims','AspNetUserLogins','AspNetUserTokens',
             'AspNetRoles','AspNetRoleClaims','RefreshTokens','__EFMigrationsHistory'))))
    THROW 51000, 'Unreviewed table found; update the maintenance table classification first.', 1;
 IF EXISTS (SELECT 1 FROM #ClearTables WHERE OBJECT_ID(N'dbo.'+QUOTENAME(Name), N'U') IS NULL)
    THROW 51000, 'Expected table is missing.', 1;
 -- This cleanup is for the verified demo database, not physical tracker registrations.
 IF EXISTS (SELECT 1 FROM dbo.Boats WHERE NULLIF(GpsDeviceId,'') IS NOT NULL AND GpsDeviceId NOT LIKE 'WWMS-%')
    THROW 51000, 'Non-demo GPS assignment exists; preserve and review physical trackers first.', 1;

 SELECT u.Id,u.Email,r.Name AS Role INTO #DeletedUsers
 FROM dbo.AspNetUsers u LEFT JOIN dbo.AspNetUserRoles ur ON ur.UserId=u.Id
 LEFT JOIN dbo.AspNetRoles r ON r.Id=ur.RoleId WHERE u.Id NOT IN (SELECT Id FROM #Authorities);
 DECLARE @name sysname, @sql nvarchar(max), @deleted bigint;
 WHILE EXISTS (SELECT 1 FROM #ClearTables WHERE Done=0)
 BEGIN
    SET @name=NULL;
    SELECT TOP(1) @name=c.Name FROM #ClearTables c WHERE c.Done=0 AND NOT EXISTS
      (SELECT 1 FROM sys.foreign_keys f JOIN #ClearTables child ON child.Name=OBJECT_NAME(f.parent_object_id)
       WHERE f.referenced_object_id=OBJECT_ID(N'dbo.'+QUOTENAME(c.Name))
       AND f.parent_object_id<>f.referenced_object_id AND child.Done=0) ORDER BY c.Name;
    IF @name IS NULL THROW 51000, 'Unresolved foreign-key cycle; transaction rolled back.', 1;
    SET @sql=N'DELETE FROM dbo.'+QUOTENAME(@name)+N'; SET @count=@@ROWCOUNT;';
    EXEC sys.sp_executesql @sql,N'@count bigint OUTPUT',@count=@deleted OUTPUT;
    UPDATE #ClearTables SET DeletedCount=@deleted,Done=1 WHERE Name=@name;
 END;
 -- Keep authority security records; remove only deleted users' identity/session records.
 DELETE FROM dbo.RefreshTokens WHERE UserId NOT IN (SELECT Id FROM #Authorities);
 DECLARE @refreshDeleted int=@@ROWCOUNT;
 DELETE FROM dbo.AspNetUserClaims WHERE UserId NOT IN (SELECT Id FROM #Authorities);
 DELETE FROM dbo.AspNetUserLogins WHERE UserId NOT IN (SELECT Id FROM #Authorities);
 DELETE FROM dbo.AspNetUserTokens WHERE UserId NOT IN (SELECT Id FROM #Authorities);
 DELETE FROM dbo.AspNetUserRoles WHERE UserId NOT IN (SELECT Id FROM #Authorities);
 DELETE FROM dbo.AspNetUsers WHERE Id NOT IN (SELECT Id FROM #Authorities);
 DECLARE @usersDeleted int=@@ROWCOUNT;

 IF EXISTS (SELECT * FROM #Authorities EXCEPT SELECT * FROM dbo.AspNetUsers)
 OR EXISTS (SELECT * FROM dbo.AspNetUsers EXCEPT SELECT * FROM #Authorities)
 OR EXISTS (SELECT * FROM #AuthorityRoles EXCEPT SELECT * FROM dbo.AspNetUserRoles)
 OR EXISTS (SELECT * FROM dbo.AspNetUserRoles EXCEPT SELECT * FROM #AuthorityRoles)
 OR EXISTS (SELECT * FROM #Roles EXCEPT SELECT * FROM dbo.AspNetRoles)
 OR EXISTS (SELECT * FROM dbo.AspNetRoles EXCEPT SELECT * FROM #Roles)
 OR EXISTS (SELECT * FROM #RoleClaims EXCEPT SELECT * FROM dbo.AspNetRoleClaims)
 OR EXISTS (SELECT * FROM #Migrations EXCEPT SELECT * FROM dbo.__EFMigrationsHistory)
    THROW 51000, 'Preserved authority, role, or migration state changed; rolling back.', 1;
 DECLARE empty_check CURSOR LOCAL FAST_FORWARD FOR SELECT Name FROM #ClearTables;
 OPEN empty_check;
 FETCH NEXT FROM empty_check INTO @name;
 WHILE @@FETCH_STATUS=0
 BEGIN
    SET @sql=N'IF EXISTS (SELECT 1 FROM dbo.'+QUOTENAME(@name)+N') THROW 51000, ''Operational table is not empty.'', 1;';
    EXEC sys.sp_executesql @sql;
    FETCH NEXT FROM empty_check INTO @name;
 END;
 CLOSE empty_check;
 DEALLOCATE empty_check;
 COMMIT;
 SELECT Name AS TableName,DeletedCount FROM #ClearTables ORDER BY Name;
 SELECT @usersDeleted AS UsersDeleted,@refreshDeleted AS DeletedUserRefreshTokens;
 SELECT Id,Email,Role FROM #DeletedUsers ORDER BY Email;
 SELECT a.Id,a.Email,e.RoleName AS PreservedRole FROM #Authorities a JOIN #ExpectedAuthorities e ON e.Email=a.Email;
 SELECT 'PASS: all operational tables empty; complete authority rows and roles unchanged' AS Verification;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;
