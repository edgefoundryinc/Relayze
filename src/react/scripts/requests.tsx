import '../styles/requests.css'
import { useWebhook } from '../contexts/WebhookContext'

function Requests() {
  const { events, selectedEventIndex, setSelectedEventIndex, isPolling } = useWebhook()

  const formatTimeAgo = (timestamp: string) => {
    const now = Date.now()
    const eventTime = new Date(timestamp).getTime()
    const diffMs = now - eventTime
    
    if (diffMs < 60000) return 'Just now'
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`
    return `${Math.floor(diffMs / 86400000)}d ago`
  }

  const truncatePayload = (payload: any) => {
    if (!payload) return 'No body content'
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload)
    return payloadStr.length > 50 ? payloadStr.substring(0, 50) + '...' : payloadStr
  }

  return (
    <section className="layout-requests">
      <div className="layout-requests-inner">
        <div className="requests-header">
          <span className="requests-title">REQUESTS</span>
          <span className="requests-count">{events.length} / 100 {isPolling && '• Live'}</span>
        </div>
        <div className="requests-list">
          {events.length === 0 ? (
            <div className="request-line" style={{ opacity: 0.6 }}>
              Waiting for webhooks...
            </div>
          ) : (
            events.map((event, index) => (
              <div 
                key={event.id}
                className={`request-line ${index === selectedEventIndex ? 'active' : ''}`}
                onClick={() => setSelectedEventIndex(index)}
              >
                ({formatTimeAgo(event.timestamp)}) {event.method} {event.path || '/'} {truncatePayload(event.payload)}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

export default Requests

