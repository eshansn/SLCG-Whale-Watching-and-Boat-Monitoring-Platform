using System.ComponentModel.DataAnnotations;

namespace WhaleWatching.Api.Complaints;

public sealed record PageResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);
public class PageQuery
{
    [Range(1, 100000)] public int Page { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 20;
    [MaxLength(160)] public string? Search { get; set; }
    [MaxLength(30)] public string Sort { get; set; } = "newest";
}
public sealed class ComplaintQuery : PageQuery
{
    [MaxLength(30)] public string? Status { get; set; }
    [MaxLength(16)] public string? Kind { get; set; }
    [RegularExpression("^(open|completed|awaiting-review|awaiting-ack|awaiting-response)$")] public string? Queue { get; set; }
    public Guid? AuthorityRoleId { get; set; }
    public Guid? PassengerId { get; set; }
    public DateTimeOffset? From { get; set; }
    public DateTimeOffset? To { get; set; }
}
public sealed record ComplaintSummary(Guid Id, string Reference, string Kind, Guid PassengerId, string PassengerName,
    Guid TripId, string BoatName, string Type, string Status, DateTimeOffset CreatedAtUtc, DateTimeOffset UpdatedAtUtc, int PendingAuthorities);

