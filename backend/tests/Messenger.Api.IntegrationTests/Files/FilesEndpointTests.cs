namespace Messenger.Api.IntegrationTests.Files;

using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Messenger.Api.IntegrationTests.Fixtures;

[Collection("Messenger")]
public sealed class FilesEndpointTests(MessengerApiFactory factory)
{
    // 1x1 transparent PNG.
    private static readonly byte[] PngBytes =
    [
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
        0x42, 0x60, 0x82
    ];

    [Fact]
    public async Task UploadAvatar_WithValidPng_ReturnsPublicUrl()
    {
        var alice = await NewAuthedClientAsync();

        var response = await alice.Client.PostAsync("/api/files/avatar", BuildMultipartContent("avatar.png", "image/png", PngBytes));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<AvatarUploadResponse>();
        body!.Url.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task UploadAvatar_WithoutAuth_ReturnsUnauthorized()
    {
        var anonymousClient = factory.CreateClient();

        var response = await anonymousClient.PostAsync("/api/files/avatar", BuildMultipartContent("avatar.png", "image/png", PngBytes));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task UploadAvatar_WithContentNotMatchingDeclaredType_ReturnsValidationError()
    {
        var alice = await NewAuthedClientAsync();
        var fakeBytes = "this is definitely not a real png"u8.ToArray();

        var response = await alice.Client.PostAsync("/api/files/avatar", BuildMultipartContent("avatar.png", "image/png", fakeBytes));

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task DownloadFile_ForAvatar_IsPubliclyAccessibleWithoutAuth()
    {
        var alice = await NewAuthedClientAsync();
        var uploadResponse = await alice.Client.PostAsync("/api/files/avatar", BuildMultipartContent("avatar.png", "image/png", PngBytes));
        var fileKey = ExtractFileKey((await uploadResponse.Content.ReadFromJsonAsync<AvatarUploadResponse>())!.Url);

        var anonymousClient = factory.CreateClient();
        var downloadResponse = await anonymousClient.GetAsync($"/api/files/{fileKey}");

        downloadResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var downloaded = await downloadResponse.Content.ReadAsByteArrayAsync();
        downloaded.Should().Equal(PngBytes);
    }

    [Fact]
    public async Task DownloadFile_ForUnknownKey_ReturnsNotFound()
    {
        var anonymousClient = factory.CreateClient();

        var response = await anonymousClient.GetAsync($"/api/files/{Guid.NewGuid():N}.png");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UploadAndSendMessage_WithPhoto_CreatesMessageWithAttachment()
    {
        var alice = await NewAuthedClientAsync();
        var bob   = await NewAuthedUserAsync();
        var chatId = await CreateDirectChatAsync(alice.Client, bob.UserId);

        using var content = BuildMultipartContent("photo.png", "image/png", PngBytes);
        var response = await alice.Client.PostAsync($"/api/chats/{chatId}/messages/upload?caption=look", content);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<UploadAndSendMessageResult>();
        body!.Content.Should().Be("look");
        body.Attachments.Should().ContainSingle();
    }

    [Fact]
    public async Task DownloadFile_ForChatAttachment_RequiresChatMembership()
    {
        var alice   = await NewAuthedClientAsync();
        var bob     = await NewAuthedUserAsync();
        var mallory = await NewAuthedClientAsync();
        var chatId  = await CreateDirectChatAsync(alice.Client, bob.UserId);

        using var content = BuildMultipartContent("photo.png", "image/png", PngBytes);
        var uploadResponse = await alice.Client.PostAsync($"/api/chats/{chatId}/messages/upload", content);
        var uploaded = await uploadResponse.Content.ReadFromJsonAsync<UploadAndSendMessageResult>();
        var fileKey = ExtractFileKey(uploaded!.Attachments[0].FileUrl);

        var anonymousClient = factory.CreateClient();
        var anonymousAttempt = await anonymousClient.GetAsync($"/api/files/{fileKey}");
        anonymousAttempt.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var intruderAttempt = await mallory.Client.GetAsync($"/api/files/{fileKey}");
        intruderAttempt.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        using var bobClient = AuthenticatedClient(bob);
        var memberAttempt = await bobClient.GetAsync($"/api/files/{fileKey}");
        memberAttempt.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task UploadChatAvatar_ByPlainMember_ReturnsForbidden()
    {
        var owner  = await NewAuthedClientAsync();
        var member = await NewAuthedUserAsync();
        var groupResponse = await owner.Client.PostAsJsonAsync("/api/chats/group", new
        {
            name      = $"Group {Guid.NewGuid():N}",
            memberIds = new[] { member.UserId }
        });
        var chatId = await groupResponse.Content.ReadFromJsonAsync<Guid>();
        using var memberClient = AuthenticatedClient(member);

        var response = await memberClient.PostAsync($"/api/chats/{chatId}/avatar", BuildMultipartContent("avatar.png", "image/png", PngBytes));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    private static MultipartFormDataContent BuildMultipartContent(string fileName, string contentType, byte[] bytes)
    {
        var fileContent = new ByteArrayContent(bytes);
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(contentType);
        var form = new MultipartFormDataContent { { fileContent, "file", fileName } };
        return form;
    }

    private static string ExtractFileKey(string url) => url.Split('/').Last();

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

    private sealed record AvatarUploadResponse(string Url);
    private sealed record UploadAndSendMessageResult(Guid MessageId, string Content, List<AttachmentResult> Attachments, DateTime SentAt);
    private sealed record AttachmentResult(string FileUrl, string FileName, string ContentType, long FileSizeBytes);
}
