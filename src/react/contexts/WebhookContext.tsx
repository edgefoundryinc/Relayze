import { createContext, useContext, ReactNode } from 'react'
import { useWebhookData } from '../hooks/useWebhookData'

const WebhookContext = createContext<ReturnType<typeof useWebhookData> | null>(null)

export function WebhookProvider({ children }: { children: ReactNode }) {
  const webhookData = useWebhookData()
  return (
    <WebhookContext.Provider value={webhookData}>
      {children}
    </WebhookContext.Provider>
  )
}

export function useWebhook() {
  const context = useContext(WebhookContext)
  if (!context) {
    throw new Error('useWebhook must be used within WebhookProvider')
  }
  return context
}

