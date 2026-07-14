using WhaleWatching.Api.Auth.Dtos;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Auth;

public interface IJwtTokenService
{
    Task<AuthResponse> CreateSessionAsync(
        ApplicationUser user,
        string ipAddress,
        CancellationToken cancellationToken = default);

    Task<AuthResponse?> RotateRefreshTokenAsync(
        string rawRefreshToken,
        string ipAddress,
        CancellationToken cancellationToken = default);
}
