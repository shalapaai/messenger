import { useEffect, useState, type ReactNode } from 'react'
import { apiClient } from '../api/apiClient'
import { FeaturesContext, defaultFeatures } from './featuresContextValue'

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState(defaultFeatures)

  useEffect(() => {
    apiClient
      .get<typeof defaultFeatures>('/auth/features')
      .then(r => setFeatures(r.data))
      .catch(() => {})
  }, [])

  return <FeaturesContext.Provider value={features}>{children}</FeaturesContext.Provider>
}
