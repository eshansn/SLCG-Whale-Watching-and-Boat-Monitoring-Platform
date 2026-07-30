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
        await SeedPortalUserAsync(
            "IdentitySeed:ShoreWildlifeEmail",
            "IdentitySeed:ShoreWildlifePassword",
            PortalRoles.ShoreWildlife,
            "development wildlife shore officer");
        await SeedPortalUserAsync("IdentitySeed:OwnerEmail", "IdentitySeed:OwnerPassword",
            PortalRoles.BoatOwner, "development boat owner", "Kamal Silva");
        await SeedPortalUserAsync("IdentitySeed:CrewEmail", "IdentitySeed:CrewPassword",
            PortalRoles.BoatCrew, "development boat crew member", "Nimal Perera");
        await SeedPortalUserAsync("IdentitySeed:PassengerEmail", "IdentitySeed:PassengerPassword",
            PortalRoles.Passenger, "development passenger", "Amara Fernando");
        if (environment.IsDevelopment())
        {
            await SeedDemoAccountsAsync();
            await SeedOperationsAsync();
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
            ("ShoreWildlife", PortalRoles.ShoreWildlife, "WWMS Demo Wildlife Shore Officer"),
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

    private async Task<ApplicationUser> SeedDataUserAsync(
        string email, string displayName, string role, string password)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            user = new ApplicationUser
            {
                Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = true,
                DisplayName = displayName
            };
            EnsureSucceeded(await userManager.CreateAsync(user, password), $"create seeded user '{email}'");
        }
        else if (user.DisplayName != displayName)
        {
            user.DisplayName = displayName;
            EnsureSucceeded(await userManager.UpdateAsync(user), $"update seeded user '{email}'");
        }
        if (!await userManager.IsInRoleAsync(user, role))
            EnsureSucceeded(await userManager.AddToRoleAsync(user, role), $"assign '{role}' to '{email}'");
        return user;
    }

    private async Task SeedOperationsAsync()
    {
        var ownerPassword = configuration["IdentitySeed:OwnerPassword"] ?? "Owner#WWMS2026!Secure";
        var crewPassword = configuration["IdentitySeed:CrewPassword"] ?? "Crew#WWMS2026!Secure";
        var owners = new[]
        {
            await SeedDataUserAsync(configuration["IdentitySeed:OwnerEmail"] ?? "owner@wwms.test", "Kamal Silva", PortalRoles.BoatOwner, ownerPassword),
            await SeedDataUserAsync("suresh.fernando@wwms.test", "Suresh Fernando", PortalRoles.BoatOwner, ownerPassword)
        };
        var crewSeed = new[]
        {
            (configuration["IdentitySeed:CrewEmail"] ?? "crew@wwms.test", "Nimal Perera", "Coxswain", 0),
            ("amal.fernando@wwms.test", "Amal Fernando", "Life Saver", 0),
            ("dinesh.kumara@wwms.test", "Dinesh Kumara", "Deck Hand", 0),
            ("lahiru.jayasinghe@wwms.test", "Lahiru Jayasinghe", "Diver", 0),
            ("pradeep.senanayake@wwms.test", "Pradeep Senanayake", "First Aid Officer", 0),
            ("kasun.perera@wwms.test", "Kasun Perera", "Coxswain", 1),
            ("chamara.silva@wwms.test", "Chamara Silva", "Life Saver", 1),
            ("isuru.madushan@wwms.test", "Isuru Madushan", "Deck Hand", 1),
            ("tharindu.bandara@wwms.test", "Tharindu Bandara", "Diver", 1),
            ("ravindu.gamage@wwms.test", "Ravindu Gamage", "First Aid Officer", 1)
        };
        var crewUsers = new List<(ApplicationUser User, string Position, int OwnerIndex)>();
        foreach (var item in crewSeed)
        {
            var crewUser = await SeedDataUserAsync(item.Item1, item.Item2, PortalRoles.BoatCrew, crewPassword);
            if (!crewUser.IsCrewCertified) { crewUser.IsCrewCertified = true;
                EnsureSucceeded(await userManager.UpdateAsync(crewUser), $"certify seeded crew '{crewUser.Email}'"); }
            if (crewUser.CrewType != item.Item3) { crewUser.CrewType = item.Item3;
                EnsureSucceeded(await userManager.UpdateAsync(crewUser), $"set crew type for '{crewUser.Email}'"); }
            crewUsers.Add((crewUser, item.Item3, item.Item4));
        }

        var boatSeed = new[]
        {
            (owners[0], "Mirissa King", "SL-WB-2047", "156466", 25.7m, 5.7m, 150, "/gallery-2.jpg"),
            (owners[0], "Sea Princess", "SL-WB-2038", "156390", 21.2m, 4.8m, 90, "/gallery-4.jpg"),
            (owners[1], "Blue Horizon", "SL-WB-2112", "157012", 23.4m, 5.1m, 120, "/gallery-1.jpg"),
            (owners[1], "Ocean Pearl", "SL-WB-2140", "157045", 19.8m, 4.5m, 80, "/gallery-5.jpg")
        };
        var boats = new List<Boat>();
        foreach (var item in boatSeed)
        {
            var boat = await db.Boats.SingleOrDefaultAsync(x => x.RegistrationNumber == item.Item3);
            if (boat is null)
            {
                boat = new Boat { Id = Guid.NewGuid(), RegistrationNumber = item.Item3 };
                db.Boats.Add(boat);
            }
            boat.OwnerId = item.Item1.Id; boat.Name = item.Item2; boat.RegistrationDate = new DateOnly(2026, 6, 10);
            boat.HullNumber = item.Item4; boat.LengthMeters = item.Item5; boat.WidthMeters = item.Item6;
            boat.MaximumCapacity = item.Item7; boat.Approval = ApprovalStatus.Approved;
            boat.WildlifeApproval = ApprovalStatus.Approved;
            boat.MaximumSpeedKnots = 28 + boats.Count;
            boat.LifeJacketCount = item.Item7 + 5; boat.GpsDeviceId = $"WWMS-{item.Item3}";
            boat.ImageUrl = item.Item8;
            boats.Add(boat);
        }
        await db.SaveChangesAsync();

        for (var index = 0; index < crewUsers.Count; index++)
        {
            var member = crewUsers[index];
            var ownerBoatOffset = member.OwnerIndex * 2;
            var boat = boats[ownerBoatOffset + (index % 5 >= 3 ? 1 : 0)];
            if (!await db.CrewAssignments.AnyAsync(x => x.BoatId == boat.Id && x.CrewUserId == member.User.Id))
                db.CrewAssignments.Add(new CrewAssignment { Id = Guid.NewGuid(), BoatId = boat.Id,
                    CrewUserId = member.User.Id, Position = member.Position, IsActive = true });
        }
        await db.SaveChangesAsync();

        foreach (var member in crewUsers)
        {
            var owner = owners[member.OwnerIndex];
            if (!await db.OwnerCrewMemberships.AnyAsync(x => x.OwnerId == owner.Id && x.CrewUserId == member.User.Id))
                db.OwnerCrewMemberships.Add(new OwnerCrewMembership { Id = Guid.NewGuid(), OwnerId = owner.Id,
                    CrewUserId = member.User.Id, AddedAtUtc = DateTimeOffset.UtcNow });
        }
        await db.SaveChangesAsync();

        var now = DateTimeOffset.UtcNow;
        foreach (var (boat, index) in boats.Select((boat, index) => (boat, index)))
        {
            if (await db.Trips.CountAsync(x => x.BoatId == boat.Id) >= 2) continue;
            db.Trips.AddRange(
                new Trip { Id = Guid.NewGuid(), BoatId = boat.Id, ScheduledDepartureUtc = now.AddHours(12 + index * 4),
                    Route = index < 2 ? "Mirissa – Dondra Head" : "Galle – Unawatuna Bay", PassengerCount = 24 + index * 4,
                    ChildrenCount = 3 + index, SpecialNeedsCount = index % 2,
                    Status = TripStatus.Scheduled, ShoreApproval = ApprovalStatus.Approved, UpdatedAtUtc = now },
                new Trip { Id = Guid.NewGuid(), BoatId = boat.Id, ScheduledDepartureUtc = now.AddDays(-2 - index),
                    ActualDepartureUtc = now.AddDays(-2 - index), ActualArrivalUtc = now.AddDays(-2 - index).AddHours(4),
                    Route = index < 2 ? "Mirissa – Weligama Bay" : "Galle – Jungle Beach", PassengerCount = 18 + index * 3,
                    ChildrenCount = 2 + index, SpecialNeedsCount = index % 2,
                    Status = TripStatus.Completed, ShoreApproval = ApprovalStatus.Approved, UpdatedAtUtc = now });
        }
        await db.SaveChangesAsync();

        var coordinates = new[] { (5.942000m, 80.455000m), (5.935000m, 80.448000m),
            (5.920000m, 80.430000m), (5.850000m, 80.460000m) };
        foreach (var (boat, index) in boats.Select((boat, index) => (boat, index)))
        {
            if (boat.GpsDeviceId is null || await db.GpsTelemetry.AnyAsync(x => x.DeviceId == boat.GpsDeviceId)) continue;
            db.GpsTelemetry.Add(new GpsTelemetry { DeviceId = boat.GpsDeviceId,
                Latitude = coordinates[index].Item1, Longitude = coordinates[index].Item2,
                SpeedKnots = 18 + index,
                RecordedAtUtc = now, ReceivedAtUtc = now });
        }
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
