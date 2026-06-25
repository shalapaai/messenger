# Модуль Users

Управляет **профилями пользователей**: отображаемое имя, статус, аватар, поиск. Хранит `AuthUserId` как ссылку на модуль Auth (без прямого FK — модули изолированы).

## Домен

### UserProfile

Агрегат. Создаётся отдельно от регистрации — пользователь сначала регистрируется в Auth, затем создаёт профиль.

```csharp
public sealed class UserProfile : AggregateRoot<Guid>
{
    public Guid AuthUserId { get; }      // ID из auth.users
    public string Email { get; }         // дублируется для поиска
    public string DisplayName { get; }
    public string? Status { get; }
    public string? AvatarUrl { get; }
    public DateTime CreatedAt { get; }
    public DateTime? UpdatedAt { get; }

    public static Result<UserProfile> Create(Guid authUserId, string email, string displayName);
    public void Update(string? displayName, string? status);
    public void SetAvatarUrl(string avatarUrl);
}
```

Email приводится к нижнему регистру при создании.

## Команды

### CreateUserProfileCommand

```
POST /api/users
Body: { displayName }
JWT: → authUserId, email

    → checks: profile for this authUserId already exists?
    → checks: email unique in users schema?
    → creates UserProfile
    → saves to users.user_profiles
    → returns UserProfileDto
```

**Валидация:**
- DisplayName: обязательный, ≥2 символа, ≤100 символов

Вызывать после регистрации — как второй шаг онбординга.

### UpdateUserProfileCommand

```
PATCH /api/users/me
Body: { displayName?, status? }
JWT: → authUserId

    → finds profile by authUserId
    → updates non-null fields
    → saves
    → returns UpdatedProfileDto
```

Оба поля опциональны: можно обновить только статус или только имя.

### UploadUserAvatarCommand

```
POST /api/users/me/avatar
Body: multipart/form-data (file)
JWT: → authUserId

    → finds profile
    → delegates to Files module via ISender:
        UploadAvatarCommand(authUserId, stream, fileName, contentType, size)
        → validates file (≤5MB, image MIME)
        → stores file
        → returns fileUrl
    → profile.SetAvatarUrl(fileUrl)
    → saves
    → returns AvatarUrlDto
```

Модуль Users зависит от модуля Files через `ProjectReference`. Взаимодействие через MediatR ISender — не прямой вызов, а отправка команды.

## Запросы

### GetMeQuery

```
GET /api/users/me
JWT: → authUserId

    → finds profile by authUserId
    → returns MeDto
```

### SearchUsersQuery

```
GET /api/users/search?q=text&page=1&pageSize=20
JWT: → currentUserId

    → ILIKE search on Email and DisplayName
    → excludes currentUser from results
    → paginates
    → returns PagedList<UserSearchResultDto>
```

Использует `EF.Functions.ILike` — регистронезависимый поиск в PostgreSQL.

## Инфраструктура

### IUserProfileRepository

```csharp
Task<UserProfile?> GetByAuthUserIdAsync(Guid authUserId, CancellationToken ct)
Task<bool> ExistsByAuthUserIdAsync(Guid authUserId, CancellationToken ct)
Task<bool> ExistsByEmailAsync(string email, CancellationToken ct)
Task<PagedList<UserProfile>> SearchAsync(
    string query, Guid excludeUserId, int page, int pageSize, CancellationToken ct)
void Add(UserProfile profile)
void Update(UserProfile profile)
```

## Потоки использования

### Онбординг нового пользователя

```
1. POST /api/auth/register       → accessToken, refreshToken
2. POST /api/users               → профиль создан
   (displayName в теле, email из токена)
```

### Обновление профиля

```
PATCH /api/users/me
{ "displayName": "Новое имя", "status": "Занят" }
```

### Смена аватара

```
POST /api/users/me/avatar
Content-Type: multipart/form-data
file: <binary>
```

## Таблицы

| Таблица | Описание |
|---|---|
| `users.user_profiles` | Профили пользователей |

Подробнее — [database.md](../database.md).
