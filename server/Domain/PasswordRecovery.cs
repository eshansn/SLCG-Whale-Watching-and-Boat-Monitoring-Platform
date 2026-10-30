namespace WhaleWatching.Api.Domain;

public sealed class PasswordRecovery
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string AccountKey { get; set; } = "";
    public string AccountStateHash { get; set; } = "";
    public Guid CodeVersion { get; set; }
    public string CodeHash { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset CodeIssuedAt { get; set; }
    public DateTimeOffset CodeExpiresAt { get; set; }
    public int FailedAttempts { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }
    public string? AuthorizationHash { get; set; }
    public DateTimeOffset? AuthorizationExpiresAt { get; set; }
    public DateTimeOffset? ConsumedAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
}

// A transactional outbox, not an external queue. Only Data Protection ciphertext is persisted.
public sealed class PasswordRecoveryDelivery
{
    public Guid Id { get; set; }
    public Guid RecoveryId { get; set; }
    public PasswordRecovery Recovery { get; set; } = null!;
    public string AccountKey { get; set; } = "";
    public Guid CodeVersion { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public string? ProtectedCode { get; set; }
    public DateTimeOffset NextAttemptAt { get; set; }
    public Guid? LeaseId { get; set; }
    public DateTimeOffset? LeaseUntil { get; set; }
    public int Attempts { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public bool Delivered { get; set; }
}

public sealed class PasswordRecoveryRateWindow
{
    public string Id { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public int Requests { get; set; }
}
