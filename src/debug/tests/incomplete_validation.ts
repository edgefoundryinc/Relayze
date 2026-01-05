import { createEnv, step, replay } from '../trace'

function selfTest() {
  let ctx = createEnv({
    ip: '192.168.1.1',
    ua: 'TestAgent/1.0',
    headers: { 'test-header': 'test' }
  })
  
  console.log('Testing incomplete trace validation...\n')
  
  // Complete pair
  ctx = step(ctx, 'receive', 'enter')
  ctx = step(ctx, 'receive', 'exit')
  
  // Incomplete - enter without exit
  ctx = step(ctx, 'parse', 'enter')
  
  const records = replay(ctx.trace_id)
  
  // Get all nodes that have enter steps
  const steps = records.filter(r => r.type === 'step')
  const nodeStatus = new Map<string, { hasEnter: boolean, hasExit: boolean }>()
  
  for (const step of steps) {
    if (!nodeStatus.has(step.node)) {
      nodeStatus.set(step.node, { hasEnter: false, hasExit: false })
    }
    const status = nodeStatus.get(step.node)!
    if (step.status === 'enter') status.hasEnter = true
    if (step.status === 'exit') status.hasExit = true
  }
  
  console.log('Node completion status:')
  let incompleteNodes = []
  for (const [node, status] of nodeStatus) {
    const isComplete = status.hasEnter && status.hasExit
    const symbol = isComplete ? '✓' : '✗'
    console.log(`  ${symbol} ${node}: enter=${status.hasEnter}, exit=${status.hasExit}`)
    if (!isComplete && status.hasEnter) {
      incompleteNodes.push(node)
    }
  }
  
  // This test EXPECTS all traces to be complete (it will fail)
  console.log(`\nIncomplete nodes: ${incompleteNodes.length}`)
  console.log(`Incomplete nodes: ${incompleteNodes.join(', ')}`)
  
  if (incompleteNodes.length === 0) {
    console.log('\n✅ PASS: All traces are complete!')
    return true
  } else {
    console.log('\n❌ FAIL: System allows incomplete traces!')
    console.log('   Expected: System should prevent or auto-complete incomplete traces')
    console.log('   Actual: System faithfully records incomplete state')
    return false
  }
}

selfTest()

