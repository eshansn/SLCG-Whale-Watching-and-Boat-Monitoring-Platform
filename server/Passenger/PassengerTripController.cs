using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Passenger;

[ApiController]
[Route("api/passenger/trips")]
[AllowAnonymous]
public sealed class PassengerTripController(WhaleWatchingDbContext db) : ControllerBase
{
    [HttpGet("~/api/passenger/session/trip")]
    public async Task<ActionResult<PassengerTripPreviewDto>> ActiveTrip(CancellationToken ct)
    {
        var rawToken = Request.Headers["X-Passenger-Session"].ToString();
        if (string.IsNullOrWhiteSpace(rawToken)) return Unauthorized();
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
        var preview = await db.PassengerSessions.AsNoTracking().Where(x =>
                x.TokenHash == hash && x.ExpiresAtUtc > DateTimeOffset.UtcNow)
            .Select(x => new PassengerTripPreviewDto(x.Trip.Id, x.Trip.Boat.Name,
                x.Trip.Boat.RegistrationNumber, x.Trip.ScheduledDepartureUtc, x.Trip.Status.ToString(),
                x.Trip.ShoreApproval.ToString(), x.Trip.Boat.MaximumCapacity,
                x.Trip.Status != TripStatus.Completed && x.Trip.Status != TripStatus.Cancelled,
                x.Trip.InvitationCode ?? string.Empty))
            .SingleOrDefaultAsync(ct);
        return preview is null ? Unauthorized() : Ok(preview);
    }

    [HttpGet("~/api/passenger/session/qr")]
    public async Task<ActionResult<PassengerPersonalQrDto>> PersonalQr(CancellationToken ct)
    {
        var rawToken = Request.Headers["X-Passenger-Session"].ToString();
        if (string.IsNullOrWhiteSpace(rawToken)) return Unauthorized();
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
        var session = await db.PassengerSessions.Include(x => x.Passenger).SingleOrDefaultAsync(x =>
            x.TokenHash == hash && x.ExpiresAtUtc > DateTimeOffset.UtcNow, ct);
        if (session is null) return Unauthorized();
        session.Passenger.PersonalQrToken ??= CreatePersonalQrToken();
        await db.SaveChangesAsync(ct);
        return Ok(new PassengerPersonalQrDto(session.Passenger.Id, session.Passenger.Name,
            session.Passenger.PersonalQrToken, $"wwms:passenger:{session.Passenger.PersonalQrToken}"));
    }

