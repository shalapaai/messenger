-- Инициализация схем БД для каждого модуля.
-- Запускается ОДИН РАЗ при первом старте контейнера PostgreSQL.
-- EF Core создаёт таблицы внутри схем через миграции.

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
