using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhaleWatching.Api.Migrations
{
    /// <inheritdoc />
    public partial class PassengerPersonalQrAndAttendance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PassengerVerificationFinalizedAtUtc",
                table: "Trips",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PassengerVerificationFinalizedByUserId",
                table: "Trips",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PrimaryPassengerId",
                table: "TripPassengers",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.Sql(
                "UPDATE [TripPassengers] SET [PrimaryPassengerId] = [PassengerId] WHERE [PrimaryPassengerId] IS NULL;");

            migrationBuilder.AlterColumn<Guid>(
                name: "PrimaryPassengerId",
                table: "TripPassengers",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PersonalQrToken",
                table: "PassengerProfiles",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TripPassengerAttendances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TripPassengerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CheckedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CheckedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TripPassengerAttendances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TripPassengerAttendances_AspNetUsers_CheckedByUserId",
                        column: x => x.CheckedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TripPassengerAttendances_TripPassengers_TripPassengerId",
                        column: x => x.TripPassengerId,
                        principalTable: "TripPassengers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PassengerAttendanceAudits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AttendanceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    PreviousStatus = table.Column<int>(type: "int", nullable: false),
                    NewStatus = table.Column<int>(type: "int", nullable: false),
                    ChangedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChangedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PassengerAttendanceAudits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PassengerAttendanceAudits_AspNetUsers_ChangedByUserId",
                        column: x => x.ChangedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PassengerAttendanceAudits_TripPassengerAttendances_AttendanceId",
                        column: x => x.AttendanceId,
                        principalTable: "TripPassengerAttendances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Trips_PassengerVerificationFinalizedByUserId",
                table: "Trips",
                column: "PassengerVerificationFinalizedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TripPassengers_PrimaryPassengerId",
                table: "TripPassengers",
                column: "PrimaryPassengerId");

            migrationBuilder.CreateIndex(
                name: "IX_PassengerProfiles_PersonalQrToken",
                table: "PassengerProfiles",
                column: "PersonalQrToken",
                unique: true,
                filter: "[PersonalQrToken] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PassengerAttendanceAudits_AttendanceId",
                table: "PassengerAttendanceAudits",
                column: "AttendanceId");

            migrationBuilder.CreateIndex(
                name: "IX_PassengerAttendanceAudits_ChangedAtUtc",
                table: "PassengerAttendanceAudits",
                column: "ChangedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_PassengerAttendanceAudits_ChangedByUserId",
                table: "PassengerAttendanceAudits",
                column: "ChangedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TripPassengerAttendances_CheckedByUserId",
                table: "TripPassengerAttendances",
                column: "CheckedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TripPassengerAttendances_TripPassengerId",
                table: "TripPassengerAttendances",
                column: "TripPassengerId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_TripPassengers_PassengerProfiles_PrimaryPassengerId",
                table: "TripPassengers",
                column: "PrimaryPassengerId",
                principalTable: "PassengerProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Trips_AspNetUsers_PassengerVerificationFinalizedByUserId",
                table: "Trips",
                column: "PassengerVerificationFinalizedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TripPassengers_PassengerProfiles_PrimaryPassengerId",
                table: "TripPassengers");

            migrationBuilder.DropForeignKey(
                name: "FK_Trips_AspNetUsers_PassengerVerificationFinalizedByUserId",
                table: "Trips");

            migrationBuilder.DropTable(
                name: "PassengerAttendanceAudits");

            migrationBuilder.DropTable(
                name: "TripPassengerAttendances");

            migrationBuilder.DropIndex(
                name: "IX_Trips_PassengerVerificationFinalizedByUserId",
                table: "Trips");

            migrationBuilder.DropIndex(
                name: "IX_TripPassengers_PrimaryPassengerId",
                table: "TripPassengers");

            migrationBuilder.DropIndex(
                name: "IX_PassengerProfiles_PersonalQrToken",
                table: "PassengerProfiles");

            migrationBuilder.DropColumn(
                name: "PassengerVerificationFinalizedAtUtc",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "PassengerVerificationFinalizedByUserId",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "PrimaryPassengerId",
                table: "TripPassengers");

            migrationBuilder.DropColumn(
                name: "PersonalQrToken",
                table: "PassengerProfiles");
        }
    }
}
