using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Auth.Recovery;

public sealed class RecoverySecrets(IOptions<PasswordRecoveryOptions> options, IDataProtectionProvider protection)
{
    private readonly IDataProtector protector = protection.CreateProtector("WWMS.PasswordRecovery.Email.v1");
    public string Hash(string purpose, string value) => Convert.ToHexString(HMACSHA256.HashData(
        Convert.FromBase64String(options.Value.HashKey), Encoding.UTF8.GetBytes($"{purpose}\n{value}")));
    public string State(ApplicationUser user) => Hash("state", $"{user.Id:D}\n{user.Email}\n{user.SecurityStamp}\n{user.EmailConfirmed}");
    public string CodeHash(PasswordRecovery recovery, string code) => Hash("otp", $"{recovery.UserId:D}\n{recovery.Id:D}\n{recovery.CodeVersion:D}\n{code}");
    public string AuthorizationHash(PasswordRecovery recovery, string token) => Hash("authorization", $"{recovery.UserId:D}\n{recovery.Id:D}\n{token}");
    public string Protect(PasswordRecovery recovery, string code) => protector.Protect($"{recovery.Id:D}|{recovery.CodeVersion:D}|{code}");
    public string Unprotect(PasswordRecovery recovery, string ciphertext)
    {
        var parts = protector.Unprotect(ciphertext).Split('|');
        if (parts.Length != 3 || parts[0] != recovery.Id.ToString("D") || parts[1] != recovery.CodeVersion.ToString("D"))
            throw new CryptographicException("Invalid recovery payload.");
        return parts[2];
    }
    public static string NewCode() => RandomNumberGenerator.GetInt32(1_000_000).ToString("D6", System.Globalization.CultureInfo.InvariantCulture);
    public static string NewAuthorization() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
    public static bool Equal(string? left, string right) => left is not null &&
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(left), Encoding.UTF8.GetBytes(right));
}
