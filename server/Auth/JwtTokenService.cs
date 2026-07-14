using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using WhaleWatching.Api.Auth.Dtos;
using WhaleWatching.Api.Data;
using WhaleWatching.Api.Domain;

namespace WhaleWatching.Api.Auth;

public sealed class JwtTokenService(
    WhaleWatchingDbContext dbContext,
    UserManager<ApplicationUser> userManager,
    IOptions<JwtOptions> options,
    TimeProvider timeProvider) : IJwtTokenService
{
    private readonly JwtOptions _options = options.Value;

    public async Task<AuthResponse> CreateSessionAsync(
        ApplicationUser user,
        string ipAddress,
        CancellationToken cancellationToken = default)
    {
        var now = timeProvider.GetUtcNow();
        var roles = await userManager.GetRolesAsync(user);
        var refreshToken = CreateRefreshToken(user, Guid.NewGuid(), ipAddress, now);

        dbContext.RefreshTokens.Add(refreshToken.Entity);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreateResponse(user, roles, refreshToken.RawToken, refreshToken.Entity, now);
    }

    public async Task<AuthResponse?> RotateRefreshTokenAsync(
        string rawRefreshToken,
        string ipAddress,
        CancellationToken cancellationToken = default)
    {
        var tokenHash = HashToken(rawRefreshToken);
        var now = timeProvider.GetUtcNow();
        var executionStrategy = dbContext.Database.CreateExecutionStrategy();

        return await executionStrategy.ExecuteAsync(async () =>
        {
            await using var transaction = await dbContext.Database.BeginTransactionAsync(
                IsolationLevel.Serializable, cancellationToken);

            var existing = await dbContext.RefreshTokens
                .Include(token => token.User)
                .SingleOrDefaultAsync(
                    token => token.TokenHash == tokenHash, cancellationToken);

            if (existing is null)
            {
                return null;
            }

            if (!existing.IsActive(now) ||
                !string.Equals(existing.SecurityStamp, existing.User.SecurityStamp,
                    StringComparison.Ordinal))
            {
                await RevokeFamilyAsync(existing, ipAddress, now, cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return null;
            }

            var replacement = CreateRefreshToken(
                existing.User, existing.FamilyId, ipAddress, now);
            existing.RevokedAtUtc = now;
            existing.RevokedByIp = ipAddress;
            existing.RevocationReason = "Rotated";
            existing.ReplacedByTokenId = replacement.Entity.Id;
            dbContext.RefreshTokens.Add(replacement.Entity);

            try
            {
                await dbContext.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                await transaction.RollbackAsync(cancellationToken);
                return null;
            }

            var roles = await userManager.GetRolesAsync(existing.User);
            return CreateResponse(
                existing.User, roles, replacement.RawToken, replacement.Entity, now);
        });
    }

    private async Task RevokeFamilyAsync(
        RefreshToken compromisedToken,
        string ipAddress,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var activeFamilyTokens = await dbContext.RefreshTokens
            .Where(token => token.UserId == compromisedToken.UserId &&
                            token.FamilyId == compromisedToken.FamilyId &&
                            token.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);

        foreach (var token in activeFamilyTokens)
        {
            token.RevokedAtUtc = now;
            token.RevokedByIp = ipAddress;
            token.RevocationReason = "Refresh token reuse or invalid security stamp";
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private AuthResponse CreateResponse(
        ApplicationUser user,
        IList<string> roles,
        string rawRefreshToken,
        RefreshToken refreshToken,
        DateTimeOffset now)
    {
        var accessTokenExpiresAt = now.AddMinutes(_options.AccessTokenMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email ?? string.Empty)
        };

        claims.AddRange(roles.Select(role => new Claim("role", role)));

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: now.UtcDateTime,
            expires: accessTokenExpiresAt.UtcDateTime,
            signingCredentials: credentials);

        return new AuthResponse(
            new JwtSecurityTokenHandler().WriteToken(token),
            accessTokenExpiresAt,
            rawRefreshToken,
            refreshToken.ExpiresAtUtc,
            roles.ToArray());
    }

    private (string RawToken, RefreshToken Entity) CreateRefreshToken(
        ApplicationUser user,
        Guid familyId,
        string ipAddress,
        DateTimeOffset now)
    {
        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        return (rawToken, new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = HashToken(rawToken),
            FamilyId = familyId,
            SecurityStamp = user.SecurityStamp
                ?? throw new InvalidOperationException("User security stamp is missing."),
            CreatedAtUtc = now,
            ExpiresAtUtc = now.AddDays(_options.RefreshTokenDays),
            CreatedByIp = ipAddress
        });
    }

    private static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
