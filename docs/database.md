# База данных

## Обзор

**PostgreSQL 16**, одна база (`messenger`), разделённая на схемы — каждый модуль владеет своей и не обращается к чужим таблицам напрямую (внешние ключи между схемами есть только там, где это выражает реальную владельческую связь, см. ниже).

```
messenger (database)
├── auth      — user, refresh_token
├── users     — user_profile
├── chats     — chats, members
├── messages  — message, message_attachment, message_reaction, poll_option, poll_vote
└── files     — file_upload
```

Названия таблиц и колонок — **snake_case**, без кавычек (`auth.user`, не `auth."User"`). Столбец `id` почти везде — `UUID`, генерируется приложением (`gen_random_uuid()` как дефолт в БД используется только там, где приложение не передаёт id заранее, см. таблицы ниже).

Подробное описание каждой таблицы (бизнес-смысл колонок, инварианты) — в `docs/modules/*.md`; здесь — сводная схема и то, что относится к БД в целом.

## Инициализация

При **первом** старте контейнера PostgreSQL выполняет `docker/init.sql` (через `/docker-entrypoint-initdb.d`, один раз, на пустом volume):
- создаёт схемы (`auth`, `users`, `chats`, `messages`, `files`)
- расширения: `uuid-ossp`, `pg_trgm`, `btree_gin` — установлены про запас; на момент написания ни одного GIN/trigram-индекса в коде нет, поиск пользователей (`GET /users/search`) идёт через `EF.Functions.ILike` без индекса
- все таблицы, индексы, constraints (см. ниже)

Каждый модуль при старте API вызывает `EnsureCreatedAsync()` — это создаёт таблицы, только если БД физически пуста. Поскольку Postgres создаёт саму БД сам при первом старте контейнера (`POSTGRES_DB`), а `init.sql` уже успевает создать таблицы до этого вызова, `EnsureCreatedAsync` с точки зрения EF Core видит "база уже существует" и молча ничего не делает. **Настоящий источник схемы — `docker/init.sql`.** Если добавляешь колонку в C#-модель — обязательно продублируй в `init.sql` руками, иначе на первом же запросе к новой колонке будет `column ... does not exist`.

**Новая таблица в уже работающей (не пустой) базе** — отдельный случай: `init.sql` выполнится только на **новой** базе, а `EnsureCreatedAsync` на уже существующей ничего не досоздаёт (см. выше), так что таблица, добавленная в модель уже после первого деплоя, никогда не появится в проде сама по себе. Поэтому `MessagesModule.MigrateAsync` (единственный модуль, где это понадобилось на практике — `message_reaction`, затем `poll_option`/`poll_vote`) после `EnsureCreatedAsync` **дополнительно** выполняет `CREATE TABLE IF NOT EXISTS` тем же DDL, что и в `init.sql` — эта часть безопасно перевыполняется на каждом старте API (идемпотентна за счёт `IF NOT EXISTS`) и досоздаёт таблицу на уже работающей базе при следующем деплое. Добавляя новую таблицу к существующему модулю — дублируй DDL и в `init.sql` (для новых баз), и в `MigrateAsync` (для уже существующих), не только в одном месте.

Применить изменения в dev-окружении — пересоздать volume:
```bash
docker compose down && docker volume rm messenger_postgres_data && docker compose up -d
```

## Схема: auth

### `auth.user`
| Колонка | Тип | |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `email` | varchar(255) not null | |
| `password_hash` | varchar(512) not null | Argon2 |
| `is_email_verified` | boolean not null default false | |
| `created_at` | timestamptz not null | |

Индекс: `ix_user_email` (unique).

### `auth.refresh_token`
| Колонка | Тип | |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid not null | FK → `auth.user`, `ON DELETE CASCADE` |
| `token` | varchar(256) not null | **SHA-256 хеш** токена, не сам токен (см. [modules/auth.md](modules/auth.md)) |
| `expires_at` | timestamptz not null | |
| `created_at` | timestamptz not null | |
| `is_revoked` | boolean not null default false | |

Индексы: `ix_refresh_token_token` (unique), `ix_refresh_token_user_id`.

## Схема: users

### `users.user_profile`
| Колонка | Тип | |
|---|---|---|
| `id` | uuid PK | Свой, **не** совпадает с `auth.user.id` |
| `auth_user_id` | uuid not null | FK → `auth.user`, `ON DELETE CASCADE` — единственная межсхемная связь модуля Users |
| `email` | varchar(255) not null | Дублируется из Auth (поиск без межмодульного вызова) |
| `display_name` | varchar(100) not null | |
| `login` | varchar(30) null | Без `@`, уникален среди непустых |
| `status` | varchar(200) null | |
| `avatar_url` | varchar(2048) null | |
| `avatar_color` | varchar(7) not null default `#2C5BF0` | Фолбэк-цвет инициалов |
| `phone` | varchar(20) null | |
| `city` | varchar(100) null | |
| `department` | varchar(100) null | |
| `created_at` | timestamptz not null | |
| `updated_at` | timestamptz null | |

