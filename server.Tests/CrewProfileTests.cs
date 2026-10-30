using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Profiles;

namespace WhaleWatching.Api.Tests;

public sealed class CrewProfileTests
{
    [Theory]
    [InlineData("application/pdf", "%PDF-1.7", false)]
    [InlineData("application/pdf", "malicious content", false)]
    [InlineData("image/png", "%PDF-1.7", false)]
    [InlineData("image/jpeg", "", false)]
    [InlineData("text/html", "<html>", false)]
    public void CertificateUpload_RejectsMismatchedFileContent(string type, string content, bool accepted) =>
        Assert.Equal(accepted, CrewProfileController.HasCertificateSignature(System.Text.Encoding.UTF8.GetBytes(content), type));

    [SqlServerFact]
    public async Task ProfileAndCertificates_PersistWithoutAllowingSelfApprovalOrAccessToAnotherCrewMember()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("WWMS_TEST_SQL_CONNECTION"))
        { InitialCatalog = $"WWMS_CrewProfileTests_{Guid.NewGuid():N}" };
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddControllers();
        services.AddDbContext<WhaleWatchingDbContext>(options => options.UseSqlServer(connection.ConnectionString));
        services.AddIdentityCore<ApplicationUser>().AddEntityFrameworkStores<WhaleWatchingDbContext>();
        await using var provider = services.BuildServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<WhaleWatchingDbContext>();
        await db.Database.EnsureCreatedAsync();
        try
        {
            var manager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var crew = new ApplicationUser { Id = Guid.NewGuid(), UserName = "crew-test", Email = "crew@example.test", DisplayName = "Crew Test", CrewType = "Coxswain", IsCrewCertified = true };
            var stranger = new ApplicationUser { Id = Guid.NewGuid(), UserName = "other-crew", Email = "other@example.test", DisplayName = "Other Crew" };
            Assert.True((await manager.CreateAsync(crew)).Succeeded);
            Assert.True((await manager.CreateAsync(stranger)).Succeeded);
            CrewProfileController Controller(Guid userId) => new(manager, db)
            {
                ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext
                {
                    RequestServices = scope.ServiceProvider,
                    User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "Test"))
                } },
                ProblemDetailsFactory = scope.ServiceProvider.GetRequiredService<ProblemDetailsFactory>()
            };
            var controller = Controller(crew.Id);
            var update = await controller.Update(new UpdateCrewProfileRequest { Email = crew.Email, PhoneNumber = "+94771234567", DisplayName = "Updated Name", Position = "Life Saver", Bio = "Updated biography" });
            var profile = Assert.IsType<CrewProfileDto>(Assert.IsType<OkObjectResult>(update.Result).Value);
            Assert.Equal("Life Saver", profile.Position);
            Assert.Equal("Updated Name", profile.DisplayName);
            Assert.False(profile.Certified);
            db.ChangeTracker.Clear();
            Assert.Equal("Life Saver", (await db.Users.SingleAsync(x => x.Id == crew.Id)).CrewType);

            var invalidRole = await controller.Update(new UpdateCrewProfileRequest { Email = crew.Email, PhoneNumber = "+94771234567", Position = "Admin" });
            Assert.Equal(400, Assert.IsAssignableFrom<ObjectResult>(invalidRole.Result).StatusCode);
            var bytes = CrewCertificateFixtures.Pdf();
            IFormFile File(byte[] content) => new FormFile(new MemoryStream(content), 0, content.Length, "certificate", "coxswain.pdf") { Headers = new HeaderDictionary(), ContentType = "application/pdf" };
            Assert.Equal(400, Assert.IsAssignableFrom<ObjectResult>(await controller.UploadCertificate(File("invalid"u8.ToArray()), default)).StatusCode);
            Assert.Equal(400, Assert.IsAssignableFrom<ObjectResult>(await controller.UploadCertificate(File([]), default)).StatusCode);
            Assert.Equal(400, Assert.IsAssignableFrom<ObjectResult>(await controller.UploadCertificate(File(new byte[5 * 1024 * 1024 + 1]), default)).StatusCode);
            var uploaded = Assert.IsType<CrewCertificateDto>(Assert.IsType<OkObjectResult>(await controller.UploadCertificate(File(bytes), default)).Value);
            db.ChangeTracker.Clear();
            var listed = Assert.IsAssignableFrom<IEnumerable<CrewCertificateDto>>(Assert.IsType<OkObjectResult>(await controller.Certificates(default)).Value);
            Assert.Equal(uploaded.Id, Assert.Single(listed).Id);
            Assert.Equal(bytes, Assert.IsType<FileContentResult>(await controller.DownloadCertificate(uploaded.Id, default)).FileContents);
            Assert.IsType<NotFoundResult>(await Controller(stranger.Id).DownloadCertificate(uploaded.Id, default));
            Assert.False((await db.Users.SingleAsync(x => x.Id == crew.Id)).IsCrewCertified);
            var admin = new WhaleWatching.Api.Admin.CrewController(db)
            { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
            Assert.Equal(bytes, Assert.IsType<FileContentResult>(await admin.DownloadCertificate(crew.Id, uploaded.Id, default)).FileContents);
            Assert.IsType<NotFoundResult>(await admin.DownloadCertificate(stranger.Id, uploaded.Id, default));
        }
        finally { await db.Database.EnsureDeletedAsync(); }
    }
}
