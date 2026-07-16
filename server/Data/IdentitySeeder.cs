using Microsoft.AspNetCore.Identity;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Data;

public sealed class IdentitySeeder(
    RoleManager<IdentityRole<Guid>> roleManager,
    UserManager<ApplicationUser> userManager,
    IConfiguration configuration,
    ILogger<IdentitySeeder> logger)
{
    public async Task SeedAsync()
    {
        foreach (var roleName in PortalRoles.All)
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                var result = await roleManager.CreateAsync(
                    new IdentityRole<Guid>(roleName));
                EnsureSucceeded(result, $"create role '{roleName}'");
            }
        }

        await SeedPortalUserAsync(
            "IdentitySeed:AdminEmail",
            "IdentitySeed:AdminPassword",
            PortalRoles.Admin,
            "initial administrator");
        await SeedPortalUserAsync(
            "IdentitySeed:OpsEmail",
            "IdentitySeed:OpsPassword",
            PortalRoles.Ops,
            "development OPS user");
        await SeedPortalUserAsync(
            "IdentitySeed:ShoreEmail",
            "IdentitySeed:ShorePassword",
            PortalRoles.ShoreCrew,
            "development shore officer");
        await SeedPortalUserAsync(
            "IdentitySeed:WildlifeEmail",
            "IdentitySeed:WildlifePassword",
            PortalRoles.Wildlife,
            "development wildlife authority user");
    }

    private async Task SeedPortalUserAsync(
        string emailKey,
        string passwordKey,
        string role,
        string description)
    {
        var email = configuration[emailKey]?.Trim();
        var password = configuration[passwordKey];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogInformation("The {Description} seed was not configured.", description);
            return;
        }

        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            user = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                Email = email,
                EmailConfirmed = true
            };
            EnsureSucceeded(
                await userManager.CreateAsync(user, password),
                $"create {description}");
        }

        if (!await userManager.IsInRoleAsync(user, role))
        {
            EnsureSucceeded(
                await userManager.AddToRoleAsync(user, role),
                $"assign {description} role");
        }
    }

    private static void EnsureSucceeded(IdentityResult result, string operation)
    {
        if (result.Succeeded)
        {
            return;
        }

        var errors = string.Join("; ", result.Errors.Select(error => error.Description));
        throw new InvalidOperationException($"Failed to {operation}: {errors}");
    }
}
