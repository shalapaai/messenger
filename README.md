# messenger

# Инструкция запуска

# 1. Клонировать и настроить окружение
git clone <repo-url> && cd messenger
cp .env.example .env           # заполнить пароли

# 2. Запустить инфраструктуру
make up-infra                  # PostgreSQL + Redis + pgAdmin
# ИЛИ всё включая API:
make up-build

# 3. Проверить health
make health
# postgres: (healthy)   redis: (healthy)

# 4. Применить миграции (первый запуск)
make migrate

# 5. Запустить API локально
cd backend
dotnet run --project src/Api/Messenger.Api
# → http://localhost:8080/swagger

# Проверка PostgreSQL:
make shell-db
# \dt auth.*   — таблицы модуля auth
# \dt messages.*

# Проверка Redis:
make shell-redis
# AUTH redis_dev
# KEYS *
# GET user:online:*

# pgAdmin: http://localhost:5050
# Email: admin@messenger.local / Password: admin
# Сервер: postgres:5432 / messenger / messenger_dev