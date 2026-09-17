using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Operations;

public sealed record BoatDocumentRequirement(string Type, string DisplayName, bool IsRenewable);

public static class BoatDocumentRequirements
{
    public const int CurrentVersion = 2;
    public const string VesselPhotographOrDiagram = "VesselPhotographOrDiagram";
    public const string BusinessRegistration = "BusinessRegistration";
    public const string MeCertificate = "MECertificate";
    public const string VesselInsuranceCertificate = "VesselInsuranceCertificate";
    public const string PassengerLifeInsuranceCertificate = "PassengerLifeInsuranceCertificate";
    public const string WildlifeCertificate = "WildlifeCertificate";
    public const string CoxswainCertificate = "CoxswainCertificate";
    public const string VesselRegistrationCertificate = "VesselRegistrationCertificate";
    public const string LifeSavingCertificate = "LifeSavingCertificate";
    public const string FirstAidCertificate = "FirstAidCertificate";
    public const string FireFightingEquipmentReport = "FireFightingEquipmentReport";
    public const string FireFightingCertificate = "FireFightingCertificate";

    public static readonly IReadOnlyList<BoatDocumentRequirement> All =
    [
        new(VesselPhotographOrDiagram, "Color Aerial Photograph or Diagram of the Vessel", false),
        new(BusinessRegistration, "Certificate of Registration of Sole Proprietorship / Business", false),
        new(MeCertificate, "ME Certificate", true),
        new(VesselInsuranceCertificate, "Vessel Insurance Certificate", true),
        new(PassengerLifeInsuranceCertificate, "Passengers' Life Insurance Certificate", true),
        new(WildlifeCertificate, "Wildlife Certificate", false),
        new(CoxswainCertificate, "Coxswain Certificate", false),
        new(VesselRegistrationCertificate, "Vessel Registration Certificate", true),
        new(LifeSavingCertificate, "Life Saving Certificate", false),
        new(FirstAidCertificate, "First Aid Certificate", true),
        new(FireFightingEquipmentReport, "Fire-Fighting Equipment Report", true),
        new(FireFightingCertificate, "Fire Fighting Certificate", false),
    ];

    public static bool TryGet(string type, out BoatDocumentRequirement requirement)
    {
        requirement = All.FirstOrDefault(item =>
            string.Equals(item.Type, type?.Trim(), StringComparison.OrdinalIgnoreCase))!;
        return requirement is not null;
    }

    public static string RenewalState(BoatDocument document, DateOnly today)
    {
        if (document.Status == BoatDocumentStatus.PendingReview)
            return TryGet(document.DocumentType, out var pendingRequirement) &&
                   pendingRequirement.IsRenewable && document.Version > 1
                ? "PendingRenewal"
                : "PendingVerification";
        if (document.Status == BoatDocumentStatus.Rejected) return "Rejected";
        if (document.Status == BoatDocumentStatus.Superseded) return "Superseded";
        if (!TryGet(document.DocumentType, out var requirement) || !requirement.IsRenewable)
            return document.Status == BoatDocumentStatus.Approved ? "Valid" : document.Status.ToString();
        if (document.ExpirationDate is null) return "PendingVerification";
        if (document.ExpirationDate < today) return "Expired";
        if (document.ExpirationDate <= today.AddDays(30)) return "ExpiringSoon";
        return "Valid";
    }
}
