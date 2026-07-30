using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Profiles;

[ApiController]
[Route("api/crew/profile")]
[Authorize(Policy = PortalPolicies.BoatCrew)]
public sealed class CrewProfileController(UserManager<ApplicationUser> userManager) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CrewProfileDto>> Get() => await UserRecord() is { } user ? Ok(ToDto(user)) : NotFound();

    [HttpPatch]
    public async Task<ActionResult<CrewProfileDto>> Update(UpdateCrewProfileRequest request)
    {
        var user = await UserRecord(); if (user is null) return NotFound();
        var email = request.Email.Trim();
        if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            var result = await userManager.SetEmailAsync(user, email); if (!result.Succeeded) return IdentityProblem(result);
            user.EmailConfirmed = true;
        }
        var phone = await userManager.SetPhoneNumberAsync(user, request.PhoneNumber.Trim()); if (!phone.Succeeded) return IdentityProblem(phone);
        user.Bio = string.IsNullOrWhiteSpace(request.Bio) ? null : request.Bio.Trim();
        var updated = await userManager.UpdateAsync(user); return updated.Succeeded ? Ok(ToDto(user)) : IdentityProblem(updated);
    }

    [HttpGet("photo")]
    public async Task<IActionResult> Photo()
    {
        var user = await UserRecord();
        return user?.ProfilePhoto is { Length: > 0 } ? File(user.ProfilePhoto, user.ProfilePhotoContentType ?? "image/jpeg") : NotFound();
    }

    [HttpPost("photo")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<ActionResult<CrewProfileDto>> Upload([FromForm] IFormFile photo)
    {
        if (photo.Length is 0 or > 5 * 1024 * 1024 || !new[] { "image/jpeg", "image/png", "image/webp" }.Contains(photo.ContentType, StringComparer.OrdinalIgnoreCase))
            return ValidationProblem("Profile picture must be a JPEG, PNG, or WebP file up to 5 MB.");
        var user = await UserRecord(); if (user is null) return NotFound();
        await using var stream = new MemoryStream(); await photo.CopyToAsync(stream, HttpContext.RequestAborted);
        user.ProfilePhoto = stream.ToArray(); user.ProfilePhotoContentType = photo.ContentType;
        var result = await userManager.UpdateAsync(user); return result.Succeeded ? Ok(ToDto(user)) : IdentityProblem(result);
    }

    private async Task<ApplicationUser?> UserRecord() => await userManager.FindByIdAsync(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
    private static CrewProfileDto ToDto(ApplicationUser u) => new(u.Id, u.UserName!, u.DisplayName, u.NicNumber ?? "", u.Email ?? "", u.PhoneNumber ?? "", u.CrewType ?? "Crew Member", u.IsCrewCertified, u.ProfilePhoto is { Length: > 0 }, u.Bio);
    private ActionResult IdentityProblem(IdentityResult result) { foreach (var e in result.Errors) ModelState.AddModelError(e.Code, e.Description); return ValidationProblem(ModelState); }
}
public sealed record CrewProfileDto(Guid Id,string UserName,string DisplayName,string NicNumber,string Email,string PhoneNumber,string Position,bool Certified,bool HasProfilePhoto,string? Bio);
public sealed class UpdateCrewProfileRequest { [Required,EmailAddress,MaxLength(256)] public required string Email { get; init; } [Required,Phone,MaxLength(32)] public required string PhoneNumber { get; init; } [MaxLength(1000)] public string? Bio { get; init; } }
