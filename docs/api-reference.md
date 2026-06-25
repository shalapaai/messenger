# API Reference

Base URL: `http://localhost:8080`

Защищённые эндпоинты требуют заголовок:
```
Authorization: Bearer <access_token>
```

---

## Auth — `/api/auth`

### `POST /api/auth/register`

Регистрация нового пользователя.

**Тело запроса:**
```json
{
  "email": "user@example.com",
  "password": "Secret_123"
}
```

**Ответы:**
| Код | Описание |
|---|---|
| 201 | Пользователь создан |
| 409 | Email уже занят |
| 422 | Ошибка валидации |

```json
// 201 Created
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "user@example.com",
  "createdAt": "2026-06-25T10:00:00Z"
}
```

---

### `POST /api/auth/login`

Вход в систему. Возвращает пару токенов.

**Тело запроса:**
```json
{
  "email": "user@example.com",
  "password": "Secret_123"
}
```

**Ответы:**
| Код | Описание |
|---|---|
| 200 | Успешный вход |
| 401 | Неверный email или пароль |
| 422 | Ошибка валидации |

```json
// 200 OK
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "a1b2c3d4...",
  "accessTokenExpiresAt": "2026-06-25T10:15:00Z"
}
```

---

### `POST /api/auth/refresh`

Обновление пары токенов. Старый refresh token аннулируется.

**Тело запроса:**
```json
{
  "refreshToken": "a1b2c3d4..."
}
```

**Ответы:**
| Код | Описание |
|---|---|
| 200 | Новая пара токенов |
| 401 | Токен недействителен или истёк |

```json
// 200 OK
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "e5f6g7h8...",
  "accessTokenExpiresAt": "2026-06-25T10:30:00Z"
}
```

---

### `POST /api/auth/logout`

Выход. Аннулирует refresh token.

**Тело запроса:**
```json
{
  "refreshToken": "a1b2c3d4..."
}
```

**Ответы:**
| Код | |
|---|---|
| 204 | Выход выполнен |

---

## Users — `/api/users` 🔒

Все эндпоинты требуют авторизации.

### `POST /api/users`

Создать профиль пользователя после регистрации.

**Тело запроса:**
```json
{
  "displayName": "Иван Иванов"
}
```

Email берётся из JWT-токена автоматически.

**Ответы:**
| Код | |
|---|---|
| 201 | Профиль создан |
| 409 | Профиль уже существует |
| 422 | Ошибка валидации |

```json
// 201 Created
{
  "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "user@example.com",
  "displayName": "Иван Иванов",
  "status": null,
  "avatarUrl": null,
  "createdAt": "2026-06-25T10:00:00Z"
}
```

---

### `GET /api/users/me`

Получить собственный профиль.

**Ответы:**
| Код | |
|---|---|
| 200 | Профиль |
| 404 | Профиль не создан |

```json
// 200 OK
{
  "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "email": "user@example.com",
  "displayName": "Иван Иванов",
  "status": "В сети",
  "avatarUrl": "/api/files/avatars/abc123",
  "createdAt": "2026-06-25T10:00:00Z",
  "updatedAt": "2026-06-25T11:00:00Z"
}
```

---

### `PATCH /api/users/me`

Обновить профиль. Все поля опциональны.

**Тело запроса:**
```json
{
  "displayName": "Новое имя",
  "status": "В отпуске"
}
```

**Ответы:**
| Код | |
|---|---|
| 200 | Обновлённый профиль |
| 404 | Профиль не найден |

---

### `POST /api/users/me/avatar`

Загрузить аватар. Форма `multipart/form-data`, поле `file`, максимум 5 МБ.

```bash
curl -X POST /api/users/me/avatar \
  -H "Authorization: Bearer <token>" \
  -F "file=@photo.jpg"
```

**Ответы:**
| Код | |
|---|---|
| 200 | `{ "avatarUrl": "/api/files/avatars/abc123" }` |
| 404 | Профиль не найден |
| 422 | Файл слишком большой или неверный тип |

