namespace Messenger.Modules.Auth.UnitTests.Domain;

using FluentAssertions;
using Messenger.Modules.Auth.Domain;

public sealed class UserAuthTests
{
    [Fact]
    public void Create_WithValidEmail_ReturnsSuccess()
    {
        var result = UserAuth.Create("User@Example.COM", "hash");

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public void Create_EmailIsStoredLowercase()
    {
        var result = UserAuth.Create("User@Example.COM", "hash");

        result.Value!.Email.Should().Be("user@example.com");
    }

    [Fact]
    public void Create_SetsCreatedAtToUtcNow()
    {
        var before = DateTime.UtcNow;
        var result = UserAuth.Create("user@example.com", "hash");
        var after  = DateTime.UtcNow;

        result.Value!.CreatedAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Fact]
    public void Create_IsEmailVerifiedIsFalseByDefault()
    {
        var result = UserAuth.Create("user@example.com", "hash");

        result.Value!.IsEmailVerified.Should().BeFalse();
    }

    [Fact]
    public void Create_AssignsNewGuidId()
    {
        var r1 = UserAuth.Create("a@example.com", "hash");
        var r2 = UserAuth.Create("b@example.com", "hash");

        r1.Value!.Id.Should().NotBe(r2.Value!.Id);
        r1.Value!.Id.Should().NotBe(Guid.Empty);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null!)]
    public void Create_WithEmptyOrNullEmail_ReturnsFailure(string? email)
    {
        var result = UserAuth.Create(email!, "hash");

        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public void VerifyEmail_SetsIsEmailVerifiedToTrue()
    {
        var user = UserAuth.Create("user@example.com", "hash").Value!;

        user.VerifyEmail();

        user.IsEmailVerified.Should().BeTrue();
    }
}
