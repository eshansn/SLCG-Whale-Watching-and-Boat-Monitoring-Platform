using System.Buffers.Binary;
using System.Text;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Profiles;

public sealed record CrewCertificateStatus(string Status, string Message)
{
    public bool CanApprove => Status == "Valid";
}

// Certificates live as private SQL bytes, keyed by a generated ID, never as user supplied paths.
public static class CrewCertificateValidation
{
    public const int MaximumBytes = 5 * 1024 * 1024;
    private static readonly Dictionary<string, string[]> Extensions = new()
    {
        ["application/pdf"] = [".pdf"], ["image/jpeg"] = [".jpg", ".jpeg"],
        ["image/png"] = [".png"], ["image/webp"] = [".webp"]
    };
    public static CrewCertificateStatus Missing => new("Missing", "Certificate required before approval. Please upload your certificate.");
    public static CrewCertificateStatus Unavailable => new("Unavailable", "Certificate unavailable. Please upload the certificate again.");
    public static CrewCertificateStatus Invalid => new("Invalid", "A valid PDF, JPEG, PNG, or WebP certificate up to 5 MB is required. Please upload the certificate again.");
    public static CrewCertificateStatus Valid => new("Valid", "Certificate available for inspection and approval.");

    public static async Task<(CrewCertificate? Document, string? Error)> ReadAsync(IFormFile? file, CancellationToken ct)
    {
        if (file is null) return (null, "Certificate required. Please upload your certificate before submitting your registration.");
        var type = file.ContentType.ToLowerInvariant();
        var name = Path.GetFileName(file.FileName.Replace('\\', '/'));
        if (file.Length is <= 0 or > MaximumBytes || !Extensions.TryGetValue(type, out var extensions) ||
            string.IsNullOrWhiteSpace(name) || name.Length > 255 || name.Any(char.IsControl) ||
            !extensions.Contains(Path.GetExtension(name), StringComparer.OrdinalIgnoreCase))
            return (null, Invalid.Message);
        // Bound the actual stream too; do not rely on the supplied length or MIME type.
        await using var input = file.OpenReadStream();
        await using var output = new MemoryStream();
        var buffer = new byte[81920];
        int read;
        while ((read = await input.ReadAsync(buffer, ct)) > 0)
        {
            if (output.Length + read > MaximumBytes) return (null, Invalid.Message);
            await output.WriteAsync(buffer.AsMemory(0, read), ct);
        }
        var bytes = output.ToArray();
        if (bytes.LongLength != file.Length || !IsValidContent(bytes, type)) return (null, Invalid.Message);
        return (new CrewCertificate { Name = name, ContentType = type, Content = bytes }, null);
    }

    public static CrewCertificateStatus Inspect(IEnumerable<CrewCertificate> documents)
    {
        var result = Missing;
        foreach (var document in documents)
        {
            if (document.Content is not { Length: > 0 })
            {
                if (result.Status == "Missing") result = Unavailable;
            }
            else if (IsValidContent(document.Content, document.ContentType)) return Valid;
            else result = Invalid;
        }
        return result;
    }

    public static async Task<Dictionary<Guid, CrewCertificateStatus>> StatusesAsync(
        WhaleWatchingDbContext db, Guid[] crewIds, CancellationToken ct)
    {
        var statuses = crewIds.Distinct().ToDictionary(id => id, _ => Missing);
        // Stream one file at a time so the staff audit does not buffer every private file.
        await foreach (var document in db.CrewCertificates.AsNoTracking()
            .Where(d => crewIds.Contains(d.CrewUserId)).AsAsyncEnumerable().WithCancellation(ct))
        {
            var status = Inspect([document]);
            var previous = statuses[document.CrewUserId];
            if (previous.CanApprove || (previous.Status == "Invalid" && !status.CanApprove)) continue;
            statuses[document.CrewUserId] = status;
        }
        return statuses;
    }

    // Structural validation supplements MIME/extension checks. It does not certify a document's
    // authenticity; the existing officer download/approval process remains responsible for review.
    public static bool IsValidContent(byte[] bytes, string type)
    {
        if (bytes.Length is 0 or > MaximumBytes) return false;
        var data = bytes.AsSpan();
        return type.ToLowerInvariant() switch
        {
            "application/pdf" => ValidPdf(bytes),
            "image/png" => ValidPng(data),
            "image/jpeg" => ValidJpeg(data),
            "image/webp" => ValidWebP(data),
            _ => false
        };
    }

    private static bool ValidPdf(byte[] bytes)
    {
        var data = Encoding.Latin1.GetString(bytes);
        if (!data.StartsWith("%PDF-1.", StringComparison.Ordinal) && !data.StartsWith("%PDF-2.0", StringComparison.Ordinal)) return false;
        var end = data.LastIndexOf("%%EOF", StringComparison.Ordinal);
        var start = data.LastIndexOf("startxref", StringComparison.Ordinal);
        if (start < 0 || end <= start || data[(end + 5)..].Any(c => !char.IsWhiteSpace(c))) return false;
        if (!long.TryParse(data[(start + 9)..end].Trim(), out var offset) || offset < 0 || offset >= start) return false;
        // Support both traditional xref tables and PDF 1.5+ cross-reference streams.
        var xref = data[(int)offset..start];
        return data.Contains("/Root", StringComparison.Ordinal) && data.Contains("/Catalog", StringComparison.Ordinal) &&
            data.Contains("endobj", StringComparison.Ordinal) &&
            (xref.StartsWith("xref", StringComparison.Ordinal) ||
                System.Text.RegularExpressions.Regex.IsMatch(xref, @"/Type\s*/XRef\b", System.Text.RegularExpressions.RegexOptions.CultureInvariant, TimeSpan.FromSeconds(1)));
    }

