# ── Stage 1: Restore (кэшируется пока не изменятся .csproj) ──────────────────
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS restore
WORKDIR /src

# Копируем только project-файлы для оптимального кэширования слоёв
COPY backend/Messenger.slnx ./
COPY backend/src/Api/Messenger.Api/Messenger.Api.csproj                                               src/Api/Messenger.Api/
COPY backend/src/Modules/Shared/Messenger.Shared.Kernel/Messenger.Shared.Kernel.csproj               src/Modules/Shared/Messenger.Shared.Kernel/
COPY backend/src/Modules/Auth/Messenger.Modules.Auth/Messenger.Modules.Auth.csproj                   src/Modules/Auth/Messenger.Modules.Auth/
COPY backend/src/Modules/Users/Messenger.Modules.Users/Messenger.Modules.Users.csproj                src/Modules/Users/Messenger.Modules.Users/
COPY backend/src/Modules/Chats/Messenger.Modules.Chats/Messenger.Modules.Chats.csproj               src/Modules/Chats/Messenger.Modules.Chats/
COPY backend/src/Modules/Messages/Messenger.Modules.Messages/Messenger.Modules.Messages.csproj       src/Modules/Messages/Messenger.Modules.Messages/
COPY backend/src/Modules/Files/Messenger.Modules.Files/Messenger.Modules.Files.csproj               src/Modules/Files/Messenger.Modules.Files/
COPY backend/src/Modules/Notifications/Messenger.Modules.Notifications/Messenger.Modules.Notifications.csproj src/Modules/Notifications/Messenger.Modules.Notifications/
COPY backend/src/Modules/Realtime/Messenger.Modules.Realtime/Messenger.Modules.Realtime.csproj       src/Modules/Realtime/Messenger.Modules.Realtime/
COPY backend/src/Modules/Localization/Messenger.Modules.Localization/Messenger.Modules.Localization.csproj src/Modules/Localization/Messenger.Modules.Localization/

RUN dotnet restore src/Api/Messenger.Api/Messenger.Api.csproj

# ── Stage 2: Build & Publish ──────────────────────────────────────────────────
FROM restore AS publish
COPY backend/src/ ./src/
RUN dotnet publish src/Api/Messenger.Api/Messenger.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish \
    -p:UseAppHost=false \
    -p:PublishTrimmed=false

# ── Stage 3: Development (dotnet watch с volume mount) ───────────────────────
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS development
WORKDIR /app

# Устанавливаем инструменты разработки
RUN dotnet tool install --global dotnet-ef && \
    apk add --no-cache curl bash

ENV PATH="${PATH}:/root/.dotnet/tools"
ENV ASPNETCORE_ENVIRONMENT=Development
ENV DOTNET_USE_POLLING_FILE_WATCHER=true

EXPOSE 8080 8081

# Точка входа переопределяется в docker-compose.override.yml
CMD ["dotnet", "watch", "run", "--project", "src/Api/Messenger.Api/Messenger.Api.csproj"]

# ── Stage 4: Runtime (production) ────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine AS runtime
WORKDIR /app

# Безопасность: non-root пользователь
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Создаём директорию для uploads с нужными правами
RUN mkdir -p /app/uploads && chown appuser:appgroup /app/uploads

# Копируем артефакты сборки
COPY --from=publish --chown=appuser:appgroup /app/publish .

USER appuser

# Healthcheck endpoint (требует добавить /health в Program.cs)
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
    CMD wget -qO- http://localhost:8080/health || exit 1

EXPOSE 8080
ENTRYPOINT ["dotnet", "Messenger.Api.dll"]
