import type { TraceRecord, EnvRecord, StepRecord, Context } from './types'

const log: TraceRecord[] = []

export function createEnv(payload: EnvRecord['payload']): Context {
  const trace_id = `tr_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const env_id = `env_${Date.now()}_${Math.random().toString(36).slice(2)}`
  
  log.push({
    type: 'env',
    env_id,
    trace_id,
    ts: Date.now(),
    source: 'webhook',
    payload
  })
  
  return { trace_id, env_id, step_id: 0 }
}

export function step(ctx: Context, node: StepRecord['node'], status: StepRecord['status'] = 'enter', meta?: StepRecord['meta']): Context {
  log.push({
    type: 'step',
    trace_id: ctx.trace_id,
    env_id: ctx.env_id,
    step_id: ctx.step_id + 1,
    at: Date.now(),
    node,
    status,
    meta
  })
  
  return { ...ctx, step_id: ctx.step_id + 1 }
}

export function replay(traceId: string): TraceRecord[] {
  return log
    .filter(x => x.trace_id === traceId)
    .sort((a, b) => {
      if (a.type === 'env') return -1
      if (b.type === 'env') return 1
      return ('step_id' in a ? a.step_id : 0) - ('step_id' in b ? b.step_id : 0)
    })
}
