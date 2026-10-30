using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Domain;
using WhaleWatching.Api.Profiles;

namespace WhaleWatching.Api.Tests;

internal static class CrewCertificateFixtures
{
    // A small real PDF document in a disposable test database, never a production certificate.
    public static byte[] Pdf()
    {
        var text = "%PDF-1.4\n";
        var offsets = new List<int> { 0 };
        foreach (var body in new[] { "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>" })
        { offsets.Add(text.Length); text += $"{offsets.Count - 1} 0 obj\n{body}\nendobj\n"; }
        var xref = text.Length;
        text += "xref\n0 4\n0000000000 65535 f \n";
        text += string.Concat(offsets.Skip(1).Select(offset => $"{offset:D10} 00000 n \n"));
        return Encoding.ASCII.GetBytes(text + $"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
    }
}

public sealed class CrewCertificateValidationTests
{
    [Fact]
    public void StructuralValidation_RejectsTruncationMismatchedTypesAndCorruption()
    {
        var pdf = CrewCertificateFixtures.Pdf();
        Assert.True(CrewCertificateValidation.IsValidContent(pdf, "application/pdf"));
        Assert.False(CrewCertificateValidation.IsValidContent(pdf[..^10], "application/pdf"));
        Assert.False(CrewCertificateValidation.IsValidContent(pdf, "image/png"));
        Assert.False(CrewCertificateValidation.IsValidContent("%PDF-1.7\n%%EOF"u8.ToArray(), "application/pdf"));
        Assert.False(CrewCertificateValidation.IsValidContent(new byte[5 * 1024 * 1024 + 1], "application/pdf"));
        var png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
        Assert.True(CrewCertificateValidation.IsValidContent(png, "image/png"));
        png[45] ^= 1;
        Assert.False(CrewCertificateValidation.IsValidContent(png, "image/png"));
        Assert.False(CrewCertificateValidation.IsValidContent(new byte[] { 255, 216, 255, 217 }, "image/jpeg"));
        Assert.False(CrewCertificateValidation.IsValidContent("RIFF0000WEBP"u8.ToArray(), "image/webp"));
    }
}

public sealed partial class ComplaintAccountabilityTests
{
    [ComplaintBrowserFact]
    public async Task Browser_LiveCrewCertificates_UploadReviewDownloadAndApprove()
    {
        await using var test = await Harness.CreateAsync();
        var crew = await test.Db.Users.SingleAsync(u => u.Id == test.Users[PortalRoles.BoatCrew]);
        crew.IsCrewCertified = true; await test.Db.SaveChangesAsync();
        var statusIds = new Dictionary<string, Guid>();
        foreach (var status in new[] { "Unavailable", "Invalid" })
        {
            var fixture = new ApplicationUser { DisplayName = $"Test {status} Crew", UserName = $"certificate-{status}", Email = $"{status}@certificate-test.example" };
            test.Db.Users.Add(fixture);
            test.Db.UserRoles.Add(new Microsoft.AspNetCore.Identity.IdentityUserRole<Guid> { UserId = fixture.Id, RoleId = test.Roles[PortalRoles.BoatCrew] });
            test.Db.CrewCertificates.Add(new CrewCertificate { CrewUserId = fixture.Id, Name = "certificate.pdf", ContentType = "application/pdf", Content = status == "Unavailable" ? [] : "%PDF-1.7"u8.ToArray() });
            statusIds.Add(status, fixture.Id);
        }
        await test.Db.SaveChangesAsync();
        var info = new System.Diagnostics.ProcessStartInfo("node")
        { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        info.ArgumentList.Add(Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../scripts/tests/crew-certificates.cjs")));
        info.Environment["WWMS_WEB_URL"] = test.Client.BaseAddress!.ToString();
        info.Environment["WWMS_CERTIFICATE_CREW_ID"] = crew.Id.ToString();
        info.Environment["WWMS_TEST_CERTIFICATE_PDF"] = Convert.ToBase64String(CrewCertificateFixtures.Pdf());
        info.Environment["WWMS_UNAVAILABLE_CREW_ID"] = statusIds["Unavailable"].ToString();
        info.Environment["WWMS_INVALID_CREW_ID"] = statusIds["Invalid"].ToString();
        using var process = System.Diagnostics.Process.Start(info)!;
        var output = process.StandardOutput.ReadToEndAsync(); var errors = process.StandardError.ReadToEndAsync();
        try { await process.WaitForExitAsync(new CancellationTokenSource(TimeSpan.FromMinutes(4)).Token); }
        catch (OperationCanceledException) { process.Kill(entireProcessTree: true); throw; }
        Assert.True(process.ExitCode == 0, await output + await errors);
        Assert.True(await test.Db.Users.AsNoTracking().Where(u => u.Id == crew.Id).Select(u => u.IsCrewCertified).SingleAsync());
        Assert.Equal(4, await test.Db.CrewCertificates.CountAsync(d => d.CrewUserId == crew.Id));
    }

    private static MultipartFormDataContent CertificateUpload(byte[]? bytes = null, string name = "certificate.pdf", string type = "application/pdf")
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes ?? CrewCertificateFixtures.Pdf());
        file.Headers.ContentType = new MediaTypeHeaderValue(type);
        form.Add(file, "certificate", name);
        return form;
    }

