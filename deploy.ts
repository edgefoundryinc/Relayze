// main worker file, keep light, put logic in core

import { createEnv, step } from './src/debug/trace'
import { handleRequest } from './src/shared/handler'
import type { StorageEnv } from './src/shared/storage'

// Import and export Durable Object classes
export { WebhookReceiver } from './src/shared/reciever'
export { RateLimiter } from './src/shared/rate-limiter'

// Cloudflare Workers types (available at runtime)
interface DurableObjectNamespace {
  idFromName(name: string): any
  get(id: any): any
}

interface Fetcher {
  fetch(request: Request): Promise<Response>
}

// Extend StorageEnv to include Durable Object bindings
export interface Env extends StorageEnv {
  WEBHOOK_RECEIVER: DurableObjectNamespace
  RATE_LIMITER: DurableObjectNamespace
  ASSETS: Fetcher // Cloudflare Pages/Assets binding for React app
  AUTH_SECRET?: string // Optional API key for unlimited webhook usage
}

export default 
{
  async fetch(request: Request, env: Env, context: any): Promise<Response> {
    const url = new URL(request.url)
    
    // Handle rate limit check endpoint
    if (url.pathname === '/h/rate-limit-check' && request.method === 'POST') {
      const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown'
      const userId = request.headers.get('x-clerk-user-id') || null
      
      // Generate temporary slug for check
      const tempSlug = 'check_' + Date.now()
      
      // Check with global rate limiter
      const id = env.RATE_LIMITER.idFromName('global')
      const stub = env.RATE_LIMITER.get(id)
      
      const response = await stub.fetch('https://internal/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, slug: tempSlug, userId, checkOnly: true })
      })
      
      const result = await response.json()
      
      return new Response(JSON.stringify(result), {
        status: result.allowed ? 200 : 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
    
    // Check if this request should be routed to a Durable Object
    const isWebSocket = request.headers.get('Upgrade') === 'websocket'
    const isWebhookPath = url.pathname.startsWith('/h/')
    
    // Route WebSocket connections, POST webhooks, and GET requests to /h/{slug} to Durable Objects
    if ((isWebSocket || request.method === 'POST' || (request.method === 'GET' && isWebhookPath)) && isWebhookPath) {
      console.log('[WORKER] Routing to Durable Object:', url.pathname)
      
      // Extract slug from path (/h/{slug})
      const pathParts = url.pathname.split('/')
      const slug = pathParts[2]
      
      if (!slug) {
        return new Response(JSON.stringify({ error: 'Invalid slug' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      // Get or create Durable Object for this slug
      const id = env.WEBHOOK_RECEIVER.idFromName(slug)
      const stub = env.WEBHOOK_RECEIVER.get(id)
      
      // Forward request to Durable Object
      return stub.fetch(request)
    }
    
    // Handle other routes (GET /events, /trace/, GET /post/) with existing handler
    // Create trace context for non-DO requests
    let ctx = createEnv({
      ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || undefined,
      ua: request.headers.get('user-agent') || undefined,
      headers: Object.fromEntries(request.headers.entries())
    })

    // Trace: receive request
    ctx = step(ctx, 'receive', 'enter')
    
    // Check URL for special endpoints
    const isFeedRequest = url.pathname.includes('/feed')
    const isTraceRequest = url.pathname.startsWith('/trace/')
    const isEventsRequest = url.pathname === '/events'
    const isPostRequest = url.pathname.startsWith('/post/')
    
    // Allow GET for post reads, feed, trace, and events
    if (request.method === 'GET' && (isPostRequest || isFeedRequest || isTraceRequest || isEventsRequest)) {
      // Valid request - pass to API handler
      ctx = step(ctx, 'receive', 'exit')
      console.log(ctx)
      return handleRequest(request, env)
    }
    
    // Serve React app for all other GET requests
    if (request.method === 'GET') {
      try {
        // Try to fetch the requested asset (JS, CSS, images, etc.)
        const assetResponse = await env.ASSETS.fetch(request)
        
        // If asset found, return it
        if (assetResponse.status < 400) {
          return assetResponse
        }
        
        // If asset not found, return index.html (for React Router SPA routes)
        // This handles routes like /docs, /pricing, /login, /signup, etc.
        const indexRequest = new Request(new URL('/', request.url), request)
        return env.ASSETS.fetch(indexRequest)
      } catch (error) {
        console.error('[WORKER] Asset serving error:', error)
        return new Response('Error loading page', { 
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        })
      }
    }
    
    // Only reject if it's not a GET request and not a valid API endpoint
    ctx = step(ctx, 'receive', 'error', { 
      error_code: 'METHOD_NOT_ALLOWED', 
      reason: `Method ${request.method} not supported for ${url.pathname}` 
    })
    console.log(ctx)
    return new Response('Method not allowed', {
      status: 405,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
}