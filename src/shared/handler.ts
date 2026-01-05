/**
 * Handler - Webhook Ingress
 * 
 * Entry point for webhook testing.
 * Parses incoming POST requests and returns acknowledgment.
 */

import { createEnv, step, replay } from '../debug/trace'
import type { Context } from './types'
import { storeEvent, queryEvents, type StorageEnv } from './storage'

// In-memory storage removed - using D1 as source of truth

export async function handleRequest(request: Request, env: StorageEnv): Promise<Response> {
  const startTime = Date.now()
  const timestamp = new Date().toISOString()
  let url = new URL(request.url)
  
  // Map /h/{slug} to /post/{slug} for compatibility
  if (url.pathname.startsWith('/h/')) {
    const newPathname = url.pathname.replace('/h/', '/post/')
    url = new URL(url.origin + newPathname + url.search)
  }
  
  // Handle database query endpoint: GET /events
  if (request.method === 'GET' && url.pathname === '/events') {
    try {
      const searchParams = url.searchParams
      const pathname = searchParams.get('pathname') || undefined
      const trace_id = searchParams.get('trace_id') || undefined
      const limit = parseInt(searchParams.get('limit') || '50')
      const offset = parseInt(searchParams.get('offset') || '0')
      
      const events = await queryEvents(env, { pathname, trace_id, limit, offset })
      
      return new Response(JSON.stringify({ 
        ok: true,
        count: events.length,
        limit,
        offset,
        filters: { pathname, trace_id },
        events
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Failed to query events',
        reason: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
  
  // Handle trace replay endpoint: GET /trace/:trace_id
  if (request.method === 'GET' && url.pathname.startsWith('/trace/')) {
    const traceId = url.pathname.split('/')[2]
    if (!traceId) {
      return new Response(JSON.stringify({ error: 'trace_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    try {
      const traceRecords = replay(traceId)
      if (traceRecords.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'Trace not found',
          trace_id: traceId,
          note: 'Traces are stored in-memory and cleared on worker restart'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ 
        trace_id: traceId,
        records: traceRecords,
        count: traceRecords.length
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Failed to replay trace',
        reason: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
  
  // RSS feed functionality removed - was for outdated XML component
  
  // Handle GET /post/{slug} - return events from D1
  if (request.method === 'GET' && url.pathname.startsWith('/post/')) {
    // Query events from D1 database (persistent storage)
    const events = await queryEvents(env, { pathname: url.pathname, limit: 50, offset: 0 })
    
    return new Response(JSON.stringify(events, null, 2), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
  
  // Create trace context
  let ctx: Context = createEnv({
    ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || undefined,
    ua: request.headers.get('user-agent') || undefined,
    headers: Object.fromEntries(request.headers.entries())
  })
  
  // Only accept paths starting with /post (e.g., /post/user-slug)
  if (!url.pathname.startsWith('/post')) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' }
    })
  }

  // Capture request headers
  const headers = Object.fromEntries(request.headers.entries())

  // Trace: parse request body
  ctx = step(ctx, 'parse', 'enter')
  
  // Parse request body
  const contentType = request.headers.get('content-type') || ''
  let payload: unknown
  let rawBody: string | undefined

  try {
    if (contentType.includes('application/json')) {
      // JSON format
      payload = await request.json()
      console.log('[HANDLER] Parsed JSON payload:', payload)
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // URL-encoded format
      rawBody = await request.text()
      payload = parseUrlEncoded(rawBody)
      console.log('[HANDLER] Parsed URL-encoded payload:', payload)
    } else {
      // Try JSON first, fallback to URL-encoded
      rawBody = await request.text()
      try {
        payload = JSON.parse(rawBody)
        console.log('[HANDLER] Parsed as JSON (no content-type)')
      } catch {
        payload = parseUrlEncoded(rawBody)
        console.log('[HANDLER] Parsed as URL-encoded (no content-type)')
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // Extract position info from SyntaxError if available
    const positionMatch = errorMessage.match(/position (\d+)/)
    const position = positionMatch ? parseInt(positionMatch[1]) : undefined
    
    console.error('[HANDLER] Failed to parse body:', error)
    
    // Capture detailed error metadata for trace replay
    ctx = step(ctx, 'parse', 'error', { 
      error_code: 'PARSE_FAILED', 
      reason: errorMessage,
      content_type: contentType,
      body_length: rawBody?.length,
      error_position: position,
      body_preview: rawBody ? rawBody.substring(0, 200) + (rawBody.length > 200 ? '...' : '') : undefined
    })
    
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: 'Failed to parse request body',
        details: errorMessage,
        trace_id: ctx.trace_id,
        debug_url: `/trace/${ctx.trace_id}`
      }),
      { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  // Trace: parse complete
  ctx = step(ctx, 'parse', 'exit')

  // Calculate processing time (before storage to capture accurate timing)
  const processingTimeMs = Date.now() - startTime
  const processingTime = `${processingTimeMs}ms`

  // Events are stored in D1 database by storeEvent() below

  // Store event to D1 database (async, for other features)
  // Note: storeEvent() handles trace steps internally
  try {
    ctx = await storeEvent(ctx, env, {
      url: request.url,
      method: request.method,
      pathname: url.pathname,
      headers,
      payload,
      contentType,
      processingTimeMs,
      ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })
  } catch (error) {
    console.error('[HANDLER] Storage failed, continuing with response:', error)
    // Storage error is already traced by storeEvent()
    // We continue and return the response even if storage fails
  }

  // Return success with metadata
  return new Response(
    JSON.stringify({ 
      ok: true,
      timestamp,
      method: request.method,
      status: 200,
      processingTime,
      headers,
      payload,
      trace_id: ctx.trace_id
    }),
    { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  )
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

