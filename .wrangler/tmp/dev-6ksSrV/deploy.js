var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/debug/trace.ts
var log = [];
var traceStates = /* @__PURE__ */ new Map();
function createEnv(payload) {
  const trace_id = `tr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const env_id = `env_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  if (!payload || typeof payload !== "object") {
    throw new Error("createEnv: payload must be a valid object");
  }
  log.push({
    type: "env",
    env_id,
    trace_id,
    ts: Date.now(),
    source: "webhook",
    payload
  });
  traceStates.set(trace_id, {
    nodes: /* @__PURE__ */ new Map(),
    lastStepId: 0,
    env_id,
    hasCriticalError: false
  });
  return Object.freeze({ trace_id, env_id, step_id: 0 });
}
__name(createEnv, "createEnv");
function step(ctx, node, status = "enter", meta) {
  if (!ctx || typeof ctx !== "object") {
    throw new Error("step: invalid context");
  }
  if (!ctx.trace_id || !ctx.env_id) {
    throw new Error("step: context missing trace_id or env_id");
  }
  const traceState = traceStates.get(ctx.trace_id);
  if (!traceState) {
    throw new Error(`step: no trace state found for trace_id ${ctx.trace_id}`);
  }
  if (ctx.env_id !== traceState.env_id) {
    throw new Error(`step: env_id mismatch - expected ${traceState.env_id}, got ${ctx.env_id}`);
  }
  if (typeof ctx.step_id !== "number" || ctx.step_id < 0) {
    throw new Error(`step: invalid step_id ${ctx.step_id} - must be non-negative number`);
  }
  if (ctx.step_id !== traceState.lastStepId) {
    throw new Error(`step: step_id out of sequence - expected ${traceState.lastStepId}, got ${ctx.step_id}`);
  }
  if (traceState.hasCriticalError) {
    throw new Error(`step: trace ${ctx.trace_id} is in error state, cannot continue`);
  }
  if (!traceState.nodes.has(node)) {
    traceState.nodes.set(node, { currentStatus: "idle", lastStepId: -1 });
  }
  const nodeState = traceState.nodes.get(node);
  if (status === "enter") {
    if (nodeState.currentStatus === "entered") {
      throw new Error(`step: node '${node}' already entered - must exit before entering again`);
    }
  } else if (status === "exit") {
    if (nodeState.currentStatus !== "entered") {
      throw new Error(`step: node '${node}' cannot exit - not currently entered (status: ${nodeState.currentStatus})`);
    }
  } else if (status === "error") {
    if (nodeState.currentStatus !== "entered") {
      throw new Error(`step: node '${node}' cannot error - not currently entered (status: ${nodeState.currentStatus})`);
    }
    traceState.hasCriticalError = true;
  }
  const newStepId = ctx.step_id + 1;
  log.push({
    type: "step",
    trace_id: ctx.trace_id,
    env_id: ctx.env_id,
    step_id: newStepId,
    at: Date.now(),
    node,
    status,
    meta
  });
  nodeState.currentStatus = status === "enter" ? "entered" : status === "exit" ? "exited" : "errored";
  nodeState.lastStepId = newStepId;
  traceState.lastStepId = newStepId;
  return Object.freeze({ trace_id: ctx.trace_id, env_id: ctx.env_id, step_id: newStepId });
}
__name(step, "step");
function replay(traceId) {
  if (!traceId || typeof traceId !== "string") {
    throw new Error("replay: traceId must be a non-empty string");
  }
  return log.filter((x) => x.trace_id === traceId).sort((a, b) => {
    if (a.type === "env") return -1;
    if (b.type === "env") return 1;
    return ("step_id" in a ? a.step_id : 0) - ("step_id" in b ? b.step_id : 0);
  });
}
__name(replay, "replay");

