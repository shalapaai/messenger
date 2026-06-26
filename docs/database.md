# База данных

## Обзор

Используется **PostgreSQL 16** с разделением по схемам — каждый модуль владеет своей схемой и не обращается к чужим таблицам напрямую.

```
messenger (database)
├── auth         — UserAuth, RefreshTokens
├── users        — UserProfiles
├── messages     — Messages
├── files        — FileUploads
└── chats        — Chats, Members (заглушка)
```

## Инициализация

При первом старте контейнера PostgreSQL запускает `docker/init.sql`:
- создаёт схемы (`CREATE SCHEMA IF NOT EXISTS ...`)
- создаёт расширения (`pg_trgm`, `btree_gin`, `uuid-ossp`)
- создаёт все таблицы с правильными типами и индексами

При старте API каждый модуль вызывает `db.Database.EnsureCreatedAsync()`. Поскольку таблицы уже созданы init.sql, EF видит их существование и пропускает создание.

> **Важно**: имена колонок в таблицах — PascalCase в кавычках (`"Id"`, `"Email"`, `"CreatedAt"`), чтобы точно совпадать с тем, что генерирует EF Core + Npgsql без `UseSnakeCaseNamingConvention`.

## Схема: auth

### Таблица `auth.users`

Хранит данные аутентификации — только email и хеш пароля. Профиль пользователя (имя, аватар) — в модуле Users.

| Колонка | Тип | Описание |
|---|---|---|
| `"Id"` | UUID PK | Идентификатор пользователя |
| `"Email"` | VARCHAR(255) UNIQUE NOT NULL | Email (lowercase) |
| `"PasswordHash"` | VARCHAR(512) NOT NULL | Bcrypt хеш пароля |
| `"IsEmailVerified"` | BOOLEAN NOT NULL DEFAULT FALSE | Верификация email |
| `"CreatedAt"` | TIMESTAMPTZ NOT NULL | Дата регистрации |

Индекс: `ix_users_email` (unique) на `"Email"`.

### Таблица `auth.refresh_tokens`

| Колонка | Тип | Описание |
|---|---|---|
| `"Id"` | UUID PK | |
| `"UserId"` | UUID NOT NULL | FK → auth.users."Id" |
| `"Token"` | VARCHAR(256) UNIQUE NOT NULL | Случайный токен |
| `"ExpiresAt"` | TIMESTAMPTZ NOT NULL | Время истечения |
| `"CreatedAt"` | TIMESTAMPTZ NOT NULL | Дата создания |
| `"IsRevoked"` | BOOLEAN NOT NULL DEFAULT FALSE | Отозван ли |

Индексы: `ix_refresh_tokens_token` (unique), `ix_refresh_tokens_user_id`.

## Схема: users

### Таблица `users.user_profiles`

Профили пользователей. `"AuthUserId"` — это `"Id"` из `auth.users`. Связь не через FK (модули изолированы), а через бизнес-логику.

| Колонка | Тип | Описание |
|---|---|---|
| `"Id"` | UUID PK | |
| `"AuthUserId"` | UUID UNIQUE NOT NULL | ID из модуля Auth |
| `"Email"` | VARCHAR(255) UNIQUE NOT NULL | Email (дублируется из Auth) |
| `"DisplayName"` | VARCHAR(100) NOT NULL | Отображаемое имя |
| `"Status"` | VARCHAR(200) | Статус пользователя |
| `"AvatarUrl"` | VARCHAR(2048) | URL аватара |
| `"CreatedAt"` | TIMESTAMPTZ NOT NULL | |
| `"UpdatedAt"` | TIMESTAMPTZ | Дата последнего обновления |

Индексы: `ix_user_profiles_auth_user_id` (unique), `ix_user_profiles_email` (unique).

## Схема: messages

### Таблица `messages.messages`

| Колонка | Тип | Описание |
|---|---|---|
| `"Id"` | UUID PK | Генерируется приложением (не БД) |
| `"ChatId"` | UUID NOT NULL | ID чата |
| `"SenderId"` | UUID NOT NULL | ID отправителя (auth.users) |
| `"Content"` | VARCHAR(4096) NOT NULL | Текст сообщения |
| `"Status"` | VARCHAR(20) NOT NULL | `Sent` / `Delivered` / `Read` / `Deleted` |
| `"SentAt"` | TIMESTAMPTZ NOT NULL | Время отправки |
| `"EditedAt"` | TIMESTAMPTZ | Время редактирования |
| `"DeletedAt"` | TIMESTAMPTZ | Время удаления |
| `"ReplyToMessageId"` | UUID | ID сообщения-ответа |

Индексы: `ix_messages_chat_id_sent_at` (ChatId, SentAt), `ix_messages_sender_id`.

## Схема: files

### Таблица `files.file_uploads`

| Колонка | Тип | Описание |
|---|---|---|
| `"Id"` | UUID PK | |
| `"FileKey"` | VARCHAR(512) UNIQUE NOT NULL | Ключ в хранилище (путь или S3 key) |
| `"OriginalName"` | VARCHAR(255) NOT NULL | Оригинальное имя файла |
| `"ContentType"` | VARCHAR(100) NOT NULL | MIME-тип |
| `"SizeBytes"` | BIGINT NOT NULL | Размер в байтах |
| `"UploadedBy"` | UUID NOT NULL | ID загрузившего (auth.users) |
| `"UploadedAt"` | TIMESTAMPTZ NOT NULL | Дата загрузки |
| `"Category"` | VARCHAR(30) | `Avatar` / `ChatAttachment` / `Document` |

Индексы: `ix_file_uploads_file_key` (unique), `ix_file_uploads_uploaded_by_category`.

## Схема: chats (заглушка)

Таблицы созданы в init.sql, но модуль Chats ещё не реализован в EF.

### `chats.chats`
`id`, `type` (direct/group), `name`, `avatar_url`, `created_at`

### `chats.members`
`chat_id`, `user_id`, `role` (owner/admin/member), `joined_at`
PK: (chat_id, user_id), FK → chats.chats

## EF Core

Каждый модуль регистрирует свой `DbContext`:

```csharp
services.AddDbContext<AuthDbContext>(options =>
    options.UseNpgsql(connectionString, npgsql =>
        npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "auth")));
```

`IUnitOfWork` — интерфейс-маркер, за которым скрывается `DbContext`. Каждый модуль регистрирует свою реализацию:

```csharp
services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<AuthDbContext>());
```

Пространства имён разные, поэтому конфликта в DI нет.
