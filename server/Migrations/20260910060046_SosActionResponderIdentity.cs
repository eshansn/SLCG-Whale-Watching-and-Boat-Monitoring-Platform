using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhaleWatching.Api.Migrations
{
    /// <inheritdoc />
    public partial class SosActionResponderIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ResponderIdNumber",
                table: "SosActions",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ResponderName",
                table: "SosActions",
                type: "nvarchar(160)",
                maxLength: 160,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql(
                """
                UPDATE [action]
                SET [ResponderName] = COALESCE(NULLIF([user].[DisplayName], ''), 'Unknown'),
                    [ResponderIdNumber] = COALESCE(NULLIF([user].[NicNumber], ''), 'Not recorded')
                FROM [SosActions] AS [action]
                INNER JOIN [AspNetUsers] AS [user] ON [user].[Id] = [action].[TakenByUserId];
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResponderIdNumber",
                table: "SosActions");

            migrationBuilder.DropColumn(
                name: "ResponderName",
                table: "SosActions");
        }
    }
}
