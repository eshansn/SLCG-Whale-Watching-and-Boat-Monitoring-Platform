using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using WhaleWatching.Api.Auth;
using WhaleWatching.Api.Auth.Dtos;

namespace WhaleWatching.Api.Tests;

public sealed class AuthRegistrationTests
{
    [Theory]
    [InlineData("DuplicateEmail")]
    [InlineData("DuplicateUserName")]
    [InlineData("DuplicateNicNumber")]
    [InlineData("PasswordTooShort")]
    public async Task FailedRegistration_ReturnsValidationErrorInsteadOfSuccess(string code)
    {
        using var services = CreateServices();
        var controller = CreateController(services, IdentityResult.Failed(new IdentityError
        {
            Code = code,
            Description = "Registration could not be completed."
        }));

        var result = Assert.IsAssignableFrom<ObjectResult>(
            await controller.Register(Request(), CancellationToken.None));

        Assert.Equal(StatusCodes.Status400BadRequest, result.StatusCode);
        var problem = Assert.IsType<ValidationProblemDetails>(result.Value);
        Assert.Equal(["Registration could not be completed."], problem.Errors[code]);
    }

    [Fact]
    public async Task SuccessfulRegistration_AllowsSignIn()
    {
        using var services = CreateServices();
        var controller = CreateController(services, IdentityResult.Success);

        var result = Assert.IsType<AcceptedResult>(
            await controller.Register(Request(), CancellationToken.None));

        Assert.Equal("Registration accepted. You can now sign in.",
            Assert.IsType<RegisterResponse>(result.Value).Message);
    }

    private static ServiceProvider CreateServices()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddControllers();
        return services.BuildServiceProvider();
    }

    private static AuthController CreateController(IServiceProvider services, IdentityResult result) =>
        new(new RegistrationService(result), null!)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { RequestServices = services }
            },
            ProblemDetailsFactory = services.GetRequiredService<ProblemDetailsFactory>()
        };

    private static RegisterRequest Request() => new()
    {
        UserName = "registration-test",
        DisplayName = "Registration Test",
        NicNumber = "199012345678",
        Email = "registration@example.test",
        Role = "BoatOwner",
        PhoneNumber = "+94771234567",
        Password = "Test-Only#Password123"
    };

    private sealed class RegistrationService(IdentityResult result) : IAuthService
    {
        public Task<IdentityResult> RegisterPublicPortalUserAsync(RegisterRequest request,
            CancellationToken cancellationToken = default) => Task.FromResult(result);

        public Task<AuthResponse?> LoginAsync(LoginRequest request, string ipAddress,
            CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<AuthResponse?> RefreshAsync(RefreshTokenRequest request, string ipAddress,
            CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
}
