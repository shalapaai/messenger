# API Reference

Base URL: `http://localhost:8080`

Защищённые эндпоинты требуют заголовок:
```
Authorization: Bearer <access_token>
```

Подробное описание бизнес-логики, схемы БД и инвариантов — в `docs/modules/*.md`, здесь только контракт запрос/ответ.

---

## Auth — `/api/auth`

Все эндпоинты анонимные (`AllowAnonymous`) — это единственный модуль, куда можно попасть без токена. Подробности про rate limiting, httpOnly-cookie для refresh-токена и 2FA/сброс пароля — в [modules/auth.md](modules/auth.md).

### `GET /api/auth/features`

Публичные фичефлаги — фронтенд скрывает недоступные поля формы (2FA, сброс пароля).

**Ответ 200:**
```json
{ "twoFactorEnabled": false, "passwordResetEnabled": true }
```

---

### `POST /api/auth/register`

Регистрация нового пользователя. Rate limit: `auth` (10/мин/IP).

**Тело запроса:**
```json
{ "email": "user@example.com", "password": "Secret_123" }
```

**Ответы:**
| Код | Описание |
|---|---|
| 201 | Пользователь создан, выданы токены |
| 202 | Email занят под 2FA — код отправлен на почту, нужен `POST /verify-otp` |
| 409 | Email уже занят |
| 422 | Ошибка валидации |

```json
// 201 Created — accessToken в теле, refreshToken только в httpOnly-cookie messenger_refresh_token
{
  "requiresOtp": false,
  "email": null,
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "accessTokenExpiresAt": "2026-06-25T10:15:00Z"
}
```
```json
// 202 Accepted — TwoFactor.Enabled=true
{ "requiresOtp": true, "email": "user@example.com", "accessToken": null, "accessTokenExpiresAt": null }
```

---

### `POST /api/auth/login`

Вход. Rate limit: `auth`.

**Тело запроса:**
```json
{ "email": "user@example.com", "password": "Secret_123" }
```

**Ответы:**
| Код | Описание |
|---|---|
| 200 | Токены выданы (`accessToken` в теле, `refreshToken` — в cookie) |
| 202 | 2FA включена — код отправлен, `requiresOtp: true`, нужен `POST /verify-otp` |
| 401 | Неверный email или пароль |
| 422 | Ошибка валидации — на этом эндпоинте **любая** неудача форсирует 422, а не только формат запроса |

Тело ответа — та же форма `LoginResultDto`, что и у `register` (см. выше).

---

### `POST /api/auth/verify-otp`

Подтверждение 6-значного кода из письма. Rate limit: `auth-strict` (5/5мин/IP).

**Тело запроса:**
```json
{ "email": "user@example.com", "code": "482913" }
```

**Ответы:**
| Код | Описание |
|---|---|
| 200 | Токены выданы, refresh — в cookie |
| 401 | Код неверный или истёк (живёт 5 минут) |

```json
// 200 OK
{ "accessToken": "eyJhbGciOiJIUzI1NiJ9...", "accessTokenExpiresAt": "2026-06-25T10:15:00Z" }
```

---

### `POST /api/auth/refresh`

Обновление пары токенов по refresh-токену. Rate limit: `auth`.

Токен сначала читается из cookie `messenger_refresh_token`; тело запроса — фолбэк для не-браузерных клиентов, можно не слать вовсе.

**Тело запроса (необязательно):**
```json
{ "token": "a1b2c3d4..." }
```

**Ответы:**
| Код | Описание |
|---|---|
| 200 | Новая пара токенов, старый refresh-токен отозван |
| 401 | Токен недействителен, истёк или отсутствует — cookie при этом удаляется |

```json
// 200 OK
{ "accessToken": "eyJhbGciOiJIUzI1NiJ9...", "accessTokenExpiresAt": "2026-06-25T10:30:00Z" }
```

---

### `POST /api/auth/logout`

Выход. Токен читается из cookie (фолбэк — тело запроса). Отзывает refresh-токен, удаляет cookie.

**Тело запроса (необязательно):**
```json
{ "refreshToken": "a1b2c3d4..." }
```

**Ответы:**
| Код | |
|---|---|
| 204 | Всегда, независимо от того, был ли токен валиден |

---

### `POST /api/auth/forgot-password`

