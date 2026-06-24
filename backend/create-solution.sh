#!/usr/bin/env bash
# Запускать из корня репозитория: bash backend/create-solution.sh
set -e

cd backend

# ── Solution ──────────────────────────────────────────────────────────────────
dotnet new sln -n Messenger

# ── Projects ──────────────────────────────────────────────────────────────────
dotnet new classlib -n Messenger.Shared.Kernel \
  -o src/Modules/Shared/Messenger.Shared.Kernel --framework net9.0

dotnet new classlib -n Messenger.Modules.Auth \
  -o src/Modules/Auth/Messenger.Modules.Auth --framework net9.0

dotnet new classlib -n Messenger.Modules.Users \
  -o src/Modules/Users/Messenger.Modules.Users --framework net9.0

dotnet new classlib -n Messenger.Modules.Chats \
  -o src/Modules/Chats/Messenger.Modules.Chats --framework net9.0

dotnet new classlib -n Messenger.Modules.Messages \
  -o src/Modules/Messages/Messenger.Modules.Messages --framework net9.0

dotnet new classlib -n Messenger.Modules.Notifications \
  -o src/Modules/Notifications/Messenger.Modules.Notifications --framework net9.0

dotnet new classlib -n Messenger.Modules.Realtime \
  -o src/Modules/Realtime/Messenger.Modules.Realtime --framework net9.0

dotnet new classlib -n Messenger.Modules.Files \
  -o src/Modules/Files/Messenger.Modules.Files --framework net9.0

dotnet new webapi -n Messenger.Api \
  -o src/Api/Messenger.Api --framework net9.0

dotnet new xunit -n Messenger.Tests.Integration \
  -o tests/Messenger.Tests.Integration --framework net9.0

dotnet new xunit -n Messenger.Tests.Unit \
  -o tests/Messenger.Tests.Unit --framework net9.0

# ── Add to solution ───────────────────────────────────────────────────────────
dotnet sln add \
  src/Modules/Shared/Messenger.Shared.Kernel/Messenger.Shared.Kernel.csproj \
  src/Modules/Auth/Messenger.Modules.Auth/Messenger.Modules.Auth.csproj \
  src/Modules/Users/Messenger.Modules.Users/Messenger.Modules.Users.csproj \
  src/Modules/Chats/Messenger.Modules.Chats/Messenger.Modules.Chats.csproj \
  src/Modules/Messages/Messenger.Modules.Messages/Messenger.Modules.Messages.csproj \
  src/Modules/Notifications/Messenger.Modules.Notifications/Messenger.Modules.Notifications.csproj \
  src/Modules/Realtime/Messenger.Modules.Realtime/Messenger.Modules.Realtime.csproj \
  src/Modules/Files/Messenger.Modules.Files/Messenger.Modules.Files.csproj \
  src/Api/Messenger.Api/Messenger.Api.csproj \
  tests/Messenger.Tests.Integration/Messenger.Tests.Integration.csproj \
  tests/Messenger.Tests.Unit/Messenger.Tests.Unit.csproj

# ── Project references ────────────────────────────────────────────────────────
KERNEL=src/Modules/Shared/Messenger.Shared.Kernel/Messenger.Shared.Kernel.csproj

# Все модули → Kernel
for MOD in Auth Users Chats Messages Notifications Realtime Files; do
  PROJ="src/Modules/$MOD/Messenger.Modules.$MOD/Messenger.Modules.$MOD.csproj"
  dotnet add "$PROJ" reference "$KERNEL"
done

# Realtime → Messages (domain events)
dotnet add src/Modules/Realtime/Messenger.Modules.Realtime/Messenger.Modules.Realtime.csproj reference \
  src/Modules/Messages/Messenger.Modules.Messages/Messenger.Modules.Messages.csproj

# Chats → Messages (IMessagesModule)
dotnet add src/Modules/Chats/Messenger.Modules.Chats/Messenger.Modules.Chats.csproj reference \
  src/Modules/Messages/Messenger.Modules.Messages/Messenger.Modules.Messages.csproj

# Notifications → Messages (domain events)
dotnet add src/Modules/Notifications/Messenger.Modules.Notifications/Messenger.Modules.Notifications.csproj reference \
  src/Modules/Messages/Messenger.Modules.Messages/Messenger.Modules.Messages.csproj

# Api → все модули
for MOD in Auth Users Chats Messages Notifications Realtime Files; do
  dotnet add src/Api/Messenger.Api/Messenger.Api.csproj reference \
    "src/Modules/$MOD/Messenger.Modules.$MOD/Messenger.Modules.$MOD.csproj"
done

# Tests
dotnet add tests/Messenger.Tests.Integration/Messenger.Tests.Integration.csproj reference \
  src/Api/Messenger.Api/Messenger.Api.csproj

echo "✓ Solution created. Run: dotnet build"
