using Microsoft.AspNetCore.Diagnostics;

namespace WhaleWatching.Api.Errors;

public sealed class ApiExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(new
        {
            message = "An unexpected error occurred. Please try again or contact support.",
            traceId = context.TraceIdentifier
        }, ct);
        return true;
    }
}
