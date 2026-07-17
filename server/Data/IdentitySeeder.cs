using Microsoft.AspNetCore.Identity;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace WhaleWatching.Api.Data;

public sealed class IdentitySeeder(
    RoleManager<IdentityRole<Guid>> roleManager,
    UserManager<ApplicationUser> userManager,
    WhaleWatchingDbContext db,
    IConfiguration configuration,
    IHostEnvironment environment,
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
        var owner = await SeedPortalUserAsync("IdentitySeed:OwnerEmail", "IdentitySeed:OwnerPassword",
            PortalRoles.BoatOwner, "development boat owner", "Kamal Silva");
        var crew = await SeedPortalUserAsync("IdentitySeed:CrewEmail", "IdentitySeed:CrewPassword",
            PortalRoles.BoatCrew, "development boat crew member", "Nimal Perera");
        await SeedPortalUserAsync("IdentitySeed:PassengerEmail", "IdentitySeed:PassengerPassword",
            PortalRoles.Passenger, "development passenger", "Amara Fernando");
        if (owner is not null && crew is not null) await SeedOperationsAsync(owner, crew);

        if (environment.IsDevelopment())
        {
            await SeedDemoAccountsAsync();
        }
    }

    private async Task<ApplicationUser?> SeedPortalUserAsync(
        string emailKey,
        string passwordKey,
        string role,
        string description,
        string? displayName = null,
        bool ensureConfiguredPassword = false)
    {
        var email = configuration[emailKey]?.Trim();
        var password = configuration[passwordKey];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogInformation("The {Description} seed was not configured.", description);
            return null;
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
                ,DisplayName = displayName ?? description
            };
            EnsureSucceeded(
                await userManager.CreateAsync(user, password),
                $"create {description}");
        }
        else if (!string.IsNullOrWhiteSpace(displayName) && user.DisplayName != displayName)
        {
            user.DisplayName = displayName;
            EnsureSucceeded(await userManager.UpdateAsync(user), $"update {description}");
        }
        if (ensureConfiguredPassword && !await userManager.CheckPasswordAsync(user, password))
        {
            var resetToken = await userManager.GeneratePasswordResetTokenAsync(user);
            EnsureSucceeded(await userManager.ResetPasswordAsync(user, resetToken, password),
                $"reset {description} password");
        }

        if (!await userManager.IsInRoleAsync(user, role))
        {
            EnsureSucceeded(
                await userManager.AddToRoleAsync(user, role),
                $"assign {description} role");
        }
        return user;
    }

    private async Task SeedDemoAccountsAsync()
    {
        var demoUsers = new[]
        {
            ("Admin", PortalRoles.Admin, "WWMS Demo Administrator"),
            ("Ops", PortalRoles.Ops, "WWMS Demo OPS Officer"),
            ("Shore", PortalRoles.ShoreCrew, "WWMS Demo Shore Officer"),
            ("Wildlife", PortalRoles.Wildlife, "WWMS Demo Wildlife Officer"),
            ("Owner", PortalRoles.BoatOwner, "Kamal Silva"),
            ("Crew", PortalRoles.BoatCrew, "Nimal Perera"),
            ("Passenger", PortalRoles.Passenger, "Amara Fernando")
        };

        foreach (var (key, role, displayName) in demoUsers)
        {
            await SeedPortalUserAsync(
                $"DemoIdentitySeed:{key}Email",
                $"DemoIdentitySeed:{key}Password",
                role,
                $"development demo {role} user",
                displayName,
                ensureConfiguredPassword: true);
        }
    }

    private async Task SeedOperationsAsync(ApplicationUser owner, ApplicationUser crew)
    {
        if (await db.Boats.AnyAsync()) return;
        var mirissa = new Boat
        {
            Id = Guid.NewGuid(), OwnerId = owner.Id, Name = "Mirissa King",
            RegistrationNumber = "SL-WB-2047", RegistrationDate = new DateOnly(2026, 6, 10),
            HullNumber = "156466", LengthMeters = 25.7m, WidthMeters = 5.7m,
            MaximumCapacity = 150, Approval = ApprovalStatus.Approved,
            ImageUrl = "/gallery-2.jpg"
        };
        var princess = new Boat
        {
            Id = Guid.NewGuid(), OwnerId = owner.Id, Name = "Sea Princess",
            RegistrationNumber = "SL-WB-2038", RegistrationDate = new DateOnly(2026, 5, 18),
            HullNumber = "156390", LengthMeters = 21.2m, WidthMeters = 4.8m,
            MaximumCapacity = 90, Approval = ApprovalStatus.Approved,
            ImageUrl = "/gallery-4.jpg"
        };
        db.Boats.AddRange(mirissa, princess);
        db.CrewAssignments.Add(new CrewAssignment
        {
            Id = Guid.NewGuid(), Boat = mirissa, CrewUserId = crew.Id,
            Position = "Coxswain", IsActive = true
        });
        db.Trips.AddRange(
            new Trip { Id = Guid.NewGuid(), Boat = mirissa, ScheduledDepartureUtc = DateTimeOffset.UtcNow.AddHours(18),
                Route = "Mirissa – Dondra Head", PassengerCount = 28, Status = TripStatus.Scheduled,
                ShoreApproval = ApprovalStatus.Pending, UpdatedAtUtc = DateTimeOffset.UtcNow },
            new Trip { Id = Guid.NewGuid(), Boat = princess, ScheduledDepartureUtc = DateTimeOffset.UtcNow.AddDays(-1),
                ActualDepartureUtc = DateTimeOffset.UtcNow.AddDays(-1), Route = "Mirissa – Weligama Bay", PassengerCount = 22,
                Status = TripStatus.Completed, ShoreApproval = ApprovalStatus.Approved, UpdatedAtUtc = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
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
