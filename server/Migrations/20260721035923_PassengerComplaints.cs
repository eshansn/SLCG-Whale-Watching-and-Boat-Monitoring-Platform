using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhaleWatching.Api.Migrations
{
    /// <inheritdoc />
    public partial class PassengerComplaints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PassengerComplaints",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PassengerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TripId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Message = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PassengerComplaints", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PassengerComplaints_PassengerProfiles_PassengerId",
                        column: x => x.PassengerId,
                        principalTable: "PassengerProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PassengerComplaints_Trips_TripId",
                        column: x => x.TripId,
                        principalTable: "Trips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ComplaintImages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ComplaintId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Content = table.Column<byte[]>(type: "varbinary(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComplaintImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ComplaintImages_PassengerComplaints_ComplaintId",
                        column: x => x.ComplaintId,
                        principalTable: "PassengerComplaints",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ComplaintImages_ComplaintId",
                table: "ComplaintImages",
                column: "ComplaintId");

            migrationBuilder.CreateIndex(
                name: "IX_PassengerComplaints_CreatedAtUtc",
                table: "PassengerComplaints",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_PassengerComplaints_PassengerId",
                table: "PassengerComplaints",
                column: "PassengerId");

            migrationBuilder.CreateIndex(
                name: "IX_PassengerComplaints_TripId",
                table: "PassengerComplaints",
                column: "TripId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ComplaintImages");

            migrationBuilder.DropTable(
                name: "PassengerComplaints");
        }
    }
}
