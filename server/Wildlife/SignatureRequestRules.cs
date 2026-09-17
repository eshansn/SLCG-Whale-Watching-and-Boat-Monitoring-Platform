using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.ShoreWildlife;

public static class SignatureRequestRules
{
    public static string RequiredRole(WildlifeSignatureType signatureType) =>
        signatureType == WildlifeSignatureType.Supervisor
            ? PortalRoles.Supervisor
            : PortalRoles.HarbourOfficer;

    public static bool CanSign(WildlifeSignatureRequest request, Guid authenticatedUserId,
        bool hasRequiredRole) => request.RequestedUserId == authenticatedUserId &&
        request.Status == WildlifeSignatureRequestStatus.Pending && hasRequiredRole;

    public static bool CanEditMonitoringDetails(WildlifeMonitoringRecord record) =>
        record.Status is not (WildlifeMonitoringStatus.Completed or WildlifeMonitoringStatus.Discarded) &&
        record.MonitoringOfficerSignature is null &&
        record.SignatureRequests.All(x => x.Status != WildlifeSignatureRequestStatus.Signed);

    public static bool HasRequiredSignatures(WildlifeMonitoringRecord record)
    {
        if (record.MonitoringOfficerSignature is null) return false;
        if (!record.UsesSignatureRequestWorkflow)
            return record.SupervisorSignature is not null && record.HarbourOfficerSignature is not null &&
                !string.IsNullOrWhiteSpace(record.HarbourOfficerName);

        var signedTypes = record.SignatureRequests
            .Where(x => x.Status == WildlifeSignatureRequestStatus.Signed)
            .Select(x => x.SignatureType)
            .ToHashSet();
        return signedTypes.Contains(WildlifeSignatureType.Supervisor) &&
            signedTypes.Contains(WildlifeSignatureType.HarbourOfficer);
    }
}
