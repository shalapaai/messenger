-- Инициализация БД: схемы, расширения и таблицы.
-- Запускается ОДИН РАЗ при первом старте контейнера PostgreSQL.
-- EnsureCreatedAsync / MigrateAsync в модулях увидят эти таблицы и пропустят создание.
-- Соглашение: snake_case. Chats: множественное число (chats.chats, chats.members), остальные — единственное.

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
--  СХЕМА: auth
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS auth.user (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email             VARCHAR(255) NOT NULL,
    password_hash     VARCHAR(512) NOT NULL,
    is_email_verified BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_user_email
    ON auth.user (email);

CREATE TABLE IF NOT EXISTS auth.refresh_token (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL,
    token      VARCHAR(256) NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    is_revoked BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_refresh_token_user_id
        FOREIGN KEY (user_id) REFERENCES auth.user (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_refresh_token_token
    ON auth.refresh_token (token);

CREATE INDEX IF NOT EXISTS ix_refresh_token_user_id
    ON auth.refresh_token (user_id);

-- ══════════════════════════════════════════════════════════════════════════════
--  СХЕМА: users
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users.user_profile (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID          NOT NULL,
    email        VARCHAR(255)  NOT NULL,
    display_name VARCHAR(100)  NOT NULL,
    login        VARCHAR(30)   DEFAULT NULL,
    status       VARCHAR(200)  DEFAULT NULL,
    avatar_url   VARCHAR(2048) DEFAULT NULL,
    avatar_color VARCHAR(7)    NOT NULL DEFAULT '#2C5BF0',
    phone        VARCHAR(20)   DEFAULT NULL,
    city         VARCHAR(100)  DEFAULT NULL,
    department   VARCHAR(100)  DEFAULT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   DEFAULT NULL,

    CONSTRAINT fk_user_profile_auth_user_id
        FOREIGN KEY (auth_user_id) REFERENCES auth.user (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_user_profile_auth_user_id
    ON users.user_profile (auth_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS ix_user_profile_email
    ON users.user_profile (email);

CREATE UNIQUE INDEX IF NOT EXISTS ix_user_profile_login
    ON users.user_profile (login)
    WHERE login IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
--  СХЕМА: chats
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chats.chats (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    type       VARCHAR(10)  NOT NULL,
    name       VARCHAR(100) DEFAULT NULL,
    avatar_url VARCHAR(512) DEFAULT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_chats_type       CHECK (type IN ('direct', 'group')),
    CONSTRAINT ck_chats_group_name CHECK (type = 'direct' OR name IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS chats.members (
    chat_id      UUID        NOT NULL,
    user_id      UUID        NOT NULL,
    role         VARCHAR(10) NOT NULL DEFAULT 'member',
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_read_at TIMESTAMPTZ DEFAULT NULL,

    PRIMARY KEY (chat_id, user_id),

    CONSTRAINT fk_members_chat_id
        FOREIGN KEY (chat_id) REFERENCES chats.chats (id) ON DELETE CASCADE,

    CONSTRAINT fk_members_user_id
        FOREIGN KEY (user_id) REFERENCES auth.user (id) ON DELETE CASCADE,

    CONSTRAINT ck_members_role CHECK (role IN ('owner', 'admin', 'member'))
);

CREATE INDEX IF NOT EXISTS idx_chats_members_user_id ON chats.members (user_id);

-- ══════════════════════════════════════════════════════════════════════════════
--  СХЕМА: messages
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS messages.message (
    id                        UUID          PRIMARY KEY,
    chat_id                   UUID          NOT NULL,
    sender_id                 UUID          NOT NULL,
    content                   VARCHAR(4096) NOT NULL,
    status                    VARCHAR(20)   NOT NULL,
    sent_at                   TIMESTAMPTZ   NOT NULL,
    edited_at                 TIMESTAMPTZ   DEFAULT NULL,
    deleted_at                TIMESTAMPTZ   DEFAULT NULL,
    reply_to_message_id       UUID          DEFAULT NULL,
    forwarded_from_message_id UUID          DEFAULT NULL,
    forwarded_from_user_id    UUID          DEFAULT NULL,

    CONSTRAINT fk_message_chat_id
        FOREIGN KEY (chat_id) REFERENCES chats.chats (id) ON DELETE CASCADE,

    CONSTRAINT fk_message_sender_id
        FOREIGN KEY (sender_id) REFERENCES auth.user (id) ON DELETE CASCADE,

    CONSTRAINT fk_message_reply_to_message_id
        FOREIGN KEY (reply_to_message_id) REFERENCES messages.message (id) ON DELETE SET NULL,

    -- пересланное сообщение — независимая копия; если оригинал/автор удалён, копия остаётся,
    -- просто пропадает подпись "Переслано от"
    CONSTRAINT fk_message_forwarded_from_message_id
        FOREIGN KEY (forwarded_from_message_id) REFERENCES messages.message (id) ON DELETE SET NULL,

    CONSTRAINT fk_message_forwarded_from_user_id
        FOREIGN KEY (forwarded_from_user_id) REFERENCES auth.user (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_message_chat_id_sent_at
    ON messages.message (chat_id, sent_at);

CREATE INDEX IF NOT EXISTS ix_message_sender_id
    ON messages.message (sender_id);

-- Одно сообщение может нести несколько вложений (несколько файлов, отправленных разом,
-- одним сообщением) — отдельная таблица вместо колонок на message; sort_order сохраняет
-- порядок, в котором пользователь выбрал файлы
CREATE TABLE IF NOT EXISTS messages.message_attachment (
    id                UUID          PRIMARY KEY,
    message_id        UUID          NOT NULL,
    file_url          VARCHAR(2048) NOT NULL,
    file_name         VARCHAR(255)  NOT NULL,
    content_type      VARCHAR(100)  NOT NULL,
    file_size_bytes   BIGINT        NOT NULL,
    sort_order        INT           NOT NULL DEFAULT 0,

    CONSTRAINT fk_message_attachment_message_id
        FOREIGN KEY (message_id) REFERENCES messages.message (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_message_attachment_message_id
    ON messages.message_attachment (message_id);

-- ══════════════════════════════════════════════════════════════════════════════
--  СХЕМА: files
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS files.file_upload (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    file_key      VARCHAR(512) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    content_type  VARCHAR(100) NOT NULL,
    size_bytes    BIGINT       NOT NULL,
    uploaded_by   UUID         NOT NULL,
    uploaded_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    category      VARCHAR(30)  DEFAULT NULL,
    -- Заполнено только для ChatAttachment — для проверки доступа при скачивании.
    -- Без FK на chats.chat: модули не должны зависеть друг от друга на уровне схемы.
    chat_id       UUID         DEFAULT NULL,

    CONSTRAINT fk_file_upload_uploaded_by
        FOREIGN KEY (uploaded_by) REFERENCES auth.user (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_file_upload_file_key
    ON files.file_upload (file_key);

CREATE INDEX IF NOT EXISTS ix_file_upload_uploaded_by_category
    ON files.file_upload (uploaded_by, category);
