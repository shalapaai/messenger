namespace Messenger.Modules.Auth.Presentation;

public sealed record RegisterRequest(string Email, string Password);
public sealed record VerifyOtpRequest(string Email, string Code);
public sealed record RefreshTokenRequest(string Token);
public sealed record LogoutRequest(string RefreshToken);
public sealed record ForgotPasswordRequest(string Email);
public sealed record ResetPasswordRequest(string Email, string Code, string NewPassword);
public sealed record AuthFeaturesDto(bool PasswordResetEnabled, bool TwoFactorEnabled);
