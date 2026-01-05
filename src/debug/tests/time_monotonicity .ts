import { createEnv, step, replay } from '../trace'

function selfTest() {
  let ctx = createEnv({
    ip: '192.168.1.1',
    ua: 'TestAgent/1.0',
    headers: { 'test-header': 'test' }
  })
  
  // Perform multiple steps
  ctx = step(ctx, 'receive', 'enter')
  ctx = step(ctx, 'receive', 'exit')
  ctx = step(ctx, 'parse', 'enter')
  ctx = step(ctx, 'parse', 'exit')
  ctx = step(ctx, 'store', 'enter')
  ctx = step(ctx, 'store', 'exit')
  
  // Get all records
  const records = replay(ctx.trace_id)
  
  console.log('Checking timestamp monotonicity...\n')
  
  let prevTime = 0
  let violations = 0
  
  for (const record of records) {
    const currentTime = record.type === 'env' ? record.ts : record.at
    const recordType = record.type === 'env' ? 'env' : `step ${record.step_id}`
    
    if (currentTime < prevTime) {
      console.log(`❌ Time travel detected at ${recordType}: ${currentTime} < ${prevTime}`)
      violations++
    } else {
      console.log(`✓ ${recordType}: ${currentTime} (Δ=${currentTime - prevTime}ms)`)
    }
    
    prevTime = currentTime
  }
  
  console.log(`\nTotal records checked: ${records.length}`)
  console.log(`Time travel violations: ${violations}`)
  
  if (violations === 0) {
    console.log('\n✅ PASS: All timestamps are monotonically increasing!')
    return true
  } else {
    console.log('\n❌ FAIL: Time travel detected!')
    return false
  }
}

selfTest()

