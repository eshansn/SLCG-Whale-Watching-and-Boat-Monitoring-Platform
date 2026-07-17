using Microsoft.AspNetCore.Identity;

namespace WhaleWatching.Api.Domain;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = string.Empty;
    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
    public ICollection<Boat> OwnedBoats { get; set; } = [];
    public ICollection<CrewAssignment> CrewAssignments { get; set; } = [];
}
