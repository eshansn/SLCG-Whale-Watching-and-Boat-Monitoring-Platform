using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using WhaleWatching.Api.Data;

#nullable disable

namespace WhaleWatching.Api.Migrations;

[DbContext(typeof(WhaleWatchingDbContext))]
[Migration("20260814130000_BoatDocumentExpirationDate")]
public partial class BoatDocumentExpirationDate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateOnly>(
            name: "ExpirationDate",
            table: "BoatDocuments",
            type: "date",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "ExpirationDate",
            table: "BoatDocuments");
    }
}
