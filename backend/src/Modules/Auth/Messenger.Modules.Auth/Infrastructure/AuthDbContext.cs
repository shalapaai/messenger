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
            b.Property(u => u.Id).HasColumnName("id");
            b.Property(u => u.Email).HasColumnName("email").HasMaxLength(255).IsRequired();
            b.Property(u => u.PasswordHash).HasColumnName("password_hash").HasMaxLength(512).IsRequired();
            b.Property(u => u.IsEmailVerified).HasColumnName("is_email_verified");
            b.Property(u => u.CreatedAt).HasColumnName("created_at");
            b.HasIndex(u => u.Email).IsUnique().HasDatabaseName("ix_user_email");
            b.ToTable("user");
        });

        modelBuilder.Entity<RefreshToken>(b =>
        {
            b.HasKey(t => t.Id);
            b.Property(t => t.Id).HasColumnName("id");
            b.Property(t => t.UserId).HasColumnName("user_id").IsRequired();
            b.Property(t => t.Token).HasColumnName("token").HasMaxLength(256).IsRequired();
            b.Property(t => t.ExpiresAt).HasColumnName("expires_at");
            b.Property(t => t.CreatedAt).HasColumnName("created_at");
            b.Property(t => t.IsRevoked).HasColumnName("is_revoked");
            b.HasIndex(t => t.Token).IsUnique().HasDatabaseName("ix_refresh_token_token");
            b.HasIndex(t => t.UserId).HasDatabaseName("ix_refresh_token_user_id");
            b.HasOne<UserAuth>()
                .WithMany()
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            b.ToTable("refresh_token");
        });
    }
}
