using Microsoft.AspNetCore.DataProtection;

namespace WhaleWatching.Api.Auth.Recovery;

public static class RecoveryRegistration
{
    public static IServiceCollection AddPasswordRecovery(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDataProtection().SetApplicationName("WWMS");
        services.AddOptions<PasswordRecoveryOptions>().Bind(configuration.GetSection(PasswordRecoveryOptions.SectionName))
            .Validate(x => x.IsValid(), "PasswordRecovery requires a base64 key of at least 32 bytes and valid Gmail STARTTLS/App Password configuration.")
            .ValidateOnStart();
        services.AddScoped<RecoverySecrets>();
        services.AddScoped<PasswordRecoveryService>();
        services.AddScoped<IRecoveryEmailSender, GmailRecoveryEmailSender>();
        services.AddScoped<PasswordRecoveryDeliveryProcessor>();
        services.AddHostedService<PasswordRecoveryWorker>();
        return services;
    }
}
