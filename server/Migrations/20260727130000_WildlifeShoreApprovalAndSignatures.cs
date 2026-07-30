using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using WhaleWatching.Api.Data;

#nullable disable
namespace WhaleWatching.Api.Migrations;

[DbContext(typeof(WhaleWatchingDbContext))]
[Migration("20260727130000_WildlifeShoreApprovalAndSignatures")]
public sealed class WildlifeShoreApprovalAndSignatures : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(name: "WildlifeShoreApproval", table: "Trips", type: "int", nullable: false, defaultValue: 0);
        migrationBuilder.AddColumn<string>(name: "WildlifeShoreNotes", table: "Trips", type: "nvarchar(1000)", maxLength: 1000, nullable: true);
        migrationBuilder.AddColumn<string>(name: "MonitoringOfficerSignature", table: "WildlifeMonitoringRecords", type: "nvarchar(max)", maxLength: 500000, nullable: true);
        migrationBuilder.AddColumn<string>(name: "SupervisorSignature", table: "WildlifeMonitoringRecords", type: "nvarchar(max)", maxLength: 500000, nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "WildlifeShoreApproval", table: "Trips");
        migrationBuilder.DropColumn(name: "WildlifeShoreNotes", table: "Trips");
        migrationBuilder.DropColumn(name: "MonitoringOfficerSignature", table: "WildlifeMonitoringRecords");
        migrationBuilder.DropColumn(name: "SupervisorSignature", table: "WildlifeMonitoringRecords");
    }
}
