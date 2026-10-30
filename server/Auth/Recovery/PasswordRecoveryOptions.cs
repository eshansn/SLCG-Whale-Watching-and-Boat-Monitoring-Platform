using System.Net.Mail;

namespace WhaleWatching.Api.Auth.Recovery;

public sealed class PasswordRecoveryOptions
{
    public const string SectionName = "PasswordRecovery";
    public bool Enabled { get; set; }
    public string HashKey { get; set; } = "";
    public int ResendSeconds { get; set; } = 60;
    public int SendsPer15Minutes { get; set; } = 3;
    public int RequestsPerHour { get; set; } = 5;
    public int RequestsPerIpPerMinute { get; set; } = 30;
    public RecoverySmtpOptions Smtp { get; set; } = new();

    public bool IsValid()
    {
        if (!Enabled) return true;
        try
        {
            return Convert.FromBase64String(HashKey).Length >= 32 &&
                ResendSeconds >= 60 && SendsPer15Minutes is >= 1 and <= 10 &&
                RequestsPerHour is >= 1 and <= 20 && RequestsPerIpPerMinute is >= 1 and <= 120 &&
                Smtp.Host == "smtp.gmail.com" && Smtp.Port == 587 &&
                MailAddress.TryCreate(Smtp.Username, out _) &&
                MailAddress.TryCreate(Smtp.FromEmail, out _) &&
                Smtp.AppPassword.Replace(" ", "").Length == 16 &&
                !string.IsNullOrWhiteSpace(Smtp.FromName) && Smtp.FromName.Length <= 100 &&
                !Smtp.FromName.Contains('\r') && !Smtp.FromName.Contains('\n') &&
                Smtp.TimeoutSeconds is >= 5 and <= 30;
        }
        catch (FormatException) { return false; }
    }
}

public sealed class RecoverySmtpOptions
{
    public string Host { get; set; } = "smtp.gmail.com";
    public int Port { get; set; } = 587;
    public string Username { get; set; } = "";
    public string AppPassword { get; set; } = "";
    public string FromEmail { get; set; } = "";
    public string FromName { get; set; } = "WWMS Account Security";
    public int TimeoutSeconds { get; set; } = 20;
}
