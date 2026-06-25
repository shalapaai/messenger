--  Инициализация БД: схемы, расширения и таблицы.
--  Запускается ОДИН РАЗ при первом старте контейнера PostgreSQL.
--  Имена колонок — PascalCase в кавычках, чтобы точно совпадать с тем,
--  что генерирует EF Core + Npgsql без UseSnakeCaseNamingConvention.
--  EnsureCreatedAsync в модулях увидит эти таблицы и пропустит создание.

-- ── Схемы ─────────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS chats;
CREATE SCHEMA IF NOT EXISTS messages;
CREATE SCHEMA IF NOT EXISTS files;

-- ── Расширения ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ══════════════════════════════════════════════════════════════════════════════
--  СХЕМА: auth  (модуль Auth — только аутентификация)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS auth.users (
    "Id"              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    "Email"           VARCHAR(255) NOT NULL,
    "PasswordHash"    VARCHAR(512) NOT NULL,
    "IsEmailVerified" BOOLEAN      NOT NULL DEFAULT FALSE,
    "CreatedAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email
    ON auth.users ("Email");

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    "Id"        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    "UserId"    UUID        NOT NULL,
    "Token"     VARCHAR(256) NOT NULL,
    "ExpiresAt" TIMESTAMPTZ  NOT NULL,
    "CreatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "IsRevoked" BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_refresh_tokens_token
    ON auth.refresh_tokens ("Token");

CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_id
    ON auth.refresh_tokens ("UserId");

-- ══════════════════════════════════════════════════════════════════════════════
--  СХЕМА: users  (модуль Users — профили пользователей)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users.user_profiles (
    "Id"          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "AuthUserId"  UUID         NOT NULL,
    "Email"       VARCHAR(255) NOT NULL,
    "DisplayName" VARCHAR(100) NOT NULL,
    "Status"      VARCHAR(200),
    "AvatarUrl"   VARCHAR(2048),
    "CreatedAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "UpdatedAt"   TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_user_profiles_auth_user_id
    ON users.user_profiles ("AuthUserId");

CREATE UNIQUE INDEX IF NOT EXISTS ix_user_profiles_email
    ON users.user_profiles ("Email");

-- ══════════════════════════════════════════════════════════════════════════════
--  СХЕМА: chats  (модуль Chats — ещё не реализован в EF, плейсхолдер)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chats.chats (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    type       VARCHAR(10) NOT NULL,
    name       VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_chats_type      CHECK (type IN ('direct', 'group')),
    CONSTRAINT ck_chats_group_name CHECK (type = 'direct' OR name IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS chats.members (
    chat_id   UUID        NOT NULL,
    user_id   UUID        NOT NULL,
    role      VARCHAR(10) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (chat_id, user_id),

    CONSTRAINT fk_members_chat FOREIGN KEY (chat_id)
        REFERENCES chats.chats (id) ON DELETE CASCADE,

    CONSTRAINT ck_members_role CHECK (role IN ('owner', 'admin', 'member'))
);

CREATE INDEX IF NOT EXISTS idx_chats_members_user_id ON chats.members (user_id);
CREATE INDEX IF NOT EXISTS idx_chats_members_chat_id ON chats.members (chat_id);

-- ══════════════════════════════════════════════════════════════════════════════
--  СХЕМА: messages  (модуль Messages — EF-модель Message)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS messages.messages (
    "Id"               UUID         PRIMARY KEY,   -- ValueGeneratedNever в EF
    "ChatId"           UUID         NOT NULL,
    "SenderId"         UUID         NOT NULL,
    "Content"          VARCHAR(4096) NOT NULL,
    "Status"           VARCHAR(20)  NOT NULL,       -- string-enum: Sent/Delivered/Read/Deleted
    "SentAt"           TIMESTAMPTZ  NOT NULL,
    "EditedAt"         TIMESTAMPTZ,
    "DeletedAt"        TIMESTAMPTZ,
    "ReplyToMessageId" UUID
);

CREATE INDEX IF NOT EXISTS ix_messages_chat_id_sent_at
    ON messages.messages ("ChatId", "SentAt");

CREATE INDEX IF NOT EXISTS ix_messages_sender_id
    ON messages.messages ("SenderId");

-- ══════════════════════════════════════════════════════════════════════════════
--  СХЕМА: files  (модуль Files — EF-модель FileUpload)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS files.file_uploads (
    "Id"           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "FileKey"      VARCHAR(512) NOT NULL,
    "OriginalName" VARCHAR(255) NOT NULL,
    "ContentType"  VARCHAR(100) NOT NULL,
    "SizeBytes"    BIGINT       NOT NULL,
    "UploadedBy"   UUID         NOT NULL,
    "UploadedAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "Category"     VARCHAR(30)
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_file_uploads_file_key
    ON files.file_uploads ("FileKey");

CREATE INDEX IF NOT EXISTS ix_file_uploads_uploaded_by_category
    ON files.file_uploads ("UploadedBy", "Category");
