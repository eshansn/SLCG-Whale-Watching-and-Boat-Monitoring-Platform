using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Operations;

namespace WhaleWatching.Api.Tests;

public sealed class BoatDocumentWorkflowTests
{
    [Fact]
    public void CurrentRegistration_HasTwelveRequiredDocumentsAndSixAnnualDocuments()
    {
        Assert.Equal(12, BoatDocumentRequirements.All.Count);
        Assert.Equal(6, BoatDocumentRequirements.All.Count(x => x.IsRenewable));
        Assert.Equal(12, BoatDocumentRequirements.All.Select(x => x.Type).Distinct().Count());
    }

    [Theory]
    [InlineData(BoatDocumentStatus.PendingReview, null, 1, "PendingVerification")]
    [InlineData(BoatDocumentStatus.PendingReview, null, 2, "PendingRenewal")]
    [InlineData(BoatDocumentStatus.Rejected, null, 1, "Rejected")]
    [InlineData(BoatDocumentStatus.Superseded, null, 1, "Superseded")]
    [InlineData(BoatDocumentStatus.Approved, "2026-09-16", 1, "Expired")]
    [InlineData(BoatDocumentStatus.Approved, "2026-09-30", 1, "ExpiringSoon")]
    [InlineData(BoatDocumentStatus.Approved, "2027-09-17", 1, "Valid")]
    public void AnnualDocument_RenewalStateIsDerivedFromWildlifeExpiry(
        BoatDocumentStatus status, string? expiry, int version, string expected)
    {
        var document = new BoatDocument
        {
            DocumentType = BoatDocumentRequirements.MeCertificate,
            Status = status,
            ExpirationDate = expiry is null ? null : DateOnly.Parse(expiry),
            Version = version,
        };

        Assert.Equal(expected, BoatDocumentRequirements.RenewalState(
            document, DateOnly.Parse("2026-09-17")));
    }

    [Fact]
    public void DatabaseModel_HasDocumentHistoryAndLookupIndexes()
    {
        var options = new DbContextOptionsBuilder<WhaleWatchingDbContext>()
            .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=WWMS-Model-Test;Trusted_Connection=True")
            .Options;
        using var db = new WhaleWatchingDbContext(options);
        var entity = db.Model.FindEntityType(typeof(BoatDocument))!;
        var indexes = entity.GetIndexes().ToArray();
        var indexProperties = indexes
            .Select(index => string.Join(',', index.Properties.Select(property => property.Name))).ToArray();

        Assert.Contains("BoatId,DocumentType,IsCurrent", indexProperties);
        Assert.Contains(indexes, index => index.IsUnique && index.GetFilter() == "[IsCurrent] = 1");
        Assert.Contains(nameof(BoatDocument.ExpirationDate), indexProperties);
        Assert.Contains(nameof(BoatDocument.Status), indexProperties);
        Assert.NotNull(entity.FindProperty(nameof(BoatDocument.ReplacesDocumentId)));
        Assert.NotNull(entity.FindProperty(nameof(BoatDocument.Version)));
    }

    [Fact]
    public void DocumentReview_IsRestrictedToWildlifeAndAdmin()
    {
        var method = typeof(OperationsController).GetMethod(nameof(OperationsController.ReviewBoatDocument))!;
        var roles = method.GetCustomAttribute<AuthorizeAttribute>()!.Roles!.Split(',');

        Assert.Contains(PortalRoles.Wildlife, roles);
        Assert.Contains(PortalRoles.Admin, roles);
        Assert.DoesNotContain(PortalRoles.BoatOwner, roles);
    }

    [Fact]
    public void DocumentDownload_PreservesAuthorizedRolesAndExcludesPassenger()
    {
        var method = typeof(OperationsController).GetMethod(nameof(OperationsController.DownloadBoatDocument))!;
        var roles = method.GetCustomAttribute<AuthorizeAttribute>()!.Roles!.Split(',');

        Assert.Contains(PortalRoles.Admin, roles);
        Assert.Contains(PortalRoles.Wildlife, roles);
        Assert.Contains(PortalRoles.Ops, roles);
        Assert.Contains(PortalRoles.ShoreCrew, roles);
        Assert.Contains(PortalRoles.BoatOwner, roles);
        Assert.Contains(PortalRoles.BoatCrew, roles);
        Assert.DoesNotContain(PortalRoles.Passenger, roles);
    }

    [Fact]
    public void OwnerUpload_DoesNotAcceptAnExpiryDate()
    {
        var method = typeof(OperationsController).GetMethod(nameof(OperationsController.UploadBoatDocument))!;
        var parameterNames = method.GetParameters().Select(parameter => parameter.Name).ToArray();

        Assert.DoesNotContain("expirationDate", parameterNames);
        Assert.Equal(PortalPolicies.BoatOwner,
            method.GetCustomAttribute<AuthorizeAttribute>()!.Policy);
    }

    [Fact]
    public void ServerUploadLimit_IsTenMegabytes() =>
        Assert.Equal(10 * 1024 * 1024, BoatDocumentService.MaximumFileSize);
}
