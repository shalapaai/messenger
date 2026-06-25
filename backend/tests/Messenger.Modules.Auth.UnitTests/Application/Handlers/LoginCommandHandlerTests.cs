namespace Messenger.Modules.Auth.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Modules.Auth.Application.Features.Login;
using Messenger.Modules.Auth.Domain;
using Microsoft.Extensions.Configuration;
using NSubstitute;

public sealed class LoginCommandHandlerTests
{
    private readonly IUserAuthRepository      _userRepo          = Substitute.For<IUserAuthRepository>();
    private readonly IPasswordHasher          _hasher            = Substitute.For<IPasswordHasher>();
    private readonly IJwtTokenService         _jwtService        = Substitute.For<IJwtTokenService>();
    private readonly IRefreshTokenRepository  _refreshTokenRepo  = Substitute.For<IRefreshTokenRepository>();
    private readonly IUnitOfWork              _uow               = Substitute.For<IUnitOfWork>();
    private readonly IConfiguration           _config            = BuildConfig();
    private readonly LoginCommandHandler      _sut;

    public LoginCommandHandlerTests()
    {
        _sut = new LoginCommandHandler(_userRepo, _hasher, _jwtService, _refreshTokenRepo, _uow, _config);
    }

    [Fact]
    public async Task Handle_WithValidCredentials_ReturnsTokenPair()
    {
        var user = CreateUser("user@example.com", "hashed");
        _userRepo.GetByEmailAsync("user@example.com", Arg.Any<CancellationToken>()).Returns(user);
        _hasher.Verify("Secret123!", "hashed").Returns(true);
        _jwtService.GenerateAccessToken(user.Id, user.Email)
                   .Returns(new AccessTokenResult("access-token", DateTime.UtcNow.AddMinutes(15)));
        _jwtService.GenerateRefreshToken().Returns("refresh-token");

        var result = await _sut.Handle(new LoginCommand("user@example.com", "Secret123!"), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.AccessToken.Should().Be("access-token");
        result.Value!.RefreshToken.Should().Be("refresh-token");
        result.Value!.AccessTokenExpiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public async Task Handle_WithNonExistentUser_ReturnsUnauthorized()
    {
        _userRepo.GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
                 .Returns((UserAuth?)null);

        var result = await _sut.Handle(new LoginCommand("ghost@example.com", "pass"), default);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Contain("Unauthorized");
    }

    [Fact]
    public async Task Handle_WithWrongPassword_ReturnsUnauthorized()
    {
        var user = CreateUser("user@example.com", "correct_hash");
        _userRepo.GetByEmailAsync("user@example.com", Arg.Any<CancellationToken>()).Returns(user);
        _hasher.Verify("wrong_password", "correct_hash").Returns(false);

        var result = await _sut.Handle(new LoginCommand("user@example.com", "wrong_password"), default);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Contain("Unauthorized");
    }

    [Fact]
    public async Task Handle_OnSuccess_SavesRefreshTokenToRepository()
    {
        var user = CreateUser("user@example.com", "hashed");
        _userRepo.GetByEmailAsync("user@example.com", Arg.Any<CancellationToken>()).Returns(user);
        _hasher.Verify(Arg.Any<string>(), Arg.Any<string>()).Returns(true);
        _jwtService.GenerateAccessToken(Arg.Any<Guid>(), Arg.Any<string>())
                   .Returns(new AccessTokenResult("token", DateTime.UtcNow.AddMinutes(15)));
        _jwtService.GenerateRefreshToken().Returns("refresh");

        await _sut.Handle(new LoginCommand("user@example.com", "pass"), default);

        _refreshTokenRepo.Received(1).Add(Arg.Is<RefreshToken>(t =>
            t.UserId == user.Id &&
            t.Token  == "refresh" &&
            t.IsActive));
        await _uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_OnFailure_DoesNotSaveAnything()
    {
        _userRepo.GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
                 .Returns((UserAuth?)null);

        await _sut.Handle(new LoginCommand("ghost@example.com", "pass"), default);

        _refreshTokenRepo.DidNotReceive().Add(Arg.Any<RefreshToken>());
        await _uow.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_RefreshTokenExpiration_ReadFromConfig()
    {
        var config = BuildConfig(refreshDays: 3);
        var sut    = new LoginCommandHandler(_userRepo, _hasher, _jwtService, _refreshTokenRepo, _uow, config);

        var user = CreateUser("user@example.com", "hashed");
        _userRepo.GetByEmailAsync("user@example.com", Arg.Any<CancellationToken>()).Returns(user);
        _hasher.Verify(Arg.Any<string>(), Arg.Any<string>()).Returns(true);
        _jwtService.GenerateAccessToken(Arg.Any<Guid>(), Arg.Any<string>())
                   .Returns(new AccessTokenResult("token", DateTime.UtcNow.AddMinutes(15)));
        _jwtService.GenerateRefreshToken().Returns("refresh");

        await sut.Handle(new LoginCommand("user@example.com", "pass"), default);

        var expectedExpiry = DateTime.UtcNow.AddDays(3);
        _refreshTokenRepo.Received(1).Add(Arg.Is<RefreshToken>(t =>
            t.ExpiresAt >= expectedExpiry.AddSeconds(-5) &&
            t.ExpiresAt <= expectedExpiry.AddSeconds(5)));
    }

    private static UserAuth CreateUser(string email, string hash) =>
        UserAuth.Create(email, hash).Value!;

    private static IConfiguration BuildConfig(int refreshDays = 7) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:RefreshTokenExpirationDays"] = refreshDays.ToString()
            })
            .Build();
}
