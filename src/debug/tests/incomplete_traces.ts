import { createEnv, step, replay } from '../trace'

function selfTest() {
  let ctx = createEnv({
    ip: '192.168.1.1',
    ua: 'TestAgent/1.0',
    headers: { 'test-header': 'test' }
  })
  
  console.log('Creating incomplete trace with unbalanced enter/exit pairs...\n')
  
  // Complete pair
  ctx = step(ctx, 'receive', 'enter')
  ctx = step(ctx, 'receive', 'exit')
  
  // Incomplete - enter without exit
  ctx = step(ctx, 'parse', 'enter')
  
  // Another incomplete - enter without exit
  ctx = step(ctx, 'store', 'enter')
  
  const records = replay(ctx.trace_id)
  
  console.log('Trace records:')
  for (const record of records) {
    if (record.type === 'env') {
      console.log(`  env - ${record.env_id}`)
    } else {
      console.log(`  step ${record.step_id} - ${record.node} [${record.status}]`)
    }
  }
  
  // Count enter vs exit
  const steps = records.filter(r => r.type === 'step')
  const enters = steps.filter(r => r.status === 'enter').length
  const exits = steps.filter(r => r.status === 'exit').length
  
  console.log(`\nStatistics:`)
  console.log(`  Total steps: ${steps.length}`)
  console.log(`  Enter steps: ${enters}`)
  console.log(`  Exit steps:  ${exits}`)
  console.log(`  Unmatched:   ${enters - exits}`)
  
  // Verify we have the incomplete state
  const expectedEnters = 3
  const expectedExits = 1
  const isIncomplete = enters > exits
  
  if (enters === expectedEnters && exits === expectedExits && isIncomplete) {
    console.log('\n✅ PASS: Incomplete trace correctly recorded!')
    console.log('   System faithfully logs unbalanced enter/exit pairs.')
    return true
  } else {
    console.log('\n❌ FAIL: Trace does not show expected incomplete state!')
    return false
  }
}

selfTest()

