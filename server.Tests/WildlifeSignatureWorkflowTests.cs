using System.Reflection;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.ShoreWildlife;

namespace WhaleWatching.Api.Tests;

public sealed class WildlifeSignatureWorkflowTests
{
    [Fact]
    public void NewPortalRoles_AreRegistered()
    {
        Assert.Contains(PortalRoles.Supervisor, PortalRoles.All);
        Assert.Contains(PortalRoles.HarbourOfficer, PortalRoles.All);
    }

    [Fact]
    public void SignaturePortalController_RequiresSignerRoles()
    {
        var authorization = typeof(SignatureRequestsController).GetCustomAttribute<AuthorizeAttribute>();
        var roles = authorization!.Roles!.Split(',');

        Assert.Contains(PortalRoles.Supervisor, roles);
        Assert.Contains(PortalRoles.HarbourOfficer, roles);
        Assert.DoesNotContain(PortalRoles.ShoreWildlife, roles);
    }

    [Fact]
    public void ShoreController_ExposesScopedSearchAndRequestRoutes()
    {
        var search = typeof(WildlifeMonitoringController).GetMethod(nameof(WildlifeMonitoringController.SearchSignatureUsers))!;
        var request = typeof(WildlifeMonitoringController).GetMethod(nameof(WildlifeMonitoringController.RequestSignature))!;

        Assert.Equal("signature-users/search", search.GetCustomAttribute<HttpGetAttribute>()!.Template);
        Assert.Equal("records/{id:guid}/signature-requests", request.GetCustomAttribute<HttpPostAttribute>()!.Template);
    }

    [Fact]
    public void AssignedPendingSupervisor_CanSignWithSupervisorRole()
    {
        var userId = Guid.NewGuid();
        var request = Request(userId, WildlifeSignatureType.Supervisor, WildlifeSignatureRequestStatus.Pending);

        Assert.True(SignatureRequestRules.CanSign(request, userId, hasRequiredRole: true));
        Assert.Equal(PortalRoles.Supervisor, SignatureRequestRules.RequiredRole(request.SignatureType));
    }

    [Fact]
    public void DifferentUser_CannotSignAssignedRequest()
    {
        var request = Request(Guid.NewGuid(), WildlifeSignatureType.HarbourOfficer,
            WildlifeSignatureRequestStatus.Pending);

        Assert.False(SignatureRequestRules.CanSign(request, Guid.NewGuid(), hasRequiredRole: true));
    }

    [Theory]
    [InlineData(WildlifeSignatureRequestStatus.Signed)]
    [InlineData(WildlifeSignatureRequestStatus.Declined)]
    [InlineData(WildlifeSignatureRequestStatus.Cancelled)]
    [InlineData(WildlifeSignatureRequestStatus.Superseded)]
    public void NonPendingRequest_CannotBeSignedAgain(WildlifeSignatureRequestStatus status)
    {
        var userId = Guid.NewGuid();
        Assert.False(SignatureRequestRules.CanSign(
            Request(userId, WildlifeSignatureType.Supervisor, status), userId, hasRequiredRole: true));
    }

    [Fact]
    public void UserWithoutRequiredRole_CannotSign()
    {
        var userId = Guid.NewGuid();
        Assert.False(SignatureRequestRules.CanSign(
            Request(userId, WildlifeSignatureType.Supervisor, WildlifeSignatureRequestStatus.Pending),
            userId, hasRequiredRole: false));
    }

    [Fact]
    public void MonitoringDetails_AreLockedAfterAnyOfficialSignature()
    {
        var record = new WildlifeMonitoringRecord
        {
            SignatureRequests =
            [
                Request(Guid.NewGuid(), WildlifeSignatureType.Supervisor,
                    WildlifeSignatureRequestStatus.Signed)
            ]
        };

        Assert.False(SignatureRequestRules.CanEditMonitoringDetails(record));
    }

    [Fact]
    public void RequestWorkflow_CannotFinalizeWhileOneSignatureIsPending()
    {
        var record = WorkflowRecord(
            WildlifeSignatureRequestStatus.Signed,
            WildlifeSignatureRequestStatus.Pending);

        Assert.False(SignatureRequestRules.HasRequiredSignatures(record));
    }

    [Fact]
    public void RequestWorkflow_CanFinalizeAfterBothAssignedUsersSign()
    {
        var record = WorkflowRecord(
            WildlifeSignatureRequestStatus.Signed,
            WildlifeSignatureRequestStatus.Signed);

        Assert.True(SignatureRequestRules.HasRequiredSignatures(record));
    }

    [Fact]
    public void FullySignedLegacyRecord_RemainsFinalizable()
    {
        var record = new WildlifeMonitoringRecord
        {
            UsesSignatureRequestWorkflow = false,
            MonitoringOfficerSignature = "legacy-monitor",
            SupervisorSignature = "legacy-supervisor",
            HarbourOfficerSignature = "legacy-harbour",
            HarbourOfficerName = "Legacy Officer"
        };

        Assert.True(SignatureRequestRules.HasRequiredSignatures(record));
    }

    [Fact]
    public void SignatureRequestDto_HasDistinctWebJsonPropertyNames()
    {
        var dto = new WildlifeSignatureRequestDto(Guid.NewGuid(), Guid.NewGuid(), "Supervisor", "Pending",
            Guid.NewGuid(), "John Perera", "john.perera", "john@example.test", "Wildlife Officer",
            DateTimeOffset.UtcNow, null, null, null, null);

        var json = JsonSerializer.Serialize(dto, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.Contains("\"requestedUserFullName\"", json);
        Assert.Contains("\"requestedUsername\"", json);
    }

    [Fact]
    public void DatabaseModel_EnforcesOnePendingRequestPerRecordAndType()
    {
        var options = new DbContextOptionsBuilder<WhaleWatchingDbContext>()
            .UseSqlServer("Server=(localdb)\\mssqllocaldb;Database=WWMS-Model-Test;Trusted_Connection=True")
            .Options;
        using var db = new WhaleWatchingDbContext(options);
        var entity = db.Model.FindEntityType(typeof(WildlifeSignatureRequest))!;
        var pendingIndex = entity.GetIndexes().Single(index => index.IsUnique &&
            index.Properties.Select(property => property.Name)
                .SequenceEqual([nameof(WildlifeSignatureRequest.WildlifeMonitoringRecordId), nameof(WildlifeSignatureRequest.SignatureType)]));

        Assert.Equal("[Status] = 0", pendingIndex.GetFilter());
        Assert.Equal(3, entity.GetForeignKeys().Count());
    }

    private static WildlifeSignatureRequest Request(Guid userId, WildlifeSignatureType type,
        WildlifeSignatureRequestStatus status) => new()
    {
        Id = Guid.NewGuid(), RequestedUserId = userId, SignatureType = type, Status = status
    };

    private static WildlifeMonitoringRecord WorkflowRecord(
        WildlifeSignatureRequestStatus supervisorStatus,
        WildlifeSignatureRequestStatus harbourStatus) => new()
    {
        UsesSignatureRequestWorkflow = true,
        MonitoringOfficerSignature = "monitor",
        SignatureRequests =
        [
            Request(Guid.NewGuid(), WildlifeSignatureType.Supervisor, supervisorStatus),
            Request(Guid.NewGuid(), WildlifeSignatureType.HarbourOfficer, harbourStatus)
        ]
    };
}
