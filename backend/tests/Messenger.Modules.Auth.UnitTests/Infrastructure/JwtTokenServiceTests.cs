namespace Messenger.Modules.Auth.UnitTests.Infrastructure;

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FluentAssertions;
using Messenger.Modules.Auth.Infrastructure;
using Microsoft.Extensions.Configuration;

public sealed class JwtTokenServiceTests
{
    private readonly JwtTokenService _sut = new(BuildConfig());

    [Fact]
    public void GenerateAccessToken_ReturnsNonEmptyToken()
    {
        var result = _sut.GenerateAccessToken(Guid.NewGuid(), "user@example.com");

        result.Token.Should().NotBeNullOrEmpty();
        result.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public void GenerateAccessToken_ContainsUserIdClaim()
    {
        var userId = Guid.NewGuid();
        var result = _sut.GenerateAccessToken(userId, "user@example.com");

        var jwt    = ReadJwt(result.Token);
        var idClaim = jwt.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);

        idClaim.Should().NotBeNull();
        idClaim!.Value.Should().Be(userId.ToString());
    }

    [Fact]
    public void GenerateAccessToken_ContainsEmailClaim()
    {
        const string email = "test@example.com";
        var result = _sut.GenerateAccessToken(Guid.NewGuid(), email);

        var jwt       = ReadJwt(result.Token);
        var emailClaim = jwt.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Email);

        emailClaim.Should().NotBeNull();
        emailClaim!.Value.Should().Be(email);
    }

    [Fact]
    public void GenerateAccessToken_ContainsUniqueJtiClaim()
    {
        var r1 = _sut.GenerateAccessToken(Guid.NewGuid(), "a@example.com");
        var r2 = _sut.GenerateAccessToken(Guid.NewGuid(), "b@example.com");

        var jti1 = ReadJwt(r1.Token).Claims.First(c => c.Type == JwtRegisteredClaimNames.Jti).Value;
        var jti2 = ReadJwt(r2.Token).Claims.First(c => c.Type == JwtRegisteredClaimNames.Jti).Value;

        jti1.Should().NotBe(jti2);
    }

    [Fact]
    public void GenerateAccessToken_ExpiresAt_MatchesTokenExpiry()
    {
        var result = _sut.GenerateAccessToken(Guid.NewGuid(), "user@example.com");
        var jwt    = ReadJwt(result.Token);

        // Убираем секундную точность при сравнении Unix timestamp
        var jwtExp = DateTimeOffset.FromUnixTimeSeconds(
            (long)jwt.Payload[JwtRegisteredClaimNames.Exp]).UtcDateTime;

        Math.Abs((result.ExpiresAt - jwtExp).TotalSeconds).Should().BeLessThan(2);
    }

    [Fact]
    public void GenerateAccessToken_HasCorrectIssuerAndAudience()
    {
        var result = _sut.GenerateAccessToken(Guid.NewGuid(), "user@example.com");
        var jwt    = ReadJwt(result.Token);

        jwt.Issuer.Should().Be("TestIssuer");
        jwt.Audiences.Should().Contain("TestAudience");
    }

    [Fact]
    public void GenerateRefreshToken_ReturnsBase64String()
    {
        var token = _sut.GenerateRefreshToken();

        var action = () => Convert.FromBase64String(token);
        action.Should().NotThrow();
    }

    [Fact]
    public void GenerateRefreshToken_EachCallReturnsUniqueValue()
    {
        var t1 = _sut.GenerateRefreshToken();
        var t2 = _sut.GenerateRefreshToken();

        t1.Should().NotBe(t2);
    }

    [Fact]
    public void GenerateRefreshToken_HasSufficientEntropy()
    {
        var token = _sut.GenerateRefreshToken();
        var bytes = Convert.FromBase64String(token);

        // 64 байта = 512 бит энтропии
        bytes.Length.Should().Be(64);
    }

    private static JwtSecurityToken ReadJwt(string token) =>
        new JwtSecurityTokenHandler().ReadJwtToken(token);

    private static IConfiguration BuildConfig(int expirationMinutes = 15) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:SecretKey"]                    = "test-secret-key-minimum-32-chars-for-testing!!",
                ["Jwt:Issuer"]                       = "TestIssuer",
                ["Jwt:Audience"]                     = "TestAudience",
                ["Jwt:AccessTokenExpirationMinutes"] = expirationMinutes.ToString(),
                ["Jwt:RefreshTokenExpirationDays"]   = "7"
            })
            .Build();
}