Запрос кода сброса пароля на email. Rate limit: `auth-strict`.

**Тело запроса:**
```json
{ "email": "user@example.com" }
```

**Ответы:**
| Код | |
|---|---|
| 200 | Всегда (даже если email не найден — защита от перечисления аккаунтов) |

---

### `POST /api/auth/reset-password`

Сброс пароля по коду из письма. Rate limit: `auth-strict`.

**Тело запроса:**
```json
{ "email": "user@example.com", "code": "482913", "newPassword": "NewSecret_123" }
```

**Ответы:**
| Код | |
|---|---|
| 204 | Пароль изменён |
| 401 | Код неверный или истёк |

---

## Users — `/api/users` 🔒

Все эндпоинты требуют авторизации.

### `POST /api/users`

Создать профиль после регистрации.

**Тело запроса:**
```json
{
  "displayName": "Иван Иванов",
  "login": "ivan",
  "avatarColor": "#2C5BF0",
  "status": null,
  "phone": null,
  "city": null,
  "department": null
}
```
`login` — без `@`, необязателен. Email/userId берутся из JWT.

**Ответы:**
| Код | |
|---|---|
| 201 | Профиль создан |
| 409 | Login или профиль уже заняты |
| 422 | Ошибка валидации |

```json
// 201 Created
{
  "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "user@example.com",
  "displayName": "Иван Иванов",
  "login": "@ivan",
  "status": null,
  "avatarUrl": null,
  "avatarColor": "#2C5BF0",
  "phone": null,
  "city": null,
  "department": null,
  "createdAt": "2026-06-25T10:00:00Z"
}
```

---

### `GET /api/users/me`

**Ответы:** 200 (профиль), 404 (профиль ещё не создан).

```json
// 200 OK
{
  "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "user@example.com",
  "displayName": "Иван Иванов",
  "login": "@ivan",
  "status": "В сети",
  "avatarUrl": "/api/files/a1b2c3d4e5f6.jpg",
  "avatarColor": "#2C5BF0",
  "phone": null,
  "city": null,
  "department": null,
  "registeredAt": "2026-06-25T10:00:00Z",
  "updatedAt": "2026-06-25T11:00:00Z"
}
```

---

### `PATCH /api/users/me`

Частичное обновление — только переданные поля. Тело: любое подмножество `displayName`, `status`, `login`, `phone`, `city`, `department`, `avatarColor`.

**Ответы:** 200 (обновлённый профиль, форма как у `GET /me`, но **без** `avatarColor` в ответе), 404, 409 (login занят).

---

### `POST /api/users/me/avatar`

`multipart/form-data`, поле `file`. JPEG/PNG/WebP/GIF, максимум 5 МБ.

```bash
curl -X POST /api/users/me/avatar -H "Authorization: Bearer <token>" -F "file=@photo.jpg"
```

**Ответы:** 200 `{ "avatarUrl": "/api/files/..." }`, 404, 422 (файл слишком большой/неверный тип).

---

### `DELETE /api/users/me/avatar`

**Ответы:** 204, 404.

---

### `GET /api/users/{userId}`

Публичный профиль другого пользователя.

**Ответ 200:**
```json
{
  "userId": "...", "displayName": "Иван", "login": "@ivan", "status": null,
  "avatarUrl": null, "avatarColor": "#2C5BF0", "phone": null, "city": null,
  "department": null, "email": "ivan@example.com"
}
```
404, если профиля не существует.

---

### `GET /api/users/search`

**Параметры:**
| Параметр | Тип | Описание |
|---|---|---|
| `q` | string (обязательный) | Без `@` — ищет по email/displayName/login разом; с `@` — только по login |
| `page` | int (default 1) | — |
| `pageSize` | int (default 20, максимум 50) | — |

Текущий пользователь исключён из результатов. Единственный эндпоинт в API со страничной (не курсорной) пагинацией.

```
GET /api/users/search?q=иван&page=1&pageSize=10
```

**Ответ 200:**
```json
{
  "items": [
    { "userId": "...", "email": "ivan@example.com", "displayName": "Иван", "login": "@ivan", "avatarUrl": null, "avatarColor": "#2C5BF0" }
  ],
  "totalCount": 1, "page": 1, "pageSize": 10
}
```

---

## Chats — `/api/chats` 🔒

