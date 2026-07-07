namespace Messenger.Api.IntegrationTests.Chats;

using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Messenger.Api.IntegrationTests.Fixtures;

[Collection("Messenger")]
public sealed class SmokeTests(MessengerApiFactory factory)
{
    [Fact]
    public async Task CreateDirectChat_ThenSendMessage_ThenRetrieveIt()
    {
        var alice = await AuthTestHelpers.RegisterAndAuthenticateAsync(factory.CreateClient());
        var aliceClient = factory.CreateClient();
        aliceClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", alice.AccessToken);

        var bobClient = factory.CreateClient();
        var bob = await AuthTestHelpers.RegisterAndAuthenticateAsync(bobClient);

        var createChatResponse = await aliceClient.PostAsJsonAsync("/api/chats/direct", new { otherUserId = bob.UserId });
        createChatResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var chatId = await createChatResponse.Content.ReadFromJsonAsync<Guid>();
        chatId.Should().NotBeEmpty();

        var sendResponse = await aliceClient.PostAsJsonAsync($"/api/chats/{chatId}/messages", new { content = "Hello Bob" });
        sendResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var getChatsResponse = await bobClient.GetAsync("/api/chats");
        getChatsResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var chatsJson = await getChatsResponse.Content.ReadAsStringAsync();
        chatsJson.Should().Contain(chatId.ToString());
        chatsJson.Should().Contain("Hello Bob");
    }
}
