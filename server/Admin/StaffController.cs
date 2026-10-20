using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Admin;

[ApiController]
[Route("api/admin/staff")]
[Authorize(Roles = $"{PortalRoles.Admin},{PortalRoles.Wildlife}")]
public sealed class StaffController(UserManager<ApplicationUser> users) : ControllerBase
{
    internal static readonly string[] StaffRoles =
    [
        PortalRoles.Admin, PortalRoles.Sltda, PortalRoles.Ops, PortalRoles.ShoreCrew, PortalRoles.Wildlife,
        PortalRoles.ShoreWildlife, PortalRoles.Supervisor, PortalRoles.HarbourOfficer
    ];
    internal static readonly string[] WildlifeManagedRoles =
        [PortalRoles.Supervisor, PortalRoles.HarbourOfficer];

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StaffDto>>> List(CancellationToken ct)
    {
        var permittedRoles = PermittedRoles;
        var records = await users.Users.AsNoTracking().OrderBy(x => x.DisplayName).ToListAsync(ct);
        var result = new List<StaffDto>();
        foreach (var user in records)
        {
            var role = (await users.GetRolesAsync(user)).FirstOrDefault(permittedRoles.Contains);
            if (role is not null) result.Add(ToDto(user, role));
        }
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<StaffDto>> Create(CreateStaffRequest request)
    {
        if (!PermittedRoles.Contains(request.Role)) return Forbid();
        var email = request.Email.Trim();
        var userName = string.IsNullOrWhiteSpace(request.UserName) ? email : request.UserName.Trim();
        if (await users.FindByEmailAsync(email) is not null)
            return Conflict(new { message = "That email is already registered." });
        if (await users.FindByNameAsync(userName) is not null)
            return Conflict(new { message = "That username is already registered." });
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = userName, Email = email, EmailConfirmed = true,
            DisplayName = request.DisplayName.Trim(), PhoneNumber = request.PhoneNumber?.Trim(),
            LockoutEnabled = true
        };
        var created = await users.CreateAsync(user, request.Password);
        if (!created.Succeeded) return IdentityValidation(created);
        var assigned = await users.AddToRoleAsync(user, request.Role);
        if (!assigned.Succeeded)
        {
            await users.DeleteAsync(user);
            return IdentityValidation(assigned);
        }
        return CreatedAtAction(nameof(Get), new { id = user.Id }, ToDto(user, request.Role));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<StaffDto>> Get(Guid id)
    {
        var user = await users.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();
        var role = (await users.GetRolesAsync(user)).FirstOrDefault(PermittedRoles.Contains);
        return role is null ? NotFound() : Ok(ToDto(user, role));
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<StaffDto>> Update(Guid id, UpdateStaffRequest request)
    {
        if (!PermittedRoles.Contains(request.Role)) return Forbid();
        var user = await users.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();
        var currentStaffRoles = (await users.GetRolesAsync(user)).Where(StaffRoles.Contains).ToArray();
        if (!User.IsInRole(PortalRoles.Admin) && currentStaffRoles.Any(x => !WildlifeManagedRoles.Contains(x)))
            return Forbid();

        var email = request.Email.Trim();
        var userName = string.IsNullOrWhiteSpace(request.UserName) ? email : request.UserName.Trim();
        var emailOwner = await users.FindByEmailAsync(email);
        if (emailOwner is not null && emailOwner.Id != id)
            return Conflict(new { message = "That email is already registered." });
        var userNameOwner = await users.FindByNameAsync(userName);
        if (userNameOwner is not null && userNameOwner.Id != id)
            return Conflict(new { message = "That username is already registered." });

        user.DisplayName = request.DisplayName.Trim();
        user.PhoneNumber = request.PhoneNumber?.Trim();
        user.Email = email;
        user.NormalizedEmail = users.NormalizeEmail(email);
        user.UserName = userName;
        user.NormalizedUserName = users.NormalizeName(userName);
        user.EmailConfirmed = true;
        user.LockoutEnabled = true;
        user.LockoutEnd = request.IsActive ? null : DateTimeOffset.MaxValue;
        var updated = await users.UpdateAsync(user);
        if (!updated.Succeeded) return IdentityValidation(updated);
        if (currentStaffRoles.Length > 0)
        {
            var removed = await users.RemoveFromRolesAsync(user, currentStaffRoles);
            if (!removed.Succeeded) return IdentityValidation(removed);
        }
        var assigned = await users.AddToRoleAsync(user, request.Role);
        if (!assigned.Succeeded) return IdentityValidation(assigned);
        await users.UpdateSecurityStampAsync(user);
        return Ok(ToDto(user, request.Role));
    }

    [HttpPost("{id:guid}/reset-password")]
    public async Task<IActionResult> ResetPassword(Guid id, ResetStaffPasswordRequest request)
    {
        var user = await users.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();
        var role = (await users.GetRolesAsync(user)).FirstOrDefault(PermittedRoles.Contains);
        if (role is null) return Forbid();
        var token = await users.GeneratePasswordResetTokenAsync(user);
        var result = await users.ResetPasswordAsync(user, token, request.TemporaryPassword);
        return result.Succeeded ? Ok(new { message = "Temporary password set successfully." }) : IdentityValidation(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var currentId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
        if (id == currentId) return Conflict(new { message = "You cannot delete your own active account." });
        var user = await users.FindByIdAsync(id.ToString());
        if (user is null) return NotFound();
        var role = (await users.GetRolesAsync(user)).FirstOrDefault(PermittedRoles.Contains);
        if (role is null) return Forbid();
        var result = await users.DeleteAsync(user);
        return result.Succeeded ? NoContent() : IdentityValidation(result);
    }

    private string[] PermittedRoles => User.IsInRole(PortalRoles.Admin) ? StaffRoles : WildlifeManagedRoles;

    private BadRequestObjectResult IdentityValidation(IdentityResult result) =>
        BadRequest(new { message = string.Join(" ", result.Errors.Select(x => x.Description)) });

    private static StaffDto ToDto(ApplicationUser user, string role) =>
        new(user.Id, user.DisplayName, user.UserName ?? user.Email ?? string.Empty, role,
            user.PhoneNumber, user.Email ?? string.Empty,
            user.LockoutEnd is null || user.LockoutEnd <= DateTimeOffset.UtcNow);
}

public sealed record StaffDto(Guid Id, string DisplayName, string UserName, string Role,
    string? PhoneNumber, string Email, bool IsActive);
public sealed record CreateStaffRequest(
    [Required, StringLength(160, MinimumLength = 1)] string DisplayName,
    [StringLength(256, MinimumLength = 1)] string? UserName,
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(32)] string Role,
    [Required, MinLength(12)] string Password,
    [StringLength(32)] string? PhoneNumber);
public sealed record UpdateStaffRequest(
    [Required, StringLength(160, MinimumLength = 1)] string DisplayName,
    [StringLength(256, MinimumLength = 1)] string? UserName,
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(32)] string Role,
    [StringLength(32)] string? PhoneNumber,
    bool IsActive);
public sealed record ResetStaffPasswordRequest([Required, MinLength(12)] string TemporaryPassword);
