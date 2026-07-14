using Microsoft.AspNetCore.Identity;
using WhaleWatching.Api.Auth.Dtos;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Auth;

public sealed class AuthService(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    IJwtTokenService jwtTokenService) : IAuthService
{
    public async Task<IdentityResult> RegisterPassengerAsync(
        RegisterRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var email = request.Email.Trim();
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            EmailConfirmed = false
        };

        var createResult = await userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            return createResult;
        }

        var roleResult = await userManager.AddToRoleAsync(user, PortalRoles.Passenger);
        if (!roleResult.Succeeded)
        {
            await userManager.DeleteAsync(user);
        }

        return roleResult;
    }

    public async Task<AuthResponse?> LoginAsync(
        LoginRequest request,
        string ipAddress,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var user = await userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null)
        {
            return null;
        }

        var signInResult = await signInManager.CheckPasswordSignInAsync(
            user, request.Password, lockoutOnFailure: true);

        return signInResult.Succeeded
            ? await jwtTokenService.CreateSessionAsync(user, ipAddress, cancellationToken)
            : null;
    }

    public Task<AuthResponse?> RefreshAsync(
        RefreshTokenRequest request,
        string ipAddress,
        CancellationToken cancellationToken = default) =>
        jwtTokenService.RotateRefreshTokenAsync(
            request.RefreshToken, ipAddress, cancellationToken);
}
