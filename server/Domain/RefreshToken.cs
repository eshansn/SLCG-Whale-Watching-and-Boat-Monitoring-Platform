namespace WhaleWatching.Api.Domain;

public sealed class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public required string TokenHash { get; set; }
    public Guid FamilyId { get; set; }
    public required string SecurityStamp { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public DateTimeOffset? RevokedAtUtc { get; set; }
    public Guid? ReplacedByTokenId { get; set; }
    public required string CreatedByIp { get; set; }
    public string? RevokedByIp { get; set; }
    public string? RevocationReason { get; set; }
    public byte[] RowVersion { get; set; } = [];

    public ApplicationUser User { get; set; } = null!;

    public bool IsActive(DateTimeOffset now) =>
        RevokedAtUtc is null && ExpiresAtUtc > now;
}
