using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using WhaleWatching.Api.Data;

#nullable disable

namespace WhaleWatching.Api.Migrations;

[DbContext(typeof(WhaleWatchingDbContext))]
[Migration("20260817090000_UniqueWildlifeMonitoringRecordPerTrip")]
public partial class UniqueWildlifeMonitoringRecordPerTrip : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            WITH [RankedRecords] AS (
                SELECT [Id], ROW_NUMBER() OVER (
                    PARTITION BY [TripId]
                    ORDER BY
                        CASE [Status] WHEN 2 THEN 0 WHEN 1 THEN 1 ELSE 2 END,
                        [UpdatedAtUtc] DESC,
                        [CreatedAtUtc] DESC,
                        [Id]
                ) AS [RowNumber]
                FROM [WildlifeMonitoringRecords]
            )
            DELETE FROM [RankedRecords] WHERE [RowNumber] > 1;
            """);

        migrationBuilder.DropIndex(
            name: "IX_WildlifeMonitoringRecords_TripId_CreatedAtUtc",
            table: "WildlifeMonitoringRecords");

        migrationBuilder.CreateIndex(
            name: "IX_WildlifeMonitoringRecords_TripId",
            table: "WildlifeMonitoringRecords",
            column: "TripId",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_WildlifeMonitoringRecords_TripId",
            table: "WildlifeMonitoringRecords");

        migrationBuilder.CreateIndex(
            name: "IX_WildlifeMonitoringRecords_TripId_CreatedAtUtc",
            table: "WildlifeMonitoringRecords",
            columns: new[] { "TripId", "CreatedAtUtc" });
    }
}
