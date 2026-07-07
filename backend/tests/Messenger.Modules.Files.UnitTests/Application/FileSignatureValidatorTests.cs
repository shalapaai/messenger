namespace Messenger.Modules.Files.UnitTests.Application;

using FluentAssertions;
using Messenger.Modules.Files.Application;

public sealed class FileSignatureValidatorTests
{
    public static IEnumerable<object[]> KnownSignatures()
    {
        yield return new object[]
        {
            "image/jpeg",
            new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46 },
            new byte[] { 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "image/png",
            new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A },
            new byte[] { 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "image/gif",
            "GIF89a"u8.ToArray(),
            "NOTGIF!"u8.ToArray()
        };
        yield return new object[]
        {
            "image/webp",
            Concat("RIFF"u8.ToArray(), new byte[] { 0x00, 0x00, 0x00, 0x00 }, "WEBP"u8.ToArray()),
            Concat("RIFF"u8.ToArray(), new byte[] { 0x00, 0x00, 0x00, 0x00 }, "JFIF"u8.ToArray())
        };
        yield return new object[]
        {
            "application/pdf",
            "%PDF-1.4"u8.ToArray(),
            "NOT-PDF!"u8.ToArray()
        };
        yield return new object[]
        {
            "application/zip",
            new byte[] { 0x50, 0x4B, 0x03, 0x04 },
            new byte[] { 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "application/x-zip-compressed",
            new byte[] { 0x50, 0x4B, 0x05, 0x06 },
            new byte[] { 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            new byte[] { 0x50, 0x4B, 0x03, 0x04 },
            new byte[] { 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            new byte[] { 0x50, 0x4B, 0x07, 0x08 },
            new byte[] { 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            new byte[] { 0x50, 0x4B, 0x03, 0x04 },
            new byte[] { 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "application/msword",
            new byte[] { 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1 },
            new byte[] { 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "application/vnd.ms-excel",
            new byte[] { 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1 },
            new byte[] { 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "application/vnd.ms-powerpoint",
            new byte[] { 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1 },
            new byte[] { 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "application/x-rar-compressed",
            new byte[] { 0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00 },
            new byte[] { 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "application/vnd.rar",
            new byte[] { 0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01, 0x00 },
            new byte[] { 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "application/x-7z-compressed",
            new byte[] { 0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C },
            new byte[] { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "audio/mpeg",
            "ID3"u8.ToArray(),
            new byte[] { 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "audio/mpeg",
            new byte[] { 0xFF, 0xFB, 0x90, 0x00 },
            new byte[] { 0xFF, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "audio/ogg",
            "OggS"u8.ToArray(),
            new byte[] { 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "audio/wav",
            "RIFF"u8.ToArray(),
            "JUNK"u8.ToArray()
        };
        yield return new object[]
        {
            "video/webm",
            new byte[] { 0x1A, 0x45, 0xDF, 0xA3 },
            new byte[] { 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "audio/webm",
            new byte[] { 0x1A, 0x45, 0xDF, 0xA3 },
            new byte[] { 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "video/mp4",
            Concat(new byte[] { 0x00, 0x00, 0x00, 0x18 }, "ftyp"u8.ToArray(), "isom"u8.ToArray()),
            new byte[] { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "audio/mp4",
            Concat(new byte[] { 0x00, 0x00, 0x00, 0x18 }, "ftyp"u8.ToArray(), "M4A "u8.ToArray()),
            new byte[] { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 }
        };
        yield return new object[]
        {
            "video/quicktime",
            Concat(new byte[] { 0x00, 0x00, 0x00, 0x14 }, "ftyp"u8.ToArray(), "qt  "u8.ToArray()),
            new byte[] { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 }
        };
    }

    private static byte[] Concat(params byte[][] parts) =>
        parts.SelectMany(p => p).ToArray();

    [Theory]
    [MemberData(nameof(KnownSignatures))]
    public void IsPlausible_WithCorrectSignature_ReturnsTrue(string contentType, byte[] correctBytes, byte[] wrongBytes)
    {
        _ = wrongBytes;
        using var stream = new MemoryStream(correctBytes);

        var result = FileSignatureValidator.IsPlausible(stream, contentType);

        result.Should().BeTrue();
    }

    [Theory]
    [MemberData(nameof(KnownSignatures))]
    public void IsPlausible_WithWrongSignature_ReturnsFalse(string contentType, byte[] correctBytes, byte[] wrongBytes)
    {
        _ = correctBytes;
        using var stream = new MemoryStream(wrongBytes);

        var result = FileSignatureValidator.IsPlausible(stream, contentType);

        result.Should().BeFalse();
    }

    [Fact]
    public void IsPlausible_WithUnregisteredContentType_ReturnsTrueRegardlessOfContent()
    {
        using var stream = new MemoryStream(new byte[] { 0x00, 0x01, 0x02, 0x03 });

        var result = FileSignatureValidator.IsPlausible(stream, "text/plain");

        result.Should().BeTrue();
    }

    [Fact]
    public void IsPlausible_WithUnknownContentType_ReturnsTrue()
    {
        using var stream = new MemoryStream(new byte[] { 0xDE, 0xAD, 0xBE, 0xEF });

        var result = FileSignatureValidator.IsPlausible(stream, "application/x-totally-made-up");

        result.Should().BeTrue();
    }

    [Fact]
    public void IsPlausible_RestoresOriginalStreamPosition()
    {
        var png = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A };
        var buffer = new byte[20];
        Array.Copy(png, 0, buffer, 2, png.Length);
        using var stream = new MemoryStream(buffer);
        stream.Position = 2;

        var result = FileSignatureValidator.IsPlausible(stream, "image/png");

        result.Should().BeTrue();
        stream.Position.Should().Be(2);
    }

    [Fact]
    public void IsPlausible_WithNonSeekableStream_ReturnsTrueWithoutReading()
    {
        using var stream = new NonSeekableStream(new byte[] { 0x00, 0x00, 0x00, 0x00 });

        var result = FileSignatureValidator.IsPlausible(stream, "image/png");

        result.Should().BeTrue();
        stream.ReadCallCount.Should().Be(0);
    }

    private sealed class NonSeekableStream : Stream
    {
        private readonly MemoryStream _inner;

        public NonSeekableStream(byte[] data) => _inner = new MemoryStream(data);

        public int ReadCallCount { get; private set; }

        public override bool CanRead  => true;
        public override bool CanSeek  => false;
        public override bool CanWrite => false;
        public override long Length   => _inner.Length;

        public override long Position
        {
            get => _inner.Position;
            set => throw new NotSupportedException();
        }

        public override void Flush() => _inner.Flush();

        public override int Read(byte[] buffer, int offset, int count)
        {
            ReadCallCount++;
            return _inner.Read(buffer, offset, count);
        }

        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();

        public override void SetLength(long value) => throw new NotSupportedException();

        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

        protected override void Dispose(bool disposing)
        {
            if (disposing) _inner.Dispose();
            base.Dispose(disposing);
        }
    }
}
