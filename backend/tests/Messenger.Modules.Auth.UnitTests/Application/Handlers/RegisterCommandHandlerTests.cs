namespace Messenger.Modules.Auth.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Modules.Auth.Application.Features.Register;
using Messenger.Modules.Auth.Domain;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using NSubstitute;

public sealed class RegisterCommandHandlerTests
{
    private readonly IUserAuthRepository     _userRepo         = Substitute.For<IUserAuthRepository>();
    private readonly IPasswordHasher         _hasher           = Substitute.For<IPasswordHasher>();
    private readonly IJwtTokenService        _jwtService       = Substitute.For<IJwtTokenService>();
    private readonly IRefreshTokenRepository _refreshTokenRepo = Substitute.For<IRefreshTokenRepository>();
    private readonly IUnitOfWork             _uow              = Substitute.For<IUnitOfWork>();
    private readonly IEmailService           _emailService     = Substitute.For<IEmailService>();
    private readonly IMemoryCache            _cache            = Substitute.For<IMemoryCache>();
    private readonly IConfiguration          _config           = BuildConfig();
    private readonly RegisterCommandHandler _sut;

    public RegisterCommandHandlerTests()
    {
        _jwtService.GenerateAccessToken(Arg.Any<Guid>(), Arg.Any<string>())
                   .Returns(new AccessTokenResult("access-token", DateTime.UtcNow.AddMinutes(15)));
        _jwtService.GenerateRefreshToken().Returns("refresh-token");

        // TwoFactor:Enabled отсутствует в BuildConfig() => false — во всех тестах ниже путь
        // с OTP-письмом (emailService/cache) не задействуется, моки нужны только для сборки
        _sut = new RegisterCommandHandler(
            _userRepo,
            _hasher,
            _jwtService,
            _refreshTokenRepo,
            _uow,
            _emailService,
            _cache,
            _config);
    }

    [Fact]
    public async Task Handle_WithNewEmail_ReturnsTokenPair()
    {
        _userRepo.ExistsByEmailAsync("user@example.com", Arg.Any<CancellationToken>()).Returns(false);
        _hasher.Hash("Secret123!").Returns("hashed_password");
        _jwtService.GenerateAccessToken(Arg.Any<Guid>(), "user@example.com")
                   .Returns(new AccessTokenResult("access-token", DateTime.UtcNow.AddMinutes(15)));
        _jwtService.GenerateRefreshToken().Returns("refresh-token");

        var command = new RegisterCommand("user@example.com", "Secret123!");
        var result  = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.AccessToken.Should().Be("access-token");
        result.Value!.RefreshToken.Should().Be("refresh-token");
        result.Value!.AccessTokenExpiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public async Task Handle_WithExistingEmail_ReturnsConflictError()
    {
        _userRepo.ExistsByEmailAsync("taken@example.com", Arg.Any<CancellationToken>()).Returns(true);

        var command = new RegisterCommand("taken@example.com", "Secret123!");
        var result  = await _sut.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Contain("Conflict");
    }

    [Fact]
    public async Task Handle_HashesPasswordBeforeSaving()
    {
        _userRepo.ExistsByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(false);
        _hasher.Hash("plaintext").Returns("bcrypt_hash");

        var command = new RegisterCommand("user@example.com", "plaintext");
        await _sut.Handle(command, CancellationToken.None);

        _hasher.Received(1).Hash("plaintext");
        _userRepo.Received(1).Add(Arg.Is<UserAuth>(u => u.PasswordHash == "bcrypt_hash"));
    }

    [Fact]
    public async Task Handle_CallsSaveChanges()
    {
        _userRepo.ExistsByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(false);
        _hasher.Hash(Arg.Any<string>()).Returns("hash");

        await _sut.Handle(new RegisterCommand("u@e.com", "Secret123!"), CancellationToken.None);

        await _uow.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_DoesNotSaveWhenEmailExists()
    {
        _userRepo.ExistsByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(true);

        await _sut.Handle(new RegisterCommand("taken@e.com", "Secret123!"), CancellationToken.None);

        _userRepo.DidNotReceive().Add(Arg.Any<UserAuth>());
        _refreshTokenRepo.DidNotReceive().Add(Arg.Any<RefreshToken>());
        await _uow.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_EmailIsCaseInsensitive()
    {
        _userRepo.ExistsByEmailAsync("user@example.com", Arg.Any<CancellationToken>()).Returns(false);
        _hasher.Hash(Arg.Any<string>()).Returns("hash");
        _jwtService.GenerateAccessToken(Arg.Any<Guid>(), "user@example.com")
                   .Returns(new AccessTokenResult("access-token", DateTime.UtcNow.AddMinutes(15)));
        _jwtService.GenerateRefreshToken().Returns("refresh-token");

        var command = new RegisterCommand("USER@EXAMPLE.COM", "Secret123!");
        var result  = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        _jwtService.Received(1).GenerateAccessToken(Arg.Any<Guid>(), "user@example.com");
    }

    [Fact]
    public async Task Handle_OnSuccess_SavesRefreshTokenToRepository()
    {
        _userRepo.ExistsByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(false);
        _hasher.Hash(Arg.Any<string>()).Returns("hash");
        _jwtService.GenerateAccessToken(Arg.Any<Guid>(), Arg.Any<string>())
                   .Returns(new AccessTokenResult("token", DateTime.UtcNow.AddMinutes(15)));
        _jwtService.GenerateRefreshToken().Returns("refresh");

        await _sut.Handle(new RegisterCommand("u@e.com", "Secret123!"), CancellationToken.None);

        _refreshTokenRepo.Received(1).Add(Arg.Is<RefreshToken>(t =>
            t.Token == RefreshToken.Hash("refresh") &&
            t.IsActive));
    }

    private static IConfiguration BuildConfig(int refreshDays = 7) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:RefreshTokenExpirationDays"] = refreshDays.ToString()
            })
            .Build();
}
