using System.ComponentModel.DataAnnotations;
using WhaleWatching.Api.Operations;

namespace WhaleWatching.Api.Tests;

public sealed class SosActionContractTests
{
    [Fact]
    public void ResponderIdentityAndActionDetails_AreRequired()
    {
        var request = new SosActionRequest(null, null, null);
        var validationResults = new List<ValidationResult>();

        var valid = Validator.TryValidateObject(request, new ValidationContext(request),
            validationResults, validateAllProperties: true);

        Assert.False(valid);
        Assert.Contains(validationResults, result => result.MemberNames.Contains(nameof(SosActionRequest.ResponderName)));
        Assert.Contains(validationResults, result => result.MemberNames.Contains(nameof(SosActionRequest.ResponderIdNumber)));
        Assert.Contains(validationResults, result => result.MemberNames.Contains(nameof(SosActionRequest.Details)));
    }

    [Fact]
    public void CompleteResponderIdentityAndActionDetails_AreAccepted()
    {
        var request = new SosActionRequest("Officer Silva", "OPS-1042", "Contacted the vessel by radio.");
        var validationResults = new List<ValidationResult>();

        var valid = Validator.TryValidateObject(request, new ValidationContext(request),
            validationResults, validateAllProperties: true);

        Assert.True(valid);
        Assert.Empty(validationResults);
    }
}
