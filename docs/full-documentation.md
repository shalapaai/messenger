# Документация мессенджера — полное описание системы

## Оглавление

1. [Обзор проекта](#1-обзор-проекта)
2. [Архитектура](#2-архитектура)
3. [База данных — все схемы](#3-база-данных--все-схемы)
4. [Модуль Auth — аутентификация](#4-модуль-auth--аутентификация)
5. [Модуль Users — профили пользователей](#5-модуль-users--профили-пользователей)
6. [Модуль Chats — чаты](#6-модуль-chats--чаты)
7. [Модуль Messages — сообщения](#7-модуль-messages--сообщения)
8. [Модуль Files — файлы](#8-модуль-files--файлы)
9. [Модуль Realtime — WebSocket / SignalR](#9-модуль-realtime--websocket--signalr)
10. [Межмодульные связи](#10-межмодульные-связи)
11. [Типичные пользовательские сценарии](#11-типичные-пользовательские-сценарии)

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
| Хранение файлов | Локальная папка (dev) / Amazon S3 (prod) |

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

## 3. База данных — все схемы

PostgreSQL содержит **5 именованных схем** — по одной на каждый модуль с данными:

```
PostgreSQL (одна БД)
├── auth.*          — таблицы Auth модуля
├── users.*         — таблицы Users модуля
├── chats.*         — таблицы Chats модуля
├── messages.*      — таблицы Messages модуля
└── files.*         — таблицы Files модуля
```

### Схема `auth`

#### Таблица `auth.user`
| Колонка | Тип | Описание |
|---|---|---|
| id | uuid | Первичный ключ |
| email | varchar(255) | Email (уникальный) |
| password_hash | varchar(512) | Хеш пароля |
| is_email_verified | boolean | Подтверждён ли email |
| created_at | timestamptz | Дата регистрации |

**Индексы:** `ix_user_email` (unique) — быстрый поиск по email при логине.

#### Таблица `auth.refresh_token`
| Колонка | Тип | Описание |
|---|---|---|
| id | uuid | Первичный ключ |
| user_id | uuid | Ссылка на auth.user |
| token | varchar(256) | Сам refresh-токен (уникальный) |
| expires_at | timestamptz | Когда истекает |
| created_at | timestamptz | Когда создан |
| is_revoked | boolean | Отозван ли (logout) |

**Индексы:** `ix_refresh_token_token` (unique), `ix_refresh_token_user_id`.

---

### Схема `users`

#### Таблица `users.user_profile`
| Колонка | Тип | Описание |
|---|---|---|
| id | uuid | Первичный ключ профиля (свой, НЕ совпадает с auth.user.id) |
| auth_user_id | uuid | FK на `auth.user.id` — связь профиля с учётной записью |
| email | varchar(255) | Email (дублируется из Auth для поиска без межмодульного вызова) |
| display_name | varchar(100) | Отображаемое имя |
| login | varchar(30) | Уникальный логин вида `@login` (nullable) |
| status | varchar(200) | Статус-сообщение под именем (nullable) |
| avatar_url | varchar(2048) | URL аватарки (nullable) |
| phone | varchar(20) | Телефон (nullable) |
| city | varchar(100) | Город (nullable) |
| department | varchar(100) | Отдел (nullable) |
| created_at | timestamptz | Дата создания профиля |
| updated_at | timestamptz | Дата последнего обновления (nullable) |

**Индексы:** `ix_user_profile_auth_user_id` (unique), `ix_user_profile_email` (unique), `ix_user_profile_login` (unique, частичный — только где `login IS NOT NULL`).

---

### Схема `chats`

#### Таблица `chats.chats`
| Колонка | Тип | Описание |
|---|---|---|
| id | uuid | Первичный ключ |
| type | varchar(10) | Тип: `"direct"` или `"group"` |
| name | varchar(100) | Название (только для группового) |
| avatar_url | varchar(512) | Аватарка группового чата |
| created_at | timestamptz | Дата создания |

#### Таблица `chats.members`
| Колонка | Тип | Описание |
|---|---|---|
| chat_id | uuid | Первичный ключ (часть 1) + FK на chats.chats |
| user_id | uuid | Первичный ключ (часть 2) + FK на auth.user |
| role | varchar(10) | Роль: `"member"`, `"admin"`, `"owner"` |
| joined_at | timestamptz | Дата вступления |

**Ключи:** составной PK `(chat_id, user_id)` — нельзя быть в одном чате дважды.  
**Индекс:** `idx_chats_members_user_id` — быстрый поиск всех чатов пользователя, и основа лёгкой EXISTS-проверки членства (`IChatRepository.IsMemberAsync`, см. §10).  
**Cascade delete:** при удалении чата → все записи в `members` удаляются автоматически.

---

### Схема `messages`

#### Таблица `messages.message`
| Колонка | Тип | Описание |
|---|---|---|
| id | uuid | Первичный ключ |
| chat_id | uuid | Какой чат (FK на chats.chats) |
| sender_id | uuid | Кто отправил (FK на auth.user) |
| content | varchar(4096) | Текст сообщения |
| file_url | varchar(2048) | URL файла (если вложение) |
| status | varchar(20) | `"Sent"`, `"Delivered"`, `"Read"`, `"Deleted"` |
| sent_at | timestamptz | Когда отправлено |
| edited_at | timestamptz | Когда отредактировано (null если нет) |
| deleted_at | timestamptz | Когда удалено (null если нет) |
| reply_to_message_id | uuid | Ответ на какое сообщение (FK на messages.message, SET NULL при удалении оригинала) |

**Индексы:**
- `ix_message_chat_id_sent_at` — пагинация истории чата (самый частый запрос)
- `ix_message_sender_id` — поиск сообщений по отправителю

---

### Схема `files`

#### Таблица `files.file_upload`
| Колонка | Тип | Описание |
|---|---|---|
| id | uuid | Первичный ключ |
| file_key | varchar(512) | Ключ в хранилище (уникальный) |
| original_name | varchar(255) | Оригинальное имя файла |
| content_type | varchar(100) | MIME-тип (image/jpeg, etc.) |
| size_bytes | bigint | Размер в байтах |
| uploaded_by | uuid | Кто загрузил (FK на auth.user) |
| uploaded_at | timestamptz | Когда загружен |
| category | varchar(30) | `"Avatar"`, `"ChatAttachment"`, `"Document"` |
| chat_id | uuid | Заполнено только для `ChatAttachment` — нужно при скачивании, чтобы проверить членство в чате. Без FK на `chats.chats` — модули не должны зависеть друг от друга на уровне схемы (см. §8, §10) |

**Индексы:**
- `ix_file_upload_file_key` (unique) — поиск при отдаче файла клиенту
- `ix_file_upload_uploaded_by_category` — поиск аватара конкретного пользователя

---

## 4. Модуль Auth — аутентификация

### Что делает

Управляет учётными данными пользователей: регистрация, вход, выход, обновление токена.

### API endpoints

| Метод | URL | Описание |
|---|---|---|
| POST | `/api/auth/register` | Регистрация нового пользователя |
| POST | `/api/auth/login` | Вход, получение JWT + refresh токена |
| POST | `/api/auth/refresh` | Обновление JWT по refresh-токену |
| POST | `/api/auth/logout` | Выход (отзыв refresh-токена) |

### Как работает логин

1. Клиент отправляет email + password
2. Система находит пользователя в `auth.user` по email
3. Сверяет пароль с хешем через **Argon2** (алгоритм безопасного хеширования)
4. Генерирует **JWT Access Token** (живёт 15 минут) — подписанный токен с userId внутри
5. Генерирует **Refresh Token** (живёт 30 дней) — длинная случайная строка, хранится в БД
6. Возвращает оба токена клиенту

### Как работает авторизация последующих запросов

Все защищённые эндпоинты требуют заголовок:
```
Authorization: Bearer <jwt_access_token>
```

JWT декодируется, из него извлекается `userId` — он используется в хендлерах.

### Refresh Token Flow

```
JWT истёк → клиент отправляет refresh token → 
  сервер проверяет его в БД → 
  выдаёт новый JWT + новый refresh token → 
  старый refresh token отзывается (is_revoked = true)
```

---

## 5. Модуль Users — профили пользователей

### Что делает

Хранит профили пользователей (имя, логин, биография, аватарка). **Отдельно от Auth** — это намеренное разделение: Auth знает только "кто может войти", Users знает "как пользователь выглядит".

### API endpoints

| Метод | URL | Описание |
|---|---|---|
| POST | `/api/users/profile` | Создать профиль после регистрации |
| GET | `/api/users/me` | Получить свой профиль |
| PATCH | `/api/users/profile` | Обновить имя, биографию |
| POST | `/api/users/avatar` | Загрузить аватарку |
| GET | `/api/users/search?q=...` | Поиск пользователей по имени/логину |

### Логин пользователя

Каждый пользователь может задать уникальный логин (как @username в Telegram). Используется для поиска.

---

## 6. Модуль Chats — чаты

### Что делает

Управляет чатами: создание, управление участниками, обновление информации, удаление.

### Типы чатов

- **Direct** — личный чат между двумя пользователями. Создаётся идемпотентно (повторный запрос вернёт тот же ID).
- **Group** — групповой чат с названием. Участники могут иметь роли.

### Роли участников

| Роль | Что может |
|---|---|
| `owner` | Всё: редактировать, добавлять/удалять участников, удалить чат |
| `admin` | Редактировать информацию чата, добавлять/удалять участников |
| `member` | Только читать и писать сообщения, выйти из чата |

### API endpoints

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/chats` | Список своих чатов с последним сообщением |
| GET | `/api/chats/{id}` | Детали чата и список участников |
| POST | `/api/chats/direct` | Создать/найти личный чат с пользователем |
| POST | `/api/chats/group` | Создать групповой чат |
| PATCH | `/api/chats/{id}` | Обновить название / аватарку (Admin+) |
| DELETE | `/api/chats/{id}` | Удалить чат (только Owner) |
| POST | `/api/chats/{id}/members` | Добавить участника |
| DELETE | `/api/chats/{id}/members/{userId}` | Удалить участника / выйти |

### Как получить список чатов

1. Запрос `GET /api/chats`
2. Система находит все чаты пользователя из `chats.members`
3. **Межмодульный вызов** к Messages через `IMessagesModule.GetLastMessagesByChatIdsAsync()` — получает последнее сообщение для каждого чата
4. Для личных чатов без имени (`name IS NULL`) — **межмодульный вызов** к Users через `IUsersModule.GetSummariesByAuthUserIdsAsync()`, резолвится displayName и avatarUrl собеседника
5. Для личных чатов — **межмодульный вызов** к `IPresenceTracker.GetOnlineAsync()` (Shared.Kernel, см. §10), узнаём `isOnline` собеседника прямо сейчас (а не только из будущих realtime-событий — иначе клиент не знал бы текущий статус до первого изменения)
6. Возвращает объединённые данные клиенту, включая `otherUserId` и `isOnline` для личных чатов

---

## 7. Модуль Messages — сообщения

### Что делает

Хранит все сообщения, управляет их жизненным циклом. При сохранении нового/изменённого сообщения — публикует **доменное событие**, которое подхватывает Realtime-модуль и рассылает по WebSocket.

### Статусы сообщений

```
Sent (0) → Delivered (1) → Read (2)
                         → Deleted (3)  (из любого состояния)
```

### API endpoints

| Метод | URL | Описание |
|---|---|---|
| POST | `/api/chats/{chatId}/messages` | Отправить текстовое сообщение |
| GET | `/api/chats/{chatId}/messages` | История сообщений (cursor-пагинация) |
| POST | `/api/chats/{chatId}/messages/upload` | Загрузить файл и отправить как сообщение |
| PATCH | `/api/chats/{chatId}/messages/{id}` | Редактировать своё сообщение |

### Авторизация по членству в чате

Все четыре эндпоинта (включая чтение истории) проверяют, что текущий пользователь **состоит в чате** — через `IChatMembershipChecker` (см. §10). Если нет — `403 Forbidden`. Без этой проверки любой залогиненный пользователь, узнав GUID чужого чата, мог бы читать и писать в него; кикнутый из группы участник продолжал бы иметь доступ по старому `chatId`.

Каждое сообщение в ответе `GetMessages` дополнено `senderName`/`senderAvatarUrl` — резолвятся через `IUsersModule`, чтобы клиенту не приходилось показывать «обрезок UUID» вместо имени отправителя.

### Cursor-пагинация

Вместо постраничной загрузки используется **cursor** — ID последнего полученного сообщения:

```
Первый запрос: GET /messages?limit=50
  → возвращает 50 сообщений + nextCursor (ID 50-го)

Следующий запрос: GET /messages?before={nextCursor}&limit=50
  → возвращает следующие 50 сообщений
```

Это эффективнее страниц: не нужно считать OFFSET в БД.

### Удаление сообщения (мягкое)

Сообщения не удаляются физически. При удалении:
- `status = "Deleted"`
- `content = ""` (контент стирается)
- `deleted_at = NOW()`

Запись остаётся в БД для сохранения целостности истории (ответы на удалённые сообщения).

### Прикреплённые файлы

Когда пользователь отправляет файл:
1. `POST /api/chats/{id}/messages/upload` — файл + опциональный caption
2. Handler вызывает `IFilesModule.UploadChatAttachmentAsync()` → файл сохраняется в хранилище
3. Создаётся запись в `messages.message` с `file_url` и пустым/caption текстом

### Доменные события (Domain Events)

Когда сообщение создаётся или редактируется, в объекте `Message` поднимается доменное событие:

- `MessageSentDomainEvent` — при создании
- `MessageEditedDomainEvent` — при редактировании

После `SaveChanges()` в `MessagesDbContext` они автоматически публикуются через MediatR — и их подхватывает Realtime-модуль.

---

## 8. Модуль Files — файлы

### Что делает

Единственное место в системе, которое работает с физическими файлами. Обрабатывает загрузку и выдачу аватарок и вложений к сообщениям.

### Хранилища (Storage backends)

| Вариант | Когда используется |
|---|---|
| `LocalFileStorage` | Разработка — файлы сохраняются в папку на диске |
| `S3FileStorage` | Продакшн — Amazon S3 (или любой S3-совместимый сервис) |

Переключение через конфиг: `FileStorage:Type = Local` или `S3`.

### API endpoints

| Метод | URL | Описание |
|---|---|---|
| POST | `/api/files/avatar` | Загрузить аватарку (JPEG/PNG/WebP/GIF, до 5 МБ) |
| GET | `/api/files/{fileKey}` | Скачать файл по ключу |

### Приватность при скачивании

Маршрут `GET /api/files/{fileKey}` помечен `AllowAnonymous` целиком (чтобы не ломать обычные `<img src>` для аватарок — браузер не прикладывает JWT к запросам картинок). Но внутри хендлера поведение различается по категории файла:

- **`Avatar`** — отдаётся всем без проверки, аватарки задуманы публичными (как в любом мессенджере)
- **`ChatAttachment`** — требует аутентификации **и** членства в чате, к которому привязан файл (`record.ChatId`, проверяется через тот же `IChatMembershipChecker`). Без логина — `401`, не участник чата — `403`

### Ограничения

- Аватарки: только изображения, максимум **5 МБ**
- Вложения в сообщения: любой тип, максимум **20 МБ**
- При загрузке новой аватарки старая автоматически удаляется

### Как работает загрузка аватарки

1. `POST /api/files/avatar` с файлом в `multipart/form-data`
2. Проверка MIME-типа и размера
3. Удаление предыдущего аватара (поиск в `files.file_upload` по `uploaded_by + category=Avatar`)
4. Сохранение в хранилище → получение `fileKey` и публичного URL
5. Создание записи в `files.file_upload`
6. Возврат URL клиенту

### Публичный API модуля

Другие модули (Messages) обращаются к Files только через интерфейс:
```
IFilesModule.UploadChatAttachmentAsync(...)  → возвращает URL файла
```

---

## 9. Модуль Realtime — WebSocket / SignalR

### Что делает

Обеспечивает работу в реальном времени: мгновенная доставка новых сообщений, индикатор набора текста, онлайн-статус.

### Подключение

```
WebSocket URL: ws://host/hubs/messenger
Требует: Authorization: Bearer <jwt_token>
```

### События от сервера к клиенту

| Событие | Данные | Когда |
|---|---|---|
| `ReceiveMessage` | messageId, chatId, senderId, senderName, senderAvatarUrl, content, sentAt | Новое сообщение в чате |
| `MessageEdited` | messageId, chatId, newContent, editedAt | Сообщение отредактировано |
| `UserTyping` | userId, chatId | Пользователь начал печатать |
| `UserStoppedTyping` | userId, chatId | Пользователь перестал печатать |
| `UserOnline` | userId, isOnline | Пользователь подключился/отключился (рассылается во все ЧАТЫ пользователя, см. ниже) |

### Методы от клиента к серверу

| Метод | Параметры | Описание |
|---|---|---|
| `JoinChat` | chatId | Подписаться на сообщения чата (только если состоишь в нём — иначе `HubException`) |
| `LeaveChat` | chatId | Отписаться от чата |
| `SendMessage` | chatId, content, replyToMessageId | Отправить сообщение (альтернатива HTTP, та же проверка членства) |
| `StartTyping` | chatId | Начать показывать "печатает..." (требует членства) |
| `StopTyping` | chatId | Убрать "печатает..." (требует членства) |

`JoinChat`/`StartTyping`/`StopTyping` проверяют членство через `IChatMembershipChecker` напрямую в хабе (они не идут через MediatR-команды Messages-модуля, поэтому проверка здесь не наследуется автоматически).

### Группы (Groups)

SignalR использует группы для адресной рассылки:

- `chat:{chatId}` — все подключённые участники конкретного чата, вступившие через `JoinChat`
- `user:{userId}` — только собственные соединения пользователя (если открыто несколько вкладок/устройств) — используется исключительно как счётчик подключений, **не** для рассылки статуса другим людям

### Presence и жизненный цикл подключения

Статус "онлайн" — это не просто факт одного соединения, а счётчик активных подключений пользователя (вкладки/устройства), который хранит `IPresenceTracker` (Shared.Kernel, Redis-реализация). Онлайн/оффлайн объявляется только когда счётчик переходит **0 ↔ 1**, а не на каждое открытие вкладки.

```
OnConnected:
  → пользователь добавляется в группу user:{userId} (только свои подключения)
  → IPresenceTracker.ConnectAsync(userId) — инкремент счётчика в Redis
  → если счётчик стал 1 (было 0 подключений) — BroadcastOnlineStatus(true):
      запросить у IChatsModule все chatId пользователя →
      разослать UserOnline(isOnline: true) в группы chat:{id} каждого из них

OnDisconnected:
  → пользователь удаляется из группы user:{userId}
  → IPresenceTracker.DisconnectAsync(userId) — декремент счётчика
  → если счётчик дошёл до 0 — BroadcastOnlineStatus(false) аналогично выше
```

**Важно — это поведение исправлено в этой версии.** Раньше `UserOnline` рассылался в группу `user:{userId}`, в которую кроме самого пользователя никто не входит — событие физически не могло дойти до собеседников. Текущая версия рассылает в группы ЧАТОВ пользователя, куда его собеседники уже вступили через `JoinChat`.

Дополнительно: `GetChatsQueryHandler` (см. §6) читает текущее состояние `IPresenceTracker` напрямую при отдаче списка чатов — иначе клиент не узнал бы, что собеседник уже онлайн, до первого изменения его статуса после открытия приложения.

### Цепочка доставки сообщения

```
Клиент отправляет сообщение (HTTP или WebSocket)
  ↓
SendMessageCommandHandler проверяет членство (IChatMembershipChecker) → сохраняет в БД
  ↓
MessagesDbContext.SaveChanges публикует MessageSentDomainEvent через MediatR
  ↓
MessageSentEventHandler (Realtime модуль) получает событие
  ↓
Резолвит имя/аватар отправителя через IUsersModule.GetSummariesByAuthUserIdsAsync()
  ↓
Отправляет "ReceiveMessage" (с senderName/senderAvatarUrl) всем в группе chat:{chatId} через SignalR
  ↓
Все подключённые участники получают сообщение мгновенно
```

---

## 10. Межмодульные связи

Модули изолированы — они не вызывают друг друга напрямую. Вместо этого используются публичные контракты (интерфейсы), реализация которых регистрируется в DI самим модулем-владельцем, а вызывающий модуль получает её только через интерфейс.

```
Chats → IMessagesModule:
  - GetLastMessagesByChatIdsAsync()   — последние сообщения для списка чатов
  - DeleteAllMessagesInChatAsync()    — при удалении чата удалить все его сообщения
  - GetMessageCountInChatAsync()      — количество сообщений в чате

Chats → IUsersModule:
  - GetSummariesByAuthUserIdsAsync()  — displayName/avatarUrl собеседника в личных чатах

Messages → IFilesModule:
  - UploadChatAttachmentAsync()       — загрузить файл-вложение (с привязкой к chatId)

Messages → IUsersModule:
  - GetSummariesByAuthUserIdsAsync()  — displayName/avatarUrl отправителей в истории сообщений

Realtime → IChatsModule:
  - GetChatIdsByUserIdAsync()         — список чатов пользователя для рассылки UserOnline

Realtime → IUsersModule:
  - GetSummariesByAuthUserIdsAsync()  — имя отправителя в событии ReceiveMessage

Realtime ← Messages (через MediatR INotification):
  - MessageSentDomainEvent            — новое сообщение → WebSocket рассылка
  - MessageEditedDomainEvent          — редактирование → WebSocket рассылка

Auth → Users (вне кода, по соглашению):
  - После регистрации клиент сам вызывает POST /api/users/profile
  - auth_user_id в user_profile связывает auth.user и users.user_profile
```

### Контракты в Shared.Kernel — когда обычного интерфейса модуля недостаточно

Два модуля иногда нуждаются друг в друге **в обе стороны**. Пример: `Chats` уже зависит от `Messages` (последнее сообщение для списка чатов) — если бы `Messages` тоже зависел от `Chats` (проверка членства), получился бы цикл на уровне `.csproj`, который C# просто не скомпилирует.

Решение — контракт живёт не в модуле-владельце данных, а в `Shared.Kernel` (его уже референсят все модули), а реализацию владелец регистрирует в DI. Вызывающий модуль получает реализацию через DI **без ссылки на сборку владельца** — связь только на рантайме, не в графе проектов.

```
IChatMembershipChecker (Shared.Kernel, реализация — Chats):
  - IsMemberAsync(chatId, userId) — лёгкая EXISTS-проверка по (chat_id, user_id)
  - Используют: Messages (SendMessage/GetMessages/UploadAndSendMessage — 403 если не участник),
                Realtime (JoinChat/StartTyping/StopTyping — HubException если не участник),
                Files (DownloadFile для ChatAttachment — 401/403)

IPresenceTracker (Shared.Kernel, Redis-реализация):
  - ConnectAsync()/DisconnectAsync()  — счётчик активных подключений пользователя
  - GetOnlineAsync(userIds)           — текущий онлайн-статус списка пользователей
  - Пишет: Realtime (MessengerHub.OnConnectedAsync/OnDisconnectedAsync)
  - Читает: Chats (GetChatsQueryHandler — текущий статус собеседника при отдаче списка чатов)
```

Без `IChatMembershipChecker` любой залогиненный пользователь, узнав GUID чужого чата, мог читать/писать в него; кикнутый из группы участник сохранял бы доступ по старому `chatId` — этот контракт закрывает именно эту дыру.

---

## 11. Типичные пользовательские сценарии

### Регистрация и вход

```
1. POST /api/auth/register  { email, password }
2. POST /api/users/profile  { displayName, login }
3. POST /api/auth/login     { email, password } → { accessToken, refreshToken }
```

### Начать чат с пользователем

```
1. GET /api/users/search?q=username  → найти userId
2. POST /api/chats/direct { otherUserId }  → получить chatId
3. WebSocket: JoinChat(chatId)  → подписаться на сообщения
4. POST /api/chats/{chatId}/messages { content }  → отправить
```

### Получить историю сообщений

```
GET /api/chats/{chatId}/messages?limit=50
  → { items: [...50 сообщений], nextCursor: "guid" }

GET /api/chats/{chatId}/messages?before={nextCursor}&limit=50
  → следующие 50 сообщений
```

### Отправить фото в чат

```
POST /api/chats/{chatId}/messages/upload
  Body: multipart/form-data
    file: <бинарные данные>
    caption: "Смотри что нашёл"
  → 201 { messageId }
```

### Создать групповой чат

```
POST /api/chats/group
  { name: "Команда", memberIds: [userId1, userId2, userId3] }
  → 201 { chatId }
  
  Создатель автоматически получает роль Owner.
  Переданные участники добавляются с ролью Member.
```
