using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Messenger.Modules.Users.Migrations
{
    /// <inheritdoc />
    public partial class AddAvatarColorToUserProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "avatar_color",
                schema: "users",
                table: "user_profile",
                type: "character varying(7)",
                maxLength: 7,
                nullable: false,
                defaultValue: "#2C5BF0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "avatar_color",
                schema: "users",
                table: "user_profile");
        }
    }
}
