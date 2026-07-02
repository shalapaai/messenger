import { useContext } from 'react'
import { FeaturesContext } from './featuresContextValue'

export function useFeatures() {
  return useContext(FeaturesContext)
}