// src/shared/storage.ts
async function storeEvent(ctx, env, eventData) {
  ctx = step(ctx, "store", "enter");
  try {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const createdAt = Date.now();
    const headersJson = JSON.stringify(eventData.headers);
    const payloadJson = JSON.stringify(eventData.payload);
    console.log("[STORAGE] Storing event:", {
      eventId,
      trace_id: ctx.trace_id,
      pathname: eventData.pathname,
      contentType: eventData.contentType
    });
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
    ).run();
    if (!result.success) {
      throw new Error("D1 insert failed");
    }
    console.log("[STORAGE] Event stored successfully:", {
      eventId,
      trace_id: ctx.trace_id,
      rowsWritten: result.meta.rows_written
    });
    ctx = step(ctx, "store", "exit", {
      event_id: eventId,
      rows_written: result.meta.rows_written
    });
    return ctx;
  } catch (error) {
    console.error("[STORAGE] Failed to store event:", error);
    ctx = step(ctx, "store", "error", {
      error_code: "STORAGE_FAILED",
      reason: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
__name(storeEvent, "storeEvent");
async function queryEvents(env, options = {}) {
  const { pathname, trace_id, limit = 50, offset = 0 } = options;
  let query = "SELECT * FROM webhook_events";
  const conditions = [];
  const params = [];
  if (pathname) {
    conditions.push("pathname = ?");
    params.push(pathname);
  }
  if (trace_id) {
    conditions.push("trace_id = ?");
    params.push(trace_id);
  }
  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);
  const result = await env.DB.prepare(query).bind(...params).all();
  return result.results || [];
}
__name(queryEvents, "queryEvents");

// src/shared/handler.ts
async function handleRequest(request, env) {
  const startTime = Date.now();
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  let url = new URL(request.url);
  if (url.pathname.startsWith("/h/")) {
    const newPathname = url.pathname.replace("/h/", "/post/");
    url = new URL(url.origin + newPathname + url.search);
  }
  if (request.method === "GET" && url.pathname === "/events") {
    try {
      const searchParams = url.searchParams;
      const pathname = searchParams.get("pathname") || void 0;
      const trace_id = searchParams.get("trace_id") || void 0;
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");
      const events = await queryEvents(env, { pathname, trace_id, limit, offset });
      return new Response(JSON.stringify({
        ok: true,
        count: events.length,
        limit,
        offset,
        filters: { pathname, trace_id },
        events
      }, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Failed to query events",
        reason: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "GET" && url.pathname.startsWith("/trace/")) {
    const traceId = url.pathname.split("/")[2];
    if (!traceId) {
      return new Response(JSON.stringify({ error: "trace_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    try {
      const traceRecords = replay(traceId);
      if (traceRecords.length === 0) {
        return new Response(JSON.stringify({
          error: "Trace not found",
          trace_id: traceId,
          note: "Traces are stored in-memory and cleared on worker restart"
        }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({
        trace_id: traceId,
        records: traceRecords,
        count: traceRecords.length
      }, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: "Failed to replay trace",
        reason: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (request.method === "GET" && url.pathname.startsWith("/post/")) {
    const events = await queryEvents(env, { pathname: url.pathname, limit: 50, offset: 0 });
    return new Response(JSON.stringify(events, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  let ctx = createEnv({
    ip: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || void 0,
    ua: request.headers.get("user-agent") || void 0,
    headers: Object.fromEntries(request.headers.entries())
  });
  if (!url.pathname.startsWith("/post")) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain" }
    });
  }
  const headers = Object.fromEntries(request.headers.entries());
  ctx = step(ctx, "parse", "enter");
  const contentType = request.headers.get("content-type") || "";
  let payload;
  let rawBody;
  try {
    if (contentType.includes("application/json")) {
      payload = await request.json();
      console.log("[HANDLER] Parsed JSON payload:", payload);
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      rawBody = await request.text();
      payload = parseUrlEncoded(rawBody);
      console.log("[HANDLER] Parsed URL-encoded payload:", payload);
    } else {
      rawBody = await request.text();
      try {
        payload = JSON.parse(rawBody);
        console.log("[HANDLER] Parsed as JSON (no content-type)");
      } catch {
        payload = parseUrlEncoded(rawBody);
        console.log("[HANDLER] Parsed as URL-encoded (no content-type)");
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const positionMatch = errorMessage.match(/position (\d+)/);
    const position = positionMatch ? parseInt(positionMatch[1]) : void 0;
    console.error("[HANDLER] Failed to parse body:", error);
    ctx = step(ctx, "parse", "error", {
      error_code: "PARSE_FAILED",
      reason: errorMessage,
      content_type: contentType,
      body_length: rawBody?.length,
      error_position: position,
      body_preview: rawBody ? rawBody.substring(0, 200) + (rawBody.length > 200 ? "..." : "") : void 0
    });
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Failed to parse request body",
        details: errorMessage,
        trace_id: ctx.trace_id,
        debug_url: `/trace/${ctx.trace_id}`
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
  ctx = step(ctx, "parse", "exit");
  const processingTimeMs = Date.now() - startTime;
  const processingTime = `${processingTimeMs}ms`;
  try {
    ctx = await storeEvent(ctx, env, {
      url: request.url,
      method: request.method,
      pathname: url.pathname,
      headers,
      payload,
      contentType,
      processingTimeMs,
      ip: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || void 0,
      userAgent: request.headers.get("user-agent") || void 0
    });
  } catch (error) {
    console.error("[HANDLER] Storage failed, continuing with response:", error);
  }
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
      headers: { "Content-Type": "application/json" }
    }
  );
}
__name(handleRequest, "handleRequest");
function parseUrlEncoded(body) {
  const params = new URLSearchParams(body);
  const result = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}
__name(parseUrlEncoded, "parseUrlEncoded");

// src/shared/reciever.ts
var WebhookReceiver = class {
  static {
    __name(this, "WebhookReceiver");
  }
  state;
  env;
  sessions;
  // For connection count logging
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = /* @__PURE__ */ new Set();
    console.log("[DO] WebhookReceiver initialized");
  }
  // WebSocket close handler (called automatically by DO runtime)
  async webSocketClose(ws, code, reason, wasClean) {
    console.log(`[DO] WebSocket closed: code=${code}, reason=${reason}`);
    this.sessions.delete(ws);
  }
  // WebSocket error handler (called automatically by DO runtime)
  async webSocketError(ws, error) {
    console.log("[DO] WebSocket error:", error);
    this.sessions.delete(ws);
  }
  /**
   * Extract user ID from request headers (Clerk or API key)
   */
  getUserId(request) {
    const apiKey = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace("Bearer ", "");
    if (apiKey && this.env.AUTH_SECRET && apiKey === this.env.AUTH_SECRET) {
      return "api_authenticated";
    }
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ") && !this.env.AUTH_SECRET) {
      return request.headers.get("x-clerk-user-id") || null;
    }
    return request.headers.get("x-clerk-user-id") || null;
  }
  /**
   * Get client IP address
   */
  getIP(request) {
    return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  }
  /**
   * Check global rate limit (2 slugs per IP for anonymous users)
   * Returns Response if rate limited, null if OK to proceed
   */
  async checkGlobalRateLimit(request, pathname) {
    const userId = this.getUserId(request);
    const ip = this.getIP(request);
    const slug = pathname.split("/")[2];
    const id = this.env.RATE_LIMITER.idFromName("global");
    const stub = this.env.RATE_LIMITER.get(id);
    const response = await stub.fetch("https://internal/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, slug, userId })
    });
    const result = await response.json();
    if (!result.allowed) {
      console.log(`[DO] \u274C Global rate limit exceeded for IP ${ip}`);
      const resetDate = result.resetAt ? new Date(result.resetAt).toISOString() : "unknown";
      return new Response(JSON.stringify({
        error: "Slug creation limit exceeded",
        limit: 2,
        current: result.slugCount,
        slugs: result.slugs,
        message: result.reason || "You have reached the maximum number of webhook URLs for anonymous users.",
        resetAt: resetDate,
        suggestion: "Sign in to create unlimited webhook URLs."
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(24 * 60 * 60),
          // 24 hours in seconds
          "X-RateLimit-Limit": "2",
          "X-RateLimit-Remaining": "0",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    console.log(`[DO] \u2705 Global rate limit OK: ${result.slugCount}/2 slugs used`);
    return null;
  }
  /**
   * Check rate limit before processing webhook
   * Returns Response if rate limited, null if OK to proceed
   */
  async checkRateLimit(request) {
    const userId = this.getUserId(request);
    const ip = this.getIP(request);
    const identifier = userId || ip;
    const limit = userId ? 100 : 25;
    const window = 60;
    const currentMinute = Math.floor(Date.now() / (window * 1e3));
    const key = `ratelimit:${identifier}:${currentMinute}`;
    const count = await this.state.storage.get(key) || 0;
    console.log(`[DO] Rate limit check: ${identifier} (${userId ? "authenticated" : "anonymous"}) - ${count}/${limit}`);
    if (count >= limit) {
      console.log(`[DO] \u274C Rate limit exceeded for ${identifier}`);
      return new Response(JSON.stringify({
        error: "Rate limit exceeded",
        limit,
        window: `${window} seconds`,
        current: count,
        retryAfter: window,
        message: userId ? `Authenticated users are limited to ${limit} requests per minute.` : `Anonymous users are limited to ${limit} requests per minute. Sign in for higher limits.`
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(window),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.floor(Date.now() / 1e3) + window),
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    await this.state.storage.put(key, count + 1, {
      expirationTtl: window
      // Auto-cleanup after window expires
    });
    console.log(`[DO] \u2705 Rate limit OK: ${count + 1}/${limit}`);
    return null;
  }
  async fetch(request) {
    const url = new URL(request.url);
    console.log(`[DO] ${request.method} ${url.pathname}`);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(request, url.pathname);
    }
    if (request.method === "POST") {
      return this.handleWebhook(request, url.pathname);
    }
    return new Response("Method not allowed", { status: 405 });
  }
  async handleWebSocket(request, pathname) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    this.sessions.add(server);
    console.log(`[DO] \u2705 WebSocket connected (${this.sessions.size} total sessions)`);
    try {
      const events = await queryEvents(this.env, { pathname, limit: 50, offset: 0 });
      const formattedEvents = events.map((e) => ({
        id: e.id,
        trace_id: e.trace_id,
        timestamp: e.timestamp,
        method: e.method,
        headers: JSON.parse(e.headers),
        payload: JSON.parse(e.payload),
        path: e.pathname,
        ip: e.ip,
        user_agent: e.user_agent
      }));
      const historyMessage = {
        type: "history",
        events: formattedEvents
      };
      server.send(JSON.stringify(historyMessage));
      console.log(`[DO] \u{1F4E4} Sent ${formattedEvents.length} events to new client`);
    } catch (err) {
      console.error("[DO] Failed to load history:", err);
      server.send(JSON.stringify({ type: "history", events: [] }));
    }
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
  async handleWebhook(request, pathname) {
    const globalRateLimitResponse = await this.checkGlobalRateLimit(request, pathname);
    if (globalRateLimitResponse) {
      return globalRateLimitResponse;
    }
    const rateLimitResponse = await this.checkRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    let ctx = createEnv({
      ip: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || void 0,
      ua: request.headers.get("user-agent") || void 0,
      headers: Object.fromEntries(request.headers.entries())
    });
    ctx = step(ctx, "receive", "enter");
    const startTime = Date.now();
    const contentType = request.headers.get("content-type") || "";
    const headers = Object.fromEntries(request.headers.entries());
    let payload;
    try {
      const body = await request.text();
      if (contentType.includes("application/json")) {
        payload = JSON.parse(body);
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        payload = parseUrlEncoded2(body);
      } else {
        try {
          payload = JSON.parse(body);
        } catch {
          payload = parseUrlEncoded2(body);
        }
      }
      ctx = step(ctx, "receive", "exit");
    } catch (err) {
      ctx = step(ctx, "receive", "error", {
        error_code: "PARSE_FAILED",
        reason: err instanceof Error ? err.message : String(err)
      });
      return new Response(JSON.stringify({
        ok: false,
        error: "Invalid payload",
        trace_id: ctx.trace_id
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const processingTimeMs = Date.now() - startTime;
    try {
      ctx = await storeEvent(ctx, this.env, {
        url: request.url,
        method: request.method,
        pathname,
        headers,
        payload,
        contentType,
        processingTimeMs,
        ip: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || void 0,
        userAgent: request.headers.get("user-agent") || void 0
      });
    } catch (err) {
      console.error("[DO] Storage failed:", err);
    }
    const event = {
      id: ctx.trace_id,
      trace_id: ctx.trace_id,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      method: request.method,
      headers,
      payload,
      path: pathname,
      ip: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || void 0,
      user_agent: request.headers.get("user-agent") || void 0
    };
    const connections = this.state.getWebSockets();
    const message = JSON.stringify(event);
    let broadcastCount = 0;
    console.log(`[DO] Found ${connections.length} WebSocket connections`);
    for (const ws of connections) {
      try {
        ws.send(message);
        broadcastCount++;
      } catch (err) {
        console.error("[DO] Failed to broadcast:", err);
      }
    }
    console.log(`[DO] \u{1F4E1} Broadcasted to ${broadcastCount} client(s)`);
    return new Response(JSON.stringify({
      ok: true,
      trace_id: ctx.trace_id,
      broadcastCount,
      timestamp: event.timestamp
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};
function parseUrlEncoded2(body) {
  const params = new URLSearchParams(body);
  const result = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}
__name(parseUrlEncoded2, "parseUrlEncoded");

// src/shared/rate-limiter.ts
var RateLimiter = class {
  static {
    __name(this, "RateLimiter");
  }
  state;
  constructor(state) {
    this.state = state;
    console.log("[RateLimiter] Initialized");
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    try {
      const body = await request.json();
      const { ip, slug, userId, checkOnly } = body;
      if (userId) {
        return new Response(JSON.stringify({
          allowed: true,
          reason: "authenticated"
        }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      const result = await this.checkIPLimit(ip, slug, checkOnly || false);
      return new Response(JSON.stringify(result), {
        status: result.allowed ? 200 : 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": "2",
          "X-RateLimit-Remaining": String(Math.max(0, 2 - result.slugCount))
        }
      });
    } catch (error) {
      console.error("[RateLimiter] Error:", error);
      return new Response(JSON.stringify({
        error: "Invalid request",
        allowed: false
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  /**
   * Check if IP has exceeded slug creation limit
   * @param checkOnly - If true, don't actually record the slug, just check
   */
  async checkIPLimit(ip, slug, checkOnly = false) {
    const key = `ip:${ip}`;
    const now = Date.now();
    const RESET_WINDOW = 24 * 60 * 60 * 1e3;
    const MAX_SLUGS = 2;
    let record = await this.state.storage.get(key);
    if (!record) {
      if (checkOnly) {
        return {
          allowed: true,
          slugCount: 0,
          slugs: []
        };
      }
      record = {
        ip,
        slugs: [{
          slug,
          firstUsed: now,
          lastUsed: now
        }],
        createdAt: now
      };
      await this.state.storage.put(key, record, {
        expirationTtl: RESET_WINDOW / 1e3
        // 24 hours in seconds
      });
      console.log(`[RateLimiter] New IP: ${ip} - slug: ${slug} (1/2)`);
      return {
        allowed: true,
        slugCount: 1,
        slugs: [slug]
      };
    }
    const validSlugs = record.slugs.filter((s) => now - s.firstUsed < RESET_WINDOW);
    const existingSlug = validSlugs.find((s) => s.slug === slug);
    if (existingSlug) {
      if (!checkOnly) {
        existingSlug.lastUsed = now;
        record.slugs = validSlugs;
        await this.state.storage.put(key, record, {
          expirationTtl: RESET_WINDOW / 1e3
        });
        console.log(`[RateLimiter] IP ${ip} reusing slug ${slug}`);
      }
      return {
        allowed: true,
        slugCount: validSlugs.length,
        slugs: validSlugs.map((s) => s.slug)
      };
    }
    if (validSlugs.length >= MAX_SLUGS) {
      const oldestSlug = validSlugs.sort((a, b) => a.firstUsed - b.firstUsed)[0];
      const resetAt = oldestSlug.firstUsed + RESET_WINDOW;
      console.log(`[RateLimiter] \u274C IP ${ip} exceeded limit (${validSlugs.length}/${MAX_SLUGS})`);
      return {
        allowed: false,
        slugCount: validSlugs.length,
        slugs: validSlugs.map((s) => s.slug),
        reason: `Anonymous users are limited to ${MAX_SLUGS} unique webhook URLs per 24 hours. Sign in for unlimited webhooks.`,
        resetAt
      };
    }
    if (!checkOnly) {
      validSlugs.push({
        slug,
        firstUsed: now,
        lastUsed: now
      });
      record.slugs = validSlugs;
      await this.state.storage.put(key, record, {
        expirationTtl: RESET_WINDOW / 1e3
      });
      console.log(`[RateLimiter] IP ${ip} added slug ${slug} (${validSlugs.length}/${MAX_SLUGS})`);
    }
    return {
      allowed: true,
      slugCount: validSlugs.length,
      slugs: validSlugs.map((s) => s.slug)
    };
  }
};

// deploy.ts
var deploy_default = {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.pathname === "/h/rate-limit-check" && request.method === "POST") {
      const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
      const userId = request.headers.get("x-clerk-user-id") || null;
      const tempSlug = "check_" + Date.now();
      const id = env.RATE_LIMITER.idFromName("global");
      const stub = env.RATE_LIMITER.get(id);
      const response = await stub.fetch("https://internal/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, slug: tempSlug, userId, checkOnly: true })
      });
      const result = await response.json();
      return new Response(JSON.stringify(result), {
        status: result.allowed ? 200 : 429,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const isWebSocket = request.headers.get("Upgrade") === "websocket";
    const isWebhookPath = url.pathname.startsWith("/h/") || url.pathname.startsWith("/post/");
    if ((isWebSocket || request.method === "POST") && isWebhookPath) {
      console.log("[WORKER] Routing to Durable Object:", url.pathname);
      const pathParts = url.pathname.split("/");
      const slug = pathParts[2];
      if (!slug) {
        return new Response(JSON.stringify({ error: "Invalid slug" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      const id = env.WEBHOOK_RECEIVER.idFromName(slug);
      const stub = env.WEBHOOK_RECEIVER.get(id);
      return stub.fetch(request);
    }
    let ctx = createEnv({
      ip: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || void 0,
      ua: request.headers.get("user-agent") || void 0,
      headers: Object.fromEntries(request.headers.entries())
    });
    ctx = step(ctx, "receive", "enter");
    const isFeedRequest = url.pathname.includes("/feed");
    const isTraceRequest = url.pathname.startsWith("/trace/");
    const isEventsRequest = url.pathname === "/events";
    const isPostRequest = url.pathname.startsWith("/post/");
    if (request.method === "GET" && (isPostRequest || isFeedRequest || isTraceRequest || isEventsRequest)) {
      ctx = step(ctx, "receive", "exit");
      console.log(ctx);
      return handleRequest(request, env);
    }
    if (request.method === "GET") {
      try {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status < 400) {
          return assetResponse;
        }
        const indexRequest = new Request(new URL("/", request.url), request);
        return env.ASSETS.fetch(indexRequest);
      } catch (error) {
        console.error("[WORKER] Asset serving error:", error);
        return new Response("Error loading page", {
          status: 500,
          headers: { "Content-Type": "text/plain" }
        });
      }
    }
    ctx = step(ctx, "receive", "error", {
      error_code: "METHOD_NOT_ALLOWED",
      reason: `Method ${request.method} not supported for ${url.pathname}`
    });
    console.log(ctx);
    return new Response("Method not allowed", {
      status: 405,
      headers: { "Content-Type": "text/plain" }
    });
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-1fb7cZ/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = deploy_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-1fb7cZ/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  RateLimiter,
  WebhookReceiver,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=deploy.js.map
