using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhaleWatching.Api.Migrations
{
    /// <inheritdoc />
    public partial class TripLifecycleAndBoatCrewAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DeclineReason",
                table: "Trips",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DeclinedAtUtc",
                table: "Trips",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DeclinedByUserId",
                table: "Trips",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RescheduleOverride",
                table: "Trips",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "RescheduleOverrideAtUtc",
                table: "Trips",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RescheduleOverrideByUserId",
                table: "Trips",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RescheduleOverrideReason",
                table: "Trips",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StartedByRole",
                table: "Trips",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "StartedByUserId",
                table: "Trips",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Position",
                table: "TripCrewAssignments",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "TripCrewAssignments",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "Legacy");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "AssignedAtUtc",
                table: "CrewAssignments",
                type: "datetimeoffset",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.Sql(
                """
                UPDATE [TripCrewAssignments]
                SET [Position] = COALESCE(NULLIF([users].[CrewType], ''), 'Crew Member'),
                    [Source] = 'Legacy'
                FROM [TripCrewAssignments] AS [tripCrew]
                INNER JOIN [AspNetUsers] AS [users] ON [users].[Id] = [tripCrew].[CrewUserId];

                UPDATE [CrewAssignments]
                SET [AssignedAtUtc] = SYSUTCDATETIME()
                WHERE [AssignedAtUtc] = '0001-01-01T00:00:00.0000000+00:00';

                WITH [RankedAssignments] AS (
                    SELECT [crew].[Id], ROW_NUMBER() OVER (
                        PARTITION BY [boat].[OwnerId], [crew].[CrewUserId]
                        ORDER BY [crew].[Id]) AS [RowNumber]
                    FROM [CrewAssignments] AS [crew]
                    INNER JOIN [Boats] AS [boat] ON [boat].[Id] = [crew].[BoatId]
                    WHERE [crew].[IsActive] = 1
                )
                UPDATE [crew]
                SET [IsActive] = 0
                FROM [CrewAssignments] AS [crew]
                INNER JOIN [RankedAssignments] AS [ranked] ON [ranked].[Id] = [crew].[Id]
                WHERE [ranked].[RowNumber] > 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Trips_DeclinedByUserId",
                table: "Trips",
                column: "DeclinedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Trips_RescheduleOverrideByUserId",
                table: "Trips",
                column: "RescheduleOverrideByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Trips_StartedByUserId",
                table: "Trips",
                column: "StartedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Trips_AspNetUsers_DeclinedByUserId",
                table: "Trips",
                column: "DeclinedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Trips_AspNetUsers_RescheduleOverrideByUserId",
                table: "Trips",
                column: "RescheduleOverrideByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Trips_AspNetUsers_StartedByUserId",
                table: "Trips",
                column: "StartedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Trips_AspNetUsers_DeclinedByUserId",
                table: "Trips");

            migrationBuilder.DropForeignKey(
                name: "FK_Trips_AspNetUsers_RescheduleOverrideByUserId",
                table: "Trips");

            migrationBuilder.DropForeignKey(
                name: "FK_Trips_AspNetUsers_StartedByUserId",
                table: "Trips");

            migrationBuilder.DropIndex(
                name: "IX_Trips_DeclinedByUserId",
                table: "Trips");

            migrationBuilder.DropIndex(
                name: "IX_Trips_RescheduleOverrideByUserId",
                table: "Trips");

            migrationBuilder.DropIndex(
                name: "IX_Trips_StartedByUserId",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "DeclineReason",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "DeclinedAtUtc",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "DeclinedByUserId",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "RescheduleOverride",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "RescheduleOverrideAtUtc",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "RescheduleOverrideByUserId",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "RescheduleOverrideReason",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "StartedByRole",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "StartedByUserId",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "Position",
                table: "TripCrewAssignments");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "TripCrewAssignments");

            migrationBuilder.DropColumn(
                name: "AssignedAtUtc",
                table: "CrewAssignments");
        }
    }
}
