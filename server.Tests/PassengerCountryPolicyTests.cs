using WhaleWatching.Api.Passenger;

namespace WhaleWatching.Api.Tests;

public sealed class PassengerCountryPolicyTests
{
    [Fact]
    public void LocalPassenger_DoesNotRequireCountry_AndUsesSriLanka()
    {
        var valid = PassengerCountryPolicy.TryNormalize("local", null, out var countryCode, out var error);

        Assert.True(valid);
        Assert.Equal("LK", countryCode);
        Assert.Null(error);
    }

    [Theory]
    [InlineData("JP", "JP")]
    [InlineData(" gb ", "GB")]
    [InlineData("za", "ZA")]
    public void ForeignPassenger_AcceptsAndNormalizesIsoCountry(string supplied, string expected)
    {
        var valid = PassengerCountryPolicy.TryNormalize("foreign", supplied, out var countryCode, out var error);

        Assert.True(valid);
        Assert.Equal(expected, countryCode);
        Assert.Null(error);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("XX")]
    [InlineData("JPN")]
    public void ForeignPassenger_RejectsMissingOrInvalidCountry(string? supplied)
    {
        var valid = PassengerCountryPolicy.TryNormalize("foreign", supplied, out var countryCode, out var error);

        Assert.False(valid);
        Assert.Null(countryCode);
        Assert.False(string.IsNullOrWhiteSpace(error));
    }
}
