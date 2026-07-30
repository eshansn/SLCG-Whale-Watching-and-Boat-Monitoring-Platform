using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using WhaleWatching.Api.Data;

#nullable disable

namespace WhaleWatching.Api.Migrations;

[DbContext(typeof(WhaleWatchingDbContext))]
[Migration("20260727090000_ShoreWildlifeMonitoringAndSmallPassenger")]
public partial class ShoreWildlifeMonitoringAndSmallPassenger : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "WildlifeMonitoringRecords",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                TripId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                TicketNumber = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                TidNumber = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                MonitoringOfficer = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                Supervisor = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                Status = table.Column<int>(type: "int", nullable: false),
                LocalAdultSnapshot = table.Column<int>(type: "int", nullable: false),
                LocalChildSnapshot = table.Column<int>(type: "int", nullable: false),
                LocalSmallSnapshot = table.Column<int>(type: "int", nullable: false),
                ForeignAdultSnapshot = table.Column<int>(type: "int", nullable: false),
                ForeignChildSnapshot = table.Column<int>(type: "int", nullable: false),
                ForeignSmallSnapshot = table.Column<int>(type: "int", nullable: false),
                HarbourOfficerName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: true),
                HarbourOfficerSignature = table.Column<string>(type: "nvarchar(max)", maxLength: 500000, nullable: true),
                CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                SignedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                CompletedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_WildlifeMonitoringRecords", x => x.Id);
                table.ForeignKey("FK_WildlifeMonitoringRecords_AspNetUsers_CreatedByUserId", x => x.CreatedByUserId,
                    principalTable: "AspNetUsers", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_WildlifeMonitoringRecords_Trips_TripId", x => x.TripId,
                    principalTable: "Trips", principalColumn: "Id", onDelete: ReferentialAction.Restrict);
            });
        migrationBuilder.CreateIndex(name: "IX_WildlifeMonitoringRecords_CreatedByUserId",
            table: "WildlifeMonitoringRecords", column: "CreatedByUserId");
        migrationBuilder.CreateIndex(name: "IX_WildlifeMonitoringRecords_TripId_CreatedAtUtc",
            table: "WildlifeMonitoringRecords", columns: new[] { "TripId", "CreatedAtUtc" });
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "WildlifeMonitoringRecords");
}
