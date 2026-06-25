import { describe, expect, it } from 'vitest'
import { isValidEmail } from './isValidEmail'

describe('isValidEmail', () => {
  it('returns true for valid emails', () => {
    expect(isValidEmail('test@mail.ru')).toBe(true)
    expect(isValidEmail('user.name@example.com')).toBe(true)
    expect(isValidEmail('user-name@example.com')).toBe(true)
    expect(isValidEmail('user+tag@example.com')).toBe(true)
  })

  it('returns true when valid email has spaces around it', () => {
    expect(isValidEmail('  test@mail.ru  ')).toBe(true)
  })

  it('returns false for invalid emails', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('test')).toBe(false)
    expect(isValidEmail('test@')).toBe(false)
    expect(isValidEmail('test@mail')).toBe(false)
    expect(isValidEmail('test@mail.r')).toBe(false)
    expect(isValidEmail('test mail@mail.ru')).toBe(false)
    expect(isValidEmail('test@mail ru')).toBe(false)
  })
})