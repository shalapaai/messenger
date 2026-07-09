# Модуль Realtime — WebSocket / SignalR

## Что делает

Обеспечивает работу в реальном времени: мгновенная доставка новых сообщений, индикатор набора текста, онлайн-статус.

## Подключение

```
WebSocket URL: ws://host/hubs/messenger
Требует: Authorization: Bearer <jwt_token>
```

## События от сервера к клиенту

| Событие | Данные | Когда |
|---|---|---|
| `ReceiveMessage` | messageId, chatId, senderId, senderName, senderAvatarUrl, content, sentAt, forwardedFromUserId, forwardedFromUserName, replyToMessageId, replyToSenderName, replyToContent | Новое сообщение в чате (обычное, пересланное или ответ — форвард/reply-поля `null`, если неприменимо) |
| `MessageEdited` | messageId, chatId, newContent, editedAt | Сообщение отредактировано |
| `MessageDeleted` | messageId, chatId | Сообщение удалено |
| `MessagesRead` | chatId, readerId, readAt | Участник прочитал чат до момента `readAt` (см. [Chats — Прочитано](chats.md#прочитано-read-receipts-реальное-время)) |
| `UserTyping` | userId, chatId | Пользователь начал печатать |
| `UserStoppedTyping` | userId, chatId | Пользователь перестал печатать |
| `UserOnline` | userId, isOnline | Пользователь подключился/отключился (рассылается во все ЧАТЫ пользователя, см. ниже) |

## Методы от клиента к серверу

| Метод | Параметры | Описание |
|---|---|---|
| `JoinChat` | chatId | Подписаться на сообщения чата (только если состоишь в нём — иначе `HubException`) |
| `LeaveChat` | chatId | Отписаться от чата |
| `SendMessage` | chatId, content, replyToMessageId | Отправить сообщение (альтернатива HTTP, та же проверка членства) |
| `StartTyping` | chatId | Начать показывать "печатает..." (требует членства) |
| `StopTyping` | chatId | Убрать "печатает..." (требует членства) |

`JoinChat`/`StartTyping`/`StopTyping` проверяют членство через `IChatMembershipChecker` напрямую в хабе (они не идут через MediatR-команды Messages-модуля, поэтому проверка здесь не наследуется автоматически).

**Rate limiting для Hub-методов.** Встроенный `RateLimiting` middleware ASP.NET Core покрывает только обычные HTTP-запросы — вызовы методов хаба идут поверх уже установленного WebSocket-соединения, а не отдельными HTTP-запросами, и middleware их не видит. Дорогие методы (`SendMessage` и т.п.) лимитируются вручную через `IHubFilter` (`HubRateLimitFilter`) с тем же смыслом, что и HTTP-политики (см. [Auth — Rate limiting](auth.md#rate-limiting)). Лимитеры на пользователя живут в кэше со sliding-expiration, а не в статическом словаре — неактивные вычищаются сами, без утечки памяти на давно отключившихся пользователей.

## Фронтенд: клиент SignalR

- `frontend/src/shared/api/signalrClient.ts` — синглтон-обёртка над `@microsoft/signalr`; каждое серверное событие — отдельный метод `on<Event>(handler) → () => void` (отписка), включая `onMessageEdited`, `onMessageDeleted`, `onMessagesRead`
- `frontend/src/shared/api/useSignalR.ts` — React-хук поверх клиента; принимает набор `on...`-колбэков через `options`, подписывает/отписывает их в `useEffect`. `sendMessage`/`startTyping`/`stopTyping`, которые он отдаёт компоненту, мемоизированы через `useCallback` с пустым списком зависимостей (читают актуальный `chatId` из `useRef`, а не из замыкания) — без этого они пересоздавались бы на каждый рендер и тянули за собой лишние пересоздания всего, что от них зависит ниже по дереву
- `frontend/src/pages/MessengerPage/hooks/useChatMessages.ts` — `handleDeletedMessage` убирает сообщение из локального состояния чата по `messageId` целиком (`filter`, не пометка — см. [Messages — Удаление сообщения](messages.md#удаление-сообщения-мягкое)); `handleEditedMessage` обновляет текст и ставит флажок `edited`; `handleIncomingMessage` перед добавлением сообщения проверяет `messageId` на дубликат (см. «Важно — двойная доставка» ниже) и обычно игнорирует собственные же сообщения — кроме пересланных копий, у которых нет локального оптимистичного добавления и которые поэтому должны появиться именно по этому realtime-событию
- `frontend/src/shared/api/chatsStore.ts` — `handleMessagesRead` обновляет `chat.otherReadAt` при получении `MessagesRead` от **другого** участника (событие о собственном прочтении с другого устройства игнорируется — оно не про статус "прочитано собеседником")

## Группы (Groups)

SignalR использует группы для адресной рассылки:

- `chat:{chatId}` — все подключённые участники конкретного чата, вступившие через `JoinChat`
- `user:{userId}` — личная группа только своих подключений (вкладок/устройств) пользователя. В основном используется как счётчик подключений для presence (см. ниже), но `MessageSentEventHandler`, `MessageEditedEventHandler`, `MessageDeletedEventHandler` и `ChatReadEventHandler` **дополнительно** шлют туда же своё событие (`ReceiveMessage`/`MessageEdited`/`MessageDeleted`/`MessagesRead`) всем участникам чата — на случай если чат только что создан и получатель ещё не успел вступить в `chat:{chatId}` через `JoinChat` (общая логика вынесена в `ChatFallback.BroadcastToMembersAsync`). Групповая рассылка и получение списка участников для fallback-рассылки запускаются параллельно (`Task.WhenAll`), а не последовательно — это независимые операции

**Принудительный выход из группы при исключении.** Когда участника удаляют из группового чата (`RemoveChatMember`) или он выходит сам, `ChatUpdatedEventHandler` проверяет через `IChatMembershipChecker`, кто из затронутых пользователей больше не состоит в чате, и принудительно выводит их **живые** SignalR-соединения из группы `chat:{chatId}` (`Groups.RemoveFromGroupAsync`). Для этого `IPresenceTracker.GetConnectionsAsync` (Shared.Kernel, Redis-реализация — набор connectionId пользователя, обновляемый в `OnConnectedAsync`/`OnDisconnectedAsync`) отдаёт все текущие connectionId пользователя. Без этого исключённый участник продолжал бы получать `ReceiveMessage`/`MessageEdited`/... для чата, из которого его только что удалили, пока сам не переподключится.

> **Важно — двойная доставка.** `ConnectedLayout` на фронтенде вступает в SignalR-группы **всех** чатов пользователя сразу при подключении (см. ниже). Значит для уже существующих (не только что созданных) чатов получатель почти всегда состоит **и** в `chat:{chatId}`, **и** в своей `user:{userId}` — и получает одно и то же `ReceiveMessage` **дважды**: один раз через рассылку в группу чата, второй раз через персональную рассылку. Серверная логика это не фильтрует (не отслеживает, кто в какой SignalR-группе уже состоит — это недёшево сделать надёжно). Решение — дедупликация на клиенте по `messageId`: и `useChatMessages.ts → handleIncomingMessage`, и `chatsStore.ts → handleNewMessage` перед добавлением сообщения проверяют, не обработали ли уже такой `messageId` (в сторе чатов — сравнением с `chat.lastMessageId`), и тихо игнорируют повтор. Без этой проверки в каждом чате задваивались бы все входящие сообщения.

## Presence и жизненный цикл подключения

Статус "онлайн" — это не просто факт одного соединения, а счётчик активных подключений пользователя (вкладки/устройства), который хранит `IPresenceTracker` (Shared.Kernel, Redis-реализация). Онлайн/оффлайн объявляется только когда счётчик переходит **0 ↔ 1**, а не на каждое открытие вкладки.

```
OnConnected:
  → пользователь добавляется в группу user:{userId} (только свои подключения)
  → IPresenceTracker.ConnectAsync(userId, connectionId) — добавляет connectionId в Redis SET
  → если счётчик стал 1 (было 0 подключений) — BroadcastOnlineStatus(true):
      запросить у IChatsModule все chatId пользователя →
      разослать UserOnline(isOnline: true) в группы chat:{id} каждого из них

OnDisconnected:
  → пользователь удаляется из группы user:{userId}
  → IPresenceTracker.DisconnectAsync(userId, connectionId) — убирает connectionId из SET
  → если счётчик дошёл до 0 — BroadcastOnlineStatus(false) аналогично выше
```

`UserOnline` рассылается в группы ЧАТОВ пользователя (`chat:{id}`), куда его собеседники уже вступили через `JoinChat` — не в группу `user:{userId}`, в которую кроме самого пользователя никто не входит и куда событие физически не могло бы дойти до собеседников.

**Отказоустойчивость счётчика.** `RedisPresenceTracker` ставит защитный TTL (24 часа) на ключ множества при каждом подключении — если инстанс упадёт/передеплоится и `OnDisconnectedAsync` для зависших соединений так и не выполнится, множество не останется в Redis навсегда, а самоисцелится по истечении TTL. Дополнительно `OnDisconnectedAsync` оборачивает удаление connectionId в `try/finally` вокруг удаления из SignalR-группы — чтобы кратковременный сбой связи с Redis-backplane не пропустил сам декремент и не завысил счётчик онлайна навсегда.

Дополнительно: `GetChatsQueryHandler` (см. [Chats](chats.md)) читает текущее состояние `IPresenceTracker` напрямую при отдаче списка чатов — иначе клиент не узнал бы, что собеседник уже онлайн, до первого изменения его статуса после открытия приложения.

## Цепочка доставки сообщения

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
