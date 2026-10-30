using Microsoft.AspNetCore.Identity;

namespace WhaleWatching.Api.Domain;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = string.Empty;
    public DateTimeOffset? PasswordResetAtUtc { get; set; }
    public string? NicNumber { get; set; }
    public byte[]? ProfilePhoto { get; set; }
    public string? ProfilePhotoContentType { get; set; }
    public string? Bio { get; set; }
    public bool IsCrewCertified { get; set; }
    public string? CrewType { get; set; }
    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
    public ICollection<Boat> OwnedBoats { get; set; } = [];
    public ICollection<CrewAssignment> CrewAssignments { get; set; } = [];
    public ICollection<OwnerCrewMembership> CrewMemberships { get; set; } = [];
    public ICollection<TripCrewAssignment> TripAssignments { get; set; } = [];
}
