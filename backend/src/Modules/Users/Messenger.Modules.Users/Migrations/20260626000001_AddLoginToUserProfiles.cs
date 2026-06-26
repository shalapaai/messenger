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
                name: "Login",
                schema: "users",
                table: "user_profiles",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_user_profiles_login",
                schema: "users",
                table: "user_profiles",
                column: "Login",
                unique: true,
                filter: "\"Login\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_user_profiles_login",
                schema: "users",
                table: "user_profiles");

            migrationBuilder.DropColumn(
                name: "Login",
                schema: "users",
                table: "user_profiles");
        }
    }
}
