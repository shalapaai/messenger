# Модуль Realtime

Обеспечивает **общение в реальном времени** через SignalR WebSocket. Получает доменные события от модуля Messages и рассылает их подключённым клиентам.

## Подключение

```
ws://localhost:8080/hubs/messenger?access_token=<jwt>
```

JWT передаётся в query string — браузеры не могут задать заголовок `Authorization` при WebSocket-upgrade. Сервер извлекает токен из `context.Request.Query["access_token"]`.

### Пример (JavaScript)

```javascript
import * as signalR from "@microsoft/signalr";

const connection = new signalR.HubConnectionBuilder()
  .withUrl("http://localhost:8080/hubs/messenger", {
    accessTokenFactory: () => localStorage.getItem("accessToken")
  })
  .withAutomaticReconnect()
  .build();

await connection.start();
```

## ChatHub

Основной хаб. Требует авторизации.

### Методы, вызываемые клиентом

#### `JoinChat(chatId: string)`

Подписаться на обновления чата. Добавляет подключение в SignalR-группу `chat:{chatId}`.

```javascript
await connection.invoke("JoinChat", "3fa85f64-5717-4562-b3fc-2c963f66afa6");
```

Вызывать при открытии чата. Только после этого клиент будет получать новые сообщения.

#### `LeaveChat(chatId: string)`

Отписаться от обновлений чата. Вызывать при закрытии чата.

```javascript
await connection.invoke("LeaveChat", "3fa85f64-5717-4562-b3fc-2c963f66afa6");
```

#### `SendMessage(request)`

Отправить сообщение через WebSocket (альтернатива REST `POST /api/chats/{id}/messages`).

```javascript
const result = await connection.invoke("SendMessage", {
  chatId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  content: "Привет!",
  replyToMessageId: null
});
// result: { messageId: "uuid" }
```

Используется тот же `SendMessageCommand` — через MediatR `ISender`.

#### `StartTyping(chatId: string)`

Уведомить других участников чата, что пользователь печатает.

```javascript
// Вызывать при вводе текста (с debounce ~500ms)
await connection.invoke("StartTyping", chatId);
```

#### `StopTyping(chatId: string)`

Убрать индикатор печати.

```javascript
await connection.invoke("StopTyping", chatId);
```

### События от сервера

#### `ReceiveMessage`

Новое сообщение в чате. Приходит всем участникам группы `chat:{chatId}`.

```javascript
connection.on("ReceiveMessage", (payload) => {
  // payload:
  // {
  //   messageId: "uuid",
  //   chatId: "uuid",
  //   senderId: "uuid",
  //   content: "Привет!",
  //   sentAt: "2026-06-25T10:00:00Z"
  // }
  addMessageToChat(payload);
});
```

**Источник**: `MessageSentEventHandler` перехватывает `MessageSentDomainEvent` → рассылает группе.

#### `MessageEdited`

Сообщение отредактировано.

```javascript
connection.on("MessageEdited", (payload) => {
  // { messageId, chatId, newContent }
  updateMessageInChat(payload);
});
```

#### `UserTyping`

Другой пользователь начал печатать.

```javascript
connection.on("UserTyping", ({ userId, chatId }) => {
  showTypingIndicator(userId, chatId);
});
```

#### `UserStoppedTyping`

```javascript
connection.on("UserStoppedTyping", ({ userId, chatId }) => {
  hideTypingIndicator(userId, chatId);
});
```

#### `UserOnline`

Пользователь подключился или отключился.

```javascript
connection.on("UserOnline", ({ userId, isOnline }) => {
  updateUserStatus(userId, isOnline);
});
```

Отправляется в личную группу `user:{userId}` при `OnConnectedAsync` и `OnDisconnectedAsync`.

## Поток сообщений

```
Клиент A → SendMessage (REST или WS)
    ↓
Messages модуль → SaveChangesAsync
    ↓
MessagesDbContext публикует MessageSentDomainEvent
    ↓
MessageSentEventHandler (MediatR handler)
    ↓
ChatHub.Clients.Group("chat:{chatId}").ReceiveMessage(payload)
    ↓
Клиент B (в той же группе) получает ReceiveMessage
```

## Конфигурация

```csharp
// Program.cs
builder.Services.AddSignalR(opts =>
{
    opts.MaximumReceiveMessageSize = 32 * 1024; // 32 KB
    opts.ClientTimeoutInterval    = TimeSpan.FromSeconds(60);
    opts.KeepAliveInterval        = TimeSpan.FromSeconds(15);
})
.AddStackExchangeRedis(redisConnectionString, opts =>
{
    opts.Configuration.ChannelPrefix = RedisChannel.Literal("messenger");
});
```

Redis backplane: все инстансы API видят broadcast-сообщения друг друга → горизонтальное масштабирование работает без изменений в коде.

## Группы SignalR

| Группа | Назначение |
|---|---|
| `chat:{chatId}` | Рассылка сообщений конкретного чата |
| `user:{userId}` | Личные уведомления пользователя |

Пользователь входит в группы явно через `JoinChat`. При разрыве соединения SignalR автоматически удаляет его из всех групп.
