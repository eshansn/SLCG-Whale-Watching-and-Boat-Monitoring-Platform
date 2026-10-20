using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Operations;

public static class BoatDisplayImage
{
    public static string DocumentUrl(Guid boatId, Guid documentId) =>
        $"/api/operations/boats/{boatId}/image/{documentId}";

    // Display the latest uploaded photograph immediately, independently of document approval.
    // IsCurrent means the approved certificate version, not the current display image.
    public static IQueryable<BoatDocument> Photographs(IQueryable<BoatDocument> documents) =>
        documents.Where(document =>
            (document.DocumentType == BoatDocumentRequirements.VesselPhotographOrDiagram ||
             document.Name == "Color Aerial Photograph or Diagram of the Vessel") &&
            (document.ContentType == "image/jpeg" || document.ContentType == "image/png") &&
            ((document.Content != null && document.Content.Length > 0) ||
             (document.FileUrl != null && document.FileUrl != "")));

    public static async Task<Dictionary<Guid, string>> GetUrlsAsync(
        IQueryable<BoatDocument> documents, CancellationToken ct)
    {
        var photographs = await Photographs(documents)
            .OrderByDescending(document => document.Version)
            .ThenByDescending(document => document.UploadedAtUtc)
            .ThenByDescending(document => document.Id)
            .Select(document => new
            {
                document.Id, document.BoatId, document.FileUrl,
                HasContent = document.Content != null && document.Content.Length > 0
            }).ToListAsync(ct);
        return photographs.GroupBy(document => document.BoatId).ToDictionary(group => group.Key, group =>
        {
            var latest = group.First();
            return latest.HasContent ? DocumentUrl(latest.BoatId, latest.Id) : latest.FileUrl!;
        });
    }
}
