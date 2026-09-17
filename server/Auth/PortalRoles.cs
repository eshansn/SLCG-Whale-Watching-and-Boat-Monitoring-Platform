namespace WhaleWatching.Api.Auth;

public static class PortalRoles
{
    public const string Admin = "Admin";
    public const string Ops = "OPS";
    public const string ShoreCrew = "ShoreCrew";
    public const string Wildlife = "Wildlife";
    public const string ShoreWildlife = "ShoreWildlife";
    public const string Supervisor = "Supervisor";
    public const string HarbourOfficer = "HarbourOfficer";
    public const string Passenger = "Passenger";
    public const string BoatOwner = "BoatOwner";
    public const string BoatCrew = "BoatCrew";

    public static readonly string[] All =
    [
        Admin,
        Ops,
        ShoreCrew,
        Wildlife,
        ShoreWildlife,
        Supervisor,
        HarbourOfficer,
        Passenger,
        BoatOwner,
        BoatCrew
    ];
}
