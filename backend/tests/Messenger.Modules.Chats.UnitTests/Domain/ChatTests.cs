namespace Messenger.Modules.Chats.UnitTests.Domain;

using FluentAssertions;
using Messenger.Modules.Chats.Domain;
using Messenger.Modules.Chats.Domain.Events;

public sealed class ChatTests
{
    // ── CreateDirect ──────────────────────────────────────────────────────────

    [Fact]
    public void CreateDirect_OrdersUserIdsCanonically_RegardlessOfArgumentOrder()
    {
        var userA = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var userB = Guid.Parse("00000000-0000-0000-0000-000000000002");

        var chatForward  = Chat.CreateDirect(userA, userB);
        var chatReversed = Chat.CreateDirect(userB, userA);

        chatForward.DirectUserId1.Should().Be(userA);
        chatForward.DirectUserId2.Should().Be(userB);
        chatReversed.DirectUserId1.Should().Be(userA);
        chatReversed.DirectUserId2.Should().Be(userB);
    }

    [Fact]
    public void CreateDirect_SetsTypeToDirect()
    {
        var chat = Chat.CreateDirect(Guid.NewGuid(), Guid.NewGuid());

        chat.Type.Should().Be(ChatType.Direct);
    }

    // ── CreateGroup ───────────────────────────────────────────────────────────

