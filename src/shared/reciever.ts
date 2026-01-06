/**
 * Durable Object - WebSocket Receiver
 * 
 * Manages WebSocket connections per slug and broadcasts webhook events in real-time.
 * Integrates with D1 database for persistent storage and trace framework for debugging.
 */

import { StorageEnv, storeEvent, queryEvents } from './storage'
import { createEnv, step } from '../debug/trace'
import type { Context, PostbackEvent } from '../../types/types'

// Cloudflare Workers types (available at runtime)
declare const WebSocketPair: any
interface DurableObjectState {
  storage: any
  acceptWebSocket(ws: any): void
}
interface DurableObjectNamespace {
  idFromName(name: string): any
  get(id: any): any
}
interface ResponseInit {
  status?: number
  headers?: Record<string, string> | Headers
  webSocket?: any
}

// Extended env with rate limiter and optional auth secret
export interface WebhookEnv extends StorageEnv {
  RATE_LIMITER: DurableObjectNamespace
  AUTH_SECRET?: string // Optional API key for unlimited usage
}

export class WebhookReceiver {
  state: DurableObjectState
  env: WebhookEnv
  sessions: Set<WebSocket> // For connection count logging
  
  constructor(state: DurableObjectState, env: WebhookEnv) {
    this.state = state
    this.env = env
    this.sessions = new Set()
    
    console.log('[DO] WebhookReceiver initialized')
  }
  
