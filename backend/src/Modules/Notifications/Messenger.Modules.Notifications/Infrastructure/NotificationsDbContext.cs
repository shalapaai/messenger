namespace Messenger.Modules.Notifications.Infrastructure;

using Messenger.Modules.Notifications.Domain;
using Microsoft.EntityFrameworkCore;

public sealed class NotificationsDbContext(DbContextOptions<NotificationsDbContext> options) : DbContext(options)
{
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("notifications");

        modelBuilder.Entity<PushSubscription>(b =>
        {
            b.HasKey(s => s.Id);
            b.Property(s => s.Id).HasColumnName("id").ValueGeneratedNever();
            b.Property(s => s.UserId).HasColumnName("user_id").IsRequired();
            b.Property(s => s.Endpoint).HasColumnName("endpoint").IsRequired();
            b.Property(s => s.P256dh).HasColumnName("p256dh").IsRequired();
            b.Property(s => s.Auth).HasColumnName("auth").IsRequired();
            b.Property(s => s.UserAgent).HasColumnName("user_agent");
            b.Property(s => s.CreatedAt).HasColumnName("created_at").IsRequired();
            b.Property(s => s.UpdatedAt).HasColumnName("updated_at").IsRequired();
            b.HasIndex(s => s.UserId).HasDatabaseName("idx_notifications_push_subscriptions_user_id");
            b.HasIndex(s => s.Endpoint).IsUnique().HasDatabaseName("ux_notifications_push_subscriptions_endpoint");
            b.ToTable("push_subscriptions");
        });
    }
}