    [Fact]
    public void CreateGroup_WithValidName_ReturnsSuccess()
    {
        var result = Chat.CreateGroup("My Group");

        result.IsSuccess.Should().BeTrue();
        result.Value!.Name.Should().Be("My Group");
        result.Value!.Type.Should().Be(ChatType.Group);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void CreateGroup_WithEmptyOrWhitespaceName_ReturnsFailure(string name)
    {
        var result = Chat.CreateGroup(name);

        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public void CreateGroup_WithNameLongerThan100Characters_ReturnsFailure()
    {
        var name = new string('a', 101);

        var result = Chat.CreateGroup(name);

        result.IsFailure.Should().BeTrue();
    }

    // ── AddMember ─────────────────────────────────────────────────────────────

    [Fact]
    public void AddMember_WithoutExplicitRole_DefaultsToMember()
    {
        var chat = CreateGroup();
        var userId = Guid.NewGuid();

        chat.AddMember(userId);

        chat.Members.Single(m => m.UserId == userId).Role.Should().Be(ChatMemberRole.Member);
    }

    [Fact]
    public void AddMember_WithExplicitRole_AssignsThatRole()
    {
        var chat = CreateGroup();
        var userId = Guid.NewGuid();

        chat.AddMember(userId, ChatMemberRole.Owner);

        chat.Members.Single(m => m.UserId == userId).Role.Should().Be(ChatMemberRole.Owner);
    }

    [Fact]
    public void AddMember_SameUserTwice_DoesNotDuplicate()
    {
        var chat = CreateGroup();
        var userId = Guid.NewGuid();

        chat.AddMember(userId);
        chat.AddMember(userId);

        chat.Members.Count(m => m.UserId == userId).Should().Be(1);
    }

    // ── RemoveMember ──────────────────────────────────────────────────────────

    [Fact]
    public void RemoveMember_OwnerSelfRemovesWithAdminPresent_TransfersOwnershipToAdmin()
    {
        var ownerId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var chat = CreateGroup();
        chat.AddMember(ownerId, ChatMemberRole.Owner);
        chat.AddMember(adminId, ChatMemberRole.Admin);
        chat.AddMember(memberId, ChatMemberRole.Member);

        var result = chat.RemoveMember(ownerId, ownerId);

        result.IsSuccess.Should().BeTrue();
        chat.Members.Should().NotContain(m => m.UserId == ownerId);
        chat.Members.Single(m => m.UserId == adminId).Role.Should().Be(ChatMemberRole.Owner);
        chat.Members.Single(m => m.UserId == memberId).Role.Should().Be(ChatMemberRole.Member);
    }

    [Fact]
    public void RemoveMember_OwnerSelfRemovesWithNoAdminPresent_TransfersOwnershipToAnyOtherMember()
    {
        var ownerId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var chat = CreateGroup();
        chat.AddMember(ownerId, ChatMemberRole.Owner);
        chat.AddMember(memberId, ChatMemberRole.Member);

        var result = chat.RemoveMember(ownerId, ownerId);

        result.IsSuccess.Should().BeTrue();
        chat.Members.Single(m => m.UserId == memberId).Role.Should().Be(ChatMemberRole.Owner);
    }

    [Fact]
    public void RemoveMember_NonOwnerSelfRemoves_JustRemovesWithoutRoleTransfer()
    {
        var ownerId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var chat = CreateGroup();
        chat.AddMember(ownerId, ChatMemberRole.Owner);
        chat.AddMember(memberId, ChatMemberRole.Member);

        var result = chat.RemoveMember(memberId, memberId);

        result.IsSuccess.Should().BeTrue();
        chat.Members.Should().NotContain(m => m.UserId == memberId);
        chat.Members.Single(m => m.UserId == ownerId).Role.Should().Be(ChatMemberRole.Owner);
    }

    [Fact]
    public void RemoveMember_RequesterNotAMember_ReturnsForbidden()
    {
        var chat = CreateGroup();
        var memberId = Guid.NewGuid();
        chat.AddMember(memberId);

        var result = chat.RemoveMember(Guid.NewGuid(), memberId);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(Messenger.Shared.Kernel.Results.ErrorType.Forbidden);
    }

    [Fact]
    public void RemoveMember_TargetNotAMember_ReturnsNotFound()
    {
        var chat = CreateGroup();
        var requesterId = Guid.NewGuid();
        chat.AddMember(requesterId, ChatMemberRole.Owner);

        var result = chat.RemoveMember(requesterId, Guid.NewGuid());

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(Messenger.Shared.Kernel.Results.ErrorType.NotFound);
    }

    [Fact]
    public void RemoveMember_PlainMemberCannotRemoveOthers_ReturnsForbidden()
    {
        var chat = CreateGroup();
        var requesterId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        chat.AddMember(requesterId, ChatMemberRole.Member);
        chat.AddMember(targetId, ChatMemberRole.Member);

        var result = chat.RemoveMember(requesterId, targetId);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(Messenger.Shared.Kernel.Results.ErrorType.Forbidden);
    }

    [Fact]
    public void RemoveMember_AdminCannotRemoveAnotherAdmin_ReturnsForbidden()
    {
        var chat = CreateGroup();
        var requesterId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        chat.AddMember(requesterId, ChatMemberRole.Admin);
        chat.AddMember(targetId, ChatMemberRole.Admin);

        var result = chat.RemoveMember(requesterId, targetId);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(Messenger.Shared.Kernel.Results.ErrorType.Forbidden);
    }

    [Theory]
    [InlineData(ChatMemberRole.Admin)]
    [InlineData(ChatMemberRole.Owner)]
    public void RemoveMember_AdminOrOwnerCanRemovePlainMember_ReturnsSuccess(ChatMemberRole requesterRole)
    {
        var chat = CreateGroup();
        var requesterId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        chat.AddMember(requesterId, requesterRole);
        chat.AddMember(targetId, ChatMemberRole.Member);

        var result = chat.RemoveMember(requesterId, targetId);

        result.IsSuccess.Should().BeTrue();
        chat.Members.Should().NotContain(m => m.UserId == targetId);
    }

    [Fact]
    public void RemoveMember_NobodyCanRemoveTheOwnerViaRemoveSomeoneElsePath_ReturnsForbidden()
    {
        var chat = CreateGroup();
        var ownerId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        chat.AddMember(ownerId, ChatMemberRole.Owner);
        chat.AddMember(adminId, ChatMemberRole.Admin);

        var result = chat.RemoveMember(adminId, ownerId);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(Messenger.Shared.Kernel.Results.ErrorType.Forbidden);
        chat.Members.Should().Contain(m => m.UserId == ownerId);
    }

    [Fact]
    public void IsEmpty_AfterLastMemberRemoved_IsTrue()
    {
        var chat = CreateGroup();
        var userId = Guid.NewGuid();
        chat.AddMember(userId, ChatMemberRole.Owner);

        chat.RemoveMember(userId, userId);

        chat.IsEmpty.Should().BeTrue();
    }

    // ── UpdateInfo ────────────────────────────────────────────────────────────

    [Fact]
    public void UpdateInfo_RequesterNotAMember_ReturnsForbidden()
    {
        var chat = CreateGroup();

        var result = chat.UpdateInfo(Guid.NewGuid(), "New Name", null);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(Messenger.Shared.Kernel.Results.ErrorType.Forbidden);
    }

    [Fact]
    public void UpdateInfo_RequesterIsPlainMember_ReturnsForbidden()
    {
        var chat = CreateGroup();
        var memberId = Guid.NewGuid();
        chat.AddMember(memberId, ChatMemberRole.Member);

        var result = chat.UpdateInfo(memberId, "New Name", null);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(Messenger.Shared.Kernel.Results.ErrorType.Forbidden);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void UpdateInfo_WithEmptyOrWhitespaceName_ReturnsValidationFailure(string name)
    {
        var chat = CreateGroup();
        var ownerId = Guid.NewGuid();
        chat.AddMember(ownerId, ChatMemberRole.Owner);

        var result = chat.UpdateInfo(ownerId, name, null);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(Messenger.Shared.Kernel.Results.ErrorType.Validation);
    }

    [Fact]
    public void UpdateInfo_WithNameLongerThan100Characters_ReturnsValidationFailure()
    {
        var chat = CreateGroup();
        var ownerId = Guid.NewGuid();
        chat.AddMember(ownerId, ChatMemberRole.Owner);

        var result = chat.UpdateInfo(ownerId, new string('a', 101), null);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(Messenger.Shared.Kernel.Results.ErrorType.Validation);
    }

    [Fact]
    public void UpdateInfo_WithOnlyNameProvided_UpdatesNameAndLeavesAvatarUnchanged()
    {
        var chat = CreateGroup();
        var ownerId = Guid.NewGuid();
        chat.AddMember(ownerId, ChatMemberRole.Owner);
        chat.UpdateInfo(ownerId, null, "https://example.com/avatar.png");

        var result = chat.UpdateInfo(ownerId, "Updated Name", null);

        result.IsSuccess.Should().BeTrue();
        chat.Name.Should().Be("Updated Name");
        chat.AvatarUrl.Should().Be("https://example.com/avatar.png");
    }

    [Fact]
    public void UpdateInfo_WithOnlyAvatarProvided_UpdatesAvatarAndLeavesNameUnchanged()
    {
        var chat = CreateGroup("Original Name");
        var ownerId = Guid.NewGuid();
        chat.AddMember(ownerId, ChatMemberRole.Owner);

        var result = chat.UpdateInfo(ownerId, null, "https://example.com/avatar.png");

        result.IsSuccess.Should().BeTrue();
        chat.Name.Should().Be("Original Name");
        chat.AvatarUrl.Should().Be("https://example.com/avatar.png");
    }

    [Fact]
    public void UpdateInfo_OnSuccess_RaisesChatUpdatedDomainEvent()
    {
        var chat = CreateGroup();
        var ownerId = Guid.NewGuid();
        chat.AddMember(ownerId, ChatMemberRole.Owner);

        chat.UpdateInfo(ownerId, "New Name", null);

        chat.DomainEvents.OfType<ChatUpdatedDomainEvent>().Should().ContainSingle();
    }

    // ── SetMemberRole ─────────────────────────────────────────────────────────

    [Fact]
    public void SetMemberRole_RequesterNotOwner_ReturnsForbidden()
    {
        var chat = CreateGroup();
        var adminId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        chat.AddMember(adminId, ChatMemberRole.Admin);
        chat.AddMember(targetId, ChatMemberRole.Member);

        var result = chat.SetMemberRole(adminId, targetId, ChatMemberRole.Admin);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(Messenger.Shared.Kernel.Results.ErrorType.Forbidden);
    }

    [Fact]
    public void SetMemberRole_RequesterTriesToChangeOwnRole_ReturnsValidationFailure()
    {
        var chat = CreateGroup();
        var ownerId = Guid.NewGuid();
        chat.AddMember(ownerId, ChatMemberRole.Owner);

        var result = chat.SetMemberRole(ownerId, ownerId, ChatMemberRole.Admin);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(Messenger.Shared.Kernel.Results.ErrorType.Validation);
    }

    [Fact]
    public void SetMemberRole_TargetNotAMember_ReturnsNotFound()
    {
        var chat = CreateGroup();
        var ownerId = Guid.NewGuid();
        chat.AddMember(ownerId, ChatMemberRole.Owner);

        var result = chat.SetMemberRole(ownerId, Guid.NewGuid(), ChatMemberRole.Admin);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(Messenger.Shared.Kernel.Results.ErrorType.NotFound);
    }

    [Fact]
    public void SetMemberRole_TargetIsOwner_ReturnsForbidden()
    {
        var chat = CreateGroup();
        var ownerId = Guid.NewGuid();
        var otherOwnerLikeId = Guid.NewGuid();
        chat.AddMember(ownerId, ChatMemberRole.Owner);
        chat.AddMember(otherOwnerLikeId, ChatMemberRole.Owner);

        var result = chat.SetMemberRole(ownerId, otherOwnerLikeId, ChatMemberRole.Admin);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(Messenger.Shared.Kernel.Results.ErrorType.Forbidden);
    }

    [Fact]
    public void SetMemberRole_ValidRequest_SetsNewRole()
    {
        var chat = CreateGroup();
        var ownerId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        chat.AddMember(ownerId, ChatMemberRole.Owner);
        chat.AddMember(targetId, ChatMemberRole.Member);

        var result = chat.SetMemberRole(ownerId, targetId, ChatMemberRole.Admin);

        result.IsSuccess.Should().BeTrue();
        chat.Members.Single(m => m.UserId == targetId).Role.Should().Be(ChatMemberRole.Admin);
    }

    // ── MarkMemberAsRead ──────────────────────────────────────────────────────

    [Fact]
    public void MarkMemberAsRead_SetsLastReadAt()
    {
        var chat = CreateGroup();
        var userId = Guid.NewGuid();
        chat.AddMember(userId);

        var before = DateTime.UtcNow;
        var result = chat.MarkMemberAsRead(userId);
        var after = DateTime.UtcNow;

        result.IsSuccess.Should().BeTrue();
        var member = chat.Members.Single(m => m.UserId == userId);
        member.LastReadAt.Should().NotBeNull();
        member.LastReadAt!.Value.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
    }

    [Fact]
    public void MarkMemberAsRead_RaisesChatReadDomainEvent()
    {
        var chat = CreateGroup();
        var userId = Guid.NewGuid();
        chat.AddMember(userId);

        chat.MarkMemberAsRead(userId);

        chat.DomainEvents.OfType<ChatReadDomainEvent>().Should().ContainSingle(e => e.ReaderId == userId);
    }

    [Fact]
    public void MarkMemberAsRead_RequesterNotAMember_ReturnsForbidden()
    {
        var chat = CreateGroup();

        var result = chat.MarkMemberAsRead(Guid.NewGuid());

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(Messenger.Shared.Kernel.Results.ErrorType.Forbidden);
    }

    // ── EnsureCanBeDeletedBy ──────────────────────────────────────────────────

    [Fact]
    public void EnsureCanBeDeletedBy_GroupChat_ReturnsValidationFailure()
    {
        var chat = CreateGroup();
        var ownerId = Guid.NewGuid();
        chat.AddMember(ownerId, ChatMemberRole.Owner);

        var result = chat.EnsureCanBeDeletedBy(ownerId);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(Messenger.Shared.Kernel.Results.ErrorType.Validation);
    }

    [Fact]
    public void EnsureCanBeDeletedBy_DirectChatRequesterNotAMember_ReturnsForbidden()
    {
        var chat = Chat.CreateDirect(Guid.NewGuid(), Guid.NewGuid());

        var result = chat.EnsureCanBeDeletedBy(Guid.NewGuid());

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(Messenger.Shared.Kernel.Results.ErrorType.Forbidden);
    }

    [Fact]
    public void EnsureCanBeDeletedBy_DirectChatRequesterIsMember_ReturnsSuccess()
    {
        var userId1 = Guid.NewGuid();
        var userId2 = Guid.NewGuid();
        var chat = Chat.CreateDirect(userId1, userId2);
        chat.AddMember(userId1);
        chat.AddMember(userId2);

        var result = chat.EnsureCanBeDeletedBy(userId1);

        result.IsSuccess.Should().BeTrue();
    }

    private static Chat CreateGroup(string name = "Group") => Chat.CreateGroup(name).Value!;
}
