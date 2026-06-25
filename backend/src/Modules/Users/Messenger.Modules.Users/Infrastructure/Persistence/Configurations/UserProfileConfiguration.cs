namespace Messenger.Modules.Users.Infrastructure.Persistence.Configurations;

using Messenger.Modules.Users.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

public sealed class UserProfileConfiguration : IEntityTypeConfiguration<UserProfile>
{
    public void Configure(EntityTypeBuilder<UserProfile> b)
    {
        b.HasKey(p => p.Id);
        b.Property(p => p.AuthUserId).IsRequired();
        b.Property(p => p.Username).HasMaxLength(30).IsRequired();
        b.Property(p => p.DisplayName).HasMaxLength(100).IsRequired();
        b.Property(p => p.Status).HasMaxLength(200);
        b.Property(p => p.AvatarUrl).HasMaxLength(2048);
        b.Property(p => p.CreatedAt).IsRequired();
        b.Property(p => p.UpdatedAt);

        b.HasIndex(p => p.AuthUserId).IsUnique().HasDatabaseName("ix_user_profiles_auth_user_id");
        b.HasIndex(p => p.Username).IsUnique().HasDatabaseName("ix_user_profiles_username");

        b.ToTable("user_profiles");
    }
}
