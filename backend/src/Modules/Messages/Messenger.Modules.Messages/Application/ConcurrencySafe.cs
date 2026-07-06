namespace Messenger.Modules.Messages.Application;

using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;

// Общая обработка гонки конкурентного изменения/удаления одного и того же сообщения —
// Edit/Delete/DeleteMessages все ловили DbUpdateConcurrencyException и превращали её
// в Error.Conflict одинаково.
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
