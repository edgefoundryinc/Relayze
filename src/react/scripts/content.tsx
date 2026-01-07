import { useEffect, useRef, useState } from 'react'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import '../styles/content.css'
import { useWebhook } from '../contexts/WebhookContext'
import { useTheme } from '../contexts/ThemeContext'

// Register JSON language
hljs.registerLanguage('json', json)

function Content() {
  const { selectedEvent } = useWebhook()
  const { theme } = useTheme()
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body')
  const [viewMode, setViewMode] = useState<'pretty' | 'raw'>('pretty')
  // const [copied, setCopied] = useState(false) // COMMENTED OUT - for hover to copy feature
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

  // Display selected webhook data or empty state
  const displayData = activeTab === 'body' 
    ? parsedEvent?.payload 
    : parsedEvent?.headers

  // Load highlight.js theme based on current theme
  useEffect(() => {
    // Remove existing highlight.js stylesheet
    const existingLink = document.querySelector('link[data-hljs-theme]')
    if (existingLink) {
      existingLink.remove()
    }

    // Add new theme stylesheet
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.setAttribute('data-hljs-theme', 'true')
    link.href = theme === 'dark' 
      ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css'
      : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css'
    document.head.appendChild(link)
  }, [theme])

  // Re-highlight code when data changes
  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.removeAttribute('data-highlighted')
      hljs.highlightElement(codeRef.current)
    }
  }, [selectedEvent, activeTab, viewMode])

  // COMMENTED OUT - Copy code to clipboard (for hover to copy feature)
  // const handleCopyCode = async () => {
  //   const textToCopy = viewMode === 'pretty' 
  //     ? JSON.stringify(displayData, null, 2)
  //     : JSON.stringify(displayData)
  //   
  //   try {
  //     await navigator.clipboard.writeText(textToCopy)
  //     setCopied(true)
  //     setTimeout(() => setCopied(false), 2000)
  //   } catch (err) {
  //     console.error('Failed to copy:', err)
  //   }
  // }
  
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
        {/* TEMPORARILY COMMENTED OUT - HOVER TO COPY OVERLAY
        <div className="copy-overlay">
          <div className="copy-overlay-content">
            <svg 
              width="32" 
              height="32" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span className="copy-overlay-text">
              {copied ? 'Copied!' : 'Click to copy entire code'}
            </span>
          </div>
        </div> */}
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
