namespace Messenger.Shared.Kernel.Membership;

// Факт "состоит ли пользователь в чате" нужен и Messages, и Realtime для авторизации
// (читать/писать/слушать realtime может только участник чата). Контракт живёт в
// Shared.Kernel, а не в Chats, потому что Chats уже зависит от Messages (превью
// последнего сообщения в списке) — обратная ссылка Messages → Chats создала бы цикл
// на уровне .csproj. Реализацию предоставляет Chats через DI, без прямой ссылки сборки.
public interface IChatMembershipChecker
{
    Task<bool> IsMemberAsync(Guid chatId, Guid userId, CancellationToken ct = default);
}
