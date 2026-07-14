using System.ComponentModel.DataAnnotations;

namespace WhaleWatching.Api.Auth.Dtos;

public sealed class RefreshTokenRequest
{
    [Required, MaxLength(512)]
    public required string RefreshToken { get; init; }
}
