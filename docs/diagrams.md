# Схемы архитектуры бекенда

---

## 1. Инфраструктура

```mermaid
graph TB
    subgraph docker["Docker Compose"]
        FE["Frontend\nReact + Vite → nginx\n:3000"]
        API["Messenger.Api\nASP.NET Core 9\n:8080"]
        PG[("PostgreSQL 16\n:5432")]
        RD[("Redis 7\n:6379")]
        PGA["pgAdmin 4\n:5050"]
    end

    Browser["Браузер"] -->|"HTTP REST"| FE
    Browser <-->|"WebSocket"| API
    FE -->|"HTTP / HTTPS"| API
    API -->|"EF Core + Npgsql"| PG
    API <-->|"SignalR backplane"| RD
    PGA -->|"SQL"| PG
```

---

## 2. Структура модуля (на примере Auth)

```mermaid
graph TD
    subgraph module["Messenger.Modules.Auth"]
        subgraph pres["Presentation"]
            EP["AuthEndpoints.cs\n/api/auth/register\n/api/auth/login\n/api/auth/refresh\n/api/auth/logout"]
        end

        subgraph app["Application"]
            CMD["Commands / Queries\nRegisterCommand\nLoginCommand\nRefreshTokenCommand\nLogoutCommand"]
            HDL["Handlers\nRegisterCommandHandler\nLoginCommandHandler\n..."]
            ABS["Abstractions (интерфейсы)\nIUserAuthRepository\nIPasswordHasher\nIJwtTokenService\nIUnitOfWork"]
        end

        subgraph dom["Domain"]
            UA["UserAuth\nemail, passwordHash\nIsEmailVerified"]
            RT["RefreshToken\nuserId, token\nexpiresAt, isRevoked"]
        end

        subgraph infra["Infrastructure"]
            DBC["AuthDbContext\nschema: auth"]
            REPO["UserAuthRepository\nRefreshTokenRepository"]
            JWT["JwtTokenService"]
            HASH["BcryptPasswordHasher"]
        end
    end

    EP -->|"sender.Send(cmd)"| CMD
    CMD --> HDL
    HDL -->|"зависит от"| ABS
    HDL -->|"создаёт"| dom
    REPO -->|"реализует"| ABS
    HASH -->|"реализует"| ABS
    JWT -->|"реализует"| ABS
    REPO --> DBC
    DBC -->|"маппит"| dom
```

---

## 3. Pipeline входящего запроса

```mermaid
flowchart LR
    REQ["HTTP\nRequest"]
    MW["Middleware Pipeline\n─────────────\nHttpsRedirection\nCORS\nSerilog logging\nLocalization\nAuthentication\nAuthorization\nExceptionHandler"]
    EP["Minimal API\nEndpoint"]
    MB["MediatR\nISender"]
    VP["ValidationPipeline\nBehavior\n(FluentValidation)"]
    HDL["CommandHandler /\nQueryHandler"]
    REPO["Repository"]
    DB[("PostgreSQL")]
    ERR["GlobalException\nHandler\n→ ProblemDetails"]

    REQ --> MW --> EP
    EP -->|"sender.Send(command)"| MB
    MB --> VP
    VP -->|"validation fails\n→ ValidationException"| ERR
    ERR -->|"422 / 400 / 404..."| REQ
    VP -->|"validation passes\n→ next()"| HDL
    HDL --> REPO --> DB
    DB -->|"данные"| HDL
    HDL -->|"Result<T>"| EP
    EP -->|"Results.Ok() / Created() / ..."| REQ
```

---

## 4. Поток аутентификации

```mermaid
sequenceDiagram
    actor C as Клиент
    participant EP as POST /api/auth/register
    participant H as RegisterCommandHandler
    participant PH as BcryptPasswordHasher
    participant DB as auth.user (PG)

    C->>EP: { email, password }
    EP->>EP: FluentValidation (email format, password ≥ 8)
    EP->>H: RegisterCommand
    H->>DB: ExistsByEmailAsync(email)
    DB-->>H: false
    H->>PH: Hash(password) → "$2b$..."
    H->>H: UserAuth.Create(email, hash) → Result<UserAuth>
    H->>DB: INSERT INTO auth.user
    H-->>EP: Result.Success(UserAuthDto)
    EP-->>C: 201 Created { userId, email }

    Note over C,DB: Отдельный шаг — клиент создаёт профиль

    C->>EP: POST /api/users/profile { displayName, login }
    EP-->>C: 201 Created { profile }
```

