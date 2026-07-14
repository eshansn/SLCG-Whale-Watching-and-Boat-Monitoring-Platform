using Microsoft.AspNetCore.Identity;
using WhaleWatching.Api.Auth.Dtos;

namespace WhaleWatching.Api.Auth;

public interface IAuthService
{
    Task<IdentityResult> RegisterPassengerAsync(
        RegisterRequest request,
        CancellationToken cancellationToken = default);

    Task<AuthResponse?> LoginAsync(
        LoginRequest request,
        string ipAddress,
        CancellationToken cancellationToken = default);

    Task<AuthResponse?> RefreshAsync(
        RefreshTokenRequest request,
        string ipAddress,
        CancellationToken cancellationToken = default);
}
