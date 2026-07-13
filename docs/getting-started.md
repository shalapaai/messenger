# Запуск проекта

## Требования

- Docker Engine 24+
- Docker Compose v2
- `make` (опционально, для удобства)

## Быстрый старт

```bash
# 1. Клонировать репозиторий
git clone <url>
cd messenger

# 2. Скопировать конфиг и заполнить переменные
cp .env.example .env

# 3. Собрать и запустить
make up-build
# или без make:
docker compose up -d --build
```

После запуска:

| Сервис | URL |
|---|---|
| API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger |
| Фронтенд | http://localhost:3000 |
| pgAdmin | http://localhost:5050 |

## Переменные окружения (`.env`)

```dotenv
# PostgreSQL
POSTGRES_USER=messenger
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=messenger
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379

# JWT
JWT_SECRET=your_very_long_secret_key_min_32_chars
JWT_ISSUER=messenger-api
JWT_AUDIENCE=messenger-client
JWT_EXPIRY_MINUTES=15

# Refresh Tokens
REFRESH_TOKEN_EXPIRY_DAYS=7

# Файловое хранилище
FILE_STORAGE_LOCAL_BASE_PATH=/app/uploads

# pgAdmin
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=admin

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

## Команды Makefile

```bash
make up-build    # пересобрать и запустить все контейнеры
make up          # запустить без пересборки
make down        # остановить контейнеры
make down-v      # остановить и удалить volumes (сброс БД)
make logs        # следить за логами API
make ps          # статус контейнеров
```

## База данных

При первом старте PostgreSQL автоматически выполняет `docker/init.sql`, который создаёт:
- все схемы (`auth`, `users`, `messages`, `files`, `chats`)
- все таблицы с нужными типами и индексами
- расширения (`pg_trgm`, `btree_gin`)

При старте API каждый модуль вызывает `EnsureCreatedAsync` — если таблицы уже есть (созданы init.sql), EF Core ничего не трогает.

**Сброс базы данных:**
```bash
docker compose down -v   # удаляет volume postgres_data
docker compose up -d     # init.sql запустится заново
```

## Swagger

В режиме Development Swagger UI доступен по адресу `http://localhost:8080/swagger`.

Чтобы тестировать защищённые эндпоинты:
1. Вызвать `POST /api/auth/register` или `POST /api/auth/login`
2. Скопировать `accessToken` из ответа
3. Нажать **Authorize** в Swagger UI → вставить токен

## Логирование

Логи API настраиваются через `appsettings.json` (Serilog). В Docker логи смотреть:

```bash
docker compose logs -f api
```

Формат по умолчанию — JSON для Production, читаемый текст для Development.
