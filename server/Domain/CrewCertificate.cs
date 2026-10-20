namespace WhaleWatching.Api.Domain;

public sealed class CrewCertificate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CrewUserId { get; set; }
    public ApplicationUser CrewUser { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public byte[] Content { get; set; } = [];
    public DateTimeOffset UploadedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