  // WebSocket close handler (called automatically by DO runtime)
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    console.log(`[DO] WebSocket closed: code=${code}, reason=${reason}`)
    this.sessions.delete(ws as any)
  }
  
  // WebSocket error handler (called automatically by DO runtime)
  async webSocketError(ws: WebSocket, error: any) {
    console.log('[DO] WebSocket error:', error)
    this.sessions.delete(ws as any)
  }
  
  /**
   * Extract user ID from request headers (Clerk or API key)
   */
  private getUserId(request: Request): string | null {
    // Check for API key auth first (for unlimited usage)
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '')
    if (apiKey && this.env.AUTH_SECRET && apiKey === this.env.AUTH_SECRET) {
      return 'api_authenticated' // Return special user ID for API auth
    }
    
    // Clerk authentication
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ') && !this.env.AUTH_SECRET) {
      // You'd decode the JWT here in production
      return request.headers.get('x-clerk-user-id') || null
    }
    return request.headers.get('x-clerk-user-id') || null
  }
  
  /**
   * Get client IP address
   */
  private getIP(request: Request): string {
    return request.headers.get('cf-connecting-ip') 
      || request.headers.get('x-forwarded-for') 
      || 'unknown'
  }
  
  /**
   * Check global rate limit (2 slugs per IP for anonymous users)
   * Returns Response if rate limited, null if OK to proceed
   */
  private async checkGlobalRateLimit(request: Request, pathname: string): Promise<Response | null> {
    const userId = this.getUserId(request)
    const ip = this.getIP(request)
    
    // Extract slug from pathname (/h/123456 -> 123456)
    const slug = pathname.split('/')[2]
    
    // Get global rate limiter DO (singleton)
    const id = this.env.RATE_LIMITER.idFromName('global')
    const stub = this.env.RATE_LIMITER.get(id)
    
    // Check with global rate limiter
    const response = await stub.fetch('https://internal/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, slug, userId })
    })
    
    const result = await response.json() as {
      allowed: boolean
      slugCount: number
      slugs?: string[]
      reason?: string
      resetAt?: number
    }
    
    if (!result.allowed) {
      console.log(`[DO] ❌ Global rate limit exceeded for IP ${ip}`)
      
      const resetDate = result.resetAt ? new Date(result.resetAt).toISOString() : 'unknown'
      
      return new Response(JSON.stringify({
        error: 'Slug creation limit exceeded',
        limit: 2,
        current: result.slugCount,
        slugs: result.slugs,
        message: result.reason || 'You have reached the maximum number of webhook URLs for anonymous users.',
        resetAt: resetDate,
        suggestion: 'Sign in to create unlimited webhook URLs.'
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(24 * 60 * 60), // 24 hours in seconds
          'X-RateLimit-Limit': '2',
          'X-RateLimit-Remaining': '0',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
    
    console.log(`[DO] ✅ Global rate limit OK: ${result.slugCount}/2 slugs used`)
    
    return null // OK to proceed
  }
  
  /**
   * Check rate limit before processing webhook
   * Returns Response if rate limited, null if OK to proceed
   */
  private async checkRateLimit(request: Request): Promise<Response | null> {
    const userId = this.getUserId(request)
    const ip = this.getIP(request)
    const identifier = userId || ip
    
    // Different limits for authenticated vs anonymous
    const limit = userId ? 100 : 25
    const window = 60 // seconds
    
    // Rate limit key: includes identifier and current minute
    const currentMinute = Math.floor(Date.now() / (window * 1000))
    const key = `ratelimit:${identifier}:${currentMinute}`
    
    // Get current count
    const count = ((await this.state.storage.get(key)) as number) || 0
    
    console.log(`[DO] Rate limit check: ${identifier} (${userId ? 'authenticated' : 'anonymous'}) - ${count}/${limit}`)
    
    // Check if exceeded
    if (count >= limit) {
      console.log(`[DO] ❌ Rate limit exceeded for ${identifier}`)
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        limit,
        window: `${window} seconds`,
        current: count,
        retryAfter: window,
        message: userId 
          ? `Authenticated users are limited to ${limit} requests per minute.`
          : `Anonymous users are limited to ${limit} requests per minute. Sign in for higher limits.`
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(window),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + window),
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
    
    // Increment counter with auto-expiration
    await this.state.storage.put(key, count + 1, {
      expirationTtl: window // Auto-cleanup after window expires
    })
    
    console.log(`[DO] ✅ Rate limit OK: ${count + 1}/${limit}`)
    
    return null // OK to proceed
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    
    console.log(`[DO] ${request.method} ${url.pathname}`)
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }
    
    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request, url.pathname)
    }
    
    // Handle POST webhook
    if (request.method === 'POST') {
      return this.handleWebhook(request, url.pathname)
    }
    
    return new Response('Method not allowed', { status: 405 })
  }
  
  async handleWebSocket(request: Request, pathname: string): Promise<Response> {
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [any, any]
    
    this.state.acceptWebSocket(server)
    this.sessions.add(server as WebSocket)
    
    console.log(`[DO] ✅ WebSocket connected (${this.sessions.size} total sessions)`)
    
    // Send history from D1 to new client
    try {
      const events = await queryEvents(this.env, { pathname, limit: 50, offset: 0 })
      
      // Transform stored events to PostbackEvent format
      const formattedEvents = events.map(e => ({
        id: e.id,
        trace_id: e.trace_id,
        timestamp: e.timestamp,
        method: e.method as any,
        headers: JSON.parse(e.headers),
        payload: JSON.parse(e.payload),
        path: e.pathname,
        ip: e.ip,
        user_agent: e.user_agent
      }))
      
      const historyMessage = {
        type: 'history',
        events: formattedEvents
      }
      
      server.send(JSON.stringify(historyMessage))
      console.log(`[DO] 📤 Sent ${formattedEvents.length} events to new client`)
    } catch (err) {
      console.error('[DO] Failed to load history:', err)
      // Send empty history on error
      server.send(JSON.stringify({ type: 'history', events: [] }))
    }
    
    // Note: WebSocket close/error is handled by webSocketClose() and webSocketError() handlers
    // No need for manual event listeners when using DO hibernation

    return new Response(null, {
      status: 101,
      webSocket: client
    } as ResponseInit)
  }
  
  async handleWebhook(request: Request, pathname: string): Promise<Response> {
    // Global rate limit check FIRST (for anonymous users)
    const globalRateLimitResponse = await this.checkGlobalRateLimit(request, pathname)
    if (globalRateLimitResponse) {
      return globalRateLimitResponse
    }
    
    // Per-slug rate limiting check
    const rateLimitResponse = await this.checkRateLimit(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }
    
    // Create trace context
    let ctx: Context = createEnv({
      ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || undefined,
      ua: request.headers.get('user-agent') || undefined,
      headers: Object.fromEntries(request.headers.entries())
    })
    
    ctx = step(ctx, 'receive', 'enter')
    
    const startTime = Date.now()
    const contentType = request.headers.get('content-type') || ''
    const headers = Object.fromEntries(request.headers.entries())
    let payload: any
    
    try {
      const body = await request.text()
      
      // Parse based on content type
      if (contentType.includes('application/json')) {
        payload = JSON.parse(body)
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        payload = parseUrlEncoded(body)
      } else {
        // Try JSON first, fallback to URL-encoded
        try {
          payload = JSON.parse(body)
        } catch {
          payload = parseUrlEncoded(body)
        }
      }
      
      ctx = step(ctx, 'receive', 'exit')
    } catch (err) {
      ctx = step(ctx, 'receive', 'error', { 
        error_code: 'PARSE_FAILED',
        reason: err instanceof Error ? err.message : String(err)
      })
      
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Invalid payload',
        trace_id: ctx.trace_id
      }), { 
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
    
    const processingTimeMs = Date.now() - startTime
    
    // Store to D1 database
    try {
      ctx = await storeEvent(ctx, this.env, {
        url: request.url,
        method: request.method,
        pathname,
        headers,
        payload,
        contentType,
        processingTimeMs,
        ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      })
    } catch (err) {
      console.error('[DO] Storage failed:', err)
      // Continue even if storage fails
    }
    
    // Create event for broadcast
    const event: PostbackEvent = {
      id: ctx.trace_id,
      trace_id: ctx.trace_id,
      timestamp: new Date().toISOString(),
      method: request.method as any,
      headers,
      payload,
      path: pathname,
      ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || undefined,
      user_agent: request.headers.get('user-agent') || undefined
    }
    
    // Broadcast to all connected WebSocket clients
    // Use state.getWebSockets() to get hibernated connections
    const connections = (this.state as any).getWebSockets()
    const message = JSON.stringify(event)
    let broadcastCount = 0
    
    console.log(`[DO] Found ${connections.length} WebSocket connections`)
    
    for (const ws of connections) {
      try {
        ws.send(message)
        broadcastCount++
      } catch (err) {
        console.error('[DO] Failed to broadcast:', err)
        // Connection will be auto-cleaned by DO runtime
      }
    }
    
    console.log(`[DO] 📡 Broadcasted to ${broadcastCount} client(s)`)
    
    return new Response(JSON.stringify({ 
      ok: true,
      trace_id: ctx.trace_id,
      broadcastCount,
      timestamp: event.timestamp
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

/**
 * Parse URL-encoded form data
 */
function parseUrlEncoded(body: string): Record<string, string> {
  const params = new URLSearchParams(body)
  const result: Record<string, string> = {}
  
  for (const [key, value] of params.entries()) {
    result[key] = value
  }
  
  return result
}