Подробности про роли, удаление, read receipts — в [modules/chats.md](modules/chats.md).

### `GET /api/chats`

Список своих чатов с последним сообщением, отсортирован сервером (последний диалог — первым).

**Ответ 200:**
```json
[{
  "id": "...", "type": "direct", "name": null, "avatarUrl": null, "avatarColor": null,
  "lastMessage": {
    "messageId": "...", "senderId": "...", "content": "Привет!", "sentAt": "2026-06-25T10:00:00Z",
    "hasAttachments": false, "firstAttachmentUrl": null, "firstAttachmentContentType": null,
    "firstAttachmentFileName": null, "kind": "Text"
  },
  "otherUserId": "...", "isOnline": true, "otherMemberLastReadAt": null, "unreadCount": 2
}]
```

---

### `GET /api/chats/{id}`

Детали чата и список участников с онлайн-статусом каждого.

**Ответы:** 200, 403 (не участник), 404.

```json
{
  "id": "...", "type": "group", "name": "Команда", "avatarUrl": null, "createdAt": "2026-06-25T10:00:00Z",
  "members": [{ "userId": "...", "displayName": "Иван", "avatarUrl": null, "avatarColor": "#2C5BF0", "role": "owner", "joinedAt": "...", "online": true }]
}
```

---

### `POST /api/chats/direct`

Идемпотентно — вернёт существующий чат, если он уже есть.

**Тело:** `{ "otherUserId": "..." }` → **200** — сырой `Guid` (id чата) в теле.

---

### `POST /api/chats/group`

**Тело:**
```json
{ "name": "Команда", "memberIds": ["..."], "avatarColor": "#2C5BF0" }
```
Создатель становится Owner, `memberIds` — Member. **201** (Location: `/api/chats/{id}`) — сырой `Guid` в теле.

---

### `PATCH /api/chats/{id}`

Обновить название/аватарку/цвет (Admin+). Любое подмножество `{ "name", "avatarUrl", "avatarColor" }`.

**Ответы:** 204, 400, 403, 404.

---

### `DELETE /api/chats/{id}`

Только для **личных** чатов — удаляет для обеих сторон целиком (422 на групповом чате — там выход через `DELETE /members/{userId}`).

**Ответы:** 204, 403, 404, 422.

---

### `POST /api/chats/{id}/read`

Отметить чат прочитанным текущим пользователем.

**Ответы:** 204, 404.

---

### `POST /api/chats/{id}/members`

Добавить участника (Admin+). **Тело:** `{ "userId": "..." }` → 204, 400, 403, 404.

---

### `DELETE /api/chats/{id}/members/{userId}`

Удалить участника, либо выйти самому (`userId` = свой id). **Ответы:** 204, 400, 403, 404.

---

### `PATCH /api/chats/{id}/members/{userId}/role`

Только Owner, назначить `Owner` через этот эндпоинт нельзя. **Тело:** `{ "role": "Admin" }` (или `"Member"`, регистр не важен — `Enum.TryParse(ignoreCase: true)`). **Ответы:** 204, 400, 403, 404.

---

### `POST /api/chats/{id}/avatar`

Аватарка группового чата (Admin+). `multipart/form-data`, поле `file`. Rate limit: `uploads` (10/мин/пользователь).

**Ответы:** 200 `{ "url": "..." }`, 400 (файл пустой), 403, 404.

---

### `DELETE /api/chats/{id}/avatar`

Admin+. **Ответы:** 204, 400, 403, 404.

---

## Messages — `/api/chats/{chatId}/messages` 🔒

Подробности про мягкое удаление, пересылку, ответы, системные сообщения — в [modules/messages.md](modules/messages.md).

### `POST /api/chats/{chatId}/messages`

Rate limit: `messaging` (20/10сек/пользователь).

**Тело:**
```json
{ "content": "Привет!", "replyToMessageId": null }
```

**Ответы:** 201 (Location: `/api/chats/{chatId}/messages/{messageId}`) — сырой `Guid` в теле; 422 (пустое сообщение, лимит 4096 символов, либо `replyToMessageId` из другого чата).

---

### `GET /api/chats/{chatId}/messages`

**Курсорная пагинация** — не страничная.

**Параметры:**
| Параметр | Тип | Описание |
|---|---|---|
| `before` | Guid (опционально) | `nextCursor` из предыдущего ответа |
| `limit` | int (default 50) | — |

