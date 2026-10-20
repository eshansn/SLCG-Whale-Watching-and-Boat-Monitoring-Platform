using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Data;

internal static class ComplaintModelConfiguration
{
    public static void Configure(ModelBuilder model)
    {
        var complaint = model.Entity<PassengerComplaint>();
        complaint.Property(x => x.Kind).HasMaxLength(16).HasDefaultValue("Complaint");
        complaint.Property(x => x.Version).IsConcurrencyToken();
        complaint.HasIndex(x => new { x.Status, x.CreatedAtUtc });
        model.Entity<PassengerProfile>().HasIndex(x => x.Name);
        model.Entity<PassengerProfile>().HasIndex(x => x.NormalizedPhoneNumber);
        var assignment = model.Entity<ComplaintAssignment>();
        assignment.Property(x => x.Note).HasMaxLength(2000);
        assignment.HasIndex(x => new { x.ComplaintId, x.AuthorityRoleId }).IsUnique();
        assignment.HasIndex(x => new { x.AuthorityRoleId, x.Status, x.ForwardedAtUtc });
        assignment.HasOne(x => x.Complaint).WithMany(x => x.Assignments).HasForeignKey(x => x.ComplaintId).OnDelete(DeleteBehavior.Restrict);
        assignment.HasOne(x => x.AuthorityRole).WithMany().HasForeignKey(x => x.AuthorityRoleId).OnDelete(DeleteBehavior.Restrict);
        assignment.HasOne(x => x.ForwardedByUser).WithMany().HasForeignKey(x => x.ForwardedByUserId).OnDelete(DeleteBehavior.Restrict);
        var entry = model.Entity<ComplaintEvent>();
        entry.Property(x => x.Action).HasMaxLength(40);
        entry.Property(x => x.Text).HasMaxLength(4000);
        entry.Property(x => x.RequestHash).HasMaxLength(64).IsFixedLength();
        entry.HasIndex(x => new { x.ComplaintId, x.CreatedAtUtc });
        entry.HasIndex(x => new { x.ComplaintId, x.ActorUserId, x.RequestId }).IsUnique().HasFilter("[RequestId] IS NOT NULL");
        entry.HasOne(x => x.Complaint).WithMany(x => x.Events).HasForeignKey(x => x.ComplaintId).OnDelete(DeleteBehavior.Restrict);
        entry.HasOne(x => x.Assignment).WithMany().HasForeignKey(x => x.AssignmentId).OnDelete(DeleteBehavior.Restrict);
        entry.HasOne(x => x.ActorUser).WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.Restrict);
        var notification = model.Entity<ComplaintNotification>();
        notification.HasIndex(x => new { x.EventId, x.RecipientUserId }).IsUnique();
        notification.HasIndex(x => new { x.RecipientUserId, x.ReadAtUtc, x.CreatedAtUtc });
        notification.HasOne(x => x.Event).WithMany().HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
        notification.HasOne(x => x.RecipientUser).WithMany().HasForeignKey(x => x.RecipientUserId).OnDelete(DeleteBehavior.Restrict);
    }
}
