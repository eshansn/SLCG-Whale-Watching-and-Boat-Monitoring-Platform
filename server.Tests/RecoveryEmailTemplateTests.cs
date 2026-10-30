using WhaleWatching.Api.Auth.Recovery;

namespace WhaleWatching.Api.Tests;

public sealed class RecoveryEmailTemplateTests
{
    [Fact]
    public void Email_PreservesGeneratedLeadingZeroCodeAndRealExpiry_InBothAlternatives()
    {
        var expiry = new DateTimeOffset(2026, 10, 30, 15, 10, 0, TimeSpan.FromHours(5.5));
        var content = RecoveryEmailTemplate.Build("000042", expiry);
        Assert.Equal("WWMS | Your Ocean Access Verification Code", content.Subject);
        foreach (var body in new[] { content.Text, content.Html })
        {
            Assert.Contains("000042", body);
            Assert.Contains("10 minutes", body);
            Assert.Contains("2026-10-30 09:40 UTC", body);
            Assert.Contains("Never share this code", body);
        }
        Assert.DoesNotContain("<script", content.Html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("http", content.Html, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("role=\"presentation\"", content.Html);
    }

    [Fact]
    public void Html_EncodesInterpolatedContent()
    {
        var content = RecoveryEmailTemplate.Build("<code>", DateTimeOffset.UtcNow);
        Assert.DoesNotContain("<code>", content.Html);
        Assert.Contains("&lt;code&gt;", content.Html);
    }
}
