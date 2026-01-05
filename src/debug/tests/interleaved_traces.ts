import { createEnv, step, replay } from '../trace'

function selfTest() {
  // Create two separate contexts
  let ctx1 = createEnv({
    ip: '192.168.1.1',
    ua: 'Client-A/1.0',
    headers: { 'x-client': 'A' }
  })
  
  let ctx2 = createEnv({
    ip: '192.168.1.2',
    ua: 'Client-B/1.0',
    headers: { 'x-client': 'B' }
  })
  
  console.log(`Context 1 trace_id: ${ctx1.trace_id}`)
  console.log(`Context 2 trace_id: ${ctx2.trace_id}\n`)
  
  // Interleave steps between the two contexts
  ctx1 = step(ctx1, 'receive', 'enter')
  ctx2 = step(ctx2, 'receive', 'enter')
  ctx1 = step(ctx1, 'receive', 'exit')
  ctx2 = step(ctx2, 'receive', 'exit')
  
  ctx1 = step(ctx1, 'parse', 'enter')
  ctx2 = step(ctx2, 'parse', 'enter')
  ctx1 = step(ctx1, 'parse', 'exit')
  ctx2 = step(ctx2, 'parse', 'exit')
  
  ctx1 = step(ctx1, 'store', 'enter')
  ctx2 = step(ctx2, 'store', 'enter')
  ctx1 = step(ctx1, 'store', 'exit')
  ctx2 = step(ctx2, 'store', 'exit')
  
  // Replay each trace
  const trace1 = replay(ctx1.trace_id)
  const trace2 = replay(ctx2.trace_id)
  
  console.log(`Trace 1 records: ${trace1.length}`)
  console.log(`Trace 2 records: ${trace2.length}\n`)
  
  // Verify each trace has correct records
  let allCorrect = true
  
  // Check trace 1
  for (const record of trace1) {
    if (record.trace_id !== ctx1.trace_id) {
      console.log(`❌ Trace 1 contamination: found record with trace_id ${record.trace_id}`)
      allCorrect = false
    }
  }
  
  // Check trace 2
  for (const record of trace2) {
    if (record.trace_id !== ctx2.trace_id) {
      console.log(`❌ Trace 2 contamination: found record with trace_id ${record.trace_id}`)
      allCorrect = false
    }
  }
  
  // Expected: 1 env + 6 steps = 7 records each
  const expectedCount = 7
  if (trace1.length !== expectedCount) {
    console.log(`❌ Trace 1 has ${trace1.length} records, expected ${expectedCount}`)
    allCorrect = false
  }
  
  if (trace2.length !== expectedCount) {
    console.log(`❌ Trace 2 has ${trace2.length} records, expected ${expectedCount}`)
    allCorrect = false
  }
  
  if (allCorrect) {
    console.log('✓ Trace 1 contains only its own records')
    console.log('✓ Trace 2 contains only its own records')
    console.log('✓ Both traces have correct record counts')
    console.log('\n✅ PASS: Interleaved traces are correctly isolated!')
    return true
  } else {
    console.log('\n❌ FAIL: Trace isolation is broken!')
    return false
  }
}

selfTest()