```
GET /api/chats/{chatId}/messages?limit=50
GET /api/chats/{chatId}/messages?before={nextCursor}&limit=50
```

**Ответ 200:**
```json
{
  "items": [{
    "id": "...", "chatId": "...", "senderId": "...", "senderName": "Иван",
    "senderAvatarUrl": null, "senderAvatarColor": "#2C5BF0",
    "content": "Привет!", "attachments": [], "status": "sent",
    "sentAt": "2026-06-25T10:00:00Z", "editedAt": null,
    "replyToMessageId": null, "replyToSenderName": null, "replyToContent": null,
    "forwardedFromUserId": null, "forwardedFromUserName": null,
    "kind": "Text", "systemEventType": null, "targetUserId": null, "targetUserName": null,
    "reactions": [], "poll": null
  }],
  "nextCursor": null
}
```
Для сообщения-опроса (`kind: "Poll"`) `content` — текст вопроса, а `poll` заполнен:
```json
{
  "poll": {
    "options": [
      { "id": "...", "text": "За", "voters": [{ "userId": "...", "userName": "Иван", "userAvatarUrl": null, "userAvatarColor": "#2C5BF0" }] },
      { "id": "...", "text": "Против", "voters": [] }
    ]
  }
}
```

---

### `GET /api/chats/{chatId}/messages/search`

