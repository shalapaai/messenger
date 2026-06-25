export function isValidEmail(email: string) {
  const trimmedEmail = email.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)
}