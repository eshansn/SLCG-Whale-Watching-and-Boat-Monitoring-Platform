using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using WhaleWatching.Api.Data;

#nullable disable

namespace WhaleWatching.Api.Migrations;

[DbContext(typeof(WhaleWatchingDbContext))]
[Migration("20260814110000_BackfillTripCrewAssignments")]
public partial class BackfillTripCrewAssignments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            INSERT INTO [TripCrewAssignments] ([Id], [TripId], [CrewUserId])
            SELECT NEWID(), [trip].[Id], [crew].[CrewUserId]
            FROM [Trips] AS [trip]
            INNER JOIN [CrewAssignments] AS [crew]
                ON [crew].[BoatId] = [trip].[BoatId] AND [crew].[IsActive] = 1
            WHERE NOT EXISTS (
                SELECT 1 FROM [TripCrewAssignments] AS [existing]
                WHERE [existing].[TripId] = [trip].[Id]);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
