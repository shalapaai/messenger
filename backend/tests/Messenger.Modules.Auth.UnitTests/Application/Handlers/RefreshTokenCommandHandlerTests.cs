namespace Messenger.Modules.Auth.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Modules.Auth.Application.Features.Login;
using Messenger.Modules.Auth.Application.Features.RefreshToken;
using Messenger.Modules.Auth.Domain;
using Microsoft.Extensions.Configuration;
using NSubstitute;

public sealed class RefreshTokenCommandHandlerTests
{
    private readonly IUserAuthRepository      _userRepo         = Substitute.For<IUserAuthRepository>();
    private readonly IRefreshTokenRepository  _tokenRepo        = Substitute.For<IRefreshTokenRepository>();
    private readonly IJwtTokenService         _jwtService       = Substitute.For<IJwtTokenService>();
    private readonly IUnitOfWork              _uow              = Substitute.For<IUnitOfWork>();
    private readonly IConfiguration           _config           = BuildConfig();
    private readonly RefreshTokenCommandHandler _sut;

    private static readonly Guid    UserId  = Guid.NewGuid();
    private static readonly UserAuth User   = UserAuth.Create("user@example.com", "hash").Value!;

    public RefreshTokenCommandHandlerTests()
    {
        _sut = new RefreshTokenCommandHandler(_userRepo, _tokenRepo, _jwtService, _uow, _config);
    }

    [Fact]
    public async Task Handle_WithValidToken_ReturnsNewTokenPair()
    {
        var oldToken = ActiveToken("old-token");
        _tokenRepo.GetByTokenAsync("old-token", Arg.Any<CancellationToken>()).Returns(oldToken);
        _userRepo.GetByIdAsync(oldToken.UserId, Arg.Any<CancellationToken>()).Returns(User);
        _jwtService.GenerateAccessToken(User.Id, User.Email)
                   .Returns(new AccessTokenResult("new-access", DateTime.UtcNow.AddMinutes(15)));
        _jwtService.GenerateRefreshToken().Returns("new-refresh");

        var result = await _sut.Handle(new RefreshTokenCommand("old-token"), default);

        result.IsSuccess.Should().BeTrue();
        result.Value!.AccessToken.Should().Be("new-access");
        result.Value!.RefreshToken.Should().Be("new-refresh");
    }

    [Fact]
    public async Task Handle_WithValidToken_RevokesOldToken()
    {
        var oldToken = ActiveToken("old-token");
        _tokenRepo.GetByTokenAsync("old-token", Arg.Any<CancellationToken>()).Returns(oldToken);
        _userRepo.GetByIdAsync(oldToken.UserId, Arg.Any<CancellationToken>()).Returns(User);
        _jwtService.GenerateAccessToken(Arg.Any<Guid>(), Arg.Any<string>())
                   .Returns(new AccessTokenResult("a", DateTime.UtcNow.AddMinutes(15)));
        _jwtService.GenerateRefreshToken().Returns("new");

        await _sut.Handle(new RefreshTokenCommand("old-token"), default);

        oldToken.IsRevoked.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_WithValidToken_SavesNewRefreshToken()
    {
        var oldToken = ActiveToken("old-token");
        _tokenRepo.GetByTokenAsync("old-token", Arg.Any<CancellationToken>()).Returns(oldToken);
        _userRepo.GetByIdAsync(oldToken.UserId, Arg.Any<CancellationToken>()).Returns(User);
        _jwtService.GenerateAccessToken(Arg.Any<Guid>(), Arg.Any<string>())
                   .Returns(new AccessTokenResult("a", DateTime.UtcNow.AddMinutes(15)));
        _jwtService.GenerateRefreshToken().Returns("new-refresh");

        await _sut.Handle(new RefreshTokenCommand("old-token"), default);

        _tokenRepo.Received(1).Add(Arg.Is<RefreshToken>(t => t.Token == "new-refresh" && t.IsActive));
        await _uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithRevokedToken_ReturnsUnauthorized()
    {
        var revoked = ActiveToken("revoked-token");
        revoked.Revoke();
        _tokenRepo.GetByTokenAsync("revoked-token", Arg.Any<CancellationToken>()).Returns(revoked);

        var result = await _sut.Handle(new RefreshTokenCommand("revoked-token"), default);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Contain("Unauthorized");
    }

    [Fact]
    public async Task Handle_WithExpiredToken_ReturnsUnauthorized()
    {
        var expired = ExpiredToken("expired-token");
        _tokenRepo.GetByTokenAsync("expired-token", Arg.Any<CancellationToken>()).Returns(expired);

        var result = await _sut.Handle(new RefreshTokenCommand("expired-token"), default);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Contain("Unauthorized");
    }

    [Fact]
    public async Task Handle_WithNonExistentToken_ReturnsUnauthorized()
    {
        _tokenRepo.GetByTokenAsync("ghost", Arg.Any<CancellationToken>())
                  .Returns((RefreshToken?)null);

        var result = await _sut.Handle(new RefreshTokenCommand("ghost"), default);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Contain("Unauthorized");
    }

    [Fact]
    public async Task Handle_WhenUserNotFound_ReturnsNotFoundError()
    {
        var token = ActiveToken("valid-token");
        _tokenRepo.GetByTokenAsync("valid-token", Arg.Any<CancellationToken>()).Returns(token);
        _userRepo.GetByIdAsync(token.UserId, Arg.Any<CancellationToken>())
                 .Returns((UserAuth?)null);

        var result = await _sut.Handle(new RefreshTokenCommand("valid-token"), default);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Contain("NotFound");
    }

    [Fact]
    public async Task Handle_OnFailure_DoesNotSaveAnything()
    {
        _tokenRepo.GetByTokenAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
                  .Returns((RefreshToken?)null);

        await _sut.Handle(new RefreshTokenCommand("ghost"), default);

        _tokenRepo.DidNotReceive().Add(Arg.Any<RefreshToken>());
        await _uow.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    private static RefreshToken ActiveToken(string value) =>
        RefreshToken.Create(UserId, value, expirationDays: 7);

    private static RefreshToken ExpiredToken(string value) =>
        RefreshToken.Create(UserId, value, expirationDays: -1);

    private static IConfiguration BuildConfig(int days = 7) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:RefreshTokenExpirationDays"] = days.ToString()
            })
            .Build();
}
