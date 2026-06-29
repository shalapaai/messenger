namespace Messenger.Modules.Chats.Infrastructure.Repositories;

using Messenger.Modules.Chats.Domain;
using Microsoft.EntityFrameworkCore;

public sealed class ChatRepository(ChatsDbContext dbContext) : IChatRepository
{
    public async Task<Chat?> GetByIdAsync(ChatId id, CancellationToken ct = default) =>
        await dbContext.Chats
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == id, ct);

    public async Task<Guid?> FindDirectChatIdAsync(Guid userId1, Guid userId2, CancellationToken ct = default) =>
        await dbContext.Chats
            .Where(c => c.Type == ChatType.Direct
                     && c.Members.Any(m => m.UserId == userId1)
                     && c.Members.Any(m => m.UserId == userId2))
            .Select(c => (Guid?)c.Id.Value)
            .FirstOrDefaultAsync(ct);

    public async Task<List<Chat>> GetByUserIdAsync(Guid userId, CancellationToken ct = default) =>
        await dbContext.Chats
            .Include(c => c.Members)
            .Where(c => c.Members.Any(m => m.UserId == userId))
            .ToListAsync(ct);

    public void Add(Chat chat) => dbContext.Chats.Add(chat);

    public void Delete(Chat chat) => dbContext.Chats.Remove(chat);
}
