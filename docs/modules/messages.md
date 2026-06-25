# Модуль Messages

Управляет **сообщениями**: отправка, редактирование, получение истории. При каждой операции публикует доменные события, которые перехватывает модуль Realtime и рассылает через SignalR.

## Домен

### Message

Агрегат. Идентификатор — value object `MessageId`, а не `Guid`.

```csharp
public sealed class Message : AggregateRoot<MessageId>
{
    public Guid ChatId { get; }
    public Guid SenderId { get; }
    public string Content { get; }          // ≤ 4096 символов
    public MessageStatus Status { get; }
    public DateTime SentAt { get; }
    public DateTime? EditedAt { get; }
    public DateTime? DeletedAt { get; }
    public Guid? ReplyToMessageId { get; }

    public static Result<Message> Create(
        Guid chatId, Guid senderId, string content, Guid? replyToMessageId = null);

    public Result Edit(Guid requesterId, string newContent);
    public Result Delete(Guid requesterId);
    public void MarkAsDelivered();
    public void MarkAsRead();
}
```

```csharp
public enum MessageStatus { Sent, Delivered, Read, Deleted }
```

### MessageId

Value object — обёртка над Guid:

```csharp
public record MessageId(Guid Value)
{
    public static MessageId New() => new(Guid.NewGuid());
    public static MessageId From(Guid value) => new(value);
}
```

В БД хранится как `UUID` (`ValueGeneratedNever` — генерирует приложение, не PostgreSQL).

### Доменные события

```csharp
// Возникает при создании сообщения
record MessageSentDomainEvent(Guid MessageId, Guid ChatId, Guid SenderId, string Content)
    : IDomainEvent;

// Возникает при редактировании
record MessageEditedDomainEvent(Guid MessageId, Guid ChatId, string NewContent)
    : IDomainEvent;
```

## Команды

### SendMessageCommand

```
POST /api/chats/{chatId}/messages
Body: { content, replyToMessageId? }
JWT: → senderId

    → validates content (not empty, ≤ 4096 chars)
    → Message.Create(chatId, senderId, content, replyToMessageId)
         → raises MessageSentDomainEvent
    → repository.Add(message)
    → unitOfWork.SaveChangesAsync()
         → MessagesDbContext публикует MessageSentDomainEvent через MediatR
    → MessageSentEventHandler:
         → ChatHub.Clients.Group("chat:{chatId}").ReceiveMessage(payload)
    → returns messageId
```

### EditMessageCommand

```
PATCH /api/chats/{chatId}/messages/{messageId}
Body: { newContent }
JWT: → requesterId

    → finds message
    → message.Edit(requesterId, newContent)
         → проверяет, что SenderId == requesterId
         → проверяет, что статус != Deleted
         → raises MessageEditedDomainEvent
    → unitOfWork.SaveChangesAsync()
         → публикует MessageEditedDomainEvent
    → MessageEditedEventHandler:
         → ChatHub.Clients.Group("chat:{chatId}").MessageEdited(payload)
```

## Запросы

### GetMessagesQuery

```
GET /api/chats/{chatId}/messages?page=1&pageSize=50

    → repository.GetByChatIdAsync(chatId, page, pageSize)
    → ORDER BY SentAt DESC (от новых к старым)
    → returns PagedList<MessageDto>
```

## Как работает публикация событий

`MessagesDbContext` переопределяет `SaveChangesAsync`:

```csharp
public override async Task<int> SaveChangesAsync(CancellationToken ct)
{
    // Собираем агрегаты с событиями
    var aggregates = ChangeTracker.Entries<AggregateRoot<MessageId>>()
        .Where(e => e.Entity.DomainEvents.Any())
        .Select(e => e.Entity).ToList();

    var domainEvents = aggregates.SelectMany(a => a.DomainEvents).ToList();
    aggregates.ForEach(a => a.ClearDomainEvents());

    var result = await base.SaveChangesAsync(ct);

    // ПОСЛЕ записи в БД — публикуем события
    foreach (var @event in domainEvents)
        await mediator.Publish(@event, ct);

    return result;
}
```

Это гарантирует: событие публикуется только если транзакция прошла успешно. Если `SaveChanges` бросит исключение — Realtime уведомление не отправится.

## Инфраструктура

### IMessageRepository

```csharp
void Add(Message message)
Task<Message?> GetByIdAsync(MessageId id, CancellationToken ct)
Task<PagedList<Message>> GetByChatIdAsync(
    Guid chatId, int page, int pageSize, CancellationToken ct)
```

## Таблицы

| Таблица | Описание |
|---|---|
| `messages.messages` | Сообщения |

Подробнее — [database.md](../database.md).

## Связь с модулями

```
Messages → публикует доменные события
Realtime → слушает события, рассылает через SignalR
```

Прямых зависимостей на уровне кода между Messages и Realtime нет — только через MediatR (слабая связь).
