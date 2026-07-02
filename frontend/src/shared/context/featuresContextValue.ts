import { createContext } from 'react'

export type AuthFeatures = {
  passwordResetEnabled: boolean
  twoFactorEnabled: boolean
}

export const defaultFeatures: AuthFeatures = {
  passwordResetEnabled: false,
  twoFactorEnabled: false,
}

export const FeaturesContext = createContext<AuthFeatures>(defaultFeatures)
