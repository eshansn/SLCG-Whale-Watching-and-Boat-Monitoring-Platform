using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Profiles;

[ApiController]
[Route("api/crew/profile")]
[Authorize(Policy = PortalPolicies.BoatCrew)]
public sealed class CrewProfileController(UserManager<ApplicationUser> userManager, WhaleWatchingDbContext db) : ControllerBase
{
    public static readonly string[] Positions = ["Crew Member", "Captain", "Coxswain", "Life Saver", "Deck Hand", "Diver", "First Aid Officer"];
    [HttpGet]
    public async Task<ActionResult<CrewProfileDto>> Get() => await UserRecord() is { } user ? Ok(ToDto(user)) : NotFound();

    [HttpPatch]
    public async Task<ActionResult<CrewProfileDto>> Update(UpdateCrewProfileRequest request)
    {
        var user = await UserRecord(); if (user is null) return NotFound();
        var position = request.Position?.Trim();
        if (position is not null && !Positions.Contains(position))
            return ValidationProblem("Select a valid crew role.");
        var email = request.Email.Trim();
        if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            var result = await userManager.SetEmailAsync(user, email); if (!result.Succeeded) return IdentityProblem(result);
            user.EmailConfirmed = true;
        }
        var phone = await userManager.SetPhoneNumberAsync(user, request.PhoneNumber.Trim()); if (!phone.Succeeded) return IdentityProblem(phone);
        user.Bio = string.IsNullOrWhiteSpace(request.Bio) ? null : request.Bio.Trim();
        if (request.DisplayName is not null) user.DisplayName = request.DisplayName.Trim();
        if (position is not null && position != (user.CrewType ?? "Crew Member"))
        {
            user.CrewType = position;
            user.IsCrewCertified = false;
        }
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

    [HttpGet("certificates")]
    public async Task<IActionResult> Certificates(CancellationToken ct)
    {
        var user = await UserRecord(); if (user is null) return NotFound();
        return Ok(await db.CrewCertificates.AsNoTracking().Where(x => x.CrewUserId == user.Id)
            .OrderByDescending(x => x.UploadedAtUtc)
            .Select(x => new CrewCertificateDto(x.Id, x.Name, x.ContentType, x.UploadedAtUtc)).ToListAsync(ct));
    }

    [HttpPost("certificates")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> UploadCertificate([FromForm] IFormFile certificate, CancellationToken ct)
    {
        if (certificate.Length is 0 or > 5 * 1024 * 1024)
            return ValidationProblem("Certificate must be between 1 byte and 5 MB.");
        var type = certificate.ContentType.ToLowerInvariant();
        if (!new[] { "application/pdf", "image/jpeg", "image/png", "image/webp" }.Contains(type))
            return ValidationProblem("Certificate must be a PDF, JPEG, PNG, or WebP file.");
        var name = Path.GetFileName(certificate.FileName.Replace('\\', '/'));
        if (string.IsNullOrWhiteSpace(name) || name.Length > 255)
            return ValidationProblem("Certificate filename must contain between 1 and 255 characters.");
        var user = await UserRecord(); if (user is null) return NotFound();
        await using var stream = new MemoryStream();
        await certificate.CopyToAsync(stream, ct);
        var bytes = stream.ToArray();
        if (!HasCertificateSignature(bytes, type)) return ValidationProblem("The certificate content does not match its file type.");
        var document = new CrewCertificate { CrewUserId = user.Id, Name = name, ContentType = type, Content = bytes };
        db.CrewCertificates.Add(document);
        await db.SaveChangesAsync(ct);
        return Ok(new CrewCertificateDto(document.Id, document.Name, document.ContentType, document.UploadedAtUtc));
    }

    [HttpGet("certificates/{id:guid}")]
    public async Task<IActionResult> DownloadCertificate(Guid id, CancellationToken ct)
    {
        var user = await UserRecord(); if (user is null) return NotFound();
        var document = await db.CrewCertificates.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.CrewUserId == user.Id, ct);
        return document is null ? NotFound() : File(document.Content, document.ContentType, document.Name);
    }

    public static bool HasCertificateSignature(byte[] bytes, string type) => type switch
    {
        "application/pdf" => bytes.AsSpan().StartsWith("%PDF-"u8),
        "image/jpeg" => bytes.AsSpan().StartsWith(new byte[] { 0xff, 0xd8, 0xff }),
        "image/png" => bytes.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
        "image/webp" => bytes.Length >= 12 && bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) && bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8),
        _ => false
    };
    private static CrewProfileDto ToDto(ApplicationUser u) => new(u.Id, u.UserName!, u.DisplayName, u.NicNumber ?? "", u.Email ?? "", u.PhoneNumber ?? "", u.CrewType ?? "Crew Member", u.IsCrewCertified, u.ProfilePhoto is { Length: > 0 }, u.Bio);
    private ActionResult IdentityProblem(IdentityResult result) { foreach (var e in result.Errors) ModelState.AddModelError(e.Code, e.Description); return ValidationProblem(ModelState); }
}
public sealed record CrewProfileDto(Guid Id,string UserName,string DisplayName,string NicNumber,string Email,string PhoneNumber,string Position,bool Certified,bool HasProfilePhoto,string? Bio);
public sealed class UpdateCrewProfileRequest { [Required,EmailAddress,MaxLength(256)] public required string Email { get; init; } [Required,Phone,MaxLength(32)] public required string PhoneNumber { get; init; } [MaxLength(1000)] public string? Bio { get; init; } [StringLength(160, MinimumLength = 1), RegularExpression(@".*\S.*")] public string? DisplayName { get; init; } [MaxLength(100)] public string? Position { get; init; } }
public sealed record CrewCertificateDto(Guid Id, string Name, string ContentType, DateTimeOffset UploadedAtUtc);
