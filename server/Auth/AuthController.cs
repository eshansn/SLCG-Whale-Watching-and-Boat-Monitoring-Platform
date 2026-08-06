using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Auth.Dtos;

namespace WhaleWatching.Api.Auth;

[ApiController]
[Route("api/auth")]
[Authorize]
[EnableRateLimiting("auth")]
public sealed class AuthController(IAuthService authService, UserManager<ApplicationUser> userManager) : ControllerBase
{
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType<RegisterResponse>(StatusCodes.Status202Accepted)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register(
        RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var result = await authService.RegisterPublicPortalUserAsync(request, cancellationToken);
        if (!result.Succeeded)
        {
            if (result.Errors.Any(error =>
                    error.Code is "DuplicateEmail" or "DuplicateUserName"))
            {
                return Accepted(new RegisterResponse(
                    "Registration accepted. You can now sign in."));
            }

            foreach (var error in result.Errors)
            {
                ModelState.AddModelError(error.Code, error.Description);
            }

            return ValidationProblem(ModelState);
        }

        return Accepted(new RegisterResponse(
            "Registration accepted. You can now sign in."));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var response = await authService.LoginAsync(
            request, GetClientIp(), cancellationToken);

        return response is null
            ? Unauthorized(new { message = "Invalid credentials or account state." })
            : Ok(response);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh(
        RefreshTokenRequest request,
        CancellationToken cancellationToken)
    {
        var response = await authService.RefreshAsync(
            request, GetClientIp(), cancellationToken);

        return response is null
            ? Unauthorized(new { message = "Invalid refresh token." })
            : Ok(response);
    }

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
            return ValidationProblem("Current and new passwords are required.");
        if (request.CurrentPassword == request.NewPassword)
            return ValidationProblem("The new password must be different from the current password.");
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        var user = id is null ? null : await userManager.FindByIdAsync(id);
        if (user is null) return Unauthorized();
        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            foreach (var error in result.Errors) ModelState.AddModelError(error.Code, error.Description);
            return ValidationProblem(ModelState);
        }
        return Ok(new { message = "Password updated successfully." });
    }

    private string GetClientIp() =>
        HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