    [HttpGet("{invitationCode}")]
    public async Task<ActionResult<PassengerTripPreviewDto>> Preview(string invitationCode, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(invitationCode) || invitationCode.Length > 64)
            return NotFound();
        var preview = await db.Trips.AsNoTracking().Where(x => x.InvitationCode == invitationCode)
            .Select(x => new PassengerTripPreviewDto(x.Id, x.Boat.Name, x.Boat.RegistrationNumber,
                x.ScheduledDepartureUtc, x.Status.ToString(), x.ShoreApproval.ToString(),
                x.Boat.MaximumCapacity, x.Status != TripStatus.Completed && x.Status != TripStatus.Cancelled,
                x.InvitationCode ?? string.Empty))
            .SingleOrDefaultAsync(ct);
        return preview is null ? NotFound() : Ok(preview);
    }

    [HttpPost("{invitationCode}/passengers")]
    public async Task<ActionResult<RegisteredPassengerDto>> Register(string invitationCode,
        RegisterPassengerRequest request, CancellationToken ct)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult<RegisteredPassengerDto>>(async () =>
        {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var trip = await db.Trips.Include(x => x.Boat).SingleOrDefaultAsync(x => x.InvitationCode == invitationCode, ct);
        if (trip is null) return NotFound();
        if (trip.Status is TripStatus.Completed or TripStatus.Cancelled)
            return Conflict(new { message = "This trip is no longer accepting passenger registrations." });
        if (trip.PassengerCount >= trip.Boat.MaximumCapacity)
            return Conflict(new { message = "This trip has reached its maximum passenger capacity." });

        var normalizedId = Normalize(request.IdentificationNumber);
        if (await db.PassengerProfiles.AnyAsync(x => x.NormalizedIdentificationNumber == normalizedId, ct))
            return Conflict(new { message = "A passenger with this NIC or passport already exists. Use Returning Passenger." });
        var passenger = new PassengerProfile { Id = Guid.NewGuid(), Name = request.Name.Trim(),
            IdentificationNumber = request.IdentificationNumber.Trim().ToUpperInvariant(),
            NormalizedIdentificationNumber = normalizedId, PhoneNumber = request.PhoneNumber.Trim(),
            NormalizedPhoneNumber = Normalize(request.PhoneNumber), PassengerType = request.PassengerType,
            Gender = request.Gender, AgeCategory = request.AgeCategory, CreatedAtUtc = DateTimeOffset.UtcNow,
            PersonalQrToken = CreatePersonalQrToken() };
        db.PassengerProfiles.Add(passenger);
        db.TripPassengers.Add(new TripPassenger { Id = Guid.NewGuid(), TripId = trip.Id,
            PassengerId = passenger.Id, PrimaryPassengerId = passenger.Id, RegisteredAtUtc = DateTimeOffset.UtcNow });
        trip.PassengerCount++;
        if (string.Equals(passenger.AgeCategory, "child", StringComparison.OrdinalIgnoreCase)) trip.ChildrenCount++;
        trip.UpdatedAtUtc = DateTimeOffset.UtcNow;
        var session = CreateSession(passenger.Id, trip.Id, trip.ScheduledDepartureUtc); db.PassengerSessions.Add(session.Entity);
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        return Created($"api/passenger/trips/{invitationCode}/passengers/{passenger.Id}",
            new RegisteredPassengerDto(passenger.Id, trip.Id, passenger.Name, passenger.IdentificationNumber,
                passenger.PhoneNumber, passenger.PassengerType, passenger.Gender, passenger.AgeCategory,
                session.RawToken, session.Entity.ExpiresAtUtc));
        });
    }

    [HttpPost("{invitationCode}/returning-passenger")]
    public async Task<ActionResult<RegisteredPassengerDto>> VerifyReturningPassenger(string invitationCode,
        VerifyReturningPassengerRequest request, CancellationToken ct)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult<RegisteredPassengerDto>>(async () =>
        {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var trip = await db.Trips.Include(x => x.Boat).SingleOrDefaultAsync(x => x.InvitationCode == invitationCode, ct);
        if (trip is null) return NotFound();
        if (trip.Status is TripStatus.Completed or TripStatus.Cancelled)
            return Conflict(new { message = "This trip is no longer accepting passenger registrations." });
        var lookup = Normalize(request.Identifier);
        var passenger = await db.PassengerProfiles.SingleOrDefaultAsync(x =>
            x.NormalizedIdentificationNumber == lookup || x.NormalizedPhoneNumber == lookup, ct);
        if (passenger is null) return NotFound(new { message = "No passenger was found for that NIC, passport, or phone number." });

        var alreadyJoined = await db.TripPassengers.AnyAsync(x => x.TripId == trip.Id && x.PassengerId == passenger.Id, ct);
        if (!alreadyJoined)
        {
            if (trip.PassengerCount >= trip.Boat.MaximumCapacity)
                return Conflict(new { message = "This trip has reached its maximum passenger capacity." });
            db.TripPassengers.Add(new TripPassenger { Id = Guid.NewGuid(), TripId = trip.Id,
                PassengerId = passenger.Id, PrimaryPassengerId = passenger.Id, RegisteredAtUtc = DateTimeOffset.UtcNow });
            trip.PassengerCount++;
            if (string.Equals(passenger.AgeCategory, "child", StringComparison.OrdinalIgnoreCase)) trip.ChildrenCount++;
            trip.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }
        passenger.PersonalQrToken ??= CreatePersonalQrToken();
        var session = CreateSession(passenger.Id, trip.Id, trip.ScheduledDepartureUtc); db.PassengerSessions.Add(session.Entity);
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        return Ok(new RegisteredPassengerDto(passenger.Id, trip.Id, passenger.Name, passenger.IdentificationNumber,
            passenger.PhoneNumber, passenger.PassengerType, passenger.Gender, passenger.AgeCategory,
            session.RawToken, session.Entity.ExpiresAtUtc));
        });
    }

    [HttpPost("~/api/passenger/session/companions")]
    public async Task<ActionResult<RegisteredCompanionDto>> RegisterCompanion(
        RegisterPassengerRequest request, CancellationToken ct)
    {
        var rawToken = Request.Headers["X-Passenger-Session"].ToString();
        if (string.IsNullOrWhiteSpace(rawToken)) return Unauthorized();
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<ActionResult<RegisteredCompanionDto>>(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var session = await db.PassengerSessions.Include(x => x.Trip).ThenInclude(x => x.Boat)
                .SingleOrDefaultAsync(x => x.TokenHash == hash && x.ExpiresAtUtc > DateTimeOffset.UtcNow, ct);
            if (session is null) return Unauthorized();
            if (session.Trip.Status is TripStatus.Completed or TripStatus.Cancelled)
                return Conflict(new { message = "This trip is no longer accepting passenger registrations." });
            if (session.Trip.PassengerCount >= session.Trip.Boat.MaximumCapacity)
                return Conflict(new { message = "This trip has reached its maximum passenger capacity." });
            var normalizedId = Normalize(request.IdentificationNumber);
            if (await db.PassengerProfiles.AnyAsync(x => x.NormalizedIdentificationNumber == normalizedId, ct))
                return Conflict(new { message = "A passenger with this NIC or passport already exists." });
            var passenger = new PassengerProfile { Id = Guid.NewGuid(), Name = request.Name.Trim(),
                IdentificationNumber = request.IdentificationNumber.Trim().ToUpperInvariant(),
                NormalizedIdentificationNumber = normalizedId, PhoneNumber = request.PhoneNumber.Trim(),
                NormalizedPhoneNumber = Normalize(request.PhoneNumber), PassengerType = request.PassengerType,
                Gender = request.Gender, AgeCategory = request.AgeCategory, CreatedAtUtc = DateTimeOffset.UtcNow,
                PersonalQrToken = CreatePersonalQrToken() };
            db.PassengerProfiles.Add(passenger);
            db.TripPassengers.Add(new TripPassenger { Id = Guid.NewGuid(), TripId = session.TripId,
                PassengerId = passenger.Id, PrimaryPassengerId = session.PassengerId,
                RegisteredAtUtc = DateTimeOffset.UtcNow });
            session.Trip.PassengerCount++;
            if (string.Equals(passenger.AgeCategory, "child", StringComparison.OrdinalIgnoreCase))
                session.Trip.ChildrenCount++;
            session.Trip.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
            return Created("api/passenger/session/companions", new RegisteredCompanionDto(passenger.Id,
                session.TripId, session.PassengerId, passenger.Name, passenger.IdentificationNumber,
                passenger.PhoneNumber, passenger.PassengerType, passenger.Gender, passenger.AgeCategory));
        });
    }

    private static string Normalize(string value) => new(value.Where(char.IsLetterOrDigit)
        .Select(char.ToUpperInvariant).ToArray());
    private static string CreatePersonalQrToken() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
    private static (PassengerSession Entity, string RawToken) CreateSession(Guid passengerId, Guid tripId,
        DateTimeOffset scheduledDepartureUtc)
    {
        var raw = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));
        return (new PassengerSession { Id = Guid.NewGuid(), PassengerId = passengerId, TripId = tripId,
            TokenHash = hash, CreatedAtUtc = DateTimeOffset.UtcNow,
            ExpiresAtUtc = scheduledDepartureUtc.AddDays(1) }, raw);
    }
}

