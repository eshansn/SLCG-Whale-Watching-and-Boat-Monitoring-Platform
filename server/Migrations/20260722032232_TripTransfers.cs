using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhaleWatching.Api.Migrations
{
    /// <inheritdoc />
    public partial class TripTransfers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TripTransfers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClientRequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SourceTripId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DestinationTripId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InitiatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Explanation = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    TransferredAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TripTransfers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TripTransfers_AspNetUsers_InitiatedByUserId",
                        column: x => x.InitiatedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TripTransfers_Trips_DestinationTripId",
                        column: x => x.DestinationTripId,
                        principalTable: "Trips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TripTransfers_Trips_SourceTripId",
                        column: x => x.SourceTripId,
                        principalTable: "Trips",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TripTransferItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TransferId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PersonId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PersonType = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    PersonName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TripTransferItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TripTransferItems_TripTransfers_TransferId",
                        column: x => x.TransferId,
                        principalTable: "TripTransfers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TripTransferItems_TransferId",
                table: "TripTransferItems",
                column: "TransferId");

            migrationBuilder.CreateIndex(
                name: "IX_TripTransfers_DestinationTripId",
                table: "TripTransfers",
                column: "DestinationTripId");

            migrationBuilder.CreateIndex(
                name: "IX_TripTransfers_InitiatedByUserId_ClientRequestId",
                table: "TripTransfers",
                columns: new[] { "InitiatedByUserId", "ClientRequestId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TripTransfers_SourceTripId",
                table: "TripTransfers",
                column: "SourceTripId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TripTransferItems");

            migrationBuilder.DropTable(
                name: "TripTransfers");
        }
    }
}
