using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhaleWatching.Api.Migrations;

public partial class TrackMyCarTelemetryFields : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_GpsTelemetry_DeviceId_RecordedAtUtc",
            table: "GpsTelemetry");

        migrationBuilder.AddColumn<decimal>(
            name: "AltitudeMeters",
            table: "GpsTelemetry",
            type: "decimal(9,2)",
            precision: 9,
            scale: 2,
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "HeadingDegrees",
            table: "GpsTelemetry",
            type: "decimal(6,2)",
            precision: 6,
            scale: 2,
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_GpsTelemetry_DeviceId_RecordedAtUtc",
            table: "GpsTelemetry",
            columns: new[] { "DeviceId", "RecordedAtUtc" },
            unique: true,
            descending: new[] { false, true });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_GpsTelemetry_DeviceId_RecordedAtUtc",
            table: "GpsTelemetry");

        migrationBuilder.DropColumn(name: "AltitudeMeters", table: "GpsTelemetry");
        migrationBuilder.DropColumn(name: "HeadingDegrees", table: "GpsTelemetry");

        migrationBuilder.CreateIndex(
            name: "IX_GpsTelemetry_DeviceId_RecordedAtUtc",
            table: "GpsTelemetry",
            columns: new[] { "DeviceId", "RecordedAtUtc" },
            descending: new[] { false, true });
    }
}
