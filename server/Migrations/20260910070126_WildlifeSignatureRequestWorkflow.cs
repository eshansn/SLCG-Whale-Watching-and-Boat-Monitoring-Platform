using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhaleWatching.Api.Migrations
{
    /// <inheritdoc />
    public partial class WildlifeSignatureRequestWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "MonitoringOfficerSignedAtUtc",
                table: "WildlifeMonitoringRecords",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "UsesSignatureRequestWorkflow",
                table: "WildlifeMonitoringRecords",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(
                """
                UPDATE [WildlifeMonitoringRecords]
                SET [MonitoringOfficerSignedAtUtc] = [SignedAtUtc]
                WHERE [MonitoringOfficerSignature] IS NOT NULL;

                UPDATE [WildlifeMonitoringRecords]
                SET [UsesSignatureRequestWorkflow] = 1,
                    [Status] = 4
                WHERE [Status] NOT IN (2, 3)
                  AND ([MonitoringOfficerSignature] IS NULL
                       OR [SupervisorSignature] IS NULL
                       OR [HarbourOfficerSignature] IS NULL
                       OR [HarbourOfficerName] IS NULL
                       OR LTRIM(RTRIM([HarbourOfficerName])) = '');
                """);

            migrationBuilder.CreateTable(
                name: "WildlifeSignatureRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WildlifeMonitoringRecordId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SignatureType = table.Column<int>(type: "int", nullable: false),
                    RequestedUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RequestedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RequestedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    SignatureData = table.Column<string>(type: "nvarchar(max)", maxLength: 500000, nullable: true),
                    SignedByName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: true),
                    SignedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DeclinedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    DeclineReason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WildlifeSignatureRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WildlifeSignatureRequests_AspNetUsers_RequestedByUserId",
                        column: x => x.RequestedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WildlifeSignatureRequests_AspNetUsers_RequestedUserId",
                        column: x => x.RequestedUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WildlifeSignatureRequests_WildlifeMonitoringRecords_WildlifeMonitoringRecordId",
                        column: x => x.WildlifeMonitoringRecordId,
                        principalTable: "WildlifeMonitoringRecords",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WildlifeSignatureRequests_RequestedByUserId",
                table: "WildlifeSignatureRequests",
                column: "RequestedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_WildlifeSignatureRequests_RequestedUserId_Status_RequestedAtUtc",
                table: "WildlifeSignatureRequests",
                columns: new[] { "RequestedUserId", "Status", "RequestedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_WildlifeSignatureRequests_WildlifeMonitoringRecordId_SignatureType",
                table: "WildlifeSignatureRequests",
                columns: new[] { "WildlifeMonitoringRecordId", "SignatureType" },
                unique: true,
                filter: "[Status] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_WildlifeSignatureRequests_WildlifeMonitoringRecordId_SignatureType_RequestedAtUtc",
                table: "WildlifeSignatureRequests",
                columns: new[] { "WildlifeMonitoringRecordId", "SignatureType", "RequestedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WildlifeSignatureRequests");

            migrationBuilder.DropColumn(
                name: "MonitoringOfficerSignedAtUtc",
                table: "WildlifeMonitoringRecords");

            migrationBuilder.DropColumn(
                name: "UsesSignatureRequestWorkflow",
                table: "WildlifeMonitoringRecords");
        }
    }
}