Поиск по сообщениям чата **по словам, а не по подстроке** — см. [modules/messages.md](modules/messages.md#поиск-по-сообщениям).

**Параметры:** `q` (string) — поисковый запрос.

```
GET /api/chats/{chatId}/messages/search?q=поход
```

**Ответ 200:**
```json
[
  { "messageId": "...", "senderId": "...", "senderName": "Иван", "content": "Идём в поход в субботу?", "sentAt": "2026-06-25T10:00:00Z" }
]
```

---

### `POST /api/chats/{chatId}/messages/upload`

`multipart/form-data` (один или несколько файлов) + query-параметр `caption` (необязателен, **не** часть формы). Rate limit: `uploads`.

```
POST /api/chats/{chatId}/messages/upload?caption=Смотри%20что%20нашёл
```

**Ответы:** 201 (Location: `/api/chats/{chatId}/messages/{MessageId}`), 422 (тип не в белом списке, файл больше 25 МБ, вложений больше 10, либо файлов не передано).

```json
{
  "messageId": "...", "content": "Смотри что нашёл",
  "attachments": [{ "fileUrl": "...", "fileName": "photo.jpg", "contentType": "image/jpeg", "fileSizeBytes": 123456 }],
  "sentAt": "2026-06-25T10:00:00Z"
}
```

---

### `PATCH /api/chats/{chatId}/messages/{messageId}`

Редактировать. Только автор, и только если он всё ещё участник чата.

**Тело:** `{ "newContent": "Исправленный текст" }` → 204, 422 (не автор, сообщение удалено, пустой контент, либо конфликт версий — см. concurrency в [messages.md](modules/messages.md)).

---

### `PUT /api/chats/{chatId}/messages/{messageId}/reaction`

Поставить/снять реакцию (одна на пользователя на сообщение).

**Тело:** `{ "emoji": "👍" }` (`null` или пусто — снять реакцию) → 204, 422.

---

### `DELETE /api/chats/{chatId}/messages/{messageId}`

Мягкое удаление — автором сообщения или Owner/Admin чата (модерация). Рядовой участник может удалить только своё.

**Ответы:** 204, 403 (не автор и не модератор), 422 (не участник чата, уже удалено, либо конфликт версий).

---

### `POST /api/chats/{chatId}/messages/delete-bulk`

`{chatId}` в пути — чат, к которому относятся все `messageIds`.

**Тело:** `{ "messageIds": ["...", "..."] }` → **200** — массив реально удалённых id. Уже удалённые, из чужого чата, либо чужие без права модерации (см. выше) — молча пропускаются, не роняют запрос.

---

### `POST /api/chats/{chatId}/messages/forward`

`{chatId}` в пути — **целевой** чат.

**Тело:**
```json
{ "sourceChatId": "...", "messageIds": ["...", "..."] }
```

**Ответы:** 201 (Location: `/api/chats/{chatId}/messages`) — массив id новых сообщений; 422 (не участник исходного или целевого чата).

---

## Polls — `/api/chats/{chatId}/polls` 🔒

Опрос — это сообщение (`kind: "Poll"`), см. [modules/messages.md](modules/messages.md#опросы) про модель голосования, видимость голосующих и почему опросы работают только в группах.

### `POST /api/chats/{chatId}/polls`

Создать опрос. **Только в групповых чатах** — `403` в личном, независимо от того, показал ли фронтенд эту возможность. Rate limit: `messaging`.

**Тело:**
```json
{ "question": "Идём в поход в субботу?", "options": ["За", "Против"] }
```
От 2 до 10 вариантов, вопрос — до 300 символов, вариант — до 100.

**Ответы:** 201 (Location: `/api/chats/{chatId}/messages/{messageId}`) — сырой `Guid` (id сообщения-опроса) в теле; 403 (не группа или не участник чата); 422 (меньше 2 вариантов, больше 10, пустой вопрос, слишком длинный текст).

---

### `PUT /api/chats/{chatId}/polls/{messageId}/vote`

Проголосовать или сменить голос — один голос на пользователя, повторный вызов с другим `optionId` просто заменяет предыдущий.

**Тело:** `{ "optionId": "..." }` → 204, 403 (не участник чата), 422 (`optionId` не принадлежит этому опросу, опрос удалён).

---

### `DELETE /api/chats/{chatId}/polls/{messageId}/vote`

Отменить свой голос (эквивалентно `PUT` с `optionId: null` на уровне домена).

**Ответы:** 204, 403, 422.

---

## Files — `/api/files`

### `GET /api/files/{fileKey}`

Маршрут анонимный целиком (`AllowAnonymous`), поведение зависит от категории файла внутри хендлера:
- **Аватарки** — отдаются всем без проверки.
- **Вложения чата** — требуют `Authorization` (иначе 401) и членства в чате, к которому привязан файл (иначе 403).

`fileKey` — иммутабельный GUID (никогда не переиспользуется на другой контент), поэтому ответ кэшируется агрессивно: `Cache-Control: public, max-age=31536000, immutable` для аватарок, `private, ...` для вложений. `Content-Length` выставляется явно из БД. Подробнее — [modules/files.md](modules/files.md#кэширование).

**Ответы:** 200 (файл), 401, 403, 404.

---

### `POST /api/files/avatar` 🔒

Отдельный от `/api/users/me/avatar` эндпоинт с той же механикой загрузки — существует в API, но фронтенд им не пользуется (реальная загрузка личного аватара идёт через Users-модуль, см. выше). `multipart/form-data`, поле `file`. Rate limit: `uploads`.

**Ответ 200:** `{ "url": "/api/files/a1b2c3d4e5f6.jpg" }`.

---

## Realtime — WebSocket

```
ws://localhost:8080/hubs/messenger?access_token=<jwt>
```

Подробнее, включая список событий/методов и presence — см. [modules/realtime.md](modules/realtime.md).

---

## Health Check

```
GET /health
```

Стандартный ASP.NET Core health-check middleware, без кастомного форматтера — ответ **plain text**, не JSON. Проверяет PostgreSQL (`SELECT 1`) и Redis.

**Ответ:** `200 OK`, тело `Healthy` — либо `503 Service Unavailable` с телом `Unhealthy`/`Degraded`, если одна из проверок не прошла.

---

## Формат ошибок

Форма ответа зависит от того, на каком уровне запрос отвергнут — это не единый формат, а один из нескольких:

**FluentValidation (форма запроса не прошла базовую валидацию) — 422:**
```json
{
  "title": "Validation failed",
  "status": 422,
  "errors": { "Email": ["Email is not valid"], "Password": ["Password must be at least 8 characters"] }
}
```

**Доменная ошибка (`Result.Failure`, бизнес-правило) — 404/409/422/401:**
```json
{ "code": "Auth.EmailAlreadyExists.Conflict", "description": "Auth.EmailAlreadyExists already exists" }
```
`Unauthorized`/`Forbidden` из этого же источника отдаются **без тела** — просто 401/403.

**Необработанное исключение — 500:**
```json
{ "status": 500, "title": "Internal Server Error", "detail": "An unexpected error occurred" }
```
`detail` — реальное сообщение исключения только в Development, в проде — фиксированная строка.
