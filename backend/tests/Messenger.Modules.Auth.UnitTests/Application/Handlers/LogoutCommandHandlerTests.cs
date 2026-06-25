namespace Messenger.Modules.Auth.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Modules.Auth.Application.Features.Logout;
using Messenger.Modules.Auth.Domain;
using NSubstitute;

public sealed class LogoutCommandHandlerTests
{
    private readonly IRefreshTokenRepository _tokenRepo = Substitute.For<IRefreshTokenRepository>();
    private readonly IUnitOfWork             _uow       = Substitute.For<IUnitOfWork>();
    private readonly LogoutCommandHandler    _sut;

    private static readonly Guid UserId = Guid.NewGuid();

    public LogoutCommandHandlerTests()
    {
        _sut = new LogoutCommandHandler(_tokenRepo, _uow);
    }

    [Fact]
    public async Task Handle_WithActiveToken_RevokesAndSaves()
    {
        var token = RefreshToken.Create(UserId, "valid-token", 7);
        _tokenRepo.GetByTokenAsync("valid-token", Arg.Any<CancellationToken>()).Returns(token);

        var result = await _sut.Handle(new LogoutCommand("valid-token"), default);

        result.IsSuccess.Should().BeTrue();
        token.IsRevoked.Should().BeTrue();
        await _uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithNonExistentToken_ReturnsSuccessIdempotently()
    {
        _tokenRepo.GetByTokenAsync("ghost-token", Arg.Any<CancellationToken>())
                  .Returns((RefreshToken?)null);

        var result = await _sut.Handle(new LogoutCommand("ghost-token"), default);

        result.IsSuccess.Should().BeTrue();
        await _uow.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithAlreadyRevokedToken_ReturnsSuccessIdempotently()
    {
        var token = RefreshToken.Create(UserId, "old-token", 7);
        token.Revoke();
        _tokenRepo.GetByTokenAsync("old-token", Arg.Any<CancellationToken>()).Returns(token);

        var result = await _sut.Handle(new LogoutCommand("old-token"), default);

        result.IsSuccess.Should().BeTrue();
        await _uow.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithExpiredToken_ReturnsSuccessIdempotently()
    {
        var expired = RefreshToken.Create(UserId, "expired-token", expirationDays: -1);
        _tokenRepo.GetByTokenAsync("expired-token", Arg.Any<CancellationToken>()).Returns(expired);

        var result = await _sut.Handle(new LogoutCommand("expired-token"), default);

        result.IsSuccess.Should().BeTrue();
        await _uow.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