    [SqlServerFact]
    public async Task CrewCertificates_ApprovalRequiresOwnedAvailableValidBytes_AndPreservesLegacyApproval()
    {
        await using var test = await Harness.CreateAsync();
        var crewId = test.Users[PortalRoles.BoatCrew];
        var path = $"/api/operations/crew/{crewId}/approval";
        var approved = new { approval = "Approved", certificateId = Guid.NewGuid(), hasCertificate = true };
        async Task<bool> Certified() => await test.Db.Users.AsNoTracking().Where(u => u.Id == crewId).Select(u => u.IsCrewCertified).SingleAsync();
        foreach (var role in PortalRoles.All.Except([PortalRoles.Admin, PortalRoles.Wildlife]))
            Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(role, HttpMethod.Patch, path, approved)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await test.Send(null, HttpMethod.Patch, path, approved)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await test.Send(PortalRoles.Admin, HttpMethod.Patch, $"/api/operations/crew/{Guid.NewGuid()}/approval", approved)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await test.Send(PortalRoles.Admin, HttpMethod.Patch, $"/api/operations/crew/{test.Users[PortalRoles.BoatOwner]}/approval", approved)).StatusCode);
        var missing = await test.Send(PortalRoles.Admin, HttpMethod.Patch, path, approved);
        Assert.Equal(HttpStatusCode.Conflict, missing.StatusCode);
        Assert.Contains("Certificate required", await missing.Content.ReadAsStringAsync());
        Assert.False(await Certified());

