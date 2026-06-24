.PHONY: up down logs ps restart build clean migrate shell-db shell-redis

# ── Docker Compose ────────────────────────────────────────────────────────────
up:                 ## Запустить всё в фоне
	docker compose up -d

up-infra:           ## Только инфраструктура (без API)
	docker compose up -d postgres redis pgadmin

up-build:           ## Пересобрать и запустить
	docker compose up -d --build

down:               ## Остановить контейнеры (данные сохраняются)
	docker compose down

down-clean:         ## Остановить + удалить volumes (ПОЛНЫЙ СБРОС)
	docker compose down -v --remove-orphans

logs:               ## Следить за логами всех сервисов
	docker compose logs -f

logs-api:           ## Логи только API
	docker compose logs -f api

ps:                 ## Статус контейнеров
	docker compose ps

restart:            ## Перезапустить API
	docker compose restart api

# ── Build ─────────────────────────────────────────────────────────────────────
build:              ## Собрать Docker-образ
	docker compose build --no-cache api

build-backend:      ## Собрать .NET решение локально
	cd backend && dotnet build -c Release

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

shell-api:          ## bash в контейнере API
	docker compose exec api sh

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
