using System.ComponentModel.DataAnnotations;

namespace WhaleWatching.Api.Auth.Dtos;

public sealed class RegisterRequest
{
    [System.Text.Json.Serialization.JsonIgnore]
    public IFormFile? Certificate { get; init; }

    [Required, MinLength(3), MaxLength(64), RegularExpression("^[a-zA-Z0-9._-]+$",
        ErrorMessage = "Username can contain letters, numbers, dots, underscores, and hyphens only.")]
    public required string UserName { get; init; }

    [Required, MaxLength(160)]
    public required string DisplayName { get; init; }

    [Required, MaxLength(20), RegularExpression("^[0-9]{9}[vVxX]$|^[0-9]{12}$",
        ErrorMessage = "Enter a valid Sri Lankan NIC number.")]
    public required string NicNumber { get; init; }

    [Required, EmailAddress, MaxLength(256)]
    public required string Email { get; init; }

    [Required, RegularExpression("^(BoatOwner|BoatCrew)$",
        ErrorMessage = "Only boat owner and boat crew accounts can be self-registered.")]
    public required string Role { get; init; }

    [Required, Phone, MaxLength(32)]
    public required string PhoneNumber { get; init; }

    [Required, MinLength(12), MaxLength(128)]
    public required string Password { get; init; }
}