        var unrelated = new CrewCertificate { CrewUserId = test.Users[PortalRoles.BoatOwner], Name = "other.pdf", ContentType = "application/pdf", Content = CrewCertificateFixtures.Pdf() };
        test.Db.CrewCertificates.Add(unrelated); await test.Db.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.Wildlife, HttpMethod.Patch, path, new { approval = "Approved", certificateId = unrelated.Id })).StatusCode);
        Assert.False(await Certified());
        var unavailable = new CrewCertificate { CrewUserId = crewId, Name = "missing.pdf", ContentType = "application/pdf", Content = [] };
        test.Db.CrewCertificates.Add(unavailable); await test.Db.SaveChangesAsync();
        var absentBytes = await test.Send(PortalRoles.Admin, HttpMethod.Patch, path, approved);
        Assert.Equal(HttpStatusCode.Conflict, absentBytes.StatusCode);
        Assert.Contains("unavailable", await absentBytes.Content.ReadAsStringAsync());
        Assert.False(await Certified());
        unavailable.Content = "%PDF-1.7\ntruncated"u8.ToArray(); await test.Db.SaveChangesAsync();
        var invalid = await test.Send(PortalRoles.Admin, HttpMethod.Patch, path, approved);
        Assert.Equal(HttpStatusCode.Conflict, invalid.StatusCode);
        Assert.Contains("valid PDF", await invalid.Content.ReadAsStringAsync());
        Assert.False(await Certified());

        var crew = await test.Db.Users.SingleAsync(u => u.Id == crewId);
        crew.IsCrewCertified = true; await test.Db.SaveChangesAsync();
        var audit = await test.Json(PortalRoles.Admin, "/api/admin/crew");
        var legacy = audit.EnumerateArray().Single(u => u.GetProperty("id").GetGuid() == crewId);
        Assert.True(legacy.GetProperty("certified").GetBoolean());
        Assert.False(legacy.GetProperty("certificate").GetProperty("canApprove").GetBoolean());
        Assert.Equal(HttpStatusCode.Conflict, (await test.Send(PortalRoles.Admin, HttpMethod.Patch, path, approved)).StatusCode);
        Assert.True(await Certified()); // Audit/failed reapproval must never revoke legacy records.
        await test.Ok(PortalRoles.Admin, HttpMethod.Patch, path, new { approval = "Rejected" });
        Assert.False(await Certified());

        var uploadPath = "/api/crew/profile/certificates";
        foreach (var bad in new[] { Array.Empty<byte>(), "not a PDF"u8.ToArray(), new byte[5 * 1024 * 1024 + 1] })
            Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(PortalRoles.BoatCrew, HttpMethod.Post, uploadPath, CertificateUpload(bad))).StatusCode);
        test.Failure.FailCertificateSave = true;
        Assert.Equal(HttpStatusCode.InternalServerError, (await test.Send(PortalRoles.BoatCrew, HttpMethod.Post, uploadPath, CertificateUpload())).StatusCode);
        Assert.Equal(1, await test.Db.CrewCertificates.CountAsync(d => d.CrewUserId == crewId));
        var uploaded = await (await test.Ok(PortalRoles.BoatCrew, HttpMethod.Post, uploadPath, CertificateUpload())).Content.ReadFromJsonAsync<JsonElement>();
        var id = uploaded.GetProperty("id").GetGuid();
        Assert.False(await Certified()); // Upload alone is never approval.
        Assert.Equal(HttpStatusCode.Forbidden, (await test.Send(PortalRoles.BoatOwner, HttpMethod.Get, $"/api/admin/crew/{crewId}/certificates/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await test.Send(PortalRoles.Admin, HttpMethod.Get, $"/api/admin/crew/{test.Users[PortalRoles.BoatOwner]}/certificates/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await test.Send(PortalRoles.Wildlife, HttpMethod.Get, $"/api/admin/crew/{crewId}/certificates/{id}")).StatusCode);
        test.Failure.FailNextSave = true;
        Assert.Equal(HttpStatusCode.InternalServerError, (await test.Send(PortalRoles.Admin, HttpMethod.Patch, path, approved)).StatusCode);
        Assert.False(await Certified()); // Even a failure after SQL writes rolls back approval.
        var concurrent = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => test.Send(PortalRoles.Admin, HttpMethod.Patch, path, approved)));
        Assert.All(concurrent, r => Assert.Equal(HttpStatusCode.NoContent, r.StatusCode));
        Assert.True(await Certified());
        await test.Ok(PortalRoles.Wildlife, HttpMethod.Patch, path, approved);
        Assert.True(await Certified());
    }

    [SqlServerFact]
    public async Task CrewCertificates_RegistrationIsAtomicAndCannotUseReferencesInsteadOfFiles()
    {
        await using var test = await Harness.CreateAsync();
        const string email = "new-crew@certificate-test.example";
        var details = new Dictionary<string, string> { ["userName"] = "certificate-crew", ["displayName"] = "Certificate Crew", ["nicNumber"] = "199123456789", ["email"] = email,
            ["role"] = PortalRoles.BoatCrew, ["phoneNumber"] = "+94771234567", ["password"] = "Certificate#2026!Test", ["certificateId"] = Guid.NewGuid().ToString(), ["hasCertificate"] = "true" };
        async Task<int> Accounts() => await test.Db.Users.CountAsync(u => u.Email == email);
        MultipartFormDataContent Form(byte[]? file = null, bool include = true)
        {
            var form = include ? CertificateUpload(file) : new MultipartFormDataContent();
            foreach (var item in details) form.Add(new StringContent(item.Value), item.Key);
            return form;
        }
        var missing = await test.Send(null, HttpMethod.Post, "/api/auth/register", details);
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Contains("Certificate required", await missing.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(null, HttpMethod.Post, "/api/auth/register", Form(include: false))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(null, HttpMethod.Post, "/api/auth/register", Form("%PDF-1.7"u8.ToArray()))).StatusCode);
        Assert.Equal(0, await Accounts());
        test.Failure.FailCertificateSave = true;
        Assert.Equal(HttpStatusCode.InternalServerError, (await test.Send(null, HttpMethod.Post, "/api/auth/register", Form())).StatusCode);
        Assert.Equal(0, await Accounts());
        Assert.False(await test.Db.CrewCertificates.AnyAsync(d => d.Name == "certificate.pdf"));
        await test.Ok(PortalRoles.Admin, HttpMethod.Post, "/api/auth/register", Form());
        var crew = await test.Db.Users.AsNoTracking().SingleAsync(u => u.Email == email);
        Assert.False(crew.IsCrewCertified);
        var document = await test.Db.CrewCertificates.AsNoTracking().SingleAsync(d => d.CrewUserId == crew.Id);
        Assert.Equal(CrewCertificateFixtures.Pdf(), document.Content);
        Assert.True(await test.Db.UserRoles.AnyAsync(r => r.UserId == crew.Id && r.RoleId == test.Roles[PortalRoles.BoatCrew]));
        await test.Ok(PortalRoles.Admin, HttpMethod.Patch, $"/api/operations/crew/{crew.Id}/approval", new { approval = "Approved" });
        Assert.True(await test.Db.Users.Where(u => u.Id == crew.Id).Select(u => u.IsCrewCertified).SingleAsync());
        Assert.Equal(HttpStatusCode.BadRequest, (await test.Send(null, HttpMethod.Post, "/api/auth/register", Form())).StatusCode);
        Assert.Equal(1, await Accounts());
        // Owner registration keeps its original JSON contract and needs no crew certificate.
        details["userName"] = "certificate-owner"; details["email"] = "owner@certificate-test.example";
        details["nicNumber"] = "199123456788"; details["role"] = PortalRoles.BoatOwner;
        var owner = await test.Send(null, HttpMethod.Post, "/api/auth/register", details);
        Assert.Equal(HttpStatusCode.Accepted, owner.StatusCode);
    }
}
