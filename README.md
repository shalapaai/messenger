# Messenger

Full-stack messenger: .NET 9 Modular Monolith (backend) + React 19 + Vite (frontend).

---

## Запуск

### Первый раз

```bash
cp .env.example .env
cd frontend && npm install && cd ..
make up-build
```

### Статус

```bash
make health
```

---

## Режимы запуска

### Полный стек в Docker

```bash
make up-build   # всё: PostgreSQL + Redis + API + Frontend (nginx)
```

| Сервис | URL |
|---|---|
| **Frontend** | http://localhost:5173 |
| **API (Swagger)** | http://localhost:8080/swagger |
| **API health** | http://localhost:8080/health |
| **pgAdmin** | http://localhost:5050 |

### Разработка фронтенда (hot reload)

Запускаем backend в Docker, фронтенд — локально с Vite:

```bash
make up-backend           # PostgreSQL + Redis + API в Docker
cd frontend
npm run dev               # Vite dev server → http://localhost:5173
```

Vite автоматически проксирует запросы к API:
- `/api/*` → `http://localhost:8080`
- `/hubs/*` → `ws://localhost:8080` (SignalR)

### Разработка бэкенда (hot reload)

Инфраструктура в Docker, API — локально:

```bash
make up-infra             # PostgreSQL + Redis + pgAdmin в Docker
cd backend
dotnet watch run --project src/Api/Messenger.Api
```

---

## Команды

```bash
make up             # запустить всё
make up-backend     # infra + API (без фронтенда)
make up-frontend    # infra + фронтенд (без API)
make up-infra       # только PostgreSQL + Redis + pgAdmin
make up-build       # пересобрать и запустить

make down           # остановить (данные сохраняются)
make down-clean     # СБРОС: остановить + удалить все volumes

make logs           # логи всех сервисов
make logs-api       # логи API
make logs-frontend  # логи фронтенда

make health         # статус контейнеров
make shell-db       # psql в PostgreSQL
make shell-redis    # redis-cli
make shell-api      # sh в контейнере API

make migrate        # применить EF Core миграции
make migrate-add MODULE=Messages NAME=AddColumn  # новая миграция

make test           # все тесты в Docker
make test-unit      # только unit-тесты
make test-integration  # только integration-тесты
```

---

## Тесты

### Unit-тесты (без инфраструктуры)

Тестируют доменные сущности, CQRS-хэндлеры, валидаторы и JWT-сервис в изоляции (NSubstitute-моки).

```bash
make test-unit
```

Или напрямую в Docker:

```bash
docker run --rm \
  -v $(pwd)/backend:/app \
  -w /app \
  mcr.microsoft.com/dotnet/sdk:9.0-alpine \
  dotnet test tests/Messenger.Modules.Auth.UnitTests
```

### Integration-тесты (Testcontainers)

Поднимают реальные PostgreSQL и Redis в Docker, запускают `WebApplicationFactory<Program>` и гоняют HTTP-запросы к API.

```bash
make test-integration
```

> Требует: Docker с доступом к `/var/run/docker.sock`.

### Все тесты

```bash
make test
```

### Покрытие

| Проект | Что тестируется |
|---|---|
| `Messenger.Modules.Auth.UnitTests` | Domain (UserAuth, RefreshToken), Validators (Register, Login, RefreshToken, Logout), Handlers (Register, Login, Refresh, Logout), JwtTokenService |
| `Messenger.Api.IntegrationTests` | POST /auth/register, POST /auth/login, POST /auth/refresh, POST /auth/logout (включая ротацию токенов) |

---

## Конфликты портов

Если локально запущены PostgreSQL (5432) или Redis/Valkey (6379):

```bash
# .env
POSTGRES_PORT=5433
REDIS_PORT=6380
```

```yaml
# docker-compose.override.yml
postgres:
  ports: ["5433:5432"]
redis:
  ports: ["6380:6379"]
```

---

## Структура

```
messenger/
├── backend/src/
│   ├── Api/Messenger.Api/      ← точка входа
│   └── Modules/
│       ├── Auth/               ← JWT + refresh tokens
│       ├── Users/              ← профили
│       ├── Chats/              ← личные и групповые чаты
│       ├── Messages/           ← сообщения
│       ├── Files/              ← загрузка файлов
│       ├── Realtime/           ← SignalR
│       ├── Notifications/      ← push-уведомления
│       ├── Localization/       ← ru / en
│       └── Shared/Kernel/      ← Result<T>, CQRS
│
├── frontend/src/
│   ├── app/router/             ← React Router
│   └── pages/                 ← LoginPage, RegisterPage, MessengerPage
│
├── docker-compose.yml          ← все сервисы
├── docker-compose.override.yml ← dev-переопределения (автоматически)
├── docker-compose.prod.yml     ← prod (2 реплики API)
├── Dockerfile                  ← backend multi-stage
├── frontend/Dockerfile         ← frontend multi-stage (nginx)
├── .env.example
└── Makefile
```
