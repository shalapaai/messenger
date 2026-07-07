# Модуль Auth — аутентификация

## Что делает

Управляет учётными данными пользователей: регистрация, вход, выход, обновление токена.

## Схема БД

Схема `auth`.

### Таблица `auth.user`

| Колонка | Тип | Описание |
|---|---|---|
| id | uuid | Первичный ключ |
| email | varchar(255) | Email (уникальный) |
| password_hash | varchar(512) | Хеш пароля (Argon2) |
| is_email_verified | boolean | Подтверждён ли email |
| created_at | timestamptz | Дата регистрации |

**Индексы:** `ix_user_email` (unique) — быстрый поиск по email при логине.

### Таблица `auth.refresh_token`

| Колонка | Тип | Описание |
|---|---|---|
| id | uuid | Первичный ключ |
| user_id | uuid | Ссылка на auth.user |
| token | varchar(256) | Сам refresh-токен (уникальный) |
| expires_at | timestamptz | Когда истекает |
| created_at | timestamptz | Когда создан |
| is_revoked | boolean | Отозван ли (logout) |

**Индексы:** `ix_refresh_token_token` (unique), `ix_refresh_token_user_id`.

## API endpoints

| Метод | URL | Описание |
|---|---|---|
| POST | `/api/auth/register` | Регистрация нового пользователя |
| POST | `/api/auth/login` | Вход, получение JWT + refresh токена |
| POST | `/api/auth/refresh` | Обновление JWT по refresh-токену |
| POST | `/api/auth/logout` | Выход (отзыв refresh-токена) |

## Как работает логин

1. Клиент отправляет email + password
2. Система находит пользователя в `auth.user` по email
3. Сверяет пароль с хешем через **Argon2** (алгоритм безопасного хеширования)
4. Генерирует **JWT Access Token** (живёт 15 минут) — подписанный токен с userId внутри
5. Генерирует **Refresh Token** (живёт 30 дней) — длинная случайная строка, хранится в БД
6. Возвращает оба токена клиенту

## Как работает авторизация последующих запросов

Все защищённые эндпоинты требуют заголовок:
```
Authorization: Bearer <jwt_access_token>
```

JWT декодируется, из него извлекается `userId` — он используется в хендлерах.

## Refresh Token Flow

```
JWT истёк → клиент отправляет refresh token →
  сервер проверяет его в БД →
  выдаёт новый JWT + новый refresh token →
  старый refresh token отзывается (is_revoked = true)
```

## Связь с модулем Users

Auth знает только "кто может войти", Users знает "как пользователь выглядит" — это намеренное разделение (см. [Users](users.md)). После регистрации клиент сам вызывает `POST /api/users`, чтобы создать профиль; `auth_user_id` в `user_profile` связывает `auth.user` и `users.user_profile` без FK между схемами.
