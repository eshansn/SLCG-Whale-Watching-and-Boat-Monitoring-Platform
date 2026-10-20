using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Gps;
using WhaleWatching.Api.Operations;

namespace WhaleWatching.Api.Tests;

// Uses a new disposable database, never the database specified in the connection string.
public sealed class SqlServerFactAttribute : FactAttribute
{
    public SqlServerFactAttribute()
    {
        if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WWMS_TEST_SQL_CONNECTION")))
            Skip = "Set WWMS_TEST_SQL_CONNECTION to run isolated SQL Server integration tests.";
    }
}

public sealed class BoatImageIntegrationTests
{
    [SqlServerFact]
    public async Task UploadAndReplacement_ShareDocumentBytesAndImmediatelyChangeEveryProjection()
    {
        await using var database = await TestDatabase.CreateAsync();
        var db = database.Context;
        var boat = await SeedBoat(db);
        var service = new BoatDocumentService(db, TimeProvider.System);
        var first = await service.UploadAsync(boat.Id, boat.OwnerId,
            BoatDocumentRequirements.VesselPhotographOrDiagram, Png(1_100_000), default);
        Assert.Null(first.Error);
        Assert.NotNull(first.Document);
        var firstUrl = BoatDisplayImage.DocumentUrl(boat.Id, first.Document.Id);
        Assert.Equal(firstUrl, first.Document.FileUrl);
        Assert.Equal(firstUrl, (await db.Boats.SingleAsync()).ImageUrl);
        Assert.Equal(1, await db.BoatDocuments.CountAsync());
        Assert.True((await service.ReviewAsync(boat.Id, first.Document.Id, boat.OwnerId,
            "Approved", null, null, default)).Succeeded);

        var replacementBytes = PngBytes(32);
        var replacement = await service.UploadAsync(boat.Id, boat.OwnerId,
            BoatDocumentRequirements.VesselPhotographOrDiagram, Png(replacementBytes), default);
        Assert.Null(replacement.Error);
        Assert.NotNull(replacement.Document);
        Assert.False(replacement.Document.IsCurrent);
        var url = BoatDisplayImage.DocumentUrl(boat.Id, replacement.Document.Id);
        Assert.NotEqual(firstUrl, url);
        Assert.Equal(url, (await db.Boats.SingleAsync()).ImageUrl);
        Assert.Equal(2, await db.BoatDocuments.CountAsync()); // One file per historical document version.

        foreach (var role in new[] { PortalRoles.BoatOwner, PortalRoles.Admin, PortalRoles.Ops,
                     PortalRoles.ShoreCrew, PortalRoles.Wildlife })
        {
            var controller = Controller(db, boat.OwnerId, role);
            var boats = Assert.IsAssignableFrom<IEnumerable<BoatDto>>(
                Assert.IsType<OkObjectResult>((await controller.Boats(default)).Result).Value);
            Assert.Equal(url, Assert.Single(boats).ImageUrl);
            var map = Assert.IsAssignableFrom<IEnumerable<VesselMapDto>>(
                Assert.IsType<OkObjectResult>((await controller.VesselMap(default)).Result).Value);
            Assert.Equal(url, Assert.Single(map).ImageUrl);
            var image = Assert.IsType<FileContentResult>(
                await controller.BoatImage(boat.Id, replacement.Document.Id, default));
            var document = Assert.IsType<FileContentResult>(
                await controller.DownloadBoatDocument(boat.Id, replacement.Document.Id, default));
            Assert.Equal(replacementBytes, image.FileContents);
            Assert.Equal(document.FileContents, image.FileContents);
        }
    }

    [SqlServerFact]
    public async Task ExistingDocument_OverridesMissingOrStaleSeparateImage_AndNoDocumentHasNoImage()
    {
        await using var database = await TestDatabase.CreateAsync();
        var db = database.Context;
        var boat = await SeedBoat(db);
        boat.ImageUrl = "/obsolete-boat.png";
        await db.SaveChangesAsync();
        var controller = Controller(db, boat.OwnerId, PortalRoles.BoatOwner);
        async Task<string?> ReadImage() => Assert.Single(Assert.IsAssignableFrom<IEnumerable<BoatDto>>(
            Assert.IsType<OkObjectResult>((await controller.Boats(default)).Result).Value)).ImageUrl;
        Assert.Null(await ReadImage());

        var document = new BoatDocument
        {
            Id = Guid.NewGuid(), BoatId = boat.Id,
            Name = "Color Aerial Photograph or Diagram of the Vessel",
            ContentType = "image/png", Content = PngBytes(32), FileSize = 32,
            UploadedAtUtc = DateTimeOffset.UtcNow
        };
        db.BoatDocuments.Add(document);
        await db.SaveChangesAsync();
        Assert.Equal(BoatDisplayImage.DocumentUrl(boat.Id, document.Id), await ReadImage());
        boat.ImageUrl = null;
        await db.SaveChangesAsync();
        Assert.Equal(BoatDisplayImage.DocumentUrl(boat.Id, document.Id), await ReadImage());
    }

