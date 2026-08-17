using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using WhaleWatching.Api.Data;

#nullable disable

namespace WhaleWatching.Api.Migrations;

[DbContext(typeof(WhaleWatchingDbContext))]
[Migration("20260817130000_UniqueActiveSosPerUser")]
public partial class UniqueActiveSosPerUser : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            WITH [RankedSos] AS (
                SELECT [Id], [RaisedAtUtc], ROW_NUMBER() OVER (
                    PARTITION BY [TripId], [RaisedByUserId]
                    ORDER BY [RaisedAtUtc], [Id]
                ) AS [RowNumber]
                FROM [SosEvents]
                WHERE [ResolvedAtUtc] IS NULL
            )
            UPDATE [s]
            SET [ResolvedAtUtc] = [r].[RaisedAtUtc]
            FROM [SosEvents] AS [s]
            INNER JOIN [RankedSos] AS [r] ON [r].[Id] = [s].[Id]
            WHERE [r].[RowNumber] > 1;
            """);

        migrationBuilder.CreateIndex(
            name: "IX_SosEvents_TripId_RaisedByUserId",
            table: "SosEvents",
            columns: new[] { "TripId", "RaisedByUserId" },
            unique: true,
            filter: "[ResolvedAtUtc] IS NULL");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_SosEvents_TripId_RaisedByUserId",
            table: "SosEvents");
    }
}
