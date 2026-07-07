namespace Messenger.Api.IntegrationTests.Chats;

using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Messenger.Api.IntegrationTests.Fixtures;

[Collection("Messenger")]
public sealed class ChatsEndpointTests(MessengerApiFactory factory)
{
    [Fact]
    public async Task CreateDirectChat_CalledTwice_ReturnsTheSameChatId()
    {
        var alice = await NewAuthedClientAsync();
        var bob   = await NewAuthedUserAsync();

        var first  = await alice.Client.PostAsJsonAsync("/api/chats/direct", new { otherUserId = bob.UserId });
        var second = await alice.Client.PostAsJsonAsync("/api/chats/direct", new { otherUserId = bob.UserId });

        first.StatusCode.Should().Be(HttpStatusCode.OK);
        second.StatusCode.Should().Be(HttpStatusCode.OK);
        var firstId  = await first.Content.ReadFromJsonAsync<Guid>();
        var secondId = await second.Content.ReadFromJsonAsync<Guid>();
        secondId.Should().Be(firstId);
    }

    [Fact]
    public async Task CreateDirectChat_WithSelf_ReturnsValidationError()
    {
        var alice = await NewAuthedClientAsync();

        var response = await alice.Client.PostAsJsonAsync("/api/chats/direct", new { otherUserId = alice.User.UserId });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task GetChats_ReturnsChatWithLastMessageAndOtherParticipant()
    {
        var alice = await NewAuthedClientAsync();
        var bob   = await NewAuthedUserAsync();

        var chatId = await CreateDirectChatAsync(alice.Client, bob.UserId);
        await alice.Client.PostAsJsonAsync($"/api/chats/{chatId}/messages", new { content = "hi bob" });

        var response = await alice.Client.GetAsync("/api/chats");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        json.Should().Contain(chatId.ToString());
        json.Should().Contain("hi bob");
        json.Should().Contain(bob.UserId.ToString());
    }

    [Fact]
    public async Task GetChatById_WhenNotAMember_ReturnsForbidden()
    {
        var alice  = await NewAuthedClientAsync();
        var bob    = await NewAuthedUserAsync();
        var mallory = await NewAuthedClientAsync();

        var chatId = await CreateDirectChatAsync(alice.Client, bob.UserId);

        var response = await mallory.Client.GetAsync($"/api/chats/{chatId}");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetChatById_WhenChatDoesNotExist_ReturnsNotFound()
    {
        var alice = await NewAuthedClientAsync();

        var response = await alice.Client.GetAsync($"/api/chats/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CreateGroupChat_CreatorBecomesOwner_MembersBecomeMembers()
    {
        var owner  = await NewAuthedClientAsync();
        var member = await NewAuthedUserAsync();

        var response = await owner.Client.PostAsJsonAsync("/api/chats/group", new
        {
            name      = $"Team {Guid.NewGuid():N}",
            memberIds = new[] { member.UserId }
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var chatId = await response.Content.ReadFromJsonAsync<Guid>();

        var details = await owner.Client.GetFromJsonAsync<GroupChatDetailDto>($"/api/chats/{chatId}");
        details!.Members.Should().Contain(m => m.UserId == owner.User.UserId && m.Role == "owner");
        details.Members.Should().Contain(m => m.UserId == member.UserId && m.Role == "member");
    }

    [Fact]
    public async Task AddChatMember_ByPlainMember_ReturnsForbidden()
    {
        var owner       = await NewAuthedClientAsync();
        var plainMember = await NewAuthedUserAsync();
        var newcomer    = await NewAuthedUserAsync();

        var chatId = await CreateGroupChatAsync(owner.Client, [plainMember.UserId]);
        using var plainMemberClient = AuthenticatedClient(plainMember);

        var response = await plainMemberClient.PostAsJsonAsync($"/api/chats/{chatId}/members", new { userId = newcomer.UserId });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task RemoveChatMember_Self_RemovesFromChat()
    {
        var owner  = await NewAuthedClientAsync();
        var member = await NewAuthedUserAsync();

        var chatId = await CreateGroupChatAsync(owner.Client, [member.UserId]);
        using var memberClient = AuthenticatedClient(member);

        var response = await memberClient.DeleteAsync($"/api/chats/{chatId}/members/{member.UserId}");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var details = await owner.Client.GetFromJsonAsync<GroupChatDetailDto>($"/api/chats/{chatId}");
        details!.Members.Should().NotContain(m => m.UserId == member.UserId);
    }

    [Fact]
    public async Task SetChatMemberRole_ByNonOwner_ReturnsForbidden()
    {
        var owner  = await NewAuthedClientAsync();
        var admin  = await NewAuthedUserAsync();
        var member = await NewAuthedUserAsync();

        var chatId = await CreateGroupChatAsync(owner.Client, [admin.UserId, member.UserId]);
        await owner.Client.PatchAsJsonAsync($"/api/chats/{chatId}/members/{admin.UserId}/role", new { role = "admin" });
        using var adminClient = AuthenticatedClient(admin);

        var response = await adminClient.PatchAsJsonAsync($"/api/chats/{chatId}/members/{member.UserId}/role", new { role = "admin" });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UpdateChat_OnDirectChat_ReturnsValidationError()
    {
        var alice = await NewAuthedClientAsync();
        var bob   = await NewAuthedUserAsync();
        var chatId = await CreateDirectChatAsync(alice.Client, bob.UserId);

        var response = await alice.Client.PatchAsJsonAsync($"/api/chats/{chatId}", new { name = "New name" });

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task DeleteChat_OnGroupChat_ReturnsValidationError()
    {
        var owner = await NewAuthedClientAsync();
        var chatId = await CreateGroupChatAsync(owner.Client, []);

        var response = await owner.Client.DeleteAsync($"/api/chats/{chatId}");

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task DeleteChat_OnDirectChat_RemovesItForBothParticipants()
    {
        var alice = await NewAuthedClientAsync();
        var bob   = await NewAuthedUserAsync();
        var chatId = await CreateDirectChatAsync(alice.Client, bob.UserId);

        var deleteResponse = await alice.Client.DeleteAsync($"/api/chats/{chatId}");

        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);
        var getResponse = await alice.Client.GetAsync($"/api/chats/{chatId}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task MarkChatRead_ThenGetChats_ReflectsAsReadByRequester()
    {
        var alice = await NewAuthedClientAsync();
        var bob   = await NewAuthedUserAsync();
        var chatId = await CreateDirectChatAsync(alice.Client, bob.UserId);
        await alice.Client.PostAsJsonAsync($"/api/chats/{chatId}/messages", new { content = "hi" });

        using var bobClient = AuthenticatedClient(bob);
        var readResponse = await bobClient.PostAsync($"/api/chats/{chatId}/read", null);

        readResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);
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

    private static async Task<Guid> CreateGroupChatAsync(HttpClient client, IReadOnlyList<Guid> memberIds)
    {
        var response = await client.PostAsJsonAsync("/api/chats/group", new
        {
            name = $"Group {Guid.NewGuid():N}",
            memberIds
        });
        return await response.Content.ReadFromJsonAsync<Guid>();
    }

    private sealed record GroupChatDetailDto(Guid Id, string Type, string? Name, List<GroupChatMemberDto> Members);
    private sealed record GroupChatMemberDto(Guid UserId, string DisplayName, string Role);
}
