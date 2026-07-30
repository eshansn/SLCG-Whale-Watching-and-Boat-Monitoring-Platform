using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using WhaleWatching.Api.Data;

#nullable disable
namespace WhaleWatching.Api.Migrations;

[DbContext(typeof(WhaleWatchingDbContext))]
[Migration("20260727160000_CompanionSpecialNeeds")]
public sealed class CompanionSpecialNeeds : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "SpecialNeedType", table: "PassengerProfiles", type: "nvarchar(80)", maxLength: 80, nullable: true);
        migrationBuilder.AddColumn<bool>(name: "SelfCareConfirmed", table: "PassengerProfiles", type: "bit", nullable: false, defaultValue: false);
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "SpecialNeedType", table: "PassengerProfiles");
        migrationBuilder.DropColumn(name: "SelfCareConfirmed", table: "PassengerProfiles");
    }
}
