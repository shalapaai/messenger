namespace Messenger.Modules.Files.Application;

// Проверка "magic bytes" — защита от подмены Content-Type: клиент может объявить
// произвольный заголовок (например, "application/pdf" для файла "invoice.pdf.exe"),
// а этот класс сверяет заявленный тип с реальным содержимым файла.
internal static class FileSignatureValidator
{
    private static readonly Dictionary<string, Func<byte[], bool>> Signatures =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = b => b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF,
            ["image/png"] = b => b.Length >= 4 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47,
            ["image/gif"] = b => b.Length >= 4 && b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8',
            ["image/webp"] = b => b.Length >= 12 && IsRiff(b) && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P',

            ["application/pdf"] = b => b.Length >= 4 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F',

            // ZIP-контейнер — общий формат для docx/xlsx/pptx/zip
            ["application/zip"] = IsZip,
            ["application/x-zip-compressed"] = IsZip,
            ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] = IsZip,
            ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] = IsZip,
            ["application/vnd.openxmlformats-officedocument.presentationml.presentation"] = IsZip,

            // Legacy Office (doc/xls/ppt) — OLE Compound File
            ["application/msword"] = IsOle,
            ["application/vnd.ms-excel"] = IsOle,
            ["application/vnd.ms-powerpoint"] = IsOle,

            ["application/x-rar-compressed"] = b => b.Length >= 4 && b[0] == 'R' && b[1] == 'a' && b[2] == 'r' && b[3] == '!',
            ["application/vnd.rar"] = b => b.Length >= 4 && b[0] == 'R' && b[1] == 'a' && b[2] == 'r' && b[3] == '!',
            ["application/x-7z-compressed"] = b => b.Length >= 6 && b[0] == 0x37 && b[1] == 0x7A && b[2] == 0xBC && b[3] == 0xAF && b[4] == 0x27 && b[5] == 0x1C,

            ["audio/mpeg"] = b => b.Length >= 3 && ((b[0] == 'I' && b[1] == 'D' && b[2] == '3') || (b[0] == 0xFF && (b[1] & 0xE0) == 0xE0)),
            ["audio/ogg"] = b => b.Length >= 4 && b[0] == 'O' && b[1] == 'g' && b[2] == 'g' && b[3] == 'S',
            ["audio/wav"] = b => b.Length >= 4 && IsRiff(b),

            ["video/webm"] = IsEbml,
            ["audio/webm"] = IsEbml,

            ["video/mp4"] = IsIsoBmff,
            ["audio/mp4"] = IsIsoBmff,
            ["video/quicktime"] = IsIsoBmff,
        };

    private static bool IsZip(byte[] b) => b.Length >= 4 && b[0] == 0x50 && b[1] == 0x4B && (b[2] == 0x03 || b[2] == 0x05 || b[2] == 0x07);
    private static bool IsOle(byte[] b) => b.Length >= 4 && b[0] == 0xD0 && b[1] == 0xCF && b[2] == 0x11 && b[3] == 0xE0;
    private static bool IsRiff(byte[] b) => b.Length >= 4 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F';
    private static bool IsEbml(byte[] b) => b.Length >= 4 && b[0] == 0x1A && b[1] == 0x45 && b[2] == 0xDF && b[3] == 0xA3;
    private static bool IsIsoBmff(byte[] b) => b.Length >= 8 && b[4] == 'f' && b[5] == 't' && b[6] == 'y' && b[7] == 'p';

    // text/plain, text/csv, image/svg+xml намеренно без сигнатуры — текстовые форматы без
    // бинарного magic number; для них полагаемся на то, что вложения отдаются как
    // application/octet-stream + Content-Disposition: attachment, а не рендерятся инлайн.

    /// <summary>
    /// Сверяет первые байты потока с ожидаемой сигнатурой для заявленного Content-Type.
    /// Возвращает true, если сигнатуры для типа нет (не проверяем) или содержимое ей соответствует.
    /// Перематывает поток обратно на исходную позицию перед возвратом.
    /// </summary>
    public static bool IsPlausible(Stream stream, string contentType)
    {
        if (!Signatures.TryGetValue(contentType, out var check))
            return true;

        if (!stream.CanSeek)
            return true;

        var originalPosition = stream.Position;
        var header = new byte[16];
        var totalRead = 0;
        while (totalRead < header.Length)
        {
            var read = stream.Read(header, totalRead, header.Length - totalRead);
            if (read == 0) break;
            totalRead += read;
        }
        stream.Position = originalPosition;

        if (totalRead < header.Length)
            Array.Resize(ref header, totalRead);

        return check(header);
    }
}