---

### `GET /api/users/search`

Поиск пользователей по email или displayName. Исключает текущего пользователя.

**Параметры:**
| Параметр | Тип | Описание |
|---|---|---|
| `q` | string (обязательный) | Строка поиска |
| `page` | int (default: 1) | Номер страницы |
| `pageSize` | int (default: 20) | Размер страницы |

```
GET /api/users/search?q=иван&page=1&pageSize=10
```

**Ответ 200:**
```json
{
  "items": [
    {
      "userId": "...",
      "email": "ivan@example.com",
      "displayName": "Иван",
      "avatarUrl": null
    }
  ],
  "totalCount": 1,
  "page": 1,
  "pageSize": 10
}
```

---

## Messages — `/api/chats/{chatId}/messages` 🔒

### `POST /api/chats/{chatId}/messages`

Отправить сообщение в чат.

**Тело запроса:**
```json
{
  "content": "Привет!",
  "replyToMessageId": null
}
```

**Ответы:**
| Код | |
|---|---|
| 201 | `{ "messageId": "uuid" }` |
| 422 | Пустое сообщение или превышен лимит 4096 символов |

---

### `GET /api/chats/{chatId}/messages`

Получить историю сообщений (пагинация от новых к старым).

**Параметры:**
| Параметр | Default |
|---|---|
| `page` | 1 |
| `pageSize` | 50 |

**Ответ 200:**
```json
{
  "items": [
    {
      "id": "uuid",
      "chatId": "uuid",
      "senderId": "uuid",
      "content": "Привет!",
      "status": "Sent",
      "sentAt": "2026-06-25T10:00:00Z",
      "editedAt": null,
      "replyToMessageId": null
    }
  ],
  "totalCount": 100,
  "page": 1,
  "pageSize": 50
}
```

---

### `PATCH /api/chats/{chatId}/messages/{messageId}`

Редактировать сообщение. Только отправитель.

**Тело запроса:**
```json
{
  "newContent": "Исправленный текст"
}
```

**Ответы:**
| Код | |
|---|---|
| 204 | Сообщение обновлено |
| 403 | Не является отправителем |
| 404 | Сообщение не найдено |
| 422 | Сообщение удалено или пустой контент |

---

## Files — `/api/files`

### `POST /api/files/avatar` 🔒

Загрузить аватар (используется внутри Users модуля). `multipart/form-data`, поле `file`.

**Ответ 200:**
```json
{
  "url": "/api/files/avatars/abc123def456"
}
```

---

### `GET /api/files/{fileKey}`

Получить файл по ключу. Публичный доступ (без токена).

**Ответы:**
| Код | |
|---|---|
| 200 | Содержимое файла (Content-Type из БД) |
| 404 | Файл не найден |

---

## Realtime — WebSocket

Endpoint для подключения SignalR:
```
ws://localhost:8080/hubs/messenger?access_token=<jwt>
```

Подробнее см. [docs/modules/realtime.md](modules/realtime.md).

---

## Health Check

```
GET /health
```

Проверяет PostgreSQL и Redis. Используется Docker healthcheck.

**Ответ 200:**
```json
{
  "status": "Healthy",
  "results": {
    "postgres": { "status": "Healthy" },
    "redis": { "status": "Healthy" }
  }
}
```

---

## Формат ошибок

Все ошибки возвращаются в единообразном формате:

```json
// Ошибка бизнес-логики (4xx)
{
  "code": "Auth.EmailAlreadyExists.Conflict",
  "description": "Auth.EmailAlreadyExists already exists"
}

// Ошибка валидации (422)
{
  "title": "Validation failed",
  "errors": {
    "Email": ["Email is not valid"],
    "Password": ["Password must be at least 8 characters"]
  }
}

// Серверная ошибка (500)
{
  "title": "Internal Server Error",
  "status": 500
}
```
