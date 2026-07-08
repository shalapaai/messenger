namespace Messenger.Modules.Messages.Application;

using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;

// Общий маппинг DbUpdateConcurrencyException -> Error.Conflict для Edit/Delete/DeleteMessages.
internal static class ConcurrencySafe
{
    public static async Task<Result> SaveChangesAsync(IUnitOfWork unitOfWork, string conflictEntity, CancellationToken ct)
    {
        try
        {
            await unitOfWork.SaveChangesAsync(ct);
            return Result.Success();
        }
        catch (DbUpdateConcurrencyException)
        {
            // Кто-то другой (или та же сущность с другой вкладки) успел изменить/удалить её
            // между чтением и записью — явный конфликт вместо тихого перезатирания.
            return Result.Failure(Error.Conflict(conflictEntity));
        }
    }
}
