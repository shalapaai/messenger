namespace Messenger.Modules.Chats.Infrastructure.Repositories;

using Messenger.Modules.Chats.Domain;
using Microsoft.EntityFrameworkCore;

public sealed class ChatRepository(ChatsDbContext dbContext) : IChatRepository
{
    public async Task<Chat?> GetByIdAsync(ChatId id, CancellationToken ct = default) =>
        await dbContext.Chats
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == id, ct);

    public async Task<Guid?> FindDirectChatIdAsync(Guid userId1, Guid userId2, CancellationToken ct = default)
    {
        // Тот же канонический порядок, что и Chat.CreateDirect — бьёт напрямую в ux_chats_direct_pair,
        // без join через members в обе стороны.
        var (first, second) = userId1.CompareTo(userId2) <= 0 ? (userId1, userId2) : (userId2, userId1);

        return await dbContext.Chats
            .Where(c => c.Type == ChatType.Direct && c.DirectUserId1 == first && c.DirectUserId2 == second)
            .Select(c => (Guid?)c.Id.Value)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<List<Chat>> GetByUserIdAsync(Guid userId, CancellationToken ct = default) =>
        await dbContext.Chats
            .Include(c => c.Members)
            .Where(c => c.Members.Any(m => m.UserId == userId))
            .ToListAsync(ct);

    public async Task<bool> IsMemberAsync(ChatId chatId, Guid userId, CancellationToken ct = default) =>
        await dbContext.Members.AnyAsync(m => m.ChatId == chatId && m.UserId == userId, ct);

    public void Add(Chat chat) => dbContext.Chats.Add(chat);

    public void Delete(Chat chat) => dbContext.Chats.Remove(chat);
}
