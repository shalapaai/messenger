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
                name: "user_profile",
                schema: "users",
                columns: table => new
                {
                    id           = table.Column<Guid>(type: "uuid", nullable: false),
                    auth_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    email        = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    display_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    status       = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    avatar_url   = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    created_at   = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at   = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_profile", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_user_profile_auth_user_id",
                schema: "users",
                table: "user_profile",
                column: "auth_user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_user_profile_email",
                schema: "users",
                table: "user_profile",
                column: "email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "user_profile", schema: "users");
        }
    }
}
