using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Messenger.Modules.Auth.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(name: "auth");

            migrationBuilder.CreateTable(
                name: "users",
                schema: "auth",
                columns: table => new
                {
                    Id            = table.Column<Guid>(type: "uuid", nullable: false),
                    Email         = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    PasswordHash  = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    IsEmailVerified = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    CreatedAt     = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "refresh_tokens",
                schema: "auth",
                columns: table => new
                {
                    Id        = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId    = table.Column<Guid>(type: "uuid", nullable: false),
                    Token     = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsRevoked = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refresh_tokens", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_users_email",
                schema: "auth",
                table: "users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_refresh_tokens_token",
                schema: "auth",
                table: "refresh_tokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_refresh_tokens_user_id",
                schema: "auth",
                table: "refresh_tokens",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "refresh_tokens", schema: "auth");
            migrationBuilder.DropTable(name: "users", schema: "auth");
        }
    }
}
