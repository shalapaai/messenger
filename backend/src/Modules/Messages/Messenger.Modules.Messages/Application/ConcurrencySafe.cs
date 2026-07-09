namespace Messenger.Modules.Messages.Application;

using Messenger.Shared.Kernel.Results;
using Microsoft.EntityFrameworkCore;

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
            return Result.Failure(Error.Conflict(conflictEntity));
        }
    }
}
