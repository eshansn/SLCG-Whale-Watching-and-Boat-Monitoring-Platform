using System.Net;
using System.Net.Http.Json;
using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MimeKit;
using WhaleWatching.Api.Auth.Recovery;
using WhaleWatching.Api.Contact;

namespace WhaleWatching.Api.Tests;

public sealed class ContactTests
{
    [ComplaintBrowserFact]
    public async Task Browser_PublicContactUsesRealApiAndPreservesInputOnDeliveryFailure()
    {
        await using var test = await Harness.Create(browser: true);
        var info = new ProcessStartInfo("node") { UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true };
        info.ArgumentList.Add(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../scripts/tests/contact.cjs")));
        info.Environment["WWMS_CONTACT_TEST_URL"] = test.Client.BaseAddress!.ToString().TrimEnd('/');
        using var process = Process.Start(info)!;
        var output = process.StandardOutput.ReadToEndAsync(); var errors = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        Assert.True(process.ExitCode == 0, await output + await errors);
        Assert.Single(test.Mail.Sent);
    }

    [Fact]
    public void EmailHasFixedRecipientAuthenticatedFromAndReplyTo_AndSafeThemedAlternatives()
    {
        using var message = GmailContactEmailSender.CreateMessage(new ContactRequest("Visitor", "visitor@example.test", "<script>alert('text only')</script>"),
            new RecoverySmtpOptions { FromEmail = "sender@example.test", FromName = "WWMMS" },
            new ContactOptions { RecipientEmail = "eshannethmina51@gmail.com" });
        Assert.Equal("eshannethmina51@gmail.com", Assert.IsType<MailboxAddress>(Assert.Single(message.To)).Address);
        Assert.Equal("sender@example.test", Assert.IsType<MailboxAddress>(Assert.Single(message.From)).Address);
        Assert.Equal("visitor@example.test", Assert.IsType<MailboxAddress>(Assert.Single(message.ReplyTo)).Address);
        Assert.Empty(message.Cc); Assert.Empty(message.Bcc);
        Assert.Equal("WWMMS website inquiry", message.Subject);
        Assert.IsType<MultipartAlternative>(message.Body);
        Assert.Contains("<script>", message.TextBody); // The plain-text alternative preserves the original message.
        Assert.DoesNotContain("<script>", message.HtmlBody);
        Assert.Contains("&lt;script&gt;", message.HtmlBody);
        Assert.Contains("#020912", message.HtmlBody);
        Assert.Contains("#35E6F7", message.HtmlBody);
        if (Environment.GetEnvironmentVariable("WWMS_CONTACT_EMAIL_PREVIEW_DIR") is { Length: > 0 } previewDirectory)
        {
            Directory.CreateDirectory(previewDirectory);
            var preview = ContactEmailTemplate.Build(new ContactRequest("Ayesha Perera", "ayesha@example.test",
                "Hello WWMS team,\n\nI would like to learn more about whale-watching trip registration and the passenger verification process.\n\nThank you for your help."));
            File.WriteAllText(Path.Combine(previewDirectory, "preview.html"), preview.Html);
        }
    }

    [Fact]
    public void ThemedEmailEncodesAllVisitorFieldsAndPreservesMessageLines()
    {
        var content = ContactEmailTemplate.Build(new ContactRequest("<img src=x onerror=alert(1)> & Visitor",
            "\"><script>email</script>", "First line\r\n<script>message</script>\nLast line"));
        Assert.DoesNotContain("<img", content.Html);
        Assert.DoesNotContain("<script>", content.Html);
        Assert.Contains("&lt;img", content.Html);
        Assert.Contains("&amp; Visitor", content.Html);
        Assert.Contains("&quot;&gt;&lt;script&gt;email&lt;/script&gt;", content.Html);
        Assert.Contains("First line<br>&lt;script&gt;message&lt;/script&gt;<br>Last line", content.Html);
        Assert.Contains("First line\r\n<script>message</script>\nLast line", content.Text);
        Assert.Contains("Reply to this email", content.Text);
    }

    [Fact]
    public async Task PublicContactValidatesInputAndRateLimitsBeforeSending()
    {
        await using var test = await Harness.Create();
        foreach (var body in new object[] { new { name = "", email = "bad", message = "" },
            new { name = "Visitor", email = "visitor@example.test", message = new string('x', 2001) } })
            Assert.Equal(HttpStatusCode.BadRequest, (await test.Client.PostAsJsonAsync("/api/contact", body)).StatusCode);
        Assert.Empty(test.Mail.Sent);
        Assert.Equal(HttpStatusCode.OK, (await test.Client.PostAsJsonAsync("/api/contact", Valid)).StatusCode);
        Assert.Single(test.Mail.Sent);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await test.Client.PostAsJsonAsync("/api/contact", Valid)).StatusCode);
        Assert.Single(test.Mail.Sent);
    }

    [Fact]
    public async Task DeliveryFailureIs503WithoutFalseSuccessOrSmtpDetails()
    {
        await using var test = await Harness.Create(); test.Mail.Fail = true;
        using var response = await test.Client.PostAsJsonAsync("/api/contact", Valid);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("sensitive-smtp", body);
        Assert.DoesNotContain("has been sent", body);
        Assert.Empty(test.Mail.Sent);
    }

    private static ContactRequest Valid => new(" Visitor ", "visitor@example.test", " Inquiry ");
    private sealed class FakeSender : IContactEmailSender
    {
        public bool Fail { get; set; }
        public List<ContactRequest> Sent { get; } = [];
        public Task SendAsync(ContactRequest request, CancellationToken ct)
        {
            if (Fail) throw new InvalidOperationException("sensitive-smtp");
            Assert.Equal("Visitor", request.Name); Assert.Equal("Inquiry", request.Message);
            Sent.Add(request); return Task.CompletedTask;
        }
    }
    private sealed class Harness(WebApplication app, HttpClient client, FakeSender mail) : IAsyncDisposable
    {
        public HttpClient Client => client;
        public FakeSender Mail => mail;
        public static async Task<Harness> Create(bool browser = false)
        {
            var builder = WebApplication.CreateBuilder(); builder.Logging.ClearProviders();
            builder.WebHost.UseUrls("http://127.0.0.1:0");
            var mail = new FakeSender(); builder.Services.AddSingleton<IContactEmailSender>(mail);
            builder.Services.AddControllers().AddApplicationPart(typeof(ContactController).Assembly);
            builder.Services.AddRateLimiter(o => { o.RejectionStatusCode = 429; o.AddFixedWindowLimiter("contact",
                limit => { limit.PermitLimit = 3; limit.Window = TimeSpan.FromMinutes(1); }); });
            var app = builder.Build(); app.UseRateLimiter(); app.MapControllers();
            if (browser)
            {
                app.MapPost("/test/contact-fail", () => { mail.Fail = true; return Results.Ok(); });
                var root = Environment.GetEnvironmentVariable("WWMS_BROWSER_WEB_ROOT")!;
                app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(root) });
                app.MapFallback(async context => { context.Response.ContentType = "text/html";
                    await context.Response.SendFileAsync(Path.Combine(root, "index.html")); });
            }
            await app.StartAsync();
            return new Harness(app, new HttpClient { BaseAddress = new Uri(app.Urls.Single()) }, mail);
        }
        public async ValueTask DisposeAsync() { client.Dispose(); await app.DisposeAsync(); }
    }
}
