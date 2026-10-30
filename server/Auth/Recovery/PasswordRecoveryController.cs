using System.ComponentModel.DataAnnotations;
using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace WhaleWatching.Api.Auth.Recovery;

public sealed class ForgotPasswordRequest
{
    [Required, EmailAddress, MaxLength(256)] public string Email { get; set; } = "";
}
public class RecoveryTransactionRequest
{
    [Required] public Guid RecoveryId { get; set; }
}
public sealed class VerifyResetOtpRequest : RecoveryTransactionRequest
{
    [Required, RegularExpression("^[0-9]{6}$")] public string Code { get; set; } = "";
}
public sealed class ResetPasswordRequest : RecoveryTransactionRequest
{
    [Required, StringLength(43, MinimumLength = 43), RegularExpression("^[A-Za-z0-9_-]{43}$")]
    public string ResetAuthorization { get; set; } = "";
    [Required, MaxLength(128)] public string NewPassword { get; set; } = "";
    [Required, MaxLength(128)] public string ConfirmPassword { get; set; } = "";
}

[ApiController, Route("api/auth"), AllowAnonymous, EnableRateLimiting("auth")]
[RequestSizeLimit(4096), ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class PasswordRecoveryController(PasswordRecoveryService recovery, ILogger<PasswordRecoveryController> logger) : ControllerBase
{
    private string Ip => HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    [HttpPost("forgot-password")]
    public Task<IActionResult> Forgot(ForgotPasswordRequest request, CancellationToken ct) =>
        RunAsync(() => recovery.StartAsync(request.Email, Ip, ct), ct);

    [HttpPost("resend-reset-otp")]
    public Task<IActionResult> Resend(RecoveryTransactionRequest request, CancellationToken ct) =>
        RunAsync(() => recovery.ResendAsync(request.RecoveryId, Ip, ct), ct);

    [HttpPost("verify-reset-otp")]
    public Task<IActionResult> Verify(VerifyResetOtpRequest request, CancellationToken ct) =>
        RunAsync(() => recovery.VerifyAsync(request.RecoveryId, request.Code, Ip, ct), ct);

    [HttpPost("reset-password")]
    public Task<IActionResult> Reset(ResetPasswordRequest request, CancellationToken ct) =>
        RunAsync(() => recovery.ResetAsync(request.RecoveryId, request.ResetAuthorization, request.NewPassword, request.ConfirmPassword, Ip, ct), ct);

    private async Task<IActionResult> RunAsync(Func<Task<RecoveryResult>> action, CancellationToken ct)
    {
        var started = Stopwatch.GetTimestamp();
        try
        {
            var result = await action();
            if (result.Status == 429) Response.Headers.RetryAfter = "60";
            return StatusCode(result.Status, result.Body);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception)
        {
            // Provider errors may contain recipient addresses or SMTP authentication details.
            logger.LogWarning("A password recovery request could not be processed.");
            return StatusCode(503, new { message = "Password recovery is temporarily unavailable. Please try again later." });
        }
        finally
        {
            // Email is asynchronous; apply the same minimum delay to real and decoy requests.
            var remaining = TimeSpan.FromMilliseconds(250) - Stopwatch.GetElapsedTime(started);
            if (remaining > TimeSpan.Zero) await Task.Delay(remaining, ct);
        }
    }
}
