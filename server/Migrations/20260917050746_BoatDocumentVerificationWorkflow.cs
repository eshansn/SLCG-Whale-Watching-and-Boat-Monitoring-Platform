using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhaleWatching.Api.Migrations
{
    /// <inheritdoc />
    public partial class BoatDocumentVerificationWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DocumentRequirementsVersion",
                table: "Boats",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "RegistrationSubmittedAtUtc",
                table: "Boats",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAtUtc",
                table: "BoatDocuments",
                type: "datetimeoffset",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<string>(
                name: "DocumentType",
                table: "BoatDocuments",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "FileSize",
                table: "BoatDocuments",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<bool>(
                name: "IsCurrent",
                table: "BoatDocuments",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                table: "BoatDocuments",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReplacesDocumentId",
                table: "BoatDocuments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "BoatDocuments",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "StoredFileName",
                table: "BoatDocuments",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAtUtc",
                table: "BoatDocuments",
                type: "datetimeoffset",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<Guid>(
                name: "UploadedByUserId",
                table: "BoatDocuments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "VerifiedAtUtc",
                table: "BoatDocuments",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "VerifiedByUserId",
                table: "BoatDocuments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Version",
                table: "BoatDocuments",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // Preserve every legacy document while mapping only categories with an unambiguous
            // equivalent. Existing boats remain on requirements version 1 and keep their approval.
            migrationBuilder.Sql(
                """
                UPDATE d
                SET d.DocumentType = CASE d.Name
                        WHEN 'Certificate of registration of Sole Proprietorship' THEN 'BusinessRegistration'
                        WHEN 'ME Certificate' THEN 'MECertificate'
                        WHEN 'Wildlife Certificate' THEN 'WildlifeCertificate'
                        WHEN 'Coxswain Certificate' THEN 'CoxswainCertificate'
                        WHEN 'Vessel Registration Certificate' THEN 'VesselRegistrationCertificate'
                        WHEN 'Boat Insurance' THEN 'VesselInsuranceCertificate'
                        WHEN 'Certificate of Vessel' THEN 'LegacyCertificateOfVessel'
                        ELSE 'LegacyUnclassified'
                    END,
                    d.Name = CASE d.Name
                        WHEN 'Certificate of registration of Sole Proprietorship' THEN 'Certificate of Registration of Sole Proprietorship / Business'
                        WHEN 'Boat Insurance' THEN 'Vessel Insurance Certificate'
                        ELSE d.Name
                    END,
                    d.StoredFileName = CASE WHEN NULLIF(d.FileName, '') IS NULL
                        THEN CONCAT(CONVERT(nvarchar(36), d.Id), '.bin') ELSE d.FileName END,
                    d.FileSize = ISNULL(DATALENGTH(d.Content), 0),
                    d.UploadedByUserId = b.OwnerId,
                    d.CreatedAtUtc = d.UploadedAtUtc,
                    d.UpdatedAtUtc = d.UploadedAtUtc,
                    d.Status = 1
                FROM BoatDocuments d
                INNER JOIN Boats b ON b.Id = d.BoatId;

                WITH RankedDocuments AS
                (
                    SELECT Id,
                        ROW_NUMBER() OVER (PARTITION BY BoatId, DocumentType ORDER BY UploadedAtUtc, Id) AS VersionNumber,
                        ROW_NUMBER() OVER (PARTITION BY BoatId, DocumentType ORDER BY UploadedAtUtc DESC, Id DESC) AS CurrentNumber
                    FROM BoatDocuments
                )
                UPDATE d
                SET d.Version = r.VersionNumber,
                    d.IsCurrent = CASE WHEN r.CurrentNumber = 1 THEN 1 ELSE 0 END,
                    d.Status = CASE WHEN r.CurrentNumber = 1 THEN 1 ELSE 4 END
                FROM BoatDocuments d
                INNER JOIN RankedDocuments r ON r.Id = d.Id;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_BoatDocuments_BoatId_DocumentType_IsCurrent",
                table: "BoatDocuments",
                columns: new[] { "BoatId", "DocumentType", "IsCurrent" },
                unique: true,
                filter: "[IsCurrent] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_BoatDocuments_ExpirationDate",
                table: "BoatDocuments",
                column: "ExpirationDate");

            migrationBuilder.CreateIndex(
                name: "IX_BoatDocuments_ReplacesDocumentId",
                table: "BoatDocuments",
                column: "ReplacesDocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_BoatDocuments_Status",
                table: "BoatDocuments",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_BoatDocuments_UploadedByUserId",
                table: "BoatDocuments",
                column: "UploadedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_BoatDocuments_VerifiedByUserId",
                table: "BoatDocuments",
                column: "VerifiedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_BoatDocuments_AspNetUsers_UploadedByUserId",
                table: "BoatDocuments",
                column: "UploadedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_BoatDocuments_AspNetUsers_VerifiedByUserId",
                table: "BoatDocuments",
                column: "VerifiedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_BoatDocuments_BoatDocuments_ReplacesDocumentId",
                table: "BoatDocuments",
                column: "ReplacesDocumentId",
                principalTable: "BoatDocuments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_BoatDocuments_AspNetUsers_UploadedByUserId",
                table: "BoatDocuments");

            migrationBuilder.DropForeignKey(
                name: "FK_BoatDocuments_AspNetUsers_VerifiedByUserId",
                table: "BoatDocuments");

            migrationBuilder.DropForeignKey(
                name: "FK_BoatDocuments_BoatDocuments_ReplacesDocumentId",
                table: "BoatDocuments");

            migrationBuilder.DropIndex(
                name: "IX_BoatDocuments_BoatId_DocumentType_IsCurrent",
                table: "BoatDocuments");

            migrationBuilder.DropIndex(
                name: "IX_BoatDocuments_ExpirationDate",
                table: "BoatDocuments");

            migrationBuilder.DropIndex(
                name: "IX_BoatDocuments_ReplacesDocumentId",
                table: "BoatDocuments");

            migrationBuilder.DropIndex(
                name: "IX_BoatDocuments_Status",
                table: "BoatDocuments");

            migrationBuilder.DropIndex(
                name: "IX_BoatDocuments_UploadedByUserId",
                table: "BoatDocuments");

            migrationBuilder.DropIndex(
                name: "IX_BoatDocuments_VerifiedByUserId",
                table: "BoatDocuments");

            migrationBuilder.DropColumn(
                name: "DocumentRequirementsVersion",
                table: "Boats");

            migrationBuilder.DropColumn(
                name: "RegistrationSubmittedAtUtc",
                table: "Boats");

            migrationBuilder.DropColumn(
                name: "CreatedAtUtc",
                table: "BoatDocuments");

            migrationBuilder.DropColumn(
                name: "DocumentType",
                table: "BoatDocuments");

            migrationBuilder.DropColumn(
                name: "FileSize",
                table: "BoatDocuments");

            migrationBuilder.DropColumn(
                name: "IsCurrent",
                table: "BoatDocuments");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                table: "BoatDocuments");

            migrationBuilder.DropColumn(
                name: "ReplacesDocumentId",
                table: "BoatDocuments");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "BoatDocuments");

            migrationBuilder.DropColumn(
                name: "StoredFileName",
                table: "BoatDocuments");

            migrationBuilder.DropColumn(
                name: "UpdatedAtUtc",
                table: "BoatDocuments");

            migrationBuilder.DropColumn(
                name: "UploadedByUserId",
                table: "BoatDocuments");

            migrationBuilder.DropColumn(
                name: "VerifiedAtUtc",
                table: "BoatDocuments");

            migrationBuilder.DropColumn(
                name: "VerifiedByUserId",
                table: "BoatDocuments");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "BoatDocuments");
        }
    }
}
