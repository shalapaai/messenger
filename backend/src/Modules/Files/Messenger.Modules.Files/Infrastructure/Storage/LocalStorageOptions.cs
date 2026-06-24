namespace Messenger.Modules.Files.Infrastructure.Storage;

public sealed class LocalStorageOptions
{
    public const string SectionName = "FileStorage:Local";

    public string BasePath { get; set; } =
        Path.Combine(Path.GetTempPath(), "messenger-uploads");

    // Базовый URL для генерации ссылок (переопределяется через env в Docker)
    public string BaseUrl { get; set; } = "/api/files";
}
