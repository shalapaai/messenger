# Документация Messenger

## Навигация

| Документ | Описание |
|---|---|
| [Архитектура](architecture.md) | Общая архитектура, паттерны, принятые решения |
| [Запуск проекта](getting-started.md) | Установка, запуск, переменные окружения |
| [База данных](database.md) | Схемы PostgreSQL, EF Core, init.sql |
| [API Reference](api-reference.md) | Все эндпоинты, запросы, ответы |
| **Модули** | |
| [Auth](modules/auth.md) | Регистрация, вход, JWT, refresh-токены |
| [Users](modules/users.md) | Профиль пользователя, аватар, поиск |
| [Messages](modules/messages.md) | Сообщения, отправка, редактирование |
| [Files](modules/files.md) | Загрузка файлов, локальное/S3 хранилище |
| [Realtime](modules/realtime.md) | SignalR, ChatHub, события в реальном времени |
| [Chats](modules/chats.md) | Чаты (в разработке) |

## Быстрый старт

```bash
cp .env.example .env
make up-build
```

API доступен на `http://localhost:8080`, Swagger — `http://localhost:8080/swagger`.