```mermaid
sequenceDiagram
    actor C as Клиент
    participant EP as POST /api/auth/login
    participant H as LoginCommandHandler
    participant PH as BcryptPasswordHasher
    participant JWT as JwtTokenService
    participant DB as auth (PG)

    C->>EP: { email, password }
    EP->>H: LoginCommand
    H->>DB: GetByEmailAsync(email)
    DB-->>H: UserAuth { passwordHash }
    H->>PH: Verify(password, hash)
    PH-->>H: true
    H->>JWT: GenerateAccessToken(userId, email)
    JWT-->>H: { token (JWT), expiresAt }
    H->>JWT: GenerateRefreshToken()
    JWT-->>H: "случайная-строка-256-бит"
    H->>DB: INSERT INTO auth.refresh_token
    H-->>EP: Result.Success(TokenPairDto)
    EP-->>C: 200 OK { accessToken, refreshToken, expiresAt }

    Note over C,DB: Refresh rotation

    C->>EP: POST /api/auth/refresh { token: "старый-refresh" }
    EP->>H: RefreshTokenCommand
    H->>DB: GetByTokenAsync → проверяем IsActive
    H->>H: token.Revoke() — старый инвалидируем
    H->>JWT: GenerateAccessToken + GenerateRefreshToken
    H->>DB: INSERT новый refresh_token
    H-->>C: 200 OK { новая пара токенов }
```

---

## 5. Отправка сообщения и реалтайм-доставка

```mermaid
sequenceDiagram
    actor A as Клиент A<br/>(отправитель)
    participant HUB as MessengerHub<br/>(SignalR)
    participant MB as MediatR
    participant H as SendMessageCommandHandler
    participant MSG as Message (Domain)
    participant DB as messages.message (PG)
    participant EVT as MessageSentEventHandler<br/>(Realtime module)
    participant RD as Redis backplane
    actor B as Клиент B<br/>(получатель)

    Note over A,HUB: WebSocket уже установлен, токен в query string
    A->>HUB: JoinChat(chatId)
    HUB->>HUB: Groups.AddToGroupAsync("chat:{chatId}")
    B->>HUB: JoinChat(chatId)

    A->>HUB: SendMessage({ chatId, content })
    HUB->>MB: sender.Send(SendMessageCommand)
    MB->>H: Handle(command)
    H->>MSG: Message.Create(chatId, senderId, content)
    MSG->>MSG: RaiseDomainEvent(MessageSentDomainEvent)
    Note right of MSG: событие накапливается в списке,<br/>НЕ публикуется сразу
    H->>DB: INSERT INTO messages.message
    Note over DB,H: SaveChangesAsync() — сначала пишем в БД
    DB-->>H: OK
    H->>MB: mediator.Publish(MessageSentDomainEvent)
    Note over H,MB: события публикуются ПОСЛЕ<br/>успешной записи в БД
    MB->>EVT: Handle(MessageSentDomainEvent)
    EVT->>HUB: hubContext.Clients.Group("chat:{id}")<br/>.SendAsync("ReceiveMessage", payload)
    HUB->>RD: broadcast
    RD-->>HUB: (другие инстансы API)
    HUB-->>B: ReceiveMessage { messageId, chatId, senderId, content, sentAt }
    HUB-->>A: SendMessageResult { messageId }
```

---

## 6. Схема базы данных

```mermaid
erDiagram
    auth_user {
        uuid id PK
        varchar email UK
        varchar password_hash
        bool is_email_verified
        timestamp created_at
    }
    auth_refresh_token {
        uuid id PK
        uuid user_id FK
        varchar token UK
        timestamp expires_at
        bool is_revoked
        timestamp created_at
    }
    users_user_profile {
        uuid id PK
        uuid auth_user_id
        varchar email
        varchar display_name
        varchar login UK
        varchar status
        varchar avatar_url
        timestamp created_at
        timestamp updated_at
    }
    messages_message {
        uuid id PK
        uuid chat_id FK
        uuid sender_id
        text content
        varchar file_url
        varchar status
        timestamp sent_at
        timestamp edited_at
        timestamp deleted_at
        uuid reply_to_message_id
    }

    auth_user ||--o{ auth_refresh_token : "имеет токены"
    auth_user ||--o| users_user_profile : "имеет профиль"
    messages_message }o--|| messages_message : "reply_to"
```

> **Важно:** схемы `auth`, `users`, `messages` физически в одной БД PostgreSQL,
> но изолированы на уровне кода — у каждого модуля свой `DbContext`
> и своя таблица `__EFMigrationsHistory`.

---

## 7. Межмодульная связь: кто о ком знает

```mermaid
graph LR
    subgraph "Shared.Kernel (знают все)"
        SK["CQRS interfaces\nResult / Error\nAggregateRoot\nIDomainEvent"]
    end

    subgraph "Модули (изолированы)"
        AUTH["Auth"]
        USERS["Users"]
        MSGS["Messages"]
        RT["Realtime"]
        CHATS["Chats"]
        FILES["Files"]
    end

    AUTH -->|"использует"| SK
    USERS -->|"использует"| SK
    MSGS -->|"использует"| SK
    RT -->|"использует"| SK

    MSGS -->|"публикует\nMessageSentDomainEvent"| MB[("MediatR\n(in-process bus)")]
    RT -->|"подписывается на\nMessageSentDomainEvent"| MB

    MSGS -.->|"НЕТ прямой зависимости"| RT
    AUTH -.->|"НЕТ прямой зависимости"| USERS

    style MSGS -.->|"НЕТ прямой зависимости"| RT fill:none
```
