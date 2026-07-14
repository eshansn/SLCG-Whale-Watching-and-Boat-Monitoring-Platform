using System.ComponentModel.DataAnnotations;

namespace WhaleWatching.Api.Auth.Dtos;

public sealed class RegisterRequest
{
    [Required, EmailAddress, MaxLength(256)]
    public required string Email { get; init; }

    [Required, MinLength(12), MaxLength(128)]
    public required string Password { get; init; }
}
