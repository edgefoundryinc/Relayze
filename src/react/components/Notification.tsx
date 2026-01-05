import { useEffect } from 'react'
import type { Notification as NotificationType } from '../hooks/useNotification'
import '../styles/notification.css'

interface NotificationProps {
  notification: NotificationType
  onClose: (id: string) => void
}

export function Notification({ notification, onClose }: NotificationProps) {
  useEffect(() => {
    // Auto-close animation at 90% of duration
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        onClose(notification.id)
      }, notification.duration * 0.9)
      
      return () => clearTimeout(timer)
    }
  }, [notification, onClose])

  const getIcon = () => {
    switch (notification.type) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'info': return 'ℹ️'
      default: return '📢'
    }
  }

  return (
    <div className={`notification notification-${notification.type}`}>
      <span className="notification-icon">{getIcon()}</span>
      <span className="notification-message">{notification.message}</span>
      <button 
        className="notification-close"
        onClick={() => onClose(notification.id)}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  )
}

interface NotificationContainerProps {
  notifications: NotificationType[]
  onClose: (id: string) => void
}

export function NotificationContainer({ notifications, onClose }: NotificationContainerProps) {
  if (notifications.length === 0) return null

  return (
    <div className="notification-container">
      {notifications.map(notification => (
        <Notification
          key={notification.id}
          notification={notification}
          onClose={onClose}
        />
      ))}
    </div>
  )
}

