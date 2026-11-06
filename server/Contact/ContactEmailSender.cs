using System.ComponentModel.DataAnnotations;
using MailAddress = System.Net.Mail.MailAddress;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using WhaleWatching.Api.Auth.Recovery;

namespace WhaleWatching.Api.Contact;

public sealed class ContactOptions
{
    [Required, EmailAddress] public string RecipientEmail { get; set; } = "";
}

public interface IContactEmailSender
{
    Task SendAsync(ContactRequest request, CancellationToken ct);
    Task SendSupportAsync(ContactRequest request, Guid reference, string subject, CancellationToken ct) => SendAsync(request, ct);
}

public sealed class GmailContactEmailSender(IOptions<PasswordRecoveryOptions> recovery, IOptions<ContactOptions> contact) : IContactEmailSender
{
    public Task SendAsync(ContactRequest request, CancellationToken ct) => SendCoreAsync(request, null, ct);

    public Task SendSupportAsync(ContactRequest request, Guid reference, string subject, CancellationToken ct) =>
        SendCoreAsync(request, $"WWMS support {reference}: {subject}", ct);

    private async Task SendCoreAsync(ContactRequest request, string? subject, CancellationToken ct)
    {
        var smtp = recovery.Value.Smtp;
        if (smtp.Host != "smtp.gmail.com" || smtp.Port != 587 || smtp.TimeoutSeconds is < 5 or > 30 ||
            !MailAddress.TryCreate(smtp.Username, out _) || !MailAddress.TryCreate(smtp.FromEmail, out _) ||
            smtp.AppPassword.Replace(" ", "").Length != 16)
            throw new InvalidOperationException("Contact email is not configured.");
        using var message = CreateMessage(request, smtp, contact.Value);
        if (subject is not null) message.Subject = subject;
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(smtp.TimeoutSeconds));
        using var client = new SmtpClient { Timeout = smtp.TimeoutSeconds * 1000 };
        await client.ConnectAsync(smtp.Host, smtp.Port, SecureSocketOptions.StartTls, timeout.Token);
        await client.AuthenticateAsync(smtp.Username, smtp.AppPassword.Replace(" ", ""), timeout.Token);
        await client.SendAsync(message, timeout.Token);
        await client.DisconnectAsync(true, timeout.Token);
    }

    internal static MimeMessage CreateMessage(ContactRequest request, RecoverySmtpOptions smtp, ContactOptions contact)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(smtp.FromName, smtp.FromEmail));
        message.To.Add(MailboxAddress.Parse(contact.RecipientEmail));
        message.ReplyTo.Add(new MailboxAddress(request.Name, request.Email));
        message.Subject = "WWMMS website inquiry";
        var content = ContactEmailTemplate.Build(request);
        message.Body = new BodyBuilder { TextBody = content.Text, HtmlBody = content.Html }.ToMessageBody();
        return message;
    }
}
