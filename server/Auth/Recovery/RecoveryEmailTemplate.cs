using System.Globalization;
using System.Net;

namespace WhaleWatching.Api.Auth.Recovery;

public sealed record RecoveryEmailContent(string Subject, string Text, string Html);

public static class RecoveryEmailTemplate
{
    public static RecoveryEmailContent Build(string code, DateTimeOffset expiresAt)
    {
        var expiry = expiresAt.UtcDateTime.ToString("yyyy-MM-dd HH:mm 'UTC'", CultureInfo.InvariantCulture);
        var safeCode = WebUtility.HtmlEncode(code);
        var text = $"""
            WWMS | WHALE-WATCHING & BOAT MONITORING SYSTEM
            Sri Lanka Coast Guard · Account Security

            Your journey back starts here.

            We received a request to reset the password for your WWMS account.
            Use the verification code below to confirm your identity and continue securely.

            {code}

            This verification code expires 10 minutes after your request, at {expiry}.
            Never share this code. WWMS staff will never ask for it.

            If you didn't request a password reset, you can safely ignore this email.
            Your password will not change unless the recovery process is completed successfully.

            Stay connected to the ocean.
            WWMS Security Team
            """;
        // Inline styles and presentation tables keep essential content usable without images or CSS support.
        var html = $$"""
            <!doctype html>
            <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <meta name="color-scheme" content="dark">
              <title>WWMS account recovery</title>
            </head>
            <body style="margin:0;padding:0;background-color:#020912;color:#EAFBFF;font-family:Arial,Helvetica,sans-serif;">
              <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your secure WWMS recovery code. Valid for 10 minutes after your request.</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#020912" style="width:100%;background-color:#020912;">
                <tr><td align="center" style="padding:36px 16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:540px;">
                    <tr><td style="padding:0 8px 24px;color:#EAFBFF;">
                      <p style="margin:0 0 7px;font-size:23px;font-weight:bold;letter-spacing:3px;">WWMS</p>
                      <p style="margin:0;font-size:9px;line-height:1.8;letter-spacing:1.4px;color:#9BB5C4;">WHALE-WATCHING &amp; BOAT MONITORING SYSTEM</p>
                    </td></tr>
                    <tr><td bgcolor="#061827" style="background-color:#061827;border:1px solid #173747;border-top:2px solid #35E6F7;border-radius:14px;padding:32px 24px;">
                      <p style="margin:0 0 22px;font-size:9px;font-weight:bold;letter-spacing:2px;color:#8AF5FF;">SECURE ACCOUNT RECOVERY</p>
                      <h1 style="margin:0 0 18px;font-size:27px;line-height:1.25;letter-spacing:-.7px;font-weight:normal;color:#EAFBFF;">Your journey back<br>starts here.</h1>
                      <p style="margin:0 0 12px;font-size:13px;line-height:1.9;color:#9BB5C4;">We received a request to reset the password for your WWMS account.</p>
                      <p style="margin:0 0 25px;font-size:13px;line-height:1.9;color:#9BB5C4;">Use the verification code below to confirm your identity and continue securely.</p>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                        <tr><td align="center" bgcolor="#04101C" style="background-color:#04101C;border:1px solid #1B4557;border-radius:10px;padding:22px 8px;">
                          <p style="margin:0 0 10px;font-size:9px;letter-spacing:1.8px;color:#8CA9B9;">YOUR VERIFICATION CODE</p>
                          <p style="margin:0;font-family:Consolas,'Courier New',monospace;font-size:32px;font-weight:bold;line-height:1.4;letter-spacing:7px;color:#8AF5FF;">{{safeCode}}</p>
                        </td></tr>
                      </table>
                      <p style="margin:16px 0 25px;text-align:center;font-size:11px;line-height:1.8;color:#9BB5C4;">Valid for <strong style="color:#EAFBFF;">10 minutes</strong> after your request.<br>Expires at {{expiry}}.</p>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                        <tr><td style="border-top:1px solid #173747;padding-top:22px;">
                          <p style="margin:0 0 10px;font-size:12px;line-height:1.8;color:#EAFBFF;">Never share this code. WWMS staff will never ask for it.</p>
                          <p style="margin:0;font-size:11px;line-height:1.9;color:#9BB5C4;">If you didn’t request a password reset, you can safely ignore this email. Your password will not change unless the recovery process is completed successfully.</p>
                        </td></tr>
                      </table>
                      <p style="margin:28px 0 5px;font-size:12px;color:#8AF5FF;">Stay connected to the ocean.</p>
                      <p style="margin:0;font-size:11px;color:#9BB5C4;">WWMS Security Team</p>
                    </td></tr>
                    <tr><td align="center" style="padding:24px 12px 0;">
                      <p style="margin:0 0 7px;font-size:10px;line-height:1.8;color:#8CA9B9;">Sri Lanka Coast Guard · WWMS</p>
                      <p style="margin:0;font-size:10px;line-height:1.8;color:#8CA9B9;">Your connection to the ocean, protected.</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;
        return new("WWMS | Your Ocean Access Verification Code", text, html);
    }
}
