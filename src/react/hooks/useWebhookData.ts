import { useState, useEffect, useCallback } from 'react'
import type { PostbackEvent } from '../../../types/types'
import { useWebSocket } from './useWebSocket'
import { useNotifications } from '../contexts/NotificationContext'

const STORAGE_KEY = 'pothook_slug'

export function useWebhookData() {
  const { showNotification } = useNotifications()
  // Generate initial slug on mount
  const generateInitialSlug = () => {
    const chars = '0123456789'
    let newSlug = ''
    for (let i = 0; i < 9; i++) {
      newSlug += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return newSlug
  }

  const [slug, setSlug] = useState<string>(() => {
    // Try to load from localStorage first, otherwise generate new
    const savedSlug = localStorage.getItem(STORAGE_KEY)
    return savedSlug || generateInitialSlug()
  })
  const [selectedEventIndex, setSelectedEventIndex] = useState<number>(0)
  const [copied, setCopied] = useState(false)

  // Use WebSocket hook instead of polling
  const { events, connected, error } = useWebSocket(slug)

  // Save slug to localStorage when it changes
  useEffect(() => {
    if (slug) {
      localStorage.setItem(STORAGE_KEY, slug)
    }
  }, [slug])

  // Auto-select first event when events first arrive
  useEffect(() => {
    if (events.length > 0 && selectedEventIndex === 0) {
      // Events are in DESC order (newest first), so index 0 is the latest
      setSelectedEventIndex(0)
    }
  }, [events.length, selectedEventIndex])

  // Generate random slug (9 digits)
  const generateSlug = useCallback(async () => {
    const chars = '0123456789'
    let newSlug = ''
    for (let i = 0; i < 9; i++) {
      newSlug += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    
    // Check if this slug would hit rate limit by doing a test POST
    try {
      const testResponse = await fetch(`https://posthook.app/h/${newSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _test: 'rate_limit_check' })
      })
      
      if (testResponse.status === 429) {
        const errorData = await testResponse.json()
        showNotification('warning', errorData.message || errorData.error, 8000)
        return // Don't switch to new slug
      }
    } catch (err) {
      console.error('Rate limit check failed:', err)
    }
    
    setSlug(newSlug)
    setSelectedEventIndex(0)
  }, [showNotification])

  // Copy URL to clipboard
  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`https://posthook.app/h/${slug}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [slug])

  // Get currently selected event
  const selectedEvent = events[selectedEventIndex] || null

  return {
    slug,
    events,
    selectedEvent,
    selectedEventIndex,
    isPolling: connected, // Renamed: connected status replaces polling status
    copied,
    generateSlug,
    copyToClipboard,
    setSelectedEventIndex,
    // Expose WebSocket-specific status for debugging
    wsConnected: connected,
    wsError: error,
  }
}

