using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace WhaleWatching.Api.Auth.Recovery;

public interface IRecoveryEmailSender
{
    Task SendAsync(string registeredEmail, string code, DateTimeOffset expiresAt, CancellationToken ct);
}

public sealed class GmailRecoveryEmailSender(IOptions<PasswordRecoveryOptions> settings) : IRecoveryEmailSender
{
    public async Task SendAsync(string registeredEmail, string code, DateTimeOffset expiresAt, CancellationToken ct)
    {
        var options = settings.Value.Smtp;
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(options.TimeoutSeconds));
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(options.FromName, options.FromEmail));
        message.To.Add(MailboxAddress.Parse(registeredEmail));
        var content = RecoveryEmailTemplate.Build(code, expiresAt);
        message.Subject = content.Subject;
        message.Body = new BodyBuilder
        {
            TextBody = content.Text,
            HtmlBody = content.Html
        }.ToMessageBody();
        using var client = new SmtpClient { Timeout = options.TimeoutSeconds * 1000 };
        // StartTls throws if the server cannot upgrade. Default certificate validation remains enabled.
        await client.ConnectAsync(options.Host, options.Port, SecureSocketOptions.StartTls, timeout.Token);
        await client.AuthenticateAsync(options.Username, options.AppPassword.Replace(" ", ""), timeout.Token);
        await client.SendAsync(message, timeout.Token);
        await client.DisconnectAsync(true, timeout.Token);
    }
}
