--  Инициализация схем БД для каждого модуля.
--  Запускается ОДИН РАЗ при первом старте контейнера PostgreSQL.
--  EF Core создаёт таблицы внутри схем через миграции.

-- ── Схемы модулей ─────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS chats;
CREATE SCHEMA IF NOT EXISTS messages;
CREATE SCHEMA IF NOT EXISTS files;

-- ── Расширения ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- gen_random_uuid() уже в pg16
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- триграммный поиск по именам/контенту
CREATE EXTENSION IF NOT EXISTS "btree_gin";      -- GIN индексы для составных запросов

-- ── Права: пользователь приложения имеет доступ только к своим схемам ─────────
DO $$
DECLARE
    app_user TEXT := current_user; -- в compose это POSTGRES_USER = messenger
BEGIN
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA auth     TO %I', app_user);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA users    TO %I', app_user);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA chats    TO %I', app_user);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA messages TO %I', app_user);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA files    TO %I', app_user);
    
    -- Автоматически выдавать права на новые таблицы в каждой схеме
    
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA auth     GRANT ALL ON TABLES TO %I', app_user);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA users    GRANT ALL ON TABLES TO %I', app_user);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA chats    GRANT ALL ON TABLES TO %I', app_user);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA messages GRANT ALL ON TABLES TO %I', app_user);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA files    GRANT ALL ON TABLES TO %I', app_user);
END $$;


--  СХЕМА: auth

CREATE TABLE IF NOT EXISTS auth.credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    login VARCHAR(50) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_auth_login UNIQUE (login),
    CONSTRAINT ck_auth_login_length CHECK (char_length(login) >= 3)
);

-- Поиск по логину при каждом входе — индекс обязателен
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_credentials_login
    ON auth.credentials (login);

--  СХЕМА: users


CREATE TABLE IF NOT EXISTS users.profiles (
    id UUID PRIMARY KEY,   -- совпадает с auth.credentials.id
    username VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    status VARCHAR(10) NOT NULL DEFAULT 'offline',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_users_status CHECK (status IN ('online', 'offline', 'away'))
);

-- Триграммный индекс для поиска пользователей по имени (LIKE '%текст%')
CREATE INDEX IF NOT EXISTS idx_users_profiles_username_trgm
    ON users.profiles
    USING GIN (username gin_trgm_ops);

--  СХЕМА: chats

CREATE TABLE IF NOT EXISTS chats.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(10) NOT NULL,
    name VARCHAR(100),             -- NULL для direct, название для group
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_chats_type CHECK (type IN ('direct', 'group')),
    -- У группового чата должно быть имя
    CONSTRAINT ck_chats_group_name CHECK (
        type = 'direct' OR (type = 'group' AND name IS NOT NULL)
    )
);

-- Досоздаем таблицу участников чата
CREATE TABLE IF NOT EXISTS chats.members (
    chat_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (chat_id, user_id),

    CONSTRAINT fk_members_chat FOREIGN KEY (chat_id)
        REFERENCES chats.chats (id) ON DELETE CASCADE,

    CONSTRAINT ck_members_role CHECK (role IN ('owner', 'admin', 'member'))
);

CREATE INDEX IF NOT EXISTS idx_chats_members_user_id ON chats.members (user_id);
CREATE INDEX IF NOT EXISTS idx_chats_members_chat_id ON chats.members (chat_id);


-- СХЕМА: messages

CREATE TABLE IF NOT EXISTS messages.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL,
    sender_id UUID,
    type VARCHAR(10) NOT NULL DEFAULT 'text',
    content TEXT,
    file_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_messages_type CHECK (type IN ('text', 'image', 'file')),

    CONSTRAINT ck_messages_text_content CHECK (
        type != 'text' OR (content IS NOT NULL AND char_length(content) > 0)
    ),
    CONSTRAINT ck_messages_file_url CHECK (
        type = 'text' OR file_url IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages.messages (chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id 
    ON messages.messages (sender_id) 
    WHERE sender_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_content_trgm 
    ON messages.messages 
    USING GIN (content gin_trgm_ops) 
    WHERE type = 'text' AND content IS NOT NULL;

CREATE OR REPLACE FUNCTION messages.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_messages_updated_at
    BEFORE UPDATE ON messages.messages
    FOR EACH ROW
    EXECUTE FUNCTION messages.set_updated_at();


-- СХЕМА: files

CREATE TABLE IF NOT EXISTS files.uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_id UUID,
    original_name TEXT NOT NULL,
    mime_type VARCHAR(127) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    storage_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_uploader_id 
    ON files.uploads (uploader_id) 
    WHERE uploader_id IS NOT NULL;