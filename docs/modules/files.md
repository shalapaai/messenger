# Модуль Files

Отвечает за **загрузку и хранение файлов**. Поддерживает два бэкенда: локальная файловая система и AWS S3. Выбор — через конфигурацию.

## Домен

### FileUpload

Сущность. Хранит метаданные о загруженном файле.

```csharp
public sealed class FileUpload : Entity<Guid>
{
    public string FileKey { get; }      // ключ в хранилище (путь или S3 key)
    public string OriginalName { get; } // оригинальное имя файла
    public string ContentType { get; }  // MIME-тип
    public long SizeBytes { get; }
    public Guid UploadedBy { get; }     // ID пользователя (auth.users)
    public DateTime UploadedAt { get; }
    public FileCategory Category { get; }

    public static FileUpload Create(
        Guid uploadedBy, string fileKey, string originalName,
        string contentType, long sizeBytes, FileCategory category);
}
```

```csharp
public enum FileCategory { Avatar, ChatAttachment, Document }
```

## Команды

### UploadAvatarCommand

Вызывается из модуля Users при загрузке аватара.

```
UploadAvatarCommand(UserId, FileContent, FileName, ContentType, FileSizeBytes)

    → validates:
        - size ≤ 5MB
        - ContentType is image (image/jpeg, image/png, image/gif, image/webp)
    → generates FileKey (userId + timestamp или UUID)
    → IFileStorage.UploadAsync(fileKey, stream)
    → creates FileUpload entity (Category = Avatar)
    → repository.Add(fileUpload)
    → unitOfWork.SaveChangesAsync()
    → returns fileUrl ("/api/files/{fileKey}")
```

## Эндпоинты

### `POST /api/files/avatar` 🔒

Прямая загрузка аватара (HTTP endpoint). Обёртка над UploadAvatarCommand.

```bash
curl -X POST http://localhost:8080/api/files/avatar \
  -H "Authorization: Bearer <token>" \
  -F "file=@photo.jpg"
```

Ответ:
```json
{ "url": "/api/files/avatars/user_123_1719312000.jpg" }
```

### `GET /api/files/{fileKey}`

Получить файл. Публичный доступ (без токена).

```bash
curl http://localhost:8080/api/files/avatars/user_123_1719312000.jpg
```

Возвращает содержимое файла с правильным `Content-Type`.

## Хранилище

### Локальное (по умолчанию)

Конфигурация в `appsettings.json`:
```json
{
  "FileStorage": {
    "Type": "Local",
    "Local": {
      "BasePath": "/app/uploads"
    }
  }
}
```

Файлы хранятся в директории `/app/uploads` внутри контейнера. В docker-compose смонтирован volume `uploads_data` для персистентности:

```yaml
volumes:
  - uploads_data:/app/uploads
```

Структура файлов:
```
/app/uploads/
└── avatars/
    ├── user_abc123_1719312000.jpg
    └── user_def456_1719315600.png
```

### AWS S3

Конфигурация:
```json
{
  "FileStorage": {
    "Type": "S3",
    "S3": {
      "BucketName": "messenger-files",
      "Region": "eu-central-1",
      "AccessKey": "...",
      "SecretKey": "..."
    }
  }
}
```

Переключение между Local и S3 меняет только `FileStorage:Type`. Остальной код не меняется.

## Абстракция IFileStorage

```csharp
public interface IFileStorage
{
    Task<string> UploadAsync(string key, Stream content, CancellationToken ct = default);
    Task<Stream> DownloadAsync(string key, CancellationToken ct = default);
    Task DeleteAsync(string key, CancellationToken ct = default);
}
```

`LocalFileStorage` и `S3FileStorage` реализуют этот интерфейс. Регистрация в DI выбирается по конфигурации в `FilesModule.Install`.

## Инфраструктура

### IFileRepository

```csharp
void Add(FileUpload fileUpload)
Task<FileUpload?> GetByFileKeyAsync(string fileKey, CancellationToken ct)
```

## Таблицы

| Таблица | Описание |
|---|---|
| `files.file_uploads` | Метаданные загруженных файлов |

Подробнее — [database.md](../database.md).
