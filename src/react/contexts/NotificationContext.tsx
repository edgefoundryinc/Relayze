import { createContext, useContext, ReactNode } from 'react'
import { useNotification } from '../hooks/useNotification'
import { NotificationContainer } from '../components/Notification'
import type { Notification } from '../hooks/useNotification'

interface NotificationContextType {
  showNotification: (type: Notification['type'], message: string, duration?: number) => string
  removeNotification: (id: string) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { notifications, showNotification, removeNotification, clearAll } = useNotification()

  return (
    <NotificationContext.Provider value={{ showNotification, removeNotification, clearAll }}>
      {children}
      <NotificationContainer notifications={notifications} onClose={removeNotification} />
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}

