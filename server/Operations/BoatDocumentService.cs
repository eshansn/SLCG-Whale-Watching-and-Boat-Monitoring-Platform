using System.Data;
using Microsoft.EntityFrameworkCore;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Operations;

public sealed record BoatDocumentValidationResult(bool Succeeded, string? Error = null)
{
    public static BoatDocumentValidationResult Success() => new(true);
    public static BoatDocumentValidationResult Failure(string error) => new(false, error);
}

public sealed class BoatDocumentService(WhaleWatchingDbContext db, TimeProvider timeProvider)
{
    public const long MaximumFileSize = 10 * 1024 * 1024;
    private static readonly IReadOnlyDictionary<string, string> AllowedExtensions =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [".pdf"] = "application/pdf",
            [".jpg"] = "image/jpeg",
            [".jpeg"] = "image/jpeg",
            [".png"] = "image/png",
        };

    public async Task<(BoatDocument? Document, string? Error, bool Forbidden)> UploadAsync(
        Guid boatId, Guid ownerId, string documentType, IFormFile file, CancellationToken ct)
    {
        var boat = await db.Boats.IgnoreQueryFilters().SingleOrDefaultAsync(x =>
            x.Id == boatId && !x.IsDeleted, ct);
        if (boat is null || boat.OwnerId != ownerId) return (null, null, true);
        if (!BoatDocumentRequirements.TryGet(documentType, out var requirement))
            return (null, "The document type is not one of the required vessel documents.", false);

        var fileValidation = await ReadAndValidateFileAsync(file, ct);
        if (fileValidation.Error is not null) return (null, fileValidation.Error, false);
        if (requirement.Type == BoatDocumentRequirements.VesselPhotographOrDiagram &&
            fileValidation.ContentType is not ("image/jpeg" or "image/png"))
            return (null, "The vessel photograph or diagram must be a JPEG or PNG image.", false);

        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var previous = await db.BoatDocuments.Where(x => x.BoatId == boatId &&
                    x.DocumentType == requirement.Type)
                .OrderByDescending(x => x.Version).ThenByDescending(x => x.UploadedAtUtc)
                .FirstOrDefaultAsync(ct);
            var nextVersion = (previous?.Version ?? 0) + 1;
            if (previous is { Status: BoatDocumentStatus.PendingReview, IsCurrent: false })
            {
                previous.Status = BoatDocumentStatus.Superseded;
                previous.UpdatedAtUtc = timeProvider.GetUtcNow();
            }

            var now = timeProvider.GetUtcNow();
            var document = new BoatDocument
            {
                Id = Guid.NewGuid(),
                BoatId = boatId,
                Name = requirement.DisplayName,
                DocumentType = requirement.Type,
                FileName = Path.GetFileName(file.FileName),
                StoredFileName = $"{Guid.NewGuid():N}{fileValidation.Extension}",
                ContentType = fileValidation.ContentType!,
                FileSize = fileValidation.Content!.LongLength,
                Content = fileValidation.Content,
                UploadedAtUtc = now,
                UploadedByUserId = ownerId,
                Status = BoatDocumentStatus.PendingReview,
                Version = nextVersion,
                IsCurrent = false,
                ReplacesDocumentId = previous?.Id,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            };
            db.BoatDocuments.Add(document);
            if (requirement.Type == BoatDocumentRequirements.VesselPhotographOrDiagram)
            {
                // The file is stored only on the document; both references point to that file.
                document.FileUrl = BoatDisplayImage.DocumentUrl(boatId, document.Id);
                var imageBoat = await db.Boats.SingleAsync(x => x.Id == boatId, ct);
                imageBoat.ImageUrl = document.FileUrl;
            }
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return (document, (string?)null, false);
        });
    }

    public async Task<BoatDocumentValidationResult> SubmitRegistrationAsync(
        Guid boatId, Guid ownerId, CancellationToken ct)
    {
        var boat = await db.Boats.SingleOrDefaultAsync(x => x.Id == boatId && x.OwnerId == ownerId, ct);
        if (boat is null) return BoatDocumentValidationResult.Failure("Boat registration was not found.");
        if (boat.DocumentRequirementsVersion < BoatDocumentRequirements.CurrentVersion)
            return BoatDocumentValidationResult.Failure("This legacy registration does not use the new submission workflow.");
        if (boat.RegistrationSubmittedAtUtc is not null) return BoatDocumentValidationResult.Success();

        var uploadedTypes = await db.BoatDocuments.AsNoTracking()
            .Where(x => x.BoatId == boatId && x.Status == BoatDocumentStatus.PendingReview)
            .Select(x => x.DocumentType).Distinct().ToListAsync(ct);
        var missing = BoatDocumentRequirements.All
            .Where(requirement => !uploadedTypes.Contains(requirement.Type))
            .Select(requirement => requirement.DisplayName).ToArray();
        if (missing.Length > 0)
            return BoatDocumentValidationResult.Failure(
                "Please upload all required vessel documents before submitting the registration.");

        boat.RegistrationSubmittedAtUtc = timeProvider.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return BoatDocumentValidationResult.Success();
    }

    public async Task<BoatDocumentValidationResult> ReviewAsync(Guid boatId, Guid documentId,
        Guid reviewerId, string status, DateOnly? expiryDate, string? rejectionReason, CancellationToken ct)
    {
        if (!Enum.TryParse<BoatDocumentStatus>(status, true, out var nextStatus) ||
            nextStatus is not (BoatDocumentStatus.Approved or BoatDocumentStatus.Rejected))
            return BoatDocumentValidationResult.Failure("Document status must be Approved or Rejected.");

        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var document = await db.BoatDocuments.Include(x => x.Boat)
                .SingleOrDefaultAsync(x => x.Id == documentId && x.BoatId == boatId, ct);
            if (document is null) return BoatDocumentValidationResult.Failure("Boat document was not found.");
            if (document.Boat.DocumentRequirementsVersion >= BoatDocumentRequirements.CurrentVersion &&
                document.Boat.RegistrationSubmittedAtUtc is null)
                return BoatDocumentValidationResult.Failure("The boat registration has not been submitted.");
            if (document.Status != BoatDocumentStatus.PendingReview)
                return BoatDocumentValidationResult.Failure("Only a pending document can be reviewed.");

            var isRenewable = BoatDocumentRequirements.TryGet(document.DocumentType, out var requirement) &&
                requirement.IsRenewable;
            var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
            if (nextStatus == BoatDocumentStatus.Approved && isRenewable && expiryDate is null)
                return BoatDocumentValidationResult.Failure("An expiry date is required for this annually renewable document.");
            if (nextStatus == BoatDocumentStatus.Approved && expiryDate < today)
                return BoatDocumentValidationResult.Failure("The expiry date cannot be in the past.");
            if (nextStatus == BoatDocumentStatus.Rejected && string.IsNullOrWhiteSpace(rejectionReason))
                return BoatDocumentValidationResult.Failure("A rejection reason is required.");

            var now = timeProvider.GetUtcNow();
            if (nextStatus == BoatDocumentStatus.Approved)
            {
                var oldCurrent = await db.BoatDocuments.Where(x => x.BoatId == boatId &&
                        x.DocumentType == document.DocumentType && x.IsCurrent && x.Id != document.Id)
                    .ToListAsync(ct);
                foreach (var previous in oldCurrent)
                {
                    previous.IsCurrent = false;
                    previous.Status = BoatDocumentStatus.Superseded;
                    previous.UpdatedAtUtc = now;
                }
                document.IsCurrent = true;
                document.ExpirationDate = isRenewable ? expiryDate : null;
                document.RejectionReason = null;
            }
            else
            {
                document.IsCurrent = false;
                document.ExpirationDate = null;
                document.RejectionReason = rejectionReason!.Trim();
            }
            document.Status = nextStatus;
            document.VerifiedAtUtc = now;
            document.VerifiedByUserId = reviewerId;
            document.UpdatedAtUtc = now;
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return BoatDocumentValidationResult.Success();
        });
    }

    public async Task<BoatDocumentValidationResult> ValidateWildlifeApprovalAsync(Guid boatId, CancellationToken ct)
    {
        var boat = await db.Boats.AsNoTracking().SingleOrDefaultAsync(x => x.Id == boatId, ct);
        if (boat is null) return BoatDocumentValidationResult.Failure("Boat registration was not found.");
        if (boat.DocumentRequirementsVersion < BoatDocumentRequirements.CurrentVersion)
            return BoatDocumentValidationResult.Success();
        if (boat.RegistrationSubmittedAtUtc is null)
            return BoatDocumentValidationResult.Failure("The boat owner has not submitted this registration.");

        var current = await db.BoatDocuments.AsNoTracking().Where(x => x.BoatId == boatId &&
                x.IsCurrent && x.Status == BoatDocumentStatus.Approved)
            .ToListAsync(ct);
        foreach (var requirement in BoatDocumentRequirements.All)
        {
            var document = current.FirstOrDefault(x => x.DocumentType == requirement.Type);
            if (document is null)
                return BoatDocumentValidationResult.Failure(
                    $"{requirement.DisplayName} must be approved before the boat registration can be approved.");
            if (requirement.IsRenewable && document.ExpirationDate is null)
                return BoatDocumentValidationResult.Failure(
                    $"Enter an expiry date for {requirement.DisplayName} before approving the boat registration.");
        }
        return BoatDocumentValidationResult.Success();
    }

    private static async Task<(byte[]? Content, string? ContentType, string Extension, string? Error)>
        ReadAndValidateFileAsync(IFormFile file, CancellationToken ct)
    {
        if (file.Length is <= 0 or > MaximumFileSize)
            return (null, null, string.Empty, "Document must be between 1 byte and 10 MB.");
        var extension = Path.GetExtension(Path.GetFileName(file.FileName));
        if (!AllowedExtensions.TryGetValue(extension, out var expectedContentType))
            return (null, null, string.Empty, "Document must be a PDF, JPG/JPEG, or PNG file.");
        if (!string.Equals(file.ContentType, expectedContentType, StringComparison.OrdinalIgnoreCase) &&
            !(extension.Equals(".jpg", StringComparison.OrdinalIgnoreCase) &&
              string.Equals(file.ContentType, "image/jpg", StringComparison.OrdinalIgnoreCase)))
            return (null, null, string.Empty, "The file extension and content type do not match.");

        await using var input = file.OpenReadStream();
        await using var output = new MemoryStream((int)file.Length);
        await input.CopyToAsync(output, ct);
        var content = output.ToArray();
        var hasValidSignature = expectedContentType switch
        {
            "application/pdf" => content.Length >= 5 && content.AsSpan(0, 5).SequenceEqual("%PDF-"u8),
            "image/jpeg" => content.Length >= 3 && content[0] == 0xFF && content[1] == 0xD8 && content[2] == 0xFF,
            "image/png" => content.Length >= 8 && content.AsSpan(0, 8).SequenceEqual(
                new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }),
            _ => false,
        };
        return hasValidSignature
            ? (content, expectedContentType, extension.ToLowerInvariant(), null)
            : (null, null, string.Empty, "The uploaded file content is not a valid PDF, JPEG, or PNG.");
    }
}
