namespace WhaleWatching.Api.Domain;

public sealed class SupportRequest
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Portal { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Category { get; set; } = "";
    public string Message { get; set; } = "";
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? NotifiedAtUtc { get; set; }
    public int NotificationAttempts { get; set; }
    public DateTimeOffset NextNotificationAtUtc { get; set; }
    public Guid? NotificationLeaseId { get; set; }
    public DateTimeOffset? NotificationLeaseUntilUtc { get; set; }
}
