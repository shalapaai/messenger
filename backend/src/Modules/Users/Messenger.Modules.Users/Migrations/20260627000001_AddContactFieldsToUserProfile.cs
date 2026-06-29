using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Messenger.Modules.Users.Migrations
{
    /// <inheritdoc />
    public partial class AddContactFieldsToUserProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "phone",
                schema: "users",
                table: "user_profile",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "city",
                schema: "users",
                table: "user_profile",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "department",
                schema: "users",
                table: "user_profile",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "phone",
                schema: "users",
                table: "user_profile");

            migrationBuilder.DropColumn(
                name: "city",
                schema: "users",
                table: "user_profile");

            migrationBuilder.DropColumn(
                name: "department",
                schema: "users",
                table: "user_profile");
        }
    }
}
