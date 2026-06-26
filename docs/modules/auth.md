# Модуль Auth

Отвечает исключительно за **аутентификацию**: регистрацию, вход, выдачу токенов. Профиль пользователя (имя, аватар) — в модуле [Users](users.md).

## Домен

### UserAuth

Агрегат. Хранит email и хеш пароля.

```csharp
public sealed class UserAuth : AggregateRoot<Guid>
{
    public string Email { get; }
    public string PasswordHash { get; }
    public bool IsEmailVerified { get; }
    public DateTime CreatedAt { get; }

    public static Result<UserAuth> Create(string email, string passwordHash);
    public void VerifyEmail();
}
```

Email всегда приводится к нижнему регистру (`ToLowerInvariant`) при создании.

### RefreshToken

Сущность. Привязана к пользователю.

```csharp
public sealed class RefreshToken : Entity<Guid>
{
    public Guid UserId { get; }
    public string Token { get; }
    public DateTime ExpiresAt { get; }
    public DateTime CreatedAt { get; }
    public bool IsRevoked { get; }

    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsActive => !IsRevoked && !IsExpired;

    public static RefreshToken Create(Guid userId, string token, int expirationDays);
    public void Revoke();
}
```

## Команды и обработчики

### RegisterCommand

```
RegisterCommand(Email, Password)
    → validates (FluentValidation)
    → checks email uniqueness
    → hashes password (Bcrypt)
    → creates UserAuth
    → saves to auth.users
    → returns UserAuthDto(Id, Email, CreatedAt)
```

**Валидация:**
- Email: обязательный, корректный формат, ≤255 символов
- Password: обязательный, ≥8 символов, ≤128 символов

### LoginCommand

```
LoginCommand(Email, Password)
    → finds user by email (case-insensitive)
    → verifies password hash
    → generates JWT (15 min expiry)
    → generates refresh token (7 days expiry, stored in DB)
    → returns TokenPairDto(AccessToken, RefreshToken, AccessTokenExpiresAt)
```

JWT payload содержит:
- `sub` — userId (Guid)
- `email` — email пользователя
- `iat`, `exp`, `iss`, `aud`

### RefreshTokenCommand

```
RefreshTokenCommand(Token)
    → finds token in DB
    → checks IsActive (not revoked, not expired)
    → revokes old token
    → generates new JWT + new refresh token
    → saves new refresh token
    → returns new TokenPairDto
```

Rotation strategy: старый токен немедленно аннулируется. Если украли и использовали — следующий запрос от легитимного пользователя с уже аннулированным токеном вернёт 401.

### LogoutCommand

```
LogoutCommand(RefreshToken)
    → finds token in DB
    → sets IsRevoked = true
    → saves
```

## Инфраструктура

### Репозитории

```csharp
IUserAuthRepository
    Task<UserAuth?> GetByEmailAsync(string email, CancellationToken ct)
    Task<UserAuth?> GetByIdAsync(Guid id, CancellationToken ct)
    Task<bool> ExistsByEmailAsync(string email, CancellationToken ct)
    void Add(UserAuth user)

IRefreshTokenRepository
    Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken ct)
    void Add(RefreshToken token)
```

### IJwtTokenService

```csharp
string GenerateAccessToken(Guid userId, string email);
ClaimsPrincipal? ValidateAccessToken(string token);
string GenerateRefreshToken();  // случайный Base64
```

### IPasswordHasher

Реализация — Bcrypt через библиотеку `BCrypt.Net-Next`.

```csharp
string Hash(string password);
bool Verify(string password, string hash);
```

## Конфигурация

В `appsettings.json`:

```json
{
  "JwtSettings": {
    "SecretKey": "your_secret",
    "Issuer": "messenger-api",
    "Audience": "messenger-client",
    "ExpiryMinutes": 15
  },
  "RefreshToken": {
    "ExpirationDays": 7
  }
}
```

## Таблицы

| Таблица | Описание |
|---|---|
| `auth.users` | Учётные данные пользователей |
| `auth.refresh_tokens` | Активные refresh токены |

Подробнее — [database.md](../database.md).

## Тесты

- **Unit-тесты**: `Messenger.Modules.Auth.UnitTests`
  - Domain: `UserAuthTests`, `RefreshTokenTests`
  - Validators: `RegisterCommandValidatorTests`, `LoginCommandValidatorTests`
  - Handlers: `RegisterCommandHandlerTests`, `LoginCommandHandlerTests`
  - Services: `JwtTokenServiceTests`
- **Integration-тесты**: `Messenger.Api.IntegrationTests`
  - Полный Auth flow с реальным PostgreSQL (Testcontainers)
  - Token rotation сценарии
