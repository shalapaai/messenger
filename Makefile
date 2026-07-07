.PHONY: up up-backend up-frontend up-infra up-build down down-clean \
        logs logs-api logs-frontend ps restart build build-backend build-frontend \
        migrate migrate-add shell-db shell-redis shell-api shell-frontend \
        env health clean-images test test-unit test-integration \
        up-local up-build-local down-local down-local-clean logs-local ps-local restart-local \
        shell-db-local frontend-local \
        up-prod up-build-prod down-prod logs-prod ps-prod restart-prod help

# Изолированная локальная копия (см. docker-compose.local.yml) — свои порты/контейнеры/БД,
# не пересекается с основным стеком (dev или docker-compose.tunnel.yml)
LOCAL_COMPOSE := docker compose -p messenger-local --env-file .env.local \
	-f docker-compose.yml -f docker-compose.override.yml -f docker-compose.local.yml

# Прод-деплой через Cloudflare Tunnel (см. docker-compose.tunnel.yml).
# ВАЖНО: -f отключает автоподхват docker-compose.override.yml, поэтому этот
# набор команд никогда не пересекается с dev-конфигом (up/up-build и т.д.)
PROD_COMPOSE := docker compose -f docker-compose.yml -f docker-compose.tunnel.yml

# ── Docker Compose ────────────────────────────────────────────────────────────
up:                 ## Запустить всё: infra + backend + frontend
	docker compose up -d

up-backend:         ## Только infra + API (для разработки фронтенда локально)
	docker compose up -d postgres redis pgadmin api

up-frontend:        ## Только infra + frontend (API должен быть запущен)
	docker compose up -d postgres redis pgadmin frontend

up-infra:           ## Только инфраструктура: PostgreSQL + Redis + pgAdmin
	docker compose up -d postgres redis pgadmin

up-build:           ## Пересобрать все образы и запустить
	docker compose up -d --build

down:               ## Остановить контейнеры (данные сохраняются)
	docker compose down

down-clean:         ## Остановить + удалить volumes (ПОЛНЫЙ СБРОС)
	docker compose down -v --remove-orphans

logs:               ## Следить за логами всех сервисов
	docker compose logs -f

logs-api:           ## Логи только API
	docker compose logs -f api

logs-frontend:      ## Логи только фронтенда
	docker compose logs -f frontend

ps:                 ## Статус контейнеров
	docker compose ps

restart:            ## Перезапустить API
	docker compose restart api

# ── Build ─────────────────────────────────────────────────────────────────────
build:              ## Пересобрать все Docker-образы без кэша
	docker compose build --no-cache

build-backend:      ## Собрать .NET решение локально
	cd backend && dotnet build -c Release

build-frontend:     ## Собрать фронтенд локально
	cd frontend && npm run build

# ── Database ──────────────────────────────────────────────────────────────────
migrate:            ## Применить EF Core миграции всех модулей
	cd backend && dotnet ef database update --project src/Modules/Auth/Messenger.Modules.Auth
	cd backend && dotnet ef database update --project src/Modules/Users/Messenger.Modules.Users
	cd backend && dotnet ef database update --project src/Modules/Chats/Messenger.Modules.Chats
	cd backend && dotnet ef database update --project src/Modules/Messages/Messenger.Modules.Messages
	cd backend && dotnet ef database update --project src/Modules/Files/Messenger.Modules.Files

migrate-add:        ## Добавить миграцию: make migrate-add MODULE=Messages NAME=InitialCreate
	cd backend && dotnet ef migrations add $(NAME) \
		--project src/Modules/$(MODULE)/Messenger.Modules.$(MODULE) \
		--startup-project src/Api/Messenger.Api

# ── Shell доступ ──────────────────────────────────────────────────────────────
shell-db:           ## psql в контейнере PostgreSQL
	docker compose exec postgres psql -U messenger -d messenger

shell-redis:        ## redis-cli в контейнере Redis
	docker compose exec redis redis-cli -a redis_dev

