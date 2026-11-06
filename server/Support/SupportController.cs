using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Support;

public sealed record SubmitSupportRequest(
    Guid SubmissionId,
    [Required, StringLength(160)] string FullName,
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(32)] string Portal,
    [Required, StringLength(160)] string Subject,
    [Required, StringLength(40)] string Category,
    [Required, StringLength(4000)] string Message,
    [StringLength(0)] string? Website = null);

[ApiController, Route("api/support/requests"), AllowAnonymous, EnableRateLimiting("support")]
[RequestSizeLimit(32768), ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class SupportController(WhaleWatchingDbContext db, TimeProvider clock) : ControllerBase
{
    public static readonly string[] Categories = ["Login & Account Issues", "Trip & Booking Issues",
        "Passenger Registration", "GPS & Tracking Issues", "Technical Problems", "Other"];

    [HttpPost]
    public async Task<IActionResult> Submit(SubmitSupportRequest request, CancellationToken ct)
    {
        if (request.SubmissionId == Guid.Empty ||
            !(PortalRoles.All.Contains(request.Portal) || request.Portal == "NotSure") || !Categories.Contains(request.Category))
            return BadRequest(new { message = "Choose a valid portal and issue category, and try again." });
        string name = Clean(request.FullName), subject = Clean(request.Subject), email = Clean(request.Email);
        var message = Clean(request.Message, multiline: true);
        if (name.Length == 0 || subject.Length == 0 || message.Length == 0 || !new EmailAddressAttribute().IsValid(email))
            return BadRequest(new { message = "Enter your name, a valid email, subject and message." });
        Guid? userId = Guid.TryParse(User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
        var now = clock.GetUtcNow();
        var ticket = new SupportRequest { Id = request.SubmissionId, UserId = userId, FullName = name, Email = email,
            Portal = request.Portal, Subject = subject, Category = request.Category, Message = message,
            CreatedAtUtc = now, NextNotificationAtUtc = now };
        var existing = await db.SupportRequests.AsNoTracking().SingleOrDefaultAsync(x => x.Id == ticket.Id, ct);
        if (existing is not null) return Replay(existing, ticket);
        db.SupportRequests.Add(ticket);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException error) when (error.InnerException is SqlException { Number: 2601 or 2627 })
        {
            db.ChangeTracker.Clear();
            existing = await db.SupportRequests.AsNoTracking().SingleAsync(x => x.Id == ticket.Id, ct);
            return Replay(existing, ticket);
        }
        return AcceptedTicket(ticket.Id);
    }

    private IActionResult Replay(SupportRequest previous, SupportRequest next) =>
        previous.UserId == next.UserId && previous.FullName == next.FullName && previous.Email == next.Email &&
        previous.Portal == next.Portal && previous.Subject == next.Subject && previous.Category == next.Category && previous.Message == next.Message
            ? AcceptedTicket(previous.Id) : Conflict(new { message = "This submission reference is already in use. Start a new request." });

    private IActionResult AcceptedTicket(Guid id) => StatusCode(StatusCodes.Status202Accepted,
        new { requestId = id, message = "Your support request has been received. Keep your reference number for follow-up." });

    private static string Clean(string value, bool multiline = false) => new(value.Trim().Replace("\r\n", "\n")
        .Where(c => !char.IsControl(c) || (multiline && (c == '\n' || c == '\t'))).ToArray());
}
