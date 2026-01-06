/**
 * Shared Type Definitions for Posthook
 * Merged from src/types.ts and src/debug/types.ts
 */

/* ============================================
 * BASE COMPOSABLE TYPES
 * ============================================ */

/* id for event */
export type Id = { id: string }

/* timestamp of event */
export type Timestamped = { ts: number }

/* trace id for event */
export type Traced = { trace_id: string }

/* env id for event */
export type Envified = { env_id: string }

/* created at timestamp */
export type CreatedAt = { created_at: number }

/* updated at timestamp */
export type UpdatedAt = { updated_at: number }

/* client identification */
export type ClientInfo = {
  /* ip address of client */
  ip_address?: string
  /* user agent of client */
  user_agent?: string
}

/* record type discriminator */
export type TypedRecord<T extends string> = { type: T }

/* ============================================
 * HTTP & REQUEST TYPES
 * ============================================ */

/* http method of request */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD'

/* headers of request */
export interface RequestHeaders {
  [key: string]: string | string[] | undefined
}

/* payload of event */
export interface Payload {
  [key: string]: any
}

/* ============================================
 * WEBHOOK TYPES
 * ============================================ */

/* Structured webhook payload (e.g., Stripe-like events) */
export type WebhookPayload = Id & {
  /* type of event like "checkout.session.completed" */
  type: string 
  /* timestamp of event */
  created: number
  /* data of event */
  data: {
    object: Record<string, any>
  }
}

/* Posthook metadata (what we add to webhooks) */
export type PosthookMeta = Traced & ClientInfo & {
  /* received at timestamp */
  received_at: number
  /* headers of request */
  headers: Record<string, string>
  /* processing time in milliseconds, Critical for signature verification */
  processing_time_ms: number
}

/* Complete structured webhook event (payload + metadata) */
export type StructuredWebhookEvent = WebhookPayload & {
  _posthook: PosthookMeta
}

/* Generic webhook event for RSS conversion */
export interface GenericWebhookEvent extends Partial<Traced> {
  /* timestamp of event */
  timestamp?: string
  /* http method of request */
  method?: string
  /* payload of event */
  payload?: {
    /* event of event */
    event?: string
    /* additional metadata */
    [key: string]: any
  }
  /* additional metadata */
  [key: string]: any
}

/* ============================================
 * POSTBACK EVENT TYPES
 * ============================================ */

/* Postback Event Types (Current Implementation) */
export interface PostbackEvent extends Id & Traced {
  /* timestamp of event */
  timestamp: string
  /* http method of request */
  method: HttpMethod
  /* headers of request - can be stringified JSON or parsed object */
  headers: RequestHeaders | string
  /* payload of event - can be stringified JSON or parsed object */
  payload: Payload | string         
  /* query of event */
  query?: Record<string, string>
  /* path of event */
  path?: string
  /* ip address of client */
  ip?: string
  /* user agent of client */
  user_agent?: string
}

/* Parsed version of PostbackEvent with guaranteed object types */
export interface ParsedPostbackEvent extends Omit<PostbackEvent, 'headers' | 'payload'> {
  headers: RequestHeaders
  payload: Payload
}

export type PostbackDataResponse = PostbackEvent[]

/* ============================================
 * COMPONENT STATE TYPES
 * ============================================ */

export interface PosthookState {
  /* slug for webhook */
  slug: string
  /* copied flag */
  copied: boolean
  /* postback data */
  postbackData: PostbackEvent[] | null
  /* polling flag */
  isPolling: boolean
}

/* ============================================
 * RSS FEED TYPES
 * ============================================ */
/* (Currently removed for obvious security reasons, we built our own datatype to mimic RSS securely) */
export interface RssFeedItem {
  /* title of event */
  title: string
  /* link to event */
  link: string
  /* guid of event */
  guid: string
  /* published date of event */
  pubDate: string
  /* description of event */
  description: {
    /* cdata of description */
    __cdata: string
  }
}

/* ============================================
 * AUTHENTICATION & USER TYPES
 * ============================================ */

export type AuthCreds = CreatedAt & {
  /* key for authentication */
  key: string
  /* secret for authentication */
  secret: string
}

export type User = Id & CreatedAt & UpdatedAt & {
  /* email of user */
  email: string
  /* credentials of user */
  creds: Record<string, AuthCreds>  // endpoint_id -> creds
}

/* ============================================
 * TRACING & DEBUG TYPES
 * ============================================ */

export type Context = Traced & Envified & {
  /* step id for event */
  step_id: number
}

