import { useState, useEffect, useCallback, useRef } from 'react'
import type { PostbackEvent } from '../../../types/types'

interface UseWebSocketReturn {
  events: PostbackEvent[]
  connected: boolean
  error: string | null
  reconnect: () => void
}

/**
 * WebSocket hook for real-time webhook updates
 * 
 * Connects to Durable Object WebSocket endpoint and receives:
 * - History of events on initial connection
 * - Real-time events as they're posted
 * 
 * Features:
 * - Auto-reconnect on disconnect
 * - Error handling
 * - Connection status tracking
 */
export function useWebSocket(slug: string): UseWebSocketReturn {
  const [events, setEvents] = useState<PostbackEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptsRef = useRef<number>(0)
  const currentSlugRef = useRef<string>(slug)

  const connect = useCallback((targetSlug: string) => {
    if (!targetSlug) {
      return
    }
    
    try {
      // Determine WebSocket protocol based on current page protocol
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/h/${targetSlug}`
      
      const socket = new WebSocket(wsUrl)
      wsRef.current = socket
      
      socket.addEventListener('open', () => {
        setConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0 // Reset reconnect attempts on successful connection
      })
      
      socket.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data)
          
          // Handle history message (sent on connect)
          if (data.type === 'history') {
            // Events come from D1 in DESC order (newest first), keep that order
            setEvents(data.events)
          } 
          // Handle new event broadcast
          else {
            // Prepend new event to the beginning (newest first)
            setEvents(prev => [data, ...prev])
          }
        } catch (err) {
          // Silently handle parse errors
        }
      })
      
      socket.addEventListener('error', () => {
        setError('Connection error')
      })
      
      socket.addEventListener('close', (event) => {
        setConnected(false)
        wsRef.current = null
        
        // Don't auto-reconnect if manually closed (code 1000)
        if (event.code === 1000) {
          return
        }
        
        // Only auto-reconnect if we're still on the same slug
        if (currentSlugRef.current === targetSlug) {
          // Auto-reconnect with exponential backoff
          const attempt = reconnectAttemptsRef.current
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000) // Max 30 seconds
          
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectAttemptsRef.current++
            connect(targetSlug)
          }, delay)
        }
      })
    } catch (err) {
      setError('Failed to connect')
      setConnected(false)
    }
  }, [])

  // Clear events and reset state when slug changes
  useEffect(() => {
    currentSlugRef.current = slug
    
    // Immediately clear events for new slug
    setEvents([])
    setConnected(false)
    setError(null)
    reconnectAttemptsRef.current = 0
    
    // Close existing connection if any
    if (wsRef.current) {
      // Use code 1000 (normal closure) to signal intentional disconnect
      wsRef.current.close(1000, 'Switching to new slug')
      wsRef.current = null
    }
    
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    // Connect to new slug
    connect(slug)
    
    return () => {
      // Cleanup on unmount or slug change
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component cleanup')
        wsRef.current = null
      }
    }
  }, [slug, connect])

  const reconnect = useCallback(() => {
    connect(slug)
  }, [slug, connect])

  return {
    events,
    connected,
    error,
    reconnect
  }
}

