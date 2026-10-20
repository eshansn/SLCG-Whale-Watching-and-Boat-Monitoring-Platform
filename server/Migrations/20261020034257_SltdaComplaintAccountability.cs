using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhaleWatching.Api.Migrations
{
    /// <inheritdoc />
    public partial class SltdaComplaintAccountability : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "PassengerComplaints",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "Complaint");

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "PassengerComplaints",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAtUtc",
                table: "PassengerComplaints",
                type: "datetimeoffset",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<Guid>(
                name: "Version",
                table: "PassengerComplaints",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.Sql("UPDATE PassengerComplaints SET UpdatedAtUtc = CreatedAtUtc, Version = NEWID();");

            migrationBuilder.CreateTable(
                name: "ComplaintAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ComplaintId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuthorityRoleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ForwardedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    ForwardedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    AcknowledgedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    RespondedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComplaintAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ComplaintAssignments_AspNetRoles_AuthorityRoleId",
                        column: x => x.AuthorityRoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ComplaintAssignments_AspNetUsers_ForwardedByUserId",
                        column: x => x.ForwardedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ComplaintAssignments_PassengerComplaints_ComplaintId",
                        column: x => x.ComplaintId,
                        principalTable: "PassengerComplaints",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ComplaintEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ComplaintId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ActorUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Action = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Text = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: true),
                    PreviousStatus = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    AssignmentStatus = table.Column<int>(type: "int", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RequestHash = table.Column<string>(type: "nchar(64)", fixedLength: true, maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComplaintEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ComplaintEvents_AspNetUsers_ActorUserId",
                        column: x => x.ActorUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ComplaintEvents_ComplaintAssignments_AssignmentId",
                        column: x => x.AssignmentId,
                        principalTable: "ComplaintAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ComplaintEvents_PassengerComplaints_ComplaintId",
                        column: x => x.ComplaintId,
                        principalTable: "PassengerComplaints",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            // Preserve original submission times without inventing a historic reviewer or action.
            migrationBuilder.Sql(@"INSERT INTO ComplaintEvents
                (Id, ComplaintId, Action, PreviousStatus, Status, CreatedAtUtc)
                SELECT NEWID(), Id, 'Submitted', 0, 0, CreatedAtUtc FROM PassengerComplaints;");

            migrationBuilder.CreateTable(
                name: "ComplaintNotifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RecipientUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EventId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    ReadAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComplaintNotifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ComplaintNotifications_AspNetUsers_RecipientUserId",
                        column: x => x.RecipientUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ComplaintNotifications_ComplaintEvents_EventId",
                        column: x => x.EventId,
                        principalTable: "ComplaintEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PassengerProfiles_Name",
                table: "PassengerProfiles",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_PassengerProfiles_NormalizedPhoneNumber",
                table: "PassengerProfiles",
                column: "NormalizedPhoneNumber");

            migrationBuilder.CreateIndex(
                name: "IX_PassengerComplaints_Status_CreatedAtUtc",
                table: "PassengerComplaints",
                columns: new[] { "Status", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ComplaintAssignments_AuthorityRoleId_Status_ForwardedAtUtc",
                table: "ComplaintAssignments",
                columns: new[] { "AuthorityRoleId", "Status", "ForwardedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ComplaintAssignments_ComplaintId_AuthorityRoleId",
                table: "ComplaintAssignments",
                columns: new[] { "ComplaintId", "AuthorityRoleId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ComplaintAssignments_ForwardedByUserId",
                table: "ComplaintAssignments",
                column: "ForwardedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ComplaintEvents_ActorUserId",
                table: "ComplaintEvents",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ComplaintEvents_AssignmentId",
                table: "ComplaintEvents",
                column: "AssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_ComplaintEvents_ComplaintId_ActorUserId_RequestId",
                table: "ComplaintEvents",
                columns: new[] { "ComplaintId", "ActorUserId", "RequestId" },
                unique: true,
                filter: "[RequestId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ComplaintEvents_ComplaintId_CreatedAtUtc",
                table: "ComplaintEvents",
                columns: new[] { "ComplaintId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ComplaintNotifications_EventId_RecipientUserId",
                table: "ComplaintNotifications",
                columns: new[] { "EventId", "RecipientUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ComplaintNotifications_RecipientUserId_ReadAtUtc_CreatedAtUtc",
                table: "ComplaintNotifications",
                columns: new[] { "RecipientUserId", "ReadAtUtc", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"IF EXISTS (SELECT 1 FROM ComplaintEvents)
                THROW 50001, 'Complaint history exists. Export and retain the audit records before considering a schema rollback.', 1;");
            migrationBuilder.DropTable(
                name: "ComplaintNotifications");

            migrationBuilder.DropTable(
                name: "ComplaintEvents");

            migrationBuilder.DropTable(
                name: "ComplaintAssignments");

            migrationBuilder.DropIndex(
                name: "IX_PassengerProfiles_Name",
                table: "PassengerProfiles");

            migrationBuilder.DropIndex(
                name: "IX_PassengerProfiles_NormalizedPhoneNumber",
                table: "PassengerProfiles");

            migrationBuilder.DropIndex(
                name: "IX_PassengerComplaints_Status_CreatedAtUtc",
                table: "PassengerComplaints");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "PassengerComplaints");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "PassengerComplaints");

            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                table: "PassengerComplaints");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "PassengerComplaints");
        }
    }
}
