using Microsoft.AspNetCore.Identity;

namespace WhaleWatching.Api.Domain;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
}
