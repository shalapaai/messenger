using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Messenger.Modules.Users.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(name: "users");

            migrationBuilder.CreateTable(
                name: "user_profiles",
                schema: "users",
                columns: table => new
                {
                    Id          = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthUserId  = table.Column<Guid>(type: "uuid", nullable: false),
                    Email       = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Status      = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    AvatarUrl   = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    CreatedAt   = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt   = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_profiles", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_user_profiles_auth_user_id",
                schema: "users",
                table: "user_profiles",
                column: "AuthUserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_user_profiles_email",
                schema: "users",
                table: "user_profiles",
                column: "Email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "user_profiles", schema: "users");
        }
    }
}