Индексы: `ix_user_profile_auth_user_id` (unique), `ix_user_profile_email` (unique), `ix_user_profile_login` (unique, частичный — `WHERE login IS NOT NULL`).

## Схема: chats

### `chats.chats`
| Колонка | Тип | |
|---|---|---|
| `id` | uuid PK | |
| `type` | varchar(10) not null | `CHECK IN ('direct', 'group')` |
| `name` | varchar(100) null | `CHECK`: обязателен для `group`, для `direct` — не важно |
| `avatar_url` | varchar(512) null | Только для `group` |
| `avatar_color` | varchar(7) null | Только для `group`, фолбэк-цвет без загруженной аватарки |
| `created_at` | timestamptz not null | |
| `direct_user_id_1` | uuid null | Только для `direct`, канонический порядок (меньший uuid первым) |
| `direct_user_id_2` | uuid null | |

Индекс: `ux_chats_direct_pair` (unique, частичный — `WHERE type = 'direct'`) на `(direct_user_id_1, direct_user_id_2)` — не даёт гонке создать два direct-чата между одной парой (см. [modules/chats.md](modules/chats.md)).

### `chats.members`
| Колонка | Тип | |
|---|---|---|
| `chat_id` | uuid | PK (часть 1), FK → `chats.chats`, `ON DELETE CASCADE` |
| `user_id` | uuid | PK (часть 2), FK → `auth.user`, `ON DELETE CASCADE` |
| `role` | varchar(10) not null default `member` | `CHECK IN ('owner', 'admin', 'member')` |
| `joined_at` | timestamptz not null | |
| `last_read_at` | timestamptz null | Двигается через `POST /chats/{id}/read` |

Индекс: `idx_chats_members_user_id`.

## Схема: messages

### `messages.message`
| Колонка | Тип | |
|---|---|---|
| `id` | uuid PK | Генерируется приложением, без дефолта в БД |
| `sequence` | bigint `GENERATED ALWAYS AS IDENTITY`, unique | Монотонный тай-брейкер к `sent_at` для курсорной пагинации |
| `chat_id` | uuid not null | FK → `chats.chats`, `ON DELETE CASCADE` |
| `sender_id` | uuid not null | FK → `auth.user`, `ON DELETE CASCADE` |
| `content` | varchar(4096) not null | |
| `status` | varchar(20) not null | `Sent` / `Delivered` / `Read` / `Deleted` (на практике проставляется только `Sent`/`Deleted`, см. [modules/messages.md](modules/messages.md)) |
| `sent_at` | timestamptz not null | |
| `edited_at` | timestamptz null | |
| `deleted_at` | timestamptz null | |
| `reply_to_message_id` | uuid null | FK → `messages.message`, `ON DELETE SET NULL` |
| `forwarded_from_message_id` | uuid null | FK → `messages.message`, `ON DELETE SET NULL` |
| `forwarded_from_user_id` | uuid null | FK → `auth.user`, `ON DELETE SET NULL` |
| `message_type` | varchar(10) not null default `Text` | `Text` / `System` |
| `system_event_type` | varchar(20) null | Только для `System`: `MemberAdded` / `MemberLeft` / `MemberRemoved` |
| `target_user_id` | uuid null | FK → `auth.user`, `ON DELETE SET NULL`. Только для `System` |

Индексы: `ix_message_chat_id_sent_at`, `ix_message_chat_id_sequence` (курсорная пагинация), `ix_message_sender_id`, `uq_message_sequence` (unique).

### `messages.message_attachment`
| Колонка | Тип | |
|---|---|---|
| `id` | uuid PK | |
| `message_id` | uuid not null | FK → `messages.message`, `ON DELETE CASCADE` |
| `file_url` | varchar(2048) not null | |
| `file_name` | varchar(255) not null | |
| `content_type` | varchar(100) not null | |
| `file_size_bytes` | bigint not null | |
| `sort_order` | int not null default 0 | Порядок выбора файлов пользователем |

Индекс: `ix_message_attachment_message_id`. Одно сообщение может нести несколько вложений (см. [modules/messages.md](modules/messages.md)).

### `messages.message_reaction`
| Колонка | Тип | |
|---|---|---|
| `id` | uuid PK | |
| `message_id` | uuid not null | FK → `messages.message`, `ON DELETE CASCADE` |
| `user_id` | uuid not null | |
| `emoji` | varchar(16) not null | |
| `created_at` | timestamptz not null | |
| `updated_at` | timestamptz not null | |

Индексы: `ux_message_reaction_message_id_user_id` (unique — одна реакция на пользователя на сообщение), `ix_message_reaction_message_id`, `ix_message_reaction_user_id`.

