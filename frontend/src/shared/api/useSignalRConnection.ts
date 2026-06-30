import { useEffect } from 'react'
import { signalR } from './signalrClient'
import { useConnectionStore } from './connectionStore'

export function useSignalRConnection() {
  const setStatus = useConnectionStore((s) => s.setStatus)

  useEffect(() => {
    signalR.onReconnecting(() => setStatus('reconnecting'))
    signalR.onReconnected(()  => setStatus('connected'))
    signalR.onDisconnected(() => setStatus('disconnected'))

    signalR.connect()
      .then(() => setStatus('connected'))
      .catch(() => setStatus('disconnected'))

    return () => {
      signalR.disconnect()
    }
  }, [setStatus])
}
