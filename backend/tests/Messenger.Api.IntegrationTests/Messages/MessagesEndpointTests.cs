namespace Messenger.Api.IntegrationTests.Messages;

using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Messenger.Api.IntegrationTests.Fixtures;

[Collection("Messenger")]
public sealed class MessagesEndpointTests(MessengerApiFactory factory)
{
    [Fact]
    public async Task SendMessage_ThenGetMessages_ReturnsItWithSenderName()
    {
        var alice = await NewAuthedClientAsync();
        var bob   = await NewAuthedUserAsync();
        var chatId = await CreateDirectChatAsync(alice.Client, bob.UserId);

        var sendResponse = await alice.Client.PostAsJsonAsync($"/api/chats/{chatId}/messages", new { content = "Hello!" });
        sendResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var page = await alice.Client.GetFromJsonAsync<MessagesPageDto>($"/api/chats/{chatId}/messages");
        page!.Items.Should().ContainSingle(m => m.Content == "Hello!" && m.SenderName == alice.User.DisplayName);
    }

    [Fact]
    public async Task SendMessage_WhenNotAMember_ReturnsForbidden()
    {
        var alice   = await NewAuthedClientAsync();
        var bob     = await NewAuthedUserAsync();
        var mallory = await NewAuthedClientAsync();
        var chatId  = await CreateDirectChatAsync(alice.Client, bob.UserId);

        var response = await mallory.Client.PostAsJsonAsync($"/api/chats/{chatId}/messages", new { content = "intruder" });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SendMessage_WithEmptyContent_ReturnsValidationError()
    {
        var alice = await NewAuthedClientAsync();
        var bob   = await NewAuthedUserAsync();
        var chatId = await CreateDirectChatAsync(alice.Client, bob.UserId);

        var response = await alice.Client.PostAsJsonAsync($"/api/chats/{chatId}/messages", new { content = "" });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task GetMessages_CursorPagination_ReturnsRemainingOlderMessagesOnSecondPage()
    {
        var alice = await NewAuthedClientAsync();
        var bob   = await NewAuthedUserAsync();
        var chatId = await CreateDirectChatAsync(alice.Client, bob.UserId);

        for (var i = 0; i < 5; i++)
            await alice.Client.PostAsJsonAsync($"/api/chats/{chatId}/messages", new { content = $"msg-{i}" });

        var firstPage = await alice.Client.GetFromJsonAsync<MessagesPageDto>($"/api/chats/{chatId}/messages?limit=3");
        firstPage!.Items.Should().HaveCount(3);
        firstPage.NextCursor.Should().NotBeNull();

        var secondPage = await alice.Client.GetFromJsonAsync<MessagesPageDto>(
            $"/api/chats/{chatId}/messages?limit=3&before={firstPage.NextCursor}");
        secondPage!.Items.Should().HaveCount(2);

        var firstPageIds  = firstPage.Items.Select(m => m.Id);
        var secondPageIds = secondPage.Items.Select(m => m.Id);
        firstPageIds.Should().NotIntersectWith(secondPageIds);
    }

    [Fact]
    public async Task EditMessage_ByNonSender_ReturnsForbidden()
    {
        var alice = await NewAuthedClientAsync();
        var bob   = await NewAuthedUserAsync();
        var chatId = await CreateDirectChatAsync(alice.Client, bob.UserId);
        var messageId = await SendMessageAsync(alice.Client, chatId, "original");

        using var bobClient = AuthenticatedClient(bob);
        var response = await bobClient.PatchAsJsonAsync($"/api/chats/{chatId}/messages/{messageId}", new { newContent = "hacked" });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task EditMessage_BySender_UpdatesContent()
    {
        var alice = await NewAuthedClientAsync();
        var bob   = await NewAuthedUserAsync();
        var chatId = await CreateDirectChatAsync(alice.Client, bob.UserId);
        var messageId = await SendMessageAsync(alice.Client, chatId, "original");

        var editResponse = await alice.Client.PatchAsJsonAsync($"/api/chats/{chatId}/messages/{messageId}", new { newContent = "edited" });
        editResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var page = await alice.Client.GetFromJsonAsync<MessagesPageDto>($"/api/chats/{chatId}/messages");
        page!.Items.Should().ContainSingle(m => m.Id == messageId && m.Content == "edited");
    }

    [Fact]
    public async Task DeleteMessage_ByAnyMember_RemovesItFromHistory()
    {
        var alice = await NewAuthedClientAsync();
        var bob   = await NewAuthedUserAsync();
        var chatId = await CreateDirectChatAsync(alice.Client, bob.UserId);
        var messageId = await SendMessageAsync(alice.Client, chatId, "to be deleted");

        using var bobClient = AuthenticatedClient(bob);
        var deleteResponse = await bobClient.DeleteAsync($"/api/chats/{chatId}/messages/{messageId}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var page = await alice.Client.GetFromJsonAsync<MessagesPageDto>($"/api/chats/{chatId}/messages");
        page!.Items.Should().NotContain(m => m.Id == messageId);
    }

    [Fact]
    public async Task DeleteMessage_Twice_ReturnsConflictOnSecondAttempt()
    {
        var alice = await NewAuthedClientAsync();
        var bob   = await NewAuthedUserAsync();
        var chatId = await CreateDirectChatAsync(alice.Client, bob.UserId);
        var messageId = await SendMessageAsync(alice.Client, chatId, "delete me");

        await alice.Client.DeleteAsync($"/api/chats/{chatId}/messages/{messageId}");
        var secondDelete = await alice.Client.DeleteAsync($"/api/chats/{chatId}/messages/{messageId}");

        secondDelete.IsSuccessStatusCode.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteMessages_Bulk_SkipsAlreadyDeletedWithoutFailingTheBatch()
    {
        var alice = await NewAuthedClientAsync();
        var bob   = await NewAuthedUserAsync();
        var chatId = await CreateDirectChatAsync(alice.Client, bob.UserId);
        var id1 = await SendMessageAsync(alice.Client, chatId, "one");
        var id2 = await SendMessageAsync(alice.Client, chatId, "two");
        await alice.Client.DeleteAsync($"/api/chats/{chatId}/messages/{id1}");

        var response = await alice.Client.PostAsJsonAsync($"/api/chats/{chatId}/messages/delete-bulk", new { messageIds = new[] { id1, id2 } });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var deletedIds = await response.Content.ReadFromJsonAsync<List<Guid>>();
        deletedIds.Should().ContainSingle().Which.Should().Be(id2);
    }

    [Fact]
    public async Task ForwardMessages_CreatesIndependentCopyInTargetChat()
    {
        var alice   = await NewAuthedClientAsync();
        var bob     = await NewAuthedUserAsync();
        var charlie = await NewAuthedUserAsync();
        var sourceChatId = await CreateDirectChatAsync(alice.Client, bob.UserId);
        var targetChatId = await CreateDirectChatAsync(alice.Client, charlie.UserId);
        var messageId = await SendMessageAsync(alice.Client, sourceChatId, "forward me");

        var response = await alice.Client.PostAsJsonAsync($"/api/chats/{targetChatId}/messages/forward",
            new { sourceChatId, messageIds = new[] { messageId } });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var forwardedIds = await response.Content.ReadFromJsonAsync<List<Guid>>();
        forwardedIds.Should().ContainSingle();
        forwardedIds![0].Should().NotBe(messageId);

        var targetPage = await alice.Client.GetFromJsonAsync<MessagesPageDto>($"/api/chats/{targetChatId}/messages");
        targetPage!.Items.Should().ContainSingle(m => m.Id == forwardedIds[0] && m.Content == "forward me");
    }

    [Fact]
    public async Task ForwardMessages_WhenNotMemberOfTargetChat_ReturnsForbidden()
    {
        var alice   = await NewAuthedClientAsync();
        var bob     = await NewAuthedUserAsync();
        var mallory = await NewAuthedClientAsync();
        var otherDirect = await NewAuthedUserAsync();
        var sourceChatId = await CreateDirectChatAsync(alice.Client, bob.UserId);
        var targetChatId = await CreateDirectChatAsync(mallory.Client, otherDirect.UserId);
        var messageId = await SendMessageAsync(alice.Client, sourceChatId, "secret");

        var response = await mallory.Client.PostAsJsonAsync($"/api/chats/{targetChatId}/messages/forward",
            new { sourceChatId, messageIds = new[] { messageId } });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ReplyToMessage_ReturnsPreviewOfQuotedMessage()
    {
        var alice = await NewAuthedClientAsync();
        var bob   = await NewAuthedUserAsync();
        var chatId = await CreateDirectChatAsync(alice.Client, bob.UserId);
        var originalId = await SendMessageAsync(alice.Client, chatId, "original question");

        var replyResponse = await alice.Client.PostAsJsonAsync($"/api/chats/{chatId}/messages",
            new { content = "the answer", replyToMessageId = originalId });
        replyResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var page = await alice.Client.GetFromJsonAsync<MessagesPageDto>($"/api/chats/{chatId}/messages");
        var reply = page!.Items.Single(m => m.Content == "the answer");
        reply.ReplyToMessageId.Should().Be(originalId);
        reply.ReplyToContent.Should().Be("original question");
    }

    private async Task<(HttpClient Client, AuthTestHelpers.AuthenticatedUser User)> NewAuthedClientAsync()
    {
        var client = factory.CreateClient();
        var user   = await AuthTestHelpers.RegisterAndAuthenticateAsync(client);
        return (client, user);
    }

    private async Task<AuthTestHelpers.AuthenticatedUser> NewAuthedUserAsync() =>
        await AuthTestHelpers.RegisterAndAuthenticateAsync(factory.CreateClient());

    private HttpClient AuthenticatedClient(AuthTestHelpers.AuthenticatedUser user)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", user.AccessToken);
        return client;
    }

    private static async Task<Guid> CreateDirectChatAsync(HttpClient client, Guid otherUserId)
    {
        var response = await client.PostAsJsonAsync("/api/chats/direct", new { otherUserId });
        return await response.Content.ReadFromJsonAsync<Guid>();
    }

    private static async Task<Guid> SendMessageAsync(HttpClient client, Guid chatId, string content)
    {
        var response = await client.PostAsJsonAsync($"/api/chats/{chatId}/messages", new { content });
        return await response.Content.ReadFromJsonAsync<Guid>();
    }

    private sealed record MessagesPageDto(List<MessageDto> Items, Guid? NextCursor);

    private sealed record MessageDto(
        Guid Id, Guid ChatId, Guid SenderId, string SenderName, string? SenderAvatarUrl,
        string Content, List<object> Attachments, string Status, DateTime SentAt, DateTime? EditedAt,
        Guid? ReplyToMessageId, string? ReplyToSenderName, string? ReplyToContent,
        Guid? ForwardedFromUserId, string? ForwardedFromUserName);
}
