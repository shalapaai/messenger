namespace Messenger.Modules.Messages.Application.Features.SearchMessages;

using System.Text.RegularExpressions;
using Messenger.Modules.Messages.Domain;
using Messenger.Modules.Users.Application.Contracts;
using Messenger.Shared.Kernel.Abstractions;
using Messenger.Shared.Kernel.Membership;
using Messenger.Shared.Kernel.Results;

public sealed partial class SearchMessagesQueryHandler(
    IMessageRepository     messageRepository,
    IUsersModule           usersModule,
    IChatMembershipChecker membershipChecker)
    : IQueryHandler<SearchMessagesQuery, List<MessageSearchResultDto>>
{
    private const int MaxResults = 100;

    [GeneratedRegex(@"[\p{L}\p{N}]+")]
    private static partial Regex WordPattern();

    public async Task<Result<List<MessageSearchResultDto>>> Handle(SearchMessagesQuery query, CancellationToken ct)
    {
        if (!await membershipChecker.IsMemberAsync(query.ChatId, query.CurrentUserId, ct))
            return Result.Failure<List<MessageSearchResultDto>>(Error.Forbidden("You are not a member of this chat"));

        var queryWords = ExtractWords(query.QueryText);
        if (queryWords.Count == 0)
            return Result.Success(new List<MessageSearchResultDto>());

        var candidates = await messageRepository.GetSearchableByChatIdAsync(query.ChatId, ct);

        // Поиск по словам, а не по подстроке: каждое слово запроса должно быть началом
        // какого-то слова сообщения — "поход" находит "поход"/"походы", но не "выход".
        var matches = candidates
            .Where(m =>
            {
                var messageWords = ExtractWords(m.Content);
                return queryWords.All(qw => messageWords.Any(mw => mw.StartsWith(qw, StringComparison.Ordinal)));
            })
            .OrderByDescending(m => m.SentAt)
            .Take(MaxResults)
            .ToList();

        var userIds = matches.Select(m => m.SenderId).Distinct().ToList();
        var summariesResult = await usersModule.GetSummariesByAuthUserIdsAsync(userIds, ct);
        if (summariesResult.IsFailure)
            return Result.Failure<List<MessageSearchResultDto>>(summariesResult.Error);

        var summaries = summariesResult.Value!;

        var dtos = matches
            .Select(m =>
            {
                summaries.TryGetValue(m.SenderId, out var summary);
                return new MessageSearchResultDto(
                    m.Id.Value, m.SenderId, summary?.DisplayName ?? "Пользователь", m.Content, m.SentAt);
            })
            .ToList();

        return Result.Success(dtos);
    }

    private static List<string> ExtractWords(string text) =>
        WordPattern().Matches(text).Select(m => m.Value.ToLowerInvariant()).ToList();
}