### `messages.poll_option`
| Колонка | Тип | |
|---|---|---|
| `id` | uuid PK | |
| `message_id` | uuid not null | FK → `messages.message`, `ON DELETE CASCADE`. Владеющее сообщение — с `message_type = 'Poll'` |
| `text` | varchar(100) not null | Текст варианта ответа |
| `sort_order` | int not null default 0 | Порядок вариантов, заданный при создании опроса |

Индекс: `ix_poll_option_message_id`.

### `messages.poll_vote`
| Колонка | Тип | |
|---|---|---|
| `id` | uuid PK | |
| `message_id` | uuid not null | FK → `messages.message`, `ON DELETE CASCADE` |
| `option_id` | uuid not null | За какой вариант — **не** FK на `poll_option` (слабая ссылка, как и `reply_to_message_id`; сверяется на уровне домена, см. [modules/messages.md](modules/messages.md#опросы)) |
| `user_id` | uuid not null | Кто проголосовал |
| `voted_at` | timestamptz not null | |

Индексы: `ux_poll_vote_message_id_user_id` (unique — один голос на пользователя на опрос), `ix_poll_vote_message_id`. Подробнее про модель голосования (смена/отмена голоса, видимость голосующих) — [modules/messages.md#опросы](modules/messages.md#опросы).

## Схема: files

### `files.file_upload`
| Колонка | Тип | |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `file_key` | varchar(512) not null | Ключ в хранилище — GUID, никогда не переиспользуется на другой контент |
| `original_name` | varchar(255) not null | |
| `content_type` | varchar(100) not null | |
| `size_bytes` | bigint not null | |
| `uploaded_by` | uuid not null | FK → `auth.user`, `ON DELETE CASCADE` |
| `uploaded_at` | timestamptz not null | |
| `category` | varchar(30) null | `Avatar` / `ChatAttachment` / `GroupAvatar` |
| `chat_id` | uuid null | Заполнено для `ChatAttachment`/`GroupAvatar`. **Без FK** на `chats.chats` — модули не зависят друг от друга на уровне схемы |

Индексы: `ix_file_upload_file_key` (unique), `ix_file_upload_uploaded_by_category`, `ux_file_upload_avatar_per_user` (unique, частичный — `WHERE category = 'Avatar'`), `ux_file_upload_group_avatar_per_chat` (unique, частичный — `WHERE category = 'GroupAvatar'`). Подробнее про иммутабельность `file_key` и кэширование — [modules/files.md](modules/files.md#кэширование).

## Межсхемные внешние ключи

Несмотря на изоляцию модулей на уровне кода, в БД есть FK **на `auth.user`** из всех остальных схем (`user_profile.auth_user_id`, `chats.members.user_id`, `messages.message.sender_id`/`forwarded_from_user_id`/`target_user_id`, `files.file_upload.uploaded_by`) — Auth физически первичен, все пользователи существуют только через него. FK **между остальными модулями** (`messages.message.chat_id → chats.chats`) тоже есть — это подстраховка на уровне БД (`ON DELETE CASCADE`), а не замена межмодульного вызова: `DeleteChatCommandHandler` всё равно явно вызывает `IMessagesModule.DeleteAllMessagesInChatAsync` и не полагается на каскад (см. [modules/chats.md — Удаление чата](modules/chats.md#удаление-чата)). Единственная сознательно **не** FK-связь — `files.file_upload.chat_id`, чтобы Files не знал о схеме Chats.

## EF Core

Каждый модуль регистрирует свой `DbContext` с собственной таблицей истории миграций (чтобы модули не путались в чужих миграциях):

```csharp
services.AddDbContext<AuthDbContext>(options =>
    options.UseNpgsql(connectionString, npgsql =>
        npgsql.MigrationsHistoryTable("__EFMigrationsHistory", "auth")));
```

`IUnitOfWork` — не общий тип из `Shared.Kernel`, а **свой маркерный интерфейс в каждом модуле** (`Messenger.Modules.Auth.Application.Abstractions.IUnitOfWork`, `Messenger.Modules.Files.Application.IUnitOfWork` и т.д. — у каждого модуля своя копия с одинаковым именем, но в своём namespace). `Install()` всех модулей регистрирует сервисы в один и тот же общий `IServiceCollection` (`builder.Services`), поэтому если бы `IUnitOfWork` был одним общим типом, пять регистраций подряд по правилам .NET DI схлопнулись бы в одну (побеждает последняя) — и все хендлеры получали бы `DbContext` последнего установленного модуля. Поскольку типы разные (namespace — часть идентичности типа в C#), конфликта нет: `using` в хендлере определяет, чей именно `IUnitOfWork` он видит и с ним резолвится.

```csharp
services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<AuthDbContext>());
```
