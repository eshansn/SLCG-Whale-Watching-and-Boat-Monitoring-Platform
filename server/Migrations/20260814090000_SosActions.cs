using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using WhaleWatching.Api.Data;

#nullable disable

namespace WhaleWatching.Api.Migrations;

[DbContext(typeof(WhaleWatchingDbContext))]
[Migration("20260814090000_SosActions")]
public partial class SosActions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "SosActions",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                SosEventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                TakenByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                Details = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                TakenAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_SosActions", x => x.Id);
                table.ForeignKey(
                    name: "FK_SosActions_AspNetUsers_TakenByUserId",
                    column: x => x.TakenByUserId,
                    principalTable: "AspNetUsers",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_SosActions_SosEvents_SosEventId",
                    column: x => x.SosEventId,
                    principalTable: "SosEvents",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_SosActions_SosEventId_TakenAtUtc",
            table: "SosActions",
            columns: new[] { "SosEventId", "TakenAtUtc" });

        migrationBuilder.CreateIndex(
            name: "IX_SosActions_TakenByUserId",
            table: "SosActions",
            column: "TakenByUserId");
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "SosActions");
}
