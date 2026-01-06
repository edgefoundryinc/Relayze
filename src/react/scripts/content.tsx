import { useEffect, useRef, useState } from 'react'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import 'highlight.js/styles/atom-one-dark.css'
import '../styles/content.css'
import { useWebhook } from '../contexts/WebhookContext'

// Register JSON language
hljs.registerLanguage('json', json)

function Content() {
  const { selectedEvent } = useWebhook()
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body')
  const [viewMode, setViewMode] = useState<'pretty' | 'raw'>('pretty')
  const codeRef = useRef<HTMLElement>(null)

  // Parse headers and payload (handle stringified JSON)
  const parsedEvent = selectedEvent ? {
    ...selectedEvent,
    headers: typeof selectedEvent.headers === 'string' 
      ? JSON.parse(selectedEvent.headers) 
      : selectedEvent.headers,
    payload: typeof selectedEvent.payload === 'string'
      ? JSON.parse(selectedEvent.payload)
      : selectedEvent.payload,
  } : null

  // Re-highlight code when data changes
  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.removeAttribute('data-highlighted')
      hljs.highlightElement(codeRef.current)
    }
  }, [selectedEvent, activeTab, viewMode])

  // Display selected webhook data or empty state
  const displayData = activeTab === 'body' 
    ? parsedEvent?.payload 
    : parsedEvent?.headers
  
  const headerCount = parsedEvent?.headers ? Object.keys(parsedEvent.headers).length : 0

  if (!selectedEvent) {
    return (
      <main className="layout-content">
        <div className="content-header">
          <div className="request-info">
            <span className="request-path-large">Waiting for webhooks...</span>
          </div>
        </div>
        <div className="content-viewer">
          <div style={{ 
            display: 'flex', 
            fontColor: 'var(--color-primary)',
            fontSize: '96px',
            paddingTop: '200px',
            paddingRight: '100px',
            fontFamily: 'monospace',
            opacity: 0.2,
             }}>
            NO DATA YET
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="layout-content">
      <div className="content-header">
        <div className="request-info">

        </div>
      </div>

      <div className="content-tabs">
        <div className="tabs-group">
          <button 
            className={`tab ${activeTab === 'body' ? 'active' : ''}`}
            onClick={() => setActiveTab('body')}
          >
            Body
          </button>
          <button 
            className={`tab ${activeTab === 'headers' ? 'active' : ''}`}
            onClick={() => setActiveTab('headers')}
          >
            Headers <span className="tab-count">({headerCount})</span>
          </button>
        </div>
        
        <div className="viewer-controls">
          <button 
            className={`viewer-toggle ${viewMode === 'pretty' ? 'active' : ''}`}
            onClick={() => setViewMode('pretty')}
          >
            Pretty
          </button>
          <button 
            className={`viewer-toggle ${viewMode === 'raw' ? 'active' : ''}`}
            onClick={() => setViewMode('raw')}
          >
            Raw
          </button>
        </div>
      </div>

      <div className="content-viewer">
        <pre className="code-block"><code ref={codeRef} className="language-json">
          {viewMode === 'pretty' 
            ? JSON.stringify(displayData, null, 2)
            : JSON.stringify(displayData)}
        </code></pre>
      </div>
    </main>
  )
}

export default Content