    private static bool ValidPng(ReadOnlySpan<byte> data)
    {
        if (!data.StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) return false;
        var offset = 8; var header = false; var image = false;
        while (offset <= data.Length - 12)
        {
            var length = BinaryPrimitives.ReadUInt32BigEndian(data.Slice(offset, 4));
            if (length > (uint)(data.Length - offset - 12)) return false;
            var size = (int)length; var chunk = data.Slice(offset + 4, 4 + size);
            uint crc = 0xffffffff;
            foreach (var value in chunk)
            {
                crc ^= value;
                for (var bit = 0; bit < 8; bit++) crc = (crc >> 1) ^ ((crc & 1) == 1 ? 0xedb88320u : 0);
            }
            if (~crc != BinaryPrimitives.ReadUInt32BigEndian(data.Slice(offset + 8 + size, 4))) return false;
            var kind = chunk[..4];
            if (!header)
            {
                if (!kind.SequenceEqual("IHDR"u8) || size != 13 ||
                    BinaryPrimitives.ReadUInt32BigEndian(chunk.Slice(4, 4)) == 0 ||
                    BinaryPrimitives.ReadUInt32BigEndian(chunk.Slice(8, 4)) == 0) return false;
                header = true;
            }
            else if (kind.SequenceEqual("IHDR"u8)) return false;
            if (kind.SequenceEqual("IDAT"u8) && size > 0) image = true;
            offset += size + 12;
            if (kind.SequenceEqual("IEND"u8)) return size == 0 && image && offset == data.Length;
        }
        return false;
    }

    private static bool ValidJpeg(ReadOnlySpan<byte> data)
    {
        if (data.Length < 4 || !data[..2].SequenceEqual(new byte[] { 0xff, 0xd8 }) ||
            !data[^2..].SequenceEqual(new byte[] { 0xff, 0xd9 })) return false;
        var offset = 2; var frame = false;
        while (offset < data.Length - 2)
        {
            if (data[offset++] != 0xff) return false;
            while (offset < data.Length && data[offset] == 0xff) offset++;
            if (offset >= data.Length) return false;
            var marker = data[offset++];
            if (offset + 2 > data.Length) return false;
            var length = BinaryPrimitives.ReadUInt16BigEndian(data.Slice(offset, 2));
            if (length < 2 || offset + length > data.Length - 2) return false;
            if (marker is >= 0xc0 and <= 0xcf && marker is not (0xc4 or 0xc8 or 0xcc))
            {
                if (length < 8 || BinaryPrimitives.ReadUInt16BigEndian(data.Slice(offset + 3, 2)) == 0 ||
                    BinaryPrimitives.ReadUInt16BigEndian(data.Slice(offset + 5, 2)) == 0) return false;
                frame = true;
            }
            if (marker == 0xda) return frame && length >= 6 && offset + length < data.Length - 2;
            offset += length;
        }
        return false;
    }

    private static bool ValidWebP(ReadOnlySpan<byte> data, int depth = 0)
    {
        if (depth > 2) return false;
        if (data.Length < 20 || !data[..4].SequenceEqual("RIFF"u8) || !data.Slice(8, 4).SequenceEqual("WEBP"u8) ||
            BinaryPrimitives.ReadUInt32LittleEndian(data.Slice(4, 4)) != data.Length - 8) return false;
        var offset = 12; var image = false;
        while (offset <= data.Length - 8)
        {
            var kind = data.Slice(offset, 4);
            var length = BinaryPrimitives.ReadUInt32LittleEndian(data.Slice(offset + 4, 4));
            if (length > data.Length - offset - 8) return false;
            var payload = data.Slice(offset + 8, (int)length);
            if (kind.SequenceEqual("VP8 "u8))
                image |= length >= 10 && payload.Slice(3, 3).SequenceEqual(new byte[] { 0x9d, 0x01, 0x2a }) &&
                    (BinaryPrimitives.ReadUInt16LittleEndian(payload.Slice(6, 2)) & 0x3fff) > 0 &&
                    (BinaryPrimitives.ReadUInt16LittleEndian(payload.Slice(8, 2)) & 0x3fff) > 0;
            if (kind.SequenceEqual("VP8L"u8)) image |= length >= 5 && payload[0] == 0x2f;
            // Animated WebP keeps image bitstreams inside ANMF chunks.
            if (kind.SequenceEqual("ANMF"u8) && length > 16)
            {
                var frame = payload[16..];
                var wrapped = new byte[12 + frame.Length];
                "RIFF"u8.CopyTo(wrapped); BinaryPrimitives.WriteUInt32LittleEndian(wrapped.AsSpan(4), (uint)wrapped.Length - 8);
                "WEBP"u8.CopyTo(wrapped.AsSpan(8)); frame.CopyTo(wrapped.AsSpan(12));
                image |= ValidWebP(wrapped, depth + 1);
            }
            offset += 8 + (int)length + (int)(length & 1);
        }
        return image && offset == data.Length;
    }
}
