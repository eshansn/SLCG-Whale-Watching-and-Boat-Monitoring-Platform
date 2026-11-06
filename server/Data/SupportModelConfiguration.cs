using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Data;

public static class SupportModelConfiguration
{
    public static void Configure(ModelBuilder builder)
    {
        var request = builder.Entity<SupportRequest>();
        request.Property(x => x.FullName).HasMaxLength(160).IsRequired();
        request.Property(x => x.Email).HasMaxLength(256).IsRequired();
        request.Property(x => x.Portal).HasMaxLength(32).IsRequired();
        request.Property(x => x.Subject).HasMaxLength(160).IsRequired();
        request.Property(x => x.Category).HasMaxLength(40).IsRequired();
        request.Property(x => x.Message).HasMaxLength(4000).IsRequired();
        request.HasIndex(x => new { x.NotifiedAtUtc, x.NextNotificationAtUtc });
        request.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.SetNull);
    }
}
