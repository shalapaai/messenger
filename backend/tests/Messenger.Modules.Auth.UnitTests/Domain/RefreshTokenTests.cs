namespace Messenger.Modules.Auth.UnitTests.Domain;

using FluentAssertions;

public sealed class RefreshTokenTests
{
    private static readonly Guid UserId = Guid.NewGuid();

    [Fact]
    public void Create_ReturnsActiveToken()
    {
        var token = Auth.Domain.RefreshToken.Create(UserId, "raw-token", expirationDays: 7);

        token.IsActive.Should().BeTrue();
        token.IsRevoked.Should().BeFalse();
        token.IsExpired.Should().BeFalse();
    }

    [Fact]
    public void Create_ExpiresAt_IsCorrectDaysFromNow()
    {
        var before = DateTime.UtcNow.AddDays(7);
        var token  = Auth.Domain.RefreshToken.Create(UserId, "raw-token", expirationDays: 7);
        var after  = DateTime.UtcNow.AddDays(7);

        token.ExpiresAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Fact]
    public void Revoke_SetsIsRevokedAndDeactivates()
    {
        var token = Auth.Domain.RefreshToken.Create(UserId, "raw-token", expirationDays: 7);

        token.Revoke();

        token.IsRevoked.Should().BeTrue();
        token.IsActive.Should().BeFalse();
    }

    [Fact]
    public void IsExpired_WithNegativeExpirationDays_ReturnsTrue()
    {
        var token = Auth.Domain.RefreshToken.Create(UserId, "raw-token", expirationDays: -1);

        token.IsExpired.Should().BeTrue();
        token.IsActive.Should().BeFalse();
    }

    [Fact]
    public void IsActive_WhenRevokedAndExpired_ReturnsFalse()
    {
        var token = Auth.Domain.RefreshToken.Create(UserId, "raw-token", expirationDays: -1);
        token.Revoke();

        token.IsActive.Should().BeFalse();
    }

    [Fact]
    public void Create_StoresHashedTokenValue_NotThePlainTextToken()
    {
        const string rawToken = "my-secure-token-value";
        var token = Auth.Domain.RefreshToken.Create(UserId, rawToken, expirationDays: 7);

        token.Token.Should().Be(Auth.Domain.RefreshToken.Hash(rawToken));
        token.Token.Should().NotBe(rawToken);
        token.UserId.Should().Be(UserId);
    }

    [Fact]
    public void Hash_IsDeterministic()
    {
        Auth.Domain.RefreshToken.Hash("same-input").Should().Be(Auth.Domain.RefreshToken.Hash("same-input"));
    }

    [Fact]
    public void Create_AssignsNewGuidId()
    {
        var t1 = Auth.Domain.RefreshToken.Create(UserId, "token-1", 7);
        var t2 = Auth.Domain.RefreshToken.Create(UserId, "token-2", 7);

        t1.Id.Should().NotBe(t2.Id);
        t1.Id.Should().NotBe(Guid.Empty);
    }
}
