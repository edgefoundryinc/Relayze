import '../styles/sidebar.css'
import { useState } from 'react'
import { useWebhook } from '../contexts/WebhookContext'
import { useNotifications } from '../contexts/NotificationContext'
import copyIcon from '../../assets/img/copy.png'
import hookIcon from '../../assets/img/hook.png'

function Sidebar() {
  const { slug, copied, generateSlug, copyToClipboard, events, wsConnected, wsError } = useWebhook()
  const { showNotification } = useNotifications()
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerateSlug = async () => {
    if (isGenerating) return // Prevent multiple clicks during animation
    
    setIsGenerating(true)
    
    // Delay the URL generation to show animation
    setTimeout(async () => {
      await generateSlug()
      setIsGenerating(false)
    }, 1500) // 1.5 second delay
  }

  return (
    <aside className="layout-sidebar">
      {/*<div className="sidebar-header">
        <h2>Postback Tester</h2>
        <p className="sidebar-description">
          Instantly generate a temporary endpoint to inspect HTTP requests and debug your webhooks.
        </p>
      </div>*/}

      <button 
        className={`btn-generate-url ${isGenerating ? 'generating' : ''}`} 
        onClick={handleGenerateSlug}
        disabled={isGenerating}
      >
        <img 
          src={hookIcon} 
          alt="Hook" 
          className={`icon-hook ${isGenerating ? 'icon-generating' : ''}`} 
        />
        {isGenerating ? 'Generating...' : 'GENERATE NEW HOOK'}
      </button>

      <div className="url-section">
        <div className="url-with-button">
          <div className="url-input-container">
            {isGenerating ? (
              <div className="url-input url-loading">
                <span className="loading-dots"></span>
              </div>
            ) : (
              <>
                <input 
                  type="text" 
                  className="url-input" 
                  value={`https://posthook.app/h/${slug}`}
                  readOnly
                />
                <button 
                  className={`btn-copy-url ${copied ? 'copied' : ''}`}
                  title={copied ? "Copied!" : "Copy"}
                  onClick={copyToClipboard}
                >
                  <img src={copyIcon} alt="Copy" className={`icon-copy ${copied ? 'icon-copied' : ''}`} />
                  {copied && <span className="copied-tooltip">Copied!</span>}
                </button>
              </>
            )}
          </div>
          {/*<button className="btn-send-test">
            <img src={playBtnIcon} alt="Play" className="icon-img" /> Send Test
          </button>*/}
        </div>
      </div>

      {/*<div className="url-controls-section">
        <select className="method-select">
          <option>POST</option>
          <option>GET</option>
          <option>PUT</option>
          <option>DELETE</option>
        </select>
      </div>*/}

      {/* WebSocket Status Section */}
      <div className="websocket-status-section">
        <div className="websocket-status-header">
          <span className="websocket-title">WebSocket</span>
        </div>
        <div className="websocket-status-items">
          <div className="websocket-status-item">
            <span className={`status-indicator ${wsConnected ? 'connected' : 'disconnected'}`}>
              {wsConnected ? '🟢' : '🔴'}
            </span>
            <span className="websocket-status-text">
              {wsConnected ? 'Connected' : wsError ? 'Disconnected' : 'Connecting...'}
            </span>
          </div>
          {wsConnected && (
            <div className="websocket-status-item websocket-url">
              <span className="websocket-label">URL:</span>
              <span className="websocket-url-text">
                wss://{window.location.host}/h/{slug}
              </span>
            </div>
          )}
          <div className="websocket-status-item">
            <span className="websocket-icon">📊</span>
            <span className="websocket-status-text">
              {events.length} {events.length === 1 ? 'event' : 'events'} received
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
