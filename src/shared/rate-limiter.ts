/**
 * Global Rate Limiter - Durable Object
 * 
 * Tracks anonymous users (by IP) across all webhook slugs.
 * Enforces global limits:
 * - 2 unique slugs per IP for anonymous users
 * - Resets after 24 hours
 */

interface SlugUsage {
  slug: string
  firstUsed: number // timestamp
  lastUsed: number  // timestamp
}

interface IPRecord {
  ip: string
  slugs: SlugUsage[]
  createdAt: number
}

export class RateLimiter {
  state: DurableObjectState
  
  constructor(state: DurableObjectState) {
    this.state = state
    console.log('[RateLimiter] Initialized')
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    
    // Only accept POST requests for rate limit checks
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }
    
    try {
      const body = await request.json() as { ip: string, slug: string, userId?: string, checkOnly?: boolean }
      const { ip, slug, userId, checkOnly } = body
      
      // Authenticated users bypass the global slug limit
      if (userId) {
        return new Response(JSON.stringify({ 
          allowed: true,
          reason: 'authenticated'
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      // Check anonymous user's slug usage
      const result = await this.checkIPLimit(ip, slug, checkOnly || false)
      
      return new Response(JSON.stringify(result), {
        status: result.allowed ? 200 : 429,
        headers: { 
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '2',
          'X-RateLimit-Remaining': String(Math.max(0, 2 - result.slugCount)),
        }
      })
      
    } catch (error) {
      console.error('[RateLimiter] Error:', error)
      return new Response(JSON.stringify({ 
        error: 'Invalid request',
        allowed: false
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
  
  /**
   * Check if IP has exceeded slug creation limit
   * @param checkOnly - If true, don't actually record the slug, just check
   */
  private async checkIPLimit(ip: string, slug: string, checkOnly: boolean = false): Promise<{
    allowed: boolean
    slugCount: number
    slugs?: string[]
    reason?: string
    resetAt?: number
  }> {
    const key = `ip:${ip}`
    const now = Date.now()
    const RESET_WINDOW = 24 * 60 * 60 * 1000 // 24 hours
    const MAX_SLUGS = 2
    
    // Get current IP record
    let record = await this.state.storage.get(key) as IPRecord | undefined
    
    if (!record) {
      // First time seeing this IP
      if (checkOnly) {
        // Don't create record for check-only
        return {
          allowed: true,
          slugCount: 0,
          slugs: []
        }
      }
      
      record = {
        ip,
        slugs: [{
          slug,
          firstUsed: now,
          lastUsed: now
        }],
        createdAt: now
      }
      
      await this.state.storage.put(key, record, {
        expirationTtl: RESET_WINDOW / 1000 // 24 hours in seconds
      })
      
      console.log(`[RateLimiter] New IP: ${ip} - slug: ${slug} (1/2)`)
      
      return {
        allowed: true,
        slugCount: 1,
        slugs: [slug]
      }
    }
    
    // Clean up expired slugs (older than 24 hours)
    const validSlugs = record.slugs.filter(s => now - s.firstUsed < RESET_WINDOW)
    
    // Check if this slug already exists for this IP
    const existingSlug = validSlugs.find(s => s.slug === slug)
    
    if (existingSlug) {
      if (!checkOnly) {
        // Just update last used time
        existingSlug.lastUsed = now
        record.slugs = validSlugs
        
        await this.state.storage.put(key, record, {
          expirationTtl: RESET_WINDOW / 1000
        })
        
        console.log(`[RateLimiter] IP ${ip} reusing slug ${slug}`)
      }
      
      return {
        allowed: true,
        slugCount: validSlugs.length,
        slugs: validSlugs.map(s => s.slug)
      }
    }
    
    // New slug for this IP
    if (validSlugs.length >= MAX_SLUGS) {
      // Limit exceeded
      const oldestSlug = validSlugs.sort((a, b) => a.firstUsed - b.firstUsed)[0]
      const resetAt = oldestSlug.firstUsed + RESET_WINDOW
      
      console.log(`[RateLimiter] ❌ IP ${ip} exceeded limit (${validSlugs.length}/${MAX_SLUGS})`)
      
      return {
        allowed: false,
        slugCount: validSlugs.length,
        slugs: validSlugs.map(s => s.slug),
        reason: `Anonymous users are limited to ${MAX_SLUGS} unique webhook URLs per 24 hours. Sign in for unlimited webhooks.`,
        resetAt
      }
    }
    
    // Add new slug
    if (!checkOnly) {
      validSlugs.push({
        slug,
        firstUsed: now,
        lastUsed: now
      })
      
      record.slugs = validSlugs
      
      await this.state.storage.put(key, record, {
        expirationTtl: RESET_WINDOW / 1000
      })
      
      console.log(`[RateLimiter] IP ${ip} added slug ${slug} (${validSlugs.length}/${MAX_SLUGS})`)
    }
    
    return {
      allowed: true,
      slugCount: validSlugs.length,
      slugs: validSlugs.map(s => s.slug)
    }
  }
}

