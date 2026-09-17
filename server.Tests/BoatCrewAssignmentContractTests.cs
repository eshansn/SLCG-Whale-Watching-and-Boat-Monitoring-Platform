using System.ComponentModel.DataAnnotations;
using System.Reflection;
using Microsoft.AspNetCore.Mvc;
using WhaleWatching.Api.Operations;

namespace WhaleWatching.Api.Tests;

public sealed class BoatCrewAssignmentContractTests
{
    [Fact]
    public void AssignCrewBoat_UsesExpectedPutRoute()
    {
        var method = typeof(OperationsController).GetMethod(nameof(OperationsController.AssignCrewBoat))!;

        Assert.Equal("owner/crew/{crewUserId:guid}/boat",
            method.GetCustomAttribute<HttpPutAttribute>()!.Template);
    }

    [Fact]
    public void PositionValidation_IsDefinedOnRecordConstructorParameter()
    {
        var position = typeof(AssignCrewBoatRequest).GetConstructors().Single()
            .GetParameters().Single(parameter => parameter.Name == "Position");

        var validation = position.GetCustomAttribute<StringLengthAttribute>();

        Assert.NotNull(validation);
        Assert.Equal(100, validation.MaximumLength);
    }

    [Fact]
    public void StartTripValidation_IsDefinedOnRecordConstructorParameter()
    {
        var overrideReason = typeof(StartTripRequest).GetConstructors().Single()
            .GetParameters().Single(parameter => parameter.Name == "OverrideReason");

        var validation = overrideReason.GetCustomAttribute<StringLengthAttribute>();

        Assert.NotNull(validation);
        Assert.Equal(1000, validation.MaximumLength);
    }
}