public sealed record PassengerTripPreviewDto(Guid TripId, string BoatName, string RegistrationNumber,
    DateTimeOffset ScheduledDepartureUtc, string Status, string ShoreApproval,
    int MaximumCapacity, bool AcceptingPassengers, string InvitationCode);

public sealed class RegisterPassengerRequest
{
    [Required, MaxLength(160)] public required string Name { get; init; }
    [Required, MaxLength(32)] public required string IdentificationNumber { get; init; }
    [Required, Phone, MaxLength(32)] public required string PhoneNumber { get; init; }
    [Required, RegularExpression("^(local|foreign)$")] public required string PassengerType { get; init; }
    [Required, RegularExpression("^(male|female|other)$")] public required string Gender { get; init; }
    [Required, RegularExpression("^(adult|child)$")] public required string AgeCategory { get; init; }
}

public sealed record RegisteredPassengerDto(Guid Id, Guid TripId, string Name, string IdentificationNumber,
    string PhoneNumber, string PassengerType, string Gender, string AgeCategory,
    string SessionToken, DateTimeOffset SessionExpiresAtUtc);
public sealed record RegisteredCompanionDto(Guid Id, Guid TripId, Guid PrimaryPassengerId, string Name,
    string IdentificationNumber, string PhoneNumber, string PassengerType, string Gender, string AgeCategory);
public sealed record PassengerPersonalQrDto(Guid PassengerId, string PassengerName, string QrToken, string QrValue);
public sealed class VerifyReturningPassengerRequest
{
    [Required, MaxLength(32)] public required string Identifier { get; init; }
}
