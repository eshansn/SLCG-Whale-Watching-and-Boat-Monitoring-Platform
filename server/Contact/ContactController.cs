using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace WhaleWatching.Api.Contact;

public sealed record ContactRequest(
    [Required, StringLength(160)] string Name,
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(2000)] string Message);

[ApiController, Route("api/contact"), AllowAnonymous, EnableRateLimiting("contact")]
[RequestSizeLimit(16384), ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ContactController(IContactEmailSender sender, ILogger<ContactController> logger) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Submit(ContactRequest request, CancellationToken ct)
    {
        try
        {
            await sender.SendAsync(request with { Name = request.Name.Trim(), Email = request.Email.Trim(), Message = request.Message.Trim() }, ct);
            return Ok(new { message = "Your inquiry has been sent. Thank you for contacting us." });
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception)
        {
            // SMTP exceptions may contain addresses, message contents or authentication details.
            logger.LogWarning("A public contact email could not be sent.");
            return StatusCode(503, new { message = "Your inquiry could not be sent. Please try again later." });
        }
    }
}
