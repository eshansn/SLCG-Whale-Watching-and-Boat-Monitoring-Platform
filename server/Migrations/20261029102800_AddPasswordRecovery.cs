using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhaleWatching.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPasswordRecovery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PasswordResetAtUtc",
                table: "AspNetUsers",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PasswordRecoveries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    AccountKey = table.Column<string>(type: "varchar(64)", unicode: false, maxLength: 64, nullable: false),
                    AccountStateHash = table.Column<string>(type: "varchar(64)", unicode: false, maxLength: 64, nullable: false),
                    CodeVersion = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CodeHash = table.Column<string>(type: "varchar(64)", unicode: false, maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CodeIssuedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CodeExpiresAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    FailedAttempts = table.Column<int>(type: "int", nullable: false),
                    VerifiedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    AuthorizationHash = table.Column<string>(type: "varchar(64)", unicode: false, maxLength: 64, nullable: true),
                    AuthorizationExpiresAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ConsumedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    CancelledAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordRecoveries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PasswordRecoveries_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PasswordRecoveryRateWindows",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(64)", unicode: false, maxLength: 64, nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Requests = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordRecoveryRateWindows", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PasswordRecoveryDeliveries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RecoveryId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccountKey = table.Column<string>(type: "varchar(64)", unicode: false, maxLength: 64, nullable: false),
                    CodeVersion = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ProtectedCode = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    NextAttemptAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LeaseId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LeaseUntil = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Attempts = table.Column<int>(type: "int", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Delivered = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordRecoveryDeliveries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PasswordRecoveryDeliveries_PasswordRecoveries_RecoveryId",
                        column: x => x.RecoveryId,
                        principalTable: "PasswordRecoveries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PasswordRecoveries_AccountKey_CreatedAt",
                table: "PasswordRecoveries",
                columns: new[] { "AccountKey", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PasswordRecoveries_CodeExpiresAt",
                table: "PasswordRecoveries",
                column: "CodeExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_PasswordRecoveries_UserId_CreatedAt",
                table: "PasswordRecoveries",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PasswordRecoveryDeliveries_AccountKey_CreatedAt",
                table: "PasswordRecoveryDeliveries",
                columns: new[] { "AccountKey", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PasswordRecoveryDeliveries_CompletedAt_NextAttemptAt",
                table: "PasswordRecoveryDeliveries",
                columns: new[] { "CompletedAt", "NextAttemptAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PasswordRecoveryDeliveries_RecoveryId",
                table: "PasswordRecoveryDeliveries",
                column: "RecoveryId");

            migrationBuilder.CreateIndex(
                name: "IX_PasswordRecoveryRateWindows_ExpiresAt",
                table: "PasswordRecoveryRateWindows",
                column: "ExpiresAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PasswordRecoveryDeliveries");

            migrationBuilder.DropTable(
                name: "PasswordRecoveryRateWindows");

            migrationBuilder.DropTable(
                name: "PasswordRecoveries");

            migrationBuilder.DropColumn(
                name: "PasswordResetAtUtc",
                table: "AspNetUsers");
        }
    }
}
