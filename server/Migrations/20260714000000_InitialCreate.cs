using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using WhaleWatching.Api.Data;

#nullable disable

namespace WhaleWatching.Api.Migrations;

[DbContext(typeof(WhaleWatchingDbContext))]
[Migration("20260714000000_InitialCreate")]
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "GpsTelemetry",
            columns: table => new
            {
                Id = table.Column<long>(type: "bigint", nullable: false)
                    .Annotation("SqlServer:Identity", "1, 1"),
                DeviceId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                Latitude = table.Column<decimal>(type: "decimal(9,6)", precision: 9, scale: 6, nullable: false),
                Longitude = table.Column<decimal>(type: "decimal(9,6)", precision: 9, scale: 6, nullable: false),
                RecordedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset(3)", precision: 3, nullable: false),
                ReceivedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset(3)", precision: 3, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_GpsTelemetry", x => x.Id);
                table.CheckConstraint("CK_GpsTelemetry_Latitude", "[Latitude] >= -90 AND [Latitude] <= 90");
                table.CheckConstraint("CK_GpsTelemetry_Longitude", "[Longitude] >= -180 AND [Longitude] <= 180");
            });

        migrationBuilder.CreateIndex(
            name: "IX_GpsTelemetry_DeviceId_RecordedAtUtc",
            table: "GpsTelemetry",
            columns: new[] { "DeviceId", "RecordedAtUtc" },
            descending: new[] { false, true });

        migrationBuilder.CreateIndex(
            name: "IX_GpsTelemetry_RecordedAtUtc",
            table: "GpsTelemetry",
            column: "RecordedAtUtc");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "GpsTelemetry");
    }
}
