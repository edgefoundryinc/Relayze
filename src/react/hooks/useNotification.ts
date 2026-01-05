import { useState, useCallback } from 'react'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

export function useNotification() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const showNotification = useCallback((
    type: Notification['type'],
    message: string,
    duration: number = 5000
  ) => {
    const id = `notification-${Date.now()}-${Math.random()}`
    
    const notification: Notification = {
      id,
      type,
      message,
      duration
    }

    setNotifications(prev => [...prev, notification])

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id))
      }, duration)
    }

    return id
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  return {
    notifications,
    showNotification,
    removeNotification,
    clearAll
  }
}

