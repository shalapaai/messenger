# Модуль Chats

> **Статус: в разработке.** Модуль зарегистрирован в системе, таблицы созданы в БД, но бизнес-логика не реализована.

## Текущее состояние

- `ChatsModule` зарегистрирован в `Program.cs`
- `ChatsDbContext` подключён к схеме `chats`
- Эндпоинты не подключены (`MapChatsModule` возвращает пустой `IEndpointRouteBuilder`)
- Доменных сущностей нет

## Таблицы (заглушка в init.sql)

### `chats.chats`

| Колонка | Тип |
|---|---|
| `id` | UUID PK |
| `type` | VARCHAR(10): `direct` или `group` |
| `name` | VARCHAR(100), nullable (только для группы) |
| `avatar_url` | TEXT, nullable |
| `created_at` | TIMESTAMPTZ |

### `chats.members`

| Колонка | Тип |
|---|---|
| `chat_id` | UUID, FK → chats.chats |
| `user_id` | UUID |
| `role` | VARCHAR(10): `owner`, `admin`, `member` |
| `joined_at` | TIMESTAMPTZ |

PK — составной `(chat_id, user_id)`.

## Что планируется

- Создание диалога (direct chat) между двумя пользователями
- Создание группового чата
- Управление участниками (добавить, удалить, изменить роль)
- Список чатов текущего пользователя
- Последнее сообщение в каждом чате (preview)

Когда модуль будет реализован, сообщения из модуля Messages смогут валидировать членство отправителя в чате.
