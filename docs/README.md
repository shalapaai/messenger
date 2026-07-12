# Документация Messenger

## Оглавление

1. [Обзор проекта](#1-обзор-проекта)
2. [Архитектура](#2-архитектура)
3. [База данных](#3-база-данных)
4. [Модули](#4-модули)
5. [Межмодульные связи](#5-межмодульные-связи)
6. [Типичные пользовательские сценарии](#6-типичные-пользовательские-сценарии)
7. [Фронтенд](frontend.md)

---

## 1. Обзор проекта

Мессенджер — это backend-приложение на **C# / .NET 9**, написанное в виде **модульного монолита**. Это значит:

- Один запущенный процесс, одна база данных (PostgreSQL)
- Внутри — 8 независимых модулей, каждый живёт в своей папке и управляет только своими данными
- Модули не обращаются к чужим таблицам напрямую — только через публичные интерфейсы

**Стек технологий:**

| Компонент | Технология |
|---|---|
| Язык | C# 13 / .NET 9 |
| База данных | PostgreSQL |
| ORM | Entity Framework Core 9 (Npgsql) |
| WebSocket | SignalR (Microsoft) |
| Авторизация | JWT Bearer токены |
| Валидация | FluentValidation |
| Команды/Запросы | MediatR (CQRS паттерн) |
| Хранение файлов | Локальная папка |

Запуск и переменные окружения — см. [getting-started.md](getting-started.md).

---

## 2. Архитектура

### 2.1 Модульный монолит

```
Приложение (один процесс)
├── Auth        — регистрация, логин, JWT, refresh-токены
├── Users       — профили, аватарки, поиск пользователей
├── Chats       — создание/управление чатами и участниками
├── Messages    — отправка, редактирование, история сообщений
├── Files       — загрузка и выдача файлов (аватары, вложения)
├── Realtime    — WebSocket (SignalR) для live-уведомлений
├── Notifications — заглушка для будущих уведомлений
└── Localization  — локализация ошибок
```

### 2.2 Слои внутри каждого модуля

Каждый модуль делится на 4 слоя:

```
Domain/           — сущности и бизнес-логика (Chat, Message, FileUpload...)
Application/      — команды и запросы (что система умеет делать)
Infrastructure/   — работа с БД, файловыми хранилищами
Presentation/     — HTTP-эндпоинты (REST API)
```

### 2.3 CQRS — разделение чтения и записи

Вместо обычных контроллеров используется паттерн **Command / Query**:

- **Command** — изменяет данные (создать чат, отправить сообщение)
- **Query** — только читает данные (получить список чатов)
- Каждый тип запроса имеет свой **Handler** (обработчик)
- Все они запускаются через **MediatR** — внутренний диспетчер

```
HTTP запрос → Endpoint → Command/Query → MediatR → Handler → БД
```

### 2.4 Result паттерн — обработка ошибок

Вместо исключений (exceptions) все операции возвращают **Result**:

```
Result.Success(данные)          — операция прошла успешно
Result.Failure(Error)          — что-то пошло не так
```

Типы ошибок: `Validation`, `NotFound`, `Forbidden`, `Unauthorized`, `Conflict`.

---

## 3. База данных

> **Как на самом деле создаётся схема.** `EnsureCreatedAsync`, который вызывают модули при старте (см. §2.1), в этом проекте почти ничего не делает: он создаёт таблицы, только если БД физически не существует. А PostgreSQL всегда создаёт БД сам (переменная `POSTGRES_DB`) при первом старте контейнера — так что с точки зрения `EnsureCreatedAsync` база "уже существует", и он молча ничего не создаёт. Настоящий источник схемы — файл `docker/init.sql`, который Postgres выполняет **один раз**, при самом первом старте контейнера (через `/docker-entrypoint-initdb.d`). Если добавляешь новую колонку в C#-модель — её обязательно нужно продублировать в `docker/init.sql` руками, иначе получишь `column ... does not exist` при первом же запросе к БД. Чтобы применить изменения в дев-окружении, проще всего пересоздать volume Postgres (`docker compose down && docker volume rm messenger_postgres_data && docker compose up -d`) — init.sql запустится заново на чистом томе.

PostgreSQL содержит **5 именованных схем** — по одной на каждый модуль с данными:

```
PostgreSQL (одна БД)
├── auth.*          — таблицы Auth модуля
├── users.*         — таблицы Users модуля
├── chats.*         — таблицы Chats модуля
├── messages.*      — таблицы Messages модуля
└── files.*         — таблицы Files модуля
```

Описание таблиц каждой схемы — в документации соответствующего модуля: [Auth](modules/auth.md#схема-бд), [Users](modules/users.md#схема-бд), [Chats](modules/chats.md#схема-бд), [Messages](modules/messages.md#схема-бд), [Files](modules/files.md#схема-бд).

---

## 4. Модули

| Модуль | Документация |
|---|---|
| Auth — аутентификация | [modules/auth.md](modules/auth.md) |
| Users — профили пользователей | [modules/users.md](modules/users.md) |
| Chats — чаты | [modules/chats.md](modules/chats.md) |
| Messages — сообщения | [modules/messages.md](modules/messages.md) |
| Files — файлы | [modules/files.md](modules/files.md) |
| Realtime — WebSocket / SignalR | [modules/realtime.md](modules/realtime.md) |

---

## 5. Межмодульные связи

Модули изолированы — они не вызывают друг друга напрямую. Вместо этого используются публичные контракты (интерфейсы), реализация которых регистрируется в DI самим модулем-владельцем, а вызывающий модуль получает её только через интерфейс.

```
Chats → IMessagesModule:
  - GetLastMessagesByChatIdsAsync()   — последние сообщения (+ признак вложений) для списка чатов
  - DeleteAllMessagesInChatAsync()    — DeleteChatCommandHandler вызывает ПОСЛЕ удаления самого
                                         чата, best-effort (явно, а не полагаясь на ON DELETE
                                         CASCADE в БД — см. Chats "Удаление чата")
  - GetMessageCountInChatAsync()      — есть в контракте, пока не вызывается ни одним хендлером

Chats → IUsersModule:
  - GetSummariesByAuthUserIdsAsync()  — displayName/avatarUrl собеседника в личных чатах

Messages → IFilesModule:
  - UploadChatAttachmentAsync()       — загрузить файл-вложение (с привязкой к chatId)
  - DeleteChatAttachmentAsync()       — компенсирующее удаление, если последующий шаг того же
                                         запроса (другой файл в батче, сохранение сообщения) упал

Chats → IFilesModule:
  - UploadGroupAvatarAsync()          — загрузить/заменить аватарку группы (UploadChatAvatarCommandHandler)

Messages → IUsersModule:
  - GetSummariesByAuthUserIdsAsync()  — displayName/avatarUrl отправителей в истории сообщений
                                         (и авторов пересланных/цитируемых сообщений)

Realtime → IChatsModule:
  - GetChatIdsByUserIdAsync()         — список чатов пользователя для рассылки UserOnline
  - GetMemberIdsAsync()               — участники чата для дополнительной personal-group
                                         рассылки ReceiveMessage/MessageEdited/MessageDeleted/
                                         MessagesRead (см. Realtime "Важно — двойная доставка")

Realtime → IUsersModule:
  - GetSummariesByAuthUserIdsAsync()  — имя отправителя (и автора пересылки/цитаты) в ReceiveMessage

Realtime → IMessagesModule:
  - GetMessagePreviewsByIdsAsync()    — превью цитируемого сообщения (автор + текст) для карточки
                                         "в ответ на" в ReceiveMessage, см. Messages "Ответ на сообщение"

Realtime ← Messages (через MediatR INotification):
  - MessageSentDomainEvent            — новое сообщение → WebSocket рассылка
  - MessageEditedDomainEvent          — редактирование → WebSocket рассылка
  - MessageDeletedDomainEvent         — удаление → WebSocket рассылка

Realtime ← Chats (через MediatR INotification):
  - ChatReadDomainEvent               — чат отмечен прочитанным → WebSocket рассылка MessagesRead

Auth → Users (вне кода, по соглашению):
  - После регистрации клиент сам вызывает POST /api/users
  - auth_user_id в user_profile связывает auth.user и users.user_profile
```

### Контракты в Shared.Kernel — когда обычного интерфейса модуля недостаточно

Два модуля иногда нуждаются друг в друге **в обе стороны**. Пример: `Chats` уже зависит от `Messages` (последнее сообщение для списка чатов) — если бы `Messages` тоже зависел от `Chats` (проверка членства), получился бы цикл на уровне `.csproj`, который C# просто не скомпилирует.

Решение — контракт живёт не в модуле-владельце данных, а в `Shared.Kernel` (его уже референсят все модули), а реализацию владелец регистрирует в DI. Вызывающий модуль получает реализацию через DI **без ссылки на сборку владельца** — связь только на рантайме, не в графе проектов.

```
IChatMembershipChecker (Shared.Kernel, реализация — Chats):
  - IsMemberAsync(chatId, userId) — лёгкая EXISTS-проверка по (chat_id, user_id)
  - Используют: Messages (SendMessage/GetMessages/UploadAndSendMessage/DeleteMessage — 403 если
                не участник; ForwardMessages — проверяет членство сразу в двух чатах, исходном
                и целевом),
                Realtime (JoinChat/StartTyping/StopTyping — HubException если не участник),
                Files (DownloadFile для ChatAttachment — 401/403)

IPresenceTracker (Shared.Kernel, Redis-реализация — один Redis SET connectionId на пользователя):
  - ConnectAsync(userId, connectionId)/DisconnectAsync(userId, connectionId) — добавляют/убирают
    connectionId из множества, возвращают его размер (= счётчик активных подключений)
  - GetOnlineAsync(userIds)           — текущий онлайн-статус списка пользователей (размер > 0)
  - GetConnectionsAsync(userId)       — все текущие connectionId пользователя, нужно
                                         Groups.RemoveFromGroupAsync (принимает connectionId, не userId)
  - Пишет: Realtime (MessengerHub.OnConnectedAsync/OnDisconnectedAsync)
  - Читает: Chats (GetChatsQueryHandler — текущий статус собеседника при отдаче списка чатов),
            Realtime (ChatUpdatedEventHandler — принудительный вывод исключённого участника
            из SignalR-группы chat:{id})
```

Без `IChatMembershipChecker` любой залогиненный пользователь, узнав GUID чужого чата, мог читать/писать в него; кикнутый из группы участник сохранял бы доступ по старому `chatId` — этот контракт закрывает именно эту дыру.

---

## 6. Типичные пользовательские сценарии

### Регистрация и вход

```
1. POST /api/auth/register  { email, password }
2. POST /api/users         { displayName, login }
3. POST /api/auth/login     { email, password } → { accessToken, refreshToken }
```

### Начать чат с пользователем

```
1. GET /api/users/search?q=username  → найти userId
   (q без "@" ищет по email/displayName/login разом; "@login" — только по login)
2. POST /api/chats/direct { otherUserId }  → получить chatId
3. WebSocket: JoinChat(chatId)  → подписаться на сообщения
4. POST /api/chats/{chatId}/messages { content }  → отправить
```

На фронтенде шаги 2–4 для НОВОГО собеседника схлопнуты в один момент — отправку первого сообщения (см. [Chats — Фронтенд: поиск пользователя и создание чата](modules/chats.md#фронтенд-поиск-пользователя-и-создание-чата-без-пустых-чатов)), чтобы у получателя не появлялся пустой чат раньше, чем ему реально что-то написали. Для уже существующего контакта (есть прямой чат с этим userId) шаг 1 сразу ведёт на `GET /api/chats/{id}/messages`, шаги 2–4 не нужны.

### Удалить чат

```
DELETE /api/chats/{chatId}
  → 204, чат и все его сообщения исчезают у обеих сторон
  → 422 если это групповой чат (нужен DELETE /chats/{id}/members/{userId} с self)
  → 403 если ты не состоишь в чате
```

### Удалить сообщение

```
DELETE /api/chats/{chatId}/messages/{messageId}
  → 204, status="Deleted", content стирается, остальным рассылается MessageDeleted по WebSocket
  → 403 если ты не участник чата (не обязательно автор — удалить может любой участник)
```

### Удалить несколько сообщений сразу

```
POST /api/chats/{chatId}/messages/delete-bulk  { messageIds: [...] }
  → 200 [ ...id успешно удалённых ]
  → уже удалённые id внутри списка молча пропускаются, а не роняют весь запрос
  → 409 если один из выбранных успели изменить/удалить параллельно
```

### Отредактировать сообщение

```
PATCH /api/chats/{chatId}/messages/{messageId}  { newContent }
  → 204, остальным рассылается MessageEdited по WebSocket
  → 403 если ты не автор (в отличие от удаления, редактировать можно только своё)
```

### Ответить на сообщение

```
POST /api/chats/{chatId}/messages  { content, replyToMessageId }
  (или через WebSocket: SendMessage({ chatId, content, replyToMessageId }))
  → сообщение создаётся как обычное, но с привязкой к оригиналу
  → все получают ReceiveMessage с готовым превью цитаты (replyToSenderName, replyToContent) —
    дополнительный запрос за оригиналом не нужен
```

### Переслать сообщения

```
POST /api/chats/{targetChatId}/messages/forward  { sourceChatId, messageIds: [...] }
  → 201, создаются независимые копии в targetChatId, автор копий — тот, кто переслал
  → 403 если не состоишь в sourceChatId или в targetChatId
```

### Отметить чат прочитанным

```
POST /api/chats/{chatId}/read
  → 204, chats.members.last_read_at = NOW() для текущего пользователя
  → остальным участникам чата рассылается MessagesRead по WebSocket
```

### Получить историю сообщений

```
GET /api/chats/{chatId}/messages?limit=50
  → { items: [...50 сообщений], nextCursor: "guid" }

GET /api/chats/{chatId}/messages?before={nextCursor}&limit=50
  → следующие 50 сообщений
```

### Отправить фото (или несколько файлов) в чат

```
POST /api/chats/{chatId}/messages/upload
  Body: multipart/form-data
    <один или несколько файлов>
    caption: "Смотри что нашёл"  (необязательно, относится ко всему сообщению)
  → 201 { messageId, content, attachments: [...], sentAt }
  → 400 если файлов не передано
  → 422 если тип не в белом списке, файл больше 25 МБ или вложений больше 10
```

### Создать групповой чат

```
POST /api/chats/group
  { name: "Команда", memberIds: [userId1, userId2, userId3] }
  → 201 { chatId }

  Создатель автоматически получает роль Owner.
  Переданные участники добавляются с ролью Member.
```
