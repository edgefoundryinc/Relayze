import type { TraceRecord, EnvRecord, StepRecord, Context } from '../../types/types'

const log: TraceRecord[] = []

// Track state per trace to enforce step pairing
type NodeState = {
  currentStatus: 'idle' | 'entered' | 'exited' | 'errored'
  lastStepId: number
}

type TraceState = {
  nodes: Map<StepRecord['node'], NodeState>
  lastStepId: number
  env_id: string
  hasCriticalError: boolean
}

const traceStates = new Map<string, TraceState>()

export function createEnv(payload: EnvRecord['payload']): Context {
  const trace_id = `tr_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const env_id = `env_${Date.now()}_${Math.random().toString(36).slice(2)}`
  
  // Validate payload
  if (!payload || typeof payload !== 'object') {
    throw new Error('createEnv: payload must be a valid object')
  }
  
  log.push({
    type: 'env',
    env_id,
    trace_id,
    ts: Date.now(),
    source: 'webhook',
    payload
  })
  
  // Initialize trace state
  traceStates.set(trace_id, {
    nodes: new Map(),
    lastStepId: 0,
    env_id,
    hasCriticalError: false
  })
  
  return Object.freeze({ trace_id, env_id, step_id: 0 })
}

export function step(ctx: Context, node: StepRecord['node'], status: StepRecord['status'] = 'enter', meta?: StepRecord['meta']): Context {
  // Guard 1: Validate context exists and is valid
  if (!ctx || typeof ctx !== 'object') {
    throw new Error('step: invalid context')
  }
  
  if (!ctx.trace_id || !ctx.env_id) {
    throw new Error('step: context missing trace_id or env_id')
  }
  
  // Guard 2: Check if trace state exists
  const traceState = traceStates.get(ctx.trace_id)
  if (!traceState) {
    throw new Error(`step: no trace state found for trace_id ${ctx.trace_id}`)
  }
  
  // Guard 3: Validate env_id hasn't been tampered with
  if (ctx.env_id !== traceState.env_id) {
    throw new Error(`step: env_id mismatch - expected ${traceState.env_id}, got ${ctx.env_id}`)
  }
  
  // Guard 4: Validate step_id is sequential
  if (typeof ctx.step_id !== 'number' || ctx.step_id < 0) {
    throw new Error(`step: invalid step_id ${ctx.step_id} - must be non-negative number`)
  }
  
  if (ctx.step_id !== traceState.lastStepId) {
    throw new Error(`step: step_id out of sequence - expected ${traceState.lastStepId}, got ${ctx.step_id}`)
  }
  
  // Guard 5: Cannot continue after critical error
  if (traceState.hasCriticalError) {
    throw new Error(`step: trace ${ctx.trace_id} is in error state, cannot continue`)
  }
  
  // Get or create node state
  if (!traceState.nodes.has(node)) {
    traceState.nodes.set(node, { currentStatus: 'idle', lastStepId: -1 })
  }
  const nodeState = traceState.nodes.get(node)!
  
  // Guard 6: Enforce state machine for enter/exit/error
  if (status === 'enter') {
    if (nodeState.currentStatus === 'entered') {
      throw new Error(`step: node '${node}' already entered - must exit before entering again`)
    }
  } else if (status === 'exit') {
    if (nodeState.currentStatus !== 'entered') {
      throw new Error(`step: node '${node}' cannot exit - not currently entered (status: ${nodeState.currentStatus})`)
    }
  } else if (status === 'error') {
    if (nodeState.currentStatus !== 'entered') {
      throw new Error(`step: node '${node}' cannot error - not currently entered (status: ${nodeState.currentStatus})`)
    }
    // Mark trace as having critical error
    traceState.hasCriticalError = true
  }
  
  // Log the step
  const newStepId = ctx.step_id + 1
  log.push({
    type: 'step',
    trace_id: ctx.trace_id,
    env_id: ctx.env_id,
    step_id: newStepId,
    at: Date.now(),
    node,
    status,
    meta
  })
  
  // Update state
  nodeState.currentStatus = status === 'enter' ? 'entered' : (status === 'exit' ? 'exited' : 'errored')
  nodeState.lastStepId = newStepId
  traceState.lastStepId = newStepId
  
  return Object.freeze({ trace_id: ctx.trace_id, env_id: ctx.env_id, step_id: newStepId })
}

export function replay(traceId: string): TraceRecord[] {
  if (!traceId || typeof traceId !== 'string') {
    throw new Error('replay: traceId must be a non-empty string')
  }
  
  return log
    .filter(x => x.trace_id === traceId)
    .sort((a, b) => {
      if (a.type === 'env') return -1
      if (b.type === 'env') return 1
      return ('step_id' in a ? a.step_id : 0) - ('step_id' in b ? b.step_id : 0)
    })
}