export type EnvRecord = TypedRecord<'env'> & Traced & Envified & Timestamped & {
  /* source of event */
  source: 'webhook' | 'frontend'  // webhook for backend, frontend for client
  /* payload of event */
  payload: {
    /* ip address of client */
    ip?: string
    /* user agent of client */
    ua?: string
    /* headers of request */
    headers?: Record<string, string>
    /* slug of webhook */
    slug?: string
    /* timestamp of event */
    timestamp?: string
    /* additional metadata */
    [key: string]: any  // Allow additional frontend metadata
  }
}

export type StepRecord = TypedRecord<'step'> & Traced & Envified & {
  /* step id for event */
  step_id: number
  /* timestamp of event */
  at: number
  /* node of event */
  node: 'receive' | 'parse' | 'store' | 'fetch'  // added 'fetch' for frontend operations
  /* status of event */
  status: 'enter' | 'exit' | 'error'
  /* metadata of event */
  meta?: {
    /* error code of event Critical for error handling */
    error_code?: string
    /* reason of event */
    reason?: string
    /* event id of event */
    event_id?: string
    /* storage metadata */
    rows_written?: number
    /* fetch metadata */
    events_fetched?: number
    /* slug of webhook */
    slug?: string
    /* generic metadata */
    [key: string]: any
  }
}

export type TraceRecord = EnvRecord | StepRecord

/* ============================================
 * WEBSOCKET / DURABLE OBJECTS TYPES
 * ============================================ */

/* Cloudflare Workers Environment */
export interface WorkerEnv {
  /* durable object namespace for webhook receiver */
  WEBHOOK_RECEIVER: any
}

// WebSocket Event (stored in Durable Object)
export interface WebSocketEvent extends Id {
  /* timestamp of event */
  _timestamp: number
  /* additional metadata */
  [key: string]: any  // Any additional webhook payload data
}

// WebSocket Message Types
export type WebSocketMessageType = 'history' | 'event'

// History message sent when client connects
export interface WebSocketHistoryMessage extends TypedRecord<'history'> {
  /* messages of event */
  messages: WebSocketEvent[]
}

/* Individual event message broadcast to clients */
export type WebSocketEventMessage = WebSocketEvent

/* Union type for all WebSocket messages */
export type WebSocketMessage = WebSocketHistoryMessage | WebSocketEventMessage

/* Webhook POST response */
export interface WebhookPostResponse {
  /* success of event */
  success: boolean
  /* event id of event */
  eventId: string
  /* broadcast count of event */
  broadcastCount: number
}

/* Export endpoint response */
export interface ExportDataResponse {
  /* exported at timestamp */
  exportedAt: string
  /* total events of event */
  totalEvents: number
  /* events of event */
  events: WebSocketEvent[]
}

/* Path matching results */
export interface PathMatch {
  webhookId: string
  type: 'ws' | 'wh' | 'export'
}

/* Storage key for slug */
export type StorageKey = 'pothook_slug'

/* ============================================
 * MUTATION TESTING TYPES
 * ============================================ */

/* single mutation definition */
export interface Mutation {
  /* unique identifier for mutation */
  id: string
  /* name of mutation */
  name: string
  /* category of mutation */
  category: 'boundary' | 'return' | 'conditional' | 'deletion' | 'literal'
  /* description of mutation */
  description: string
  /* line number of mutation */
  line: number
  /* original code */
  original: string
  /* mutated code */
  mutated: string
  /* true if this mutation should cause test failures */
  shouldKill: boolean
}

/* result of running tests against a mutation */
export interface MutationResult {
  /* mutation that was tested */
  mutation: Mutation
  /* status of mutation test */
  status: 'killed' | 'survived' | 'timeout' | 'error'
  /* test execution time in milliseconds */
  executionTime: number
  /* which test killed the mutation (if any) */
  killedBy?: string
  /* error details if status is error */
  error?: string
}

/* collection of mutation test results */
export interface MutationTestReport {
  /* total mutations tested */
  totalMutations: number
  /* mutations killed by tests */
  killed: number
  /* mutations that survived tests */
  survived: number
  /* mutations that timed out */
  timeout: number
  /* mutations that errored */
  error: number
  /* mutation score percentage (killed / total) */
  mutationScore: number
  /* detailed results for each mutation */
  results: MutationResult[]
  /* timestamp of test run */
  timestamp: number
}

/* test configuration for mutation testing */
export interface MutationTestConfig {
  /* files to mutate */
  files: string[]
  /* test command to run */
  testCommand: string
  /* timeout per mutation in milliseconds */
  timeout: number
  /* mutations to apply */
  mutations: Mutation[]
}
