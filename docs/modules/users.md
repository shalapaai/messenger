# Модуль Users — профили пользователей

## Что делает

Хранит профили пользователей (имя, логин, биография, аватарка). **Отдельно от Auth** — это намеренное разделение: Auth знает только "кто может войти", Users знает "как пользователь выглядит".

## Схема БД

Схема `users`.

### Таблица `users.user_profile`

| Колонка | Тип | Описание |
|---|---|---|
| id | uuid | Первичный ключ профиля (свой, НЕ совпадает с auth.user.id) |
| auth_user_id | uuid | FK на `auth.user.id` — связь профиля с учётной записью |
| email | varchar(255) | Email (дублируется из Auth для поиска без межмодульного вызова) |
| display_name | varchar(100) | Отображаемое имя |
| login | varchar(30) | Уникальный логин вида `@login` (nullable) |
| status | varchar(200) | Статус-сообщение под именем (nullable) |
| avatar_url | varchar(2048) | URL аватарки (nullable) |
| avatar_color | varchar(7) | Цвет фона инициалов, если аватарки нет (`#RRGGBB`, дефолт `#2C5BF0`) |
| phone | varchar(20) | Телефон (nullable) |
| city | varchar(100) | Город (nullable) |
| department | varchar(100) | Отдел (nullable) |
| created_at | timestamptz | Дата создания профиля |
| updated_at | timestamptz | Дата последнего обновления (nullable) |

**Индексы:** `ix_user_profile_auth_user_id` (unique), `ix_user_profile_email` (unique), `ix_user_profile_login` (unique, частичный — только где `login IS NOT NULL`).

## API endpoints

| Метод | URL | Описание |
|---|---|---|
| POST | `/api/users` | Создать профиль после регистрации (`login` необязателен) |
| GET | `/api/users/me` | Получить свой полный профиль |
| PATCH | `/api/users/me` | Частичное обновление профиля (только переданные поля) |
| POST | `/api/users/me/avatar` | Загрузить аватарку (JPEG/PNG/WebP, до 5 МБ) |
| DELETE | `/api/users/me/avatar` | Удалить аватарку |
| GET | `/api/users/{userId}` | Публичный профиль пользователя по id |
| GET | `/api/users/search?q=...` | Поиск пользователей по email/displayName/login, с пагинацией (`page`, `pageSize`, max 50) |

## Логин пользователя

Каждый пользователь может задать уникальный логин (как @username в Telegram). Используется для поиска: `q` без `"@"` ищет по email/displayName/login разом, `"@login"` — только по login.

## Аватарка

Загрузка/удаление аватарки делегируется модулю [Files](files.md) через `IFilesModule` — Users не работает с хранилищем напрямую.
