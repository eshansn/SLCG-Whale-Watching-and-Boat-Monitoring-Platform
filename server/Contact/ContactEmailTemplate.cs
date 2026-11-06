using System.Net;

namespace WhaleWatching.Api.Contact;

public sealed record ContactEmailContent(string Text, string Html);

public static class ContactEmailTemplate
{
    public static ContactEmailContent Build(ContactRequest request)
    {
        var name = WebUtility.HtmlEncode(request.Name);
        var email = WebUtility.HtmlEncode(request.Email);
        var message = WebUtility.HtmlEncode(request.Message.Replace("\r\n", "\n").Replace('\r', '\n'))
            .Replace("\n", "<br>");
        var text = $"""
            WWMS | WHALE-WATCHING & BOAT MONITORING SYSTEM
            Sri Lanka Coast Guard · Website inquiry

            A new inquiry has arrived.

            Name: {request.Name}
            Email: {request.Email}

            {request.Message}

            Reply to this email to respond directly to the sender.

            Stay connected to the ocean.
            WWMS
            """;
        // Match the existing recovery email's ocean palette. Inline styles and tables
        // preserve the message in clients that do not support the web app's CSS.
        var html = $$"""
            <!doctype html>
            <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <meta name="color-scheme" content="dark">
              <title>WWMS website inquiry</title>
            </head>
            <body style="margin:0;padding:0;background-color:#020912;color:#EAFBFF;font-family:Arial,Helvetica,sans-serif;">
              <div style="display:none;max-height:0;overflow:hidden;opacity:0;">A new message from the WWMS website. Reply directly to the sender.</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#020912" style="width:100%;background-color:#020912;">
                <tr><td align="center" style="padding:36px 16px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:540px;">
                    <tr><td style="padding:0 8px 24px;color:#EAFBFF;">
                      <p style="margin:0 0 7px;font-size:23px;font-weight:bold;letter-spacing:3px;">WWMS</p>
                      <p style="margin:0;font-size:9px;line-height:1.8;letter-spacing:1.4px;color:#9BB5C4;">WHALE-WATCHING &amp; BOAT MONITORING SYSTEM</p>
                    </td></tr>
                    <tr><td bgcolor="#061827" style="background-color:#061827;border:1px solid #173747;border-top:2px solid #35E6F7;border-radius:14px;padding:32px 24px;">
                      <p style="margin:0 0 22px;font-size:9px;font-weight:bold;letter-spacing:2px;color:#8AF5FF;">WEBSITE INQUIRY</p>
                      <h1 style="margin:0 0 16px;font-size:27px;line-height:1.25;letter-spacing:-.7px;font-weight:normal;color:#EAFBFF;">A new inquiry<br>has arrived.</h1>
                      <p style="margin:0 0 26px;font-size:13px;line-height:1.9;color:#9BB5C4;">Someone reached out through the WWMS website. Their details and message are below.</p>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;">
                        <tr><td style="padding:0 0 16px;border-bottom:1px solid #173747;overflow-wrap:anywhere;word-break:break-word;">
                          <p style="margin:0 0 7px;font-size:9px;letter-spacing:1.5px;color:#8CA9B9;">FROM</p>
                          <p style="margin:0;font-size:15px;line-height:1.7;color:#EAFBFF;">{{name}}</p>
                        </td></tr>
                        <tr><td style="padding:16px 0 24px;overflow-wrap:anywhere;word-break:break-word;">
                          <p style="margin:0 0 7px;font-size:9px;letter-spacing:1.5px;color:#8CA9B9;">EMAIL ADDRESS</p>
                          <p style="margin:0;font-size:13px;line-height:1.8;color:#8AF5FF;">{{email}}</p>
                        </td></tr>
                        <tr><td bgcolor="#04101C" style="background-color:#04101C;border:1px solid #1B4557;border-radius:10px;padding:20px;overflow-wrap:anywhere;word-break:break-word;">
                          <p style="margin:0 0 13px;font-size:9px;letter-spacing:1.5px;color:#8CA9B9;">MESSAGE</p>
                          <p style="margin:0;font-size:14px;line-height:1.9;color:#EAFBFF;">{{message}}</p>
                        </td></tr>
                      </table>
                      <p style="margin:22px 0 0;font-size:11px;line-height:1.9;color:#9BB5C4;">Reply to this email to respond directly to the sender.</p>
                      <p style="margin:28px 0 5px;font-size:12px;color:#8AF5FF;">Stay connected to the ocean.</p>
                      <p style="margin:0;font-size:11px;color:#9BB5C4;">WWMS</p>
                    </td></tr>
                    <tr><td align="center" style="padding:24px 12px 0;">
                      <p style="margin:0 0 7px;font-size:10px;line-height:1.8;color:#8CA9B9;">Sri Lanka Coast Guard · WWMS</p>
                      <p style="margin:0;font-size:10px;line-height:1.8;color:#8CA9B9;">Your connection to the ocean.</p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;
        return new(text, html);
    }
}
