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
[Authorize(Roles = PortalRoles.Admin)]
public sealed class StaffController(UserManager<ApplicationUser> users) : ControllerBase
{
    private static readonly string[] StaffRoles =
        [PortalRoles.Admin, PortalRoles.Ops, PortalRoles.ShoreCrew, PortalRoles.Wildlife, PortalRoles.ShoreWildlife];

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StaffDto>>> List(CancellationToken ct)
    {
        var records = await users.Users.AsNoTracking().OrderBy(x => x.DisplayName).ToListAsync(ct);
        var result = new List<StaffDto>();
        foreach (var user in records)
        {
            var roles = await users.GetRolesAsync(user);
            var role = roles.FirstOrDefault(StaffRoles.Contains);
            if (role is not null) result.Add(ToDto(user, role));
        }
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<StaffDto>> Create(CreateStaffRequest request)
    {
        if (!StaffRoles.Contains(request.Role)) return ValidationProblem("Invalid staff role.");
        var email = request.Email.Trim();
        if (await users.FindByEmailAsync(email) is not null) return Conflict(new { message = "That email is already registered." });
        var user = new ApplicationUser { Id = Guid.NewGuid(), UserName = email, Email = email,
            EmailConfirmed = true, DisplayName = request.DisplayName.Trim(), PhoneNumber = request.PhoneNumber?.Trim() };
        var created = await users.CreateAsync(user, request.Password);
        if (!created.Succeeded) return ValidationProblem(string.Join(" ", created.Errors.Select(x => x.Description)));
        var assigned = await users.AddToRoleAsync(user, request.Role);
        if (!assigned.Succeeded) { await users.DeleteAsync(user); return ValidationProblem(string.Join(" ", assigned.Errors.Select(x => x.Description))); }
        return CreatedAtAction(nameof(Get), new { id = user.Id }, ToDto(user, request.Role));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<StaffDto>> Get(Guid id)
    {
        var user = await users.FindByIdAsync(id.ToString()); if (user is null) return NotFound();
        var role = (await users.GetRolesAsync(user)).FirstOrDefault(StaffRoles.Contains);
        return role is null ? NotFound() : Ok(ToDto(user, role));
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<StaffDto>> Update(Guid id, UpdateStaffRequest request)
    {
        if (!StaffRoles.Contains(request.Role)) return ValidationProblem("Invalid staff role.");
        var user = await users.FindByIdAsync(id.ToString()); if (user is null) return NotFound();
        var current = (await users.GetRolesAsync(user)).Where(StaffRoles.Contains).ToArray();
        if (current.Length > 0) { var removed = await users.RemoveFromRolesAsync(user, current); if (!removed.Succeeded) return ValidationProblem(string.Join(" ", removed.Errors.Select(x => x.Description))); }
        var assigned = await users.AddToRoleAsync(user, request.Role);
        if (!assigned.Succeeded) return ValidationProblem(string.Join(" ", assigned.Errors.Select(x => x.Description)));
        return Ok(ToDto(user, request.Role));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var currentId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")!);
        if (id == currentId) return Conflict(new { message = "You cannot delete your own active account." });
        var user = await users.FindByIdAsync(id.ToString()); if (user is null) return NotFound();
        var result = await users.DeleteAsync(user);
        return result.Succeeded ? NoContent() : ValidationProblem(string.Join(" ", result.Errors.Select(x => x.Description)));
    }

    private static StaffDto ToDto(ApplicationUser user, string role) =>
        new(user.Id, user.DisplayName, role, user.PhoneNumber, user.Email!, user.LockoutEnd);
}

public sealed record StaffDto(Guid Id, string DisplayName, string Role, string? PhoneNumber, string Email, DateTimeOffset? LockoutEnd);
public sealed record CreateStaffRequest(string DisplayName, string Role, string Email, string Password, string? PhoneNumber);
public sealed record UpdateStaffRequest(string Role);
