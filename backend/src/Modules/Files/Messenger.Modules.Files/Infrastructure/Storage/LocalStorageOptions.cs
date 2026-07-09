namespace Messenger.Modules.Files.Infrastructure.Storage;

public sealed class LocalStorageOptions
{
    public const string SectionName = "FileStorage:Local";

    public string BasePath { get; set; } =
        Path.Combine(Path.GetTempPath(), "messenger-uploads");

    public string BaseUrl { get; set; } = "/api/files";
}
