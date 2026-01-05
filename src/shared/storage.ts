/**
 * Storage - D1 Database Storage
 * 
 * Handles storing webhook events to D1 database.
 * Follows trace.ts framework for consistent error tracking.
 */

import { step } from '../debug/trace'
import type { Context } from '../../types/types'

// D1 Database type from Cloudflare Workers runtime
export interface StorageEnv {
  DB: any  // D1Database type is available at runtime
}

export interface StoredEvent {
  id: string
  trace_id: string
  timestamp: string
  method: string
  url: string
  pathname: string
  ip?: string
  user_agent?: string
  headers: string  // JSON stringified
  payload: string  // JSON stringified
  content_type: string
  processing_time_ms: number
  created_at: number
}

/**
 * Store a webhook event to D1 database
 * 
 * @param ctx - Trace context
 * @param env - Environment with DB binding
 * @param eventData - Event data to store
 * @returns Updated context
 */
export async function storeEvent(
  ctx: Context,
  env: StorageEnv,
  eventData: {
    url: string
    method: string
    pathname: string
    headers: Record<string, string>
    payload: unknown
    contentType: string
    processingTimeMs: number
    ip?: string
    userAgent?: string
  }
): Promise<Context> {
  // Trace: entering store operation
  ctx = step(ctx, 'store', 'enter')
  
  try {
    // Generate unique ID for this event
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const timestamp = new Date().toISOString()
    const createdAt = Date.now()
    
    // Serialize complex objects to JSON
    const headersJson = JSON.stringify(eventData.headers)
    const payloadJson = JSON.stringify(eventData.payload)
    
    console.log('[STORAGE] Storing event:', {
      eventId,
      trace_id: ctx.trace_id,
      pathname: eventData.pathname,
      contentType: eventData.contentType
    })
    
    // Insert into D1 database
    const result = await env.DB.prepare(`
      INSERT INTO webhook_events (
        id,
        trace_id,
        timestamp,
        method,
        url,
        pathname,
        ip,
        user_agent,
        headers,
        payload,
        content_type,
        processing_time_ms,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      eventId,
      ctx.trace_id,
      timestamp,
      eventData.method,
      eventData.url,
      eventData.pathname,
      eventData.ip || null,
      eventData.userAgent || null,
      headersJson,
      payloadJson,
      eventData.contentType,
      eventData.processingTimeMs,
      createdAt
    ).run()
    
    // Check if insert was successful
    if (!result.success) {
      throw new Error('D1 insert failed')
    }
    
    console.log('[STORAGE] Event stored successfully:', {
      eventId,
      trace_id: ctx.trace_id,
      rowsWritten: result.meta.rows_written
    })
    
    // Trace: store operation completed successfully
    ctx = step(ctx, 'store', 'exit', {
      event_id: eventId,
      rows_written: result.meta.rows_written
    })
    
    return ctx
    
  } catch (error) {
    console.error('[STORAGE] Failed to store event:', error)
    
    // Trace: store operation failed
    ctx = step(ctx, 'store', 'error', {
      error_code: 'STORAGE_FAILED',
      reason: error instanceof Error ? error.message : String(error)
    })
    
    throw error
  }
}

/**
 * Initialize database schema
 * Call this once during setup to create the webhook_events table
 */
export async function initDatabase(db: any): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      pathname TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      headers TEXT NOT NULL,
      payload TEXT NOT NULL,
      content_type TEXT NOT NULL,
      processing_time_ms INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `).run()
  
  // Create index on trace_id for efficient lookups
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_webhook_events_trace_id 
    ON webhook_events(trace_id)
  `).run()
  
  // Create index on created_at for chronological queries (RSS feed)
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at 
    ON webhook_events(created_at DESC)
  `).run()
  
  // Create index on pathname for filtering by user/endpoint
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_webhook_events_pathname 
    ON webhook_events(pathname)
  `).run()
  
  console.log('[STORAGE] Database schema initialized')
}

/**
 * Query webhook events from database
 * 
 * @param env - Environment with DB binding
 * @param options - Query options (pathname, limit, offset)
 * @returns Array of stored events
 */
export async function queryEvents(
  env: StorageEnv,
  options: {
    pathname?: string
    trace_id?: string
    limit?: number
    offset?: number
  } = {}
): Promise<StoredEvent[]> {
  const { pathname, trace_id, limit = 50, offset = 0 } = options
  
  let query = 'SELECT * FROM webhook_events'
  const conditions: string[] = []
  const params: any[] = []
  
  if (pathname) {
    conditions.push('pathname = ?')
    params.push(pathname)
  }
  
  if (trace_id) {
    conditions.push('trace_id = ?')
    params.push(trace_id)
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)
  
  const result = await env.DB.prepare(query).bind(...params).all()
  
  return result.results || []
}

