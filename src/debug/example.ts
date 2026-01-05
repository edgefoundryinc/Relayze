import type { TraceRecord, Context } from './src/types'

const log: TraceRecord[] = []

function createEnv(payload: any): Context {
  const trace_id = `tr_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const env_id = `env_${Date.now()}_${Math.random().toString(36).slice(2)}`
  log.push({ type: 'env', env_id, trace_id, ts: Date.now(), source: 'webhook', payload })
  return { trace_id, env_id, step_id: 0 }
}

function step(ctx: Context, node: string, status: 'enter' | 'exit' = 'enter'): Context {
  log.push({ type: 'step', trace_id: ctx.trace_id, env_id: ctx.env_id, step_id: ctx.step_id + 1, at: Date.now(), node, status })
  return { ...ctx, step_id: ctx.step_id + 1 }
}

function validatePayload(ctx: Context, data: any): Context {
  ctx = step(ctx, 'validate', 'enter')
  console.log(`✓ Validating: ${JSON.stringify(data)}`)
  ctx = step(ctx, 'validate', 'exit')
  return ctx
}

function processOrder(ctx: Context, orderId: string): Context {
  ctx = step(ctx, 'process', 'enter')
  console.log(`✓ Processing order: ${orderId}`)
  ctx = step(ctx, 'process', 'exit')
  return ctx
}

function notifyUser(ctx: Context, userId: string): Context {
  ctx = step(ctx, 'notify', 'enter')
  console.log(`✓ Notifying user: ${userId}`)
  ctx = step(ctx, 'notify', 'exit')
  return ctx
}

// Run toy workflow
let ctx = createEnv({ order: 'ORD-123', user: 'USR-456' })
ctx = validatePayload(ctx, { order: 'ORD-123' })
ctx = processOrder(ctx, 'ORD-123')
ctx = notifyUser(ctx, 'USR-456')

console.log('\n📋 Trace Log:')
console.log(JSON.stringify(log.filter(x => x.trace_id === ctx.trace_id), null, 2))

