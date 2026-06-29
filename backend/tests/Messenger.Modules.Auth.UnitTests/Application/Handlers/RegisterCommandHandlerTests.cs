namespace Messenger.Modules.Auth.UnitTests.Application.Handlers;

using FluentAssertions;
using Messenger.Modules.Auth.Application.Abstractions;
using Messenger.Modules.Auth.Application.Features.Register;
using Messenger.Modules.Auth.Domain;
using NSubstitute;

public sealed class RegisterCommandHandlerTests
{
    private readonly IUserAuthRepository   _userRepo = Substitute.For<IUserAuthRepository>();
    private readonly IPasswordHasher       _hasher   = Substitute.For<IPasswordHasher>();
    private readonly IUnitOfWork           _uow      = Substitute.For<IUnitOfWork>();
    private readonly RegisterCommandHandler _sut;

    public RegisterCommandHandlerTests()
    {
        _sut = new RegisterCommandHandler(_userRepo, _hasher, _uow);
    }

    [Fact]
    public async Task Handle_WithNewEmail_ReturnsUserDto()
    {
        _userRepo.ExistsByEmailAsync("user@example.com", Arg.Any<CancellationToken>()).Returns(false);
        _hasher.Hash("Secret123!").Returns("hashed_password");

        var command = new RegisterCommand("user@example.com", "Secret123!");
        var result  = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Email.Should().Be("user@example.com");
        result.Value!.Id.Should().NotBe(Guid.Empty);
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
        await _uow.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_EmailIsCaseInsensitive()
    {
        _userRepo.ExistsByEmailAsync("user@example.com", Arg.Any<CancellationToken>()).Returns(false);
        _hasher.Hash(Arg.Any<string>()).Returns("hash");

        var command = new RegisterCommand("USER@EXAMPLE.COM", "Secret123!");
        var result  = await _sut.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value!.Email.Should().Be("user@example.com");
    }
}
