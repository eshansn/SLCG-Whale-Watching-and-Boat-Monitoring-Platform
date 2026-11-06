using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Auth.Dtos;
using System.Text.Json.Serialization;

namespace WhaleWatching.Api.Auth;

[ApiController]
[Route("api/auth")]
[Authorize]
[EnableRateLimiting("auth")]
public sealed class AuthController(IAuthService authService, UserManager<ApplicationUser> userManager) : ControllerBase
{
    [HttpPost("register")]
    [Consumes("application/json")]
    [AllowAnonymous]
    [ProducesResponseType<RegisterResponse>(StatusCodes.Status202Accepted)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register(
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var result = await authService.RegisterPublicPortalUserAsync(request, cancellationToken);
        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                ModelState.AddModelError(error.Code, error.Description);
            }

            return ValidationProblem(ModelState);
        }

        return Accepted(new RegisterResponse(
            "Registration accepted. You can now sign in."));
    }

    [HttpPost("register")]
    [Consumes("multipart/form-data")]
    [AllowAnonymous]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 6 * 1024 * 1024)]
    public Task<IActionResult> RegisterWithCertificate([FromForm] RegisterRequest request, CancellationToken ct) =>
        Register(request, ct);

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

    [HttpDelete("account")]
    public async Task<IActionResult> DeleteAccount(DeleteAccountRequest request,
        [FromServices] AccountDeletionService deletion, [FromServices] AccountSessionRegistry sessions, CancellationToken ct)
    {
        if (!string.Equals(request.Confirmation, "confirm", StringComparison.Ordinal))
            return BadRequest(new { message = "Type exactly confirm, without spaces, to delete your account." });
        if (!Guid.TryParse(User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Unauthorized();
        var conflict = await deletion.DeleteAsync(userId, ct);
        if (conflict is not null) return Conflict(new { message = conflict });
        sessions.Revoke(userId);
        return Ok(new { message = "Your account has been permanently deleted." });
    }
}

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record DeleteAccountRequest(string? Confirmation);