    [SqlServerFact]
    public async Task InvalidOrUnauthorizedReplacement_DoesNotChangeImage_AndOtherDocumentsStayPrivate()
    {
        await using var database = await TestDatabase.CreateAsync();
        var db = database.Context;
        var boat = await SeedBoat(db);
        var service = new BoatDocumentService(db, TimeProvider.System);
        var uploaded = await service.UploadAsync(boat.Id, boat.OwnerId,
            BoatDocumentRequirements.VesselPhotographOrDiagram, Png(32), default);
        var url = uploaded.Document!.FileUrl;
        var pdf = new FormFile(new MemoryStream("%PDF-test"u8.ToArray()), 0, 9, "file", "diagram.pdf")
            { Headers = new HeaderDictionary(), ContentType = "application/pdf" };
        Assert.NotNull((await service.UploadAsync(boat.Id, boat.OwnerId,
            BoatDocumentRequirements.VesselPhotographOrDiagram, pdf, default)).Error);
        var stranger = Guid.NewGuid();
        Assert.True((await service.UploadAsync(boat.Id, stranger,
            BoatDocumentRequirements.VesselPhotographOrDiagram, Png(32), default)).Forbidden);
        Assert.Equal(url, (await db.Boats.SingleAsync()).ImageUrl);
        Assert.IsType<NotFoundResult>(await Controller(db, stranger, PortalRoles.BoatOwner)
            .BoatImage(boat.Id, uploaded.Document.Id, default));

        var certificate = await service.UploadAsync(boat.Id, boat.OwnerId,
            BoatDocumentRequirements.BusinessRegistration, Png(32), default);
        Assert.IsType<NotFoundResult>(await Controller(db, boat.OwnerId, PortalRoles.ShoreWildlife)
            .BoatImage(boat.Id, certificate.Document!.Id, default));
        Assert.IsType<FileContentResult>(await Controller(db, boat.OwnerId, PortalRoles.ShoreWildlife)
            .BoatImage(boat.Id, uploaded.Document.Id, default));
    }

    private static OperationsController Controller(WhaleWatchingDbContext db, Guid userId, string role) =>
        new(db, null!, null!, new GpsTrackerStatus(Options.Create(new TrackMyCarOptions()), TimeProvider.System),
            null!, new BoatDocumentService(db, TimeProvider.System))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity([
                        new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(ClaimTypes.Role, role)
                    ], "Test"))
                }
            }
        };

    private static async Task<Boat> SeedBoat(WhaleWatchingDbContext db)
    {
        var boat = new Boat
        {
            Id = Guid.NewGuid(), Owner = new ApplicationUser { Id = Guid.NewGuid(), DisplayName = "Image Test Owner" },
            Name = "Image Test Boat", RegistrationNumber = Guid.NewGuid().ToString(),
            RegistrationDate = new DateOnly(2026, 1, 1)
        };
        db.Boats.Add(boat);
        await db.SaveChangesAsync();
        return boat;
    }

    private static byte[] PngBytes(int size)
    {
        var bytes = new byte[size];
        new byte[] { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a }.CopyTo(bytes, 0);
        return bytes;
    }
    private static IFormFile Png(int size) => Png(PngBytes(size));
    private static IFormFile Png(byte[] bytes) => new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", "vessel.png")
        { Headers = new HeaderDictionary(), ContentType = "image/png" };

    private sealed class TestDatabase(WhaleWatchingDbContext context) : IAsyncDisposable
    {
        public WhaleWatchingDbContext Context => context;
        public static async Task<TestDatabase> CreateAsync()
        {
            var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("WWMS_TEST_SQL_CONNECTION"))
            {
                InitialCatalog = $"WWMS_BoatImageTests_{Guid.NewGuid():N}"
            };
            var context = new WhaleWatchingDbContext(new DbContextOptionsBuilder<WhaleWatchingDbContext>()
                .UseSqlServer(connection.ConnectionString).Options);
            await context.Database.EnsureCreatedAsync();
            return new TestDatabase(context);
        }
        public async ValueTask DisposeAsync()
        {
            await context.Database.EnsureDeletedAsync();
            await context.DisposeAsync();
        }
    }
}
