namespace Messenger.Modules.Messages.Domain;

// Событие группового чата, отображаемое в ленте как системное сообщение (см. Message.CreateSystem) —
// TargetUserId на самом Message указывает, кого именно добавили/удалили/кто вышел.
public enum SystemEventType
{
    MemberAdded = 0,
    MemberLeft = 1,
    MemberRemoved = 2
}
