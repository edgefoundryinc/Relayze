import { createEnv, step } from '../trace_validation'

function selfTest() {
  console.log('🛡️  ADVERSARIAL TEST: Testing guardrails\n')
  
  let guardsWorking = []
  let guardsFailed = []
  
  // Test 1: Exit without enter
  console.log('Test 1: Exit without Enter')
  try {
    let ctx1 = createEnv({ ip: '1.1.1.1', ua: 'Test', headers: {} })
    ctx1 = step(ctx1, 'receive', 'exit') // EXIT FIRST!
    console.log('  ❌ Guard FAILED: System allowed exit without enter\n')
    guardsFailed.push('Exit without Enter')
  } catch (err) {
    console.log(`  ✅ Guard BLOCKED: ${(err as Error).message}\n`)
    guardsWorking.push('Exit without Enter')
  }
  
  // Test 2: Double enter without exit
  console.log('Test 2: Double Enter without Exit')
  try {
    let ctx2 = createEnv({ ip: '2.2.2.2', ua: 'Test', headers: {} })
    ctx2 = step(ctx2, 'parse', 'enter')
    ctx2 = step(ctx2, 'parse', 'enter') // ENTER AGAIN!
    console.log('  ❌ Guard FAILED: System allowed double enter\n')
    guardsFailed.push('Double Enter without Exit')
  } catch (err) {
    console.log(`  ✅ Guard BLOCKED: ${(err as Error).message}\n`)
    guardsWorking.push('Double Enter without Exit')
  }
  
  // Test 3: Manual context manipulation
  console.log('Test 3: Manual Context Manipulation')
  try {
    let ctx3 = createEnv({ ip: '3.3.3.3', ua: 'Test', headers: {} })
    const originalStepId = ctx3.step_id
    // Try to manipulate - context is frozen!
    ;(ctx3 as any).step_id = 999
    
    // Check if mutation actually happened
    if (ctx3.step_id !== originalStepId) {
      console.log('  ❌ Guard FAILED: Context is mutable!\n')
      guardsFailed.push('Manual Context Manipulation')
    } else {
      console.log('  ✅ Guard BLOCKED: Context is immutable (Object.freeze working)\n')
      guardsWorking.push('Manual Context Manipulation')
    }
  } catch (err) {
    console.log(`  ✅ Guard BLOCKED: ${(err as Error).message}\n`)
    guardsWorking.push('Manual Context Manipulation')
  }
  
  // Test 4: Mixing Contexts
  console.log('Test 4: Mixing Contexts (Frankenstein)')
  try {
    let ctxA = createEnv({ ip: '4.4.4.4', ua: 'Test', headers: {} })
    let ctxB = createEnv({ ip: '5.5.5.5', ua: 'Test', headers: {} })
    ctxA = step(ctxA, 'receive', 'enter')
    // Try to create Frankenstein context
    let ctxFranken = { trace_id: ctxA.trace_id, env_id: ctxB.env_id, step_id: ctxA.step_id }
    ctxFranken = step(ctxFranken, 'store', 'enter')
    console.log('  ❌ Guard FAILED: System allowed cross-contamination\n')
    guardsFailed.push('Cross-Context Contamination')
  } catch (err) {
    console.log(`  ✅ Guard BLOCKED: ${(err as Error).message}\n`)
    guardsWorking.push('Cross-Context Contamination')
  }
  
  // Test 5: Error status abuse (continue after error)
  console.log('Test 5: Continue After Error')
  try {
    let ctx5 = createEnv({ ip: '6.6.6.6', ua: 'Test', headers: {} })
    ctx5 = step(ctx5, 'receive', 'enter')
    ctx5 = step(ctx5, 'receive', 'error')
    ctx5 = step(ctx5, 'parse', 'enter') // Try to continue!
    console.log('  ❌ Guard FAILED: System allowed continuation after error\n')
    guardsFailed.push('Error Status Abuse')
  } catch (err) {
    console.log(`  ✅ Guard BLOCKED: ${(err as Error).message}\n`)
    guardsWorking.push('Error Status Abuse')
  }
  
  // Test 6: Negative step_id
  console.log('Test 6: Invalid Step ID')
  try {
    let ctx6 = createEnv({ ip: '7.7.7.7', ua: 'Test', headers: {} })
    // Try to manipulate - context is frozen!
    let ctxBad = { trace_id: ctx6.trace_id, env_id: ctx6.env_id, step_id: -5 }
    ctxBad = step(ctxBad, 'receive', 'enter')
    console.log('  ❌ Guard FAILED: System allowed negative step_id\n')
    guardsFailed.push('Negative Step ID')
  } catch (err) {
    console.log(`  ✅ Guard BLOCKED: ${(err as Error).message}\n`)
    guardsWorking.push('Negative Step ID')
  }
  
  // Summary
  console.log('═'.repeat(60))
  console.log(`\n🛡️  GUARDS WORKING: ${guardsWorking.length}/6`)
  guardsWorking.forEach((v, i) => console.log(`  ✅ ${i + 1}. ${v}`))
  
  if (guardsFailed.length > 0) {
    console.log(`\n💀 GUARDS FAILED: ${guardsFailed.length}/6`)
    guardsFailed.forEach((v, i) => console.log(`  ❌ ${i + 1}. ${v}`))
  }
  
  if (guardsWorking.length === 6) {
    console.log('\n✅ PASS: All guardrails working!')
    return true
  } else {
    console.log('\n❌ FAIL: Some guardrails missing!')
    return false
  }
}

selfTest()

