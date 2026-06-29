namespace Messenger.Modules.Users.Infrastructure.Persistence.Configurations;

using Messenger.Modules.Users.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public sealed class UserProfileConfiguration : IEntityTypeConfiguration<UserProfile>
{
    public void Configure(EntityTypeBuilder<UserProfile> b)
    {
        b.HasKey(p => p.Id);
        b.Property(p => p.Id).HasColumnName("id");
        b.Property(p => p.AuthUserId).HasColumnName("auth_user_id").IsRequired();
        b.Property(p => p.Email).HasColumnName("email").HasMaxLength(255).IsRequired();
        b.Property(p => p.DisplayName).HasColumnName("display_name").HasMaxLength(100).IsRequired();
        b.Property(p => p.Login).HasColumnName("login").HasMaxLength(30);
        b.Property(p => p.Status).HasColumnName("status").HasMaxLength(200);
        b.Property(p => p.AvatarUrl).HasColumnName("avatar_url").HasMaxLength(2048);
        b.Property(p => p.CreatedAt).HasColumnName("created_at").IsRequired();
        b.Property(p => p.UpdatedAt).HasColumnName("updated_at");

        b.HasIndex(p => p.AuthUserId).IsUnique().HasDatabaseName("ix_user_profile_auth_user_id");
        b.HasIndex(p => p.Email).IsUnique().HasDatabaseName("ix_user_profile_email");
        b.HasIndex(p => p.Login).IsUnique().HasDatabaseName("ix_user_profile_login")
            .HasFilter("login IS NOT NULL");

        b.ToTable("user_profile");
    }
}
