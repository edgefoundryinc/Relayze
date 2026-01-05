// main worker file, keep light, put logic in core

import { createEnv, step } from './src/debug/trace'
import { handleRequest } from './src/shared/handler'
import type { StorageEnv } from './src/shared/storage'

// Import and export Durable Object classes
export { WebhookReceiver } from './src/shared/reciever'
export { RateLimiter } from './src/shared/rate-limiter'

// Extend StorageEnv to include Durable Object bindings
export interface Env extends StorageEnv {
  WEBHOOK_RECEIVER: DurableObjectNamespace
  RATE_LIMITER: DurableObjectNamespace
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
    const isWebhookPath = url.pathname.startsWith('/h/') || url.pathname.startsWith('/post/')
    
    // Route WebSocket connections and POST webhooks to Durable Objects
    if ((isWebSocket || request.method === 'POST') && isWebhookPath) {
      console.log('[WORKER] Routing to Durable Object:', url.pathname)
      
      // Extract slug from path (/h/{slug} or /post/{slug})
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
      // Valid request
      ctx = step(ctx, 'receive', 'exit')
      console.log(ctx)
    } else {
      // Invalid method
      ctx = step(ctx, 'receive', 'error', { 
        error_code: 'METHOD_NOT_ALLOWED', 
        reason: `Method ${request.method} not supported for ${url.pathname}` 
      })
      console.log(ctx)
      return new Response('Unauthorized Method', {
        status: 405,
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    // Pass to handler with env for D1 access
    return handleRequest(request, env)
  }
}