namespace Messenger.Shared.Kernel.Results;

public sealed record Error(string Code, string Description, ErrorType Type = ErrorType.Failure)
{
    public static readonly Error None = new(string.Empty, string.Empty, ErrorType.None);
    public static readonly Error NullValue = new("General.Null", "Null value was provided");

    public static Error NotFound(string resource) =>
        new($"{resource}.NotFound", $"{resource} was not found", ErrorType.NotFound);

    public static Error Unauthorized(string message = "Unauthorized access") =>
        new("Auth.Unauthorized", message, ErrorType.Unauthorized);

    public static Error Validation(string field, string message) =>
        new($"Validation.{field}", message, ErrorType.Validation);

    public static Error Conflict(string resource) =>
        new($"{resource}.Conflict", $"{resource} already exists", ErrorType.Conflict);

    public static Error Forbidden(string message = "Access denied") =>
        new("Auth.Forbidden", message, ErrorType.Forbidden);
}

public enum ErrorType { None, Failure, NotFound, Unauthorized, Validation, Conflict, Forbidden }
