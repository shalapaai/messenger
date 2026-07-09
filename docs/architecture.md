# Архитектура

## Обзор

Messenger — **модульный монолит** на .NET 9. Каждый модуль (Auth, Users, Messages и т.д.) изолирован: имеет собственный `DbContext`, репозитории, обработчики команд/запросов и схему PostgreSQL. Модули общаются друг с другом только через MediatR (`ISender`) или доменные события.

```
┌─────────────────────────────────────────────┐
│               Messenger.Api                 │
│   (ASP.NET Core Minimal API + SignalR)      │
│                                             │
│  Auth │ Users │ Messages │ Files │ Realtime │
└───────┬─────────────────────────────────────┘
        │ MediatR / Domain Events
┌───────▼──────────┐    ┌──────────────────┐
│  PostgreSQL 16   │    │    Redis 7        │
│  (per-module     │    │  (SignalR backpl. │
│   schemas)       │    │   + cache)        │
└──────────────────┘    └──────────────────┘
```

## Технологический стек

| Слой | Технология |
|---|---|
| Фреймворк | .NET 9 / ASP.NET Core |
| ORM | Entity Framework Core 9 + Npgsql |
| Медиатор | MediatR |
| Валидация | FluentValidation |
| База данных | PostgreSQL 16 |
| Кеш / Realtime | Redis 7 |
| WebSocket | SignalR (с Redis backplane) |
| Аутентификация | JWT (HS256) + Refresh Tokens |
| Документация API | Swagger / OpenAPI |
| Хранилище файлов | Local filesystem или AWS S3 |
| Фронтенд | React 19 + Vite |
| Контейнеризация | Docker + Docker Compose |
| Логирование | Serilog |

## Паттерны

### CQRS (Command Query Responsibility Segregation)

Все операции делятся на два типа:

- **Command** — изменяет состояние, возвращает `Result<T>` или `Result`
- **Query** — читает данные, не меняет состояние, возвращает `Result<T>`

```csharp
// Команда
public sealed record RegisterCommand(string Email, string Password) : ICommand<UserAuthDto>;

// Запрос
public sealed record GetMeQuery(Guid AuthUserId) : IQuery<MeDto>;
```

Обработчики регистрируются в DI через `AddMediatR` в каждом модуле. MediatR сам находит нужный обработчик по типу запроса.

### Railway-Oriented Programming (Result pattern)

Вместо исключений все операции возвращают `Result<T>`:

```csharp
// Успех
return Result.Success(new UserAuthDto(...));

// Ошибка
return Result.Failure<UserAuthDto>(Error.Conflict("Auth.EmailAlreadyExists"));
```

`Error` содержит код, описание и тип (`NotFound`, `Conflict`, `Unauthorized`, `Validation`, `Forbidden`). Тип ошибки автоматически маппится в HTTP-статус через `error.ToHttpResult()`.

### Доменные события

Агрегаты накапливают события через `RaiseDomainEvent(...)`. После сохранения в БД `MessagesDbContext.SaveChangesAsync` публикует их в MediatR:

```
Message.Create() → raises MessageSentDomainEvent
    ↓ SaveChangesAsync
    ↓ mediator.Publish(MessageSentDomainEvent)
    ↓ MessageSentEventHandler → ChatHub.Clients.Group("chat:xxx").ReceiveMessage(...)
```

### Модульная структура

Каждый модуль реализует `IModuleInstaller`:

```csharp
public interface IModuleInstaller
{
    void Install(IServiceCollection services, IConfiguration configuration);
    Task MigrateAsync(IServiceProvider services, CancellationToken ct = default);
}
```

`Program.cs` вызывает `Install` и `MigrateAsync` для каждого модуля в порядке регистрации.

## Структура проекта

```
backend/src/
├── Api/
│   └── Messenger.Api/          — точка входа, Program.cs, middleware
└── Modules/
    ├── Shared/
    │   └── Messenger.Shared.Kernel/   — Result, Error, CQRS, AggregateRoot
    ├── Auth/
    │   └── Messenger.Modules.Auth/
    │       ├── Application/           — команды, запросы, обработчики
    │       ├── Domain/                — UserAuth, RefreshToken
    │       ├── Infrastructure/        — DbContext, репозитории
    │       └── Presentation/          — HTTP эндпоинты (Minimal API)
    ├── Users/      (аналогичная структура)
    ├── Messages/
    ├── Files/
    ├── Chats/
    ├── Realtime/
    ├── Notifications/
    └── Localization/
```

## Авторизация

JWT-токен передаётся в заголовке:
```
Authorization: Bearer <access_token>
```

Для SignalR WebSocket — в query string (браузеры не могут отправлять заголовки при upgrade):
```
wss://host/hubs/messenger?access_token=<token>
```

Из токена извлекаются claims `sub` (userId) и `email`. Хелперы:

```csharp
ctx.GetUserId()    // → Guid
ctx.GetUserEmail() // → string
```

Оба хелпера ищут claim по нескольким именам подряд (`ClaimTypes.NameIdentifier` / `"nameid"` / `"sub"`), а не по одному — начиная с .NET 8, `JwtBearer` по умолчанию использует `JsonWebTokenHandler` с `MapInboundClaims = false`: claims, записанные как `ClaimTypes.*`, сериализуются в короткие имена из самого JWT (`"nameid"`, `"email"`) и возвращаются как есть, не перемапливаясь обратно в длинные URI `ClaimTypes.*`. Цепочка фолбэков покрывает и старое (перемапленное), и новое (неперемапленное) поведение одним кодом.

## Горизонтальное масштабирование

- **API** — stateless, можно запускать несколько инстансов
- **SignalR** — Redis backplane синхронизирует broadcast между инстансами
- **PostgreSQL** — shared, соединения через connection pool

## Продакшн-деплой

Два независимых варианта, не комбинируются одновременно:

- **`docker-compose.prod.yml`** — свой VPS с публичным IP, TLS терминирует Caddy. Наружу торчит только Caddy; `api` и `frontend` доступны лишь по внутренней docker-сети, всё идёт через `frontend` (nginx), который проксирует `/api` и `/hubs` — сам API снаружи не нужен. `pgAdmin` в проде выключен (`replicas: 0`), Redis не пробрасывает порт наружу.
- **`docker-compose.tunnel.yml`** — без своего публичного IP/VPS, через Cloudflare Tunnel (`cloudflared`). Публичный доступ идёт только через туннель; `cloudflared` принудительно использует `--protocol http2` (TCP+TLS), а не QUIC/UDP по умолчанию — часть провайдеров душит/рвёт именно QUIC, из-за чего туннель постоянно переподключался.

В обоих случаях healthcheck API использует `wget`, не `curl` — в runtime-образе (`aspnet:9.0`, debian-slim) `curl` не установлен, только `wget`.
