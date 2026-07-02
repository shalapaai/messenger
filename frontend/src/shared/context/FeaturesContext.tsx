import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiClient } from '../api/apiClient'

type AuthFeatures = {
  passwordResetEnabled: boolean
  twoFactorEnabled: boolean
}

const defaultFeatures: AuthFeatures = {
  passwordResetEnabled: false,
  twoFactorEnabled: false,
}

const FeaturesContext = createContext<AuthFeatures>(defaultFeatures)

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<AuthFeatures>(defaultFeatures)

  useEffect(() => {
    apiClient
      .get<AuthFeatures>('/auth/features')
      .then(r => setFeatures(r.data))
      .catch(() => {})
  }, [])

  return <FeaturesContext.Provider value={features}>{children}</FeaturesContext.Provider>
}

export function useFeatures() {
  return useContext(FeaturesContext)
}