shell-api:          ## sh в контейнере API
	docker compose exec api sh

shell-frontend:     ## sh в контейнере фронтенда
	docker compose exec frontend sh

# ── Тесты ────────────────────────────────────────────────────────────────────
test:               ## Все тесты (unit + integration) в Docker
	docker run --rm \
		-v $(PWD)/backend:/app \
		-w /app \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-e DOTNET_CLI_HOME=/tmp/dotnet \
		mcr.microsoft.com/dotnet/sdk:9.0-alpine \
		dotnet test --logger "console;verbosity=normal"

test-unit:          ## Только unit-тесты (без Docker-инфраструктуры)
	docker run --rm \
		-v $(PWD)/backend:/app \
		-w /app \
		-e DOTNET_CLI_HOME=/tmp/dotnet \
		mcr.microsoft.com/dotnet/sdk:9.0-alpine \
		dotnet test tests/Messenger.Modules.Auth.UnitTests --logger "console;verbosity=normal"

test-integration:   ## Только integration-тесты (поднимает БД через Testcontainers)
	docker run --rm \
		-v $(PWD)/backend:/app \
		-w /app \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-e DOTNET_CLI_HOME=/tmp/dotnet \
		mcr.microsoft.com/dotnet/sdk:9.0-alpine \
		dotnet test tests/Messenger.Api.IntegrationTests --logger "console;verbosity=normal"

# ── Локальная копия (изолированная, параллельно с основным стеком) ───────────
up-local:           ## Поднять изолированную локальную копию целиком (infra + backend + frontend)
	$(LOCAL_COMPOSE) up -d

up-build-local:     ## Пересобрать образы и поднять изолированную локальную копию целиком
	$(LOCAL_COMPOSE) up -d --build

down-local:         ## Остановить локальную копию (данные сохраняются)
	$(LOCAL_COMPOSE) down

down-local-clean:   ## Остановить локальную копию + удалить volumes (ПОЛНЫЙ СБРОС)
	$(LOCAL_COMPOSE) down -v --remove-orphans

logs-local:         ## Логи локальной копии
	$(LOCAL_COMPOSE) logs -f

ps-local:           ## Статус контейнеров локальной копии
	$(LOCAL_COMPOSE) ps

restart-local:      ## Перезапустить API локальной копии
	$(LOCAL_COMPOSE) restart api

shell-db-local:     ## psql в контейнере PostgreSQL локальной копии
	$(LOCAL_COMPOSE) exec postgres psql -U messenger -d messenger

frontend-local:     ## Запустить фронтенд локальной копии (Vite, порт из .env.local)
	cd frontend && API_TARGET=http://localhost:$$(grep -oP 'API_PORT=\K.*' ../.env.local) \
		npm run dev -- --port $$(grep -oP 'FRONTEND_PORT=\K.*' ../.env.local)

# ── Прод (Cloudflare Tunnel) ──────────────────────────────────────────────────
up-prod:            ## Поднять прод (Cloudflare Tunnel), без пересборки
	$(PROD_COMPOSE) up -d

up-build-prod:      ## Пересобрать образы и поднять прод (Cloudflare Tunnel)
	$(PROD_COMPOSE) up -d --build

down-prod:          ## Остановить прод (данные сохраняются)
	$(PROD_COMPOSE) down

logs-prod:          ## Логи прода
	$(PROD_COMPOSE) logs -f

ps-prod:            ## Статус контейнеров прода
	$(PROD_COMPOSE) ps

restart-prod:       ## Перезапустить API прода
	$(PROD_COMPOSE) restart api

# ── Утилиты ───────────────────────────────────────────────────────────────────
env:                ## Создать .env из .env.example
	cp -n .env.example .env && echo ".env created"

health:             ## Проверить health-check всех сервисов
	docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

clean-images:       ## Удалить неиспользуемые Docker образы
	docker image prune -f

help:               ## Показать эту помощь
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
