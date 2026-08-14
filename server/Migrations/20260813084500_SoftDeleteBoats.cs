using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using WhaleWatching.Api.Data;

#nullable disable

namespace WhaleWatching.Api.Migrations;

[DbContext(typeof(WhaleWatchingDbContext))]
[Migration("20260813084500_SoftDeleteBoats")]
public partial class SoftDeleteBoats : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_Boats_GpsDeviceId",
            table: "Boats");

        migrationBuilder.DropIndex(
            name: "IX_Boats_RegistrationNumber",
            table: "Boats");

        migrationBuilder.AddColumn<bool>(
            name: "IsDeleted",
            table: "Boats",
            type: "bit",
            nullable: false,
            defaultValue: false);

        migrationBuilder.CreateIndex(
            name: "IX_Boats_GpsDeviceId",
            table: "Boats",
            column: "GpsDeviceId",
            unique: true,
            filter: "[GpsDeviceId] IS NOT NULL AND [IsDeleted] = 0");

        migrationBuilder.CreateIndex(
            name: "IX_Boats_RegistrationNumber",
            table: "Boats",
            column: "RegistrationNumber",
            unique: true,
            filter: "[IsDeleted] = 0");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_Boats_GpsDeviceId",
            table: "Boats");

        migrationBuilder.DropIndex(
            name: "IX_Boats_RegistrationNumber",
            table: "Boats");

        migrationBuilder.DropColumn(
            name: "IsDeleted",
            table: "Boats");

        migrationBuilder.CreateIndex(
            name: "IX_Boats_GpsDeviceId",
            table: "Boats",
            column: "GpsDeviceId",
            unique: true,
            filter: "[GpsDeviceId] IS NOT NULL");

        migrationBuilder.CreateIndex(
            name: "IX_Boats_RegistrationNumber",
            table: "Boats",
            column: "RegistrationNumber",
            unique: true);
    }
}
