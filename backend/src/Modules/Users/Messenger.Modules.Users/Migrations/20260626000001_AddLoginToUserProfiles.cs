using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Messenger.Modules.Users.Migrations
{
    /// <inheritdoc />
    public partial class AddLoginToUserProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "login",
                schema: "users",
                table: "user_profile",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_user_profile_login",
                schema: "users",
                table: "user_profile",
                column: "login",
                unique: true,
                filter: "login IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_user_profile_login",
                schema: "users",
                table: "user_profile");

            migrationBuilder.DropColumn(
                name: "login",
                schema: "users",
                table: "user_profile");
        }
    }
}
