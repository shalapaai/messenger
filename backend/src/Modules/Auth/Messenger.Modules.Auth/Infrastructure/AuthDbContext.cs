namespace Messenger.Modules.Auth.Infrastructure;

using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Modules.Auth.Domain;
using Microsoft.EntityFrameworkCore;

public sealed class AuthDbContext(DbContextOptions<AuthDbContext> options)
    : DbContext(options), IUnitOfWork
{
    public DbSet<UserAuth>     Users         => Set<UserAuth>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("auth");

        modelBuilder.Entity<UserAuth>(b =>
        {
            b.HasKey(u => u.Id);
            b.Property(u => u.Email).HasMaxLength(255).IsRequired();
            b.Property(u => u.PasswordHash).HasMaxLength(512).IsRequired();
            b.HasIndex(u => u.Email).IsUnique().HasDatabaseName("ix_users_email");
            b.ToTable("users");
        });

        modelBuilder.Entity<RefreshToken>(b =>
        {
            b.HasKey(t => t.Id);
            b.Property(t => t.Token).HasMaxLength(256).IsRequired();
            b.Property(t => t.UserId).IsRequired();
            b.HasIndex(t => t.Token).IsUnique().HasDatabaseName("ix_refresh_tokens_token");
            b.HasIndex(t => t.UserId).HasDatabaseName("ix_refresh_tokens_user_id");
            b.ToTable("refresh_tokens");
        });
    }
}
