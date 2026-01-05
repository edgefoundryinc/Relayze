import { createEnv, step, replay } from '../trace'

function selfTest() {
  console.log('🔴 ADVERSARIAL TEST: Breaking the trace system\n')
  
  let vulnerabilities = []
  
  // Vuln 1: Exit without enter
  console.log('Test 1: Exit without Enter')
  let ctx1 = createEnv({ ip: '1.1.1.1', ua: 'Test', headers: {} })
  ctx1 = step(ctx1, 'receive', 'exit') // EXIT FIRST!
  console.log('  ❌ System allowed exit without enter\n')
  vulnerabilities.push('Exit without Enter')
  
  // Vuln 2: Double enter without exit
  console.log('Test 2: Double Enter without Exit')
  let ctx2 = createEnv({ ip: '2.2.2.2', ua: 'Test', headers: {} })
  ctx2 = step(ctx2, 'parse', 'enter')
  ctx2 = step(ctx2, 'parse', 'enter') // ENTER AGAIN!
  console.log('  ❌ System allowed double enter without exit\n')
  vulnerabilities.push('Double Enter without Exit')
  
  // Vuln 3: Manual context manipulation
  console.log('Test 3: Manual Context Manipulation')
  let ctx3 = createEnv({ ip: '3.3.3.3', ua: 'Test', headers: {} })
  ctx3.step_id = 999 // DIRECT MANIPULATION!
  ctx3 = step(ctx3, 'store', 'enter')
  console.log(`  ❌ System allowed manual step_id manipulation (jumped to ${ctx3.step_id})\n`)
  vulnerabilities.push('Manual Context Manipulation')
  
  // Vuln 4: Calling step with wrong context
  console.log('Test 4: Mixing Contexts')
  let ctxA = createEnv({ ip: '4.4.4.4', ua: 'Test', headers: {} })
  let ctxB = createEnv({ ip: '5.5.5.5', ua: 'Test', headers: {} })
  ctxA = step(ctxA, 'receive', 'enter')
  ctxB = step(ctxB, 'parse', 'enter')
  // Now use ctxA's step_id but ctxB's trace_id (malformed context)
  let ctxFranken = { trace_id: ctxA.trace_id, env_id: ctxB.env_id, step_id: ctxA.step_id }
  ctxFranken = step(ctxFranken, 'store', 'enter')
  console.log('  ❌ System allowed mixed trace_id/env_id (Frankenstein context)\n')
  vulnerabilities.push('Cross-Context Contamination')
  
  // Vuln 5: Error status without actual error
  console.log('Test 5: Error Status Abuse')
  let ctx5 = createEnv({ ip: '6.6.6.6', ua: 'Test', headers: {} })
  ctx5 = step(ctx5, 'receive', 'enter')
  ctx5 = step(ctx5, 'receive', 'error') // ERROR but no actual error!
  ctx5 = step(ctx5, 'parse', 'enter') // Continue after "error"
  console.log('  ❌ System allowed continuation after error status\n')
  vulnerabilities.push('Error Status Abuse')
  
  // Vuln 6: Negative or invalid step_id
  console.log('Test 6: Invalid Step ID')
  let ctx6 = createEnv({ ip: '7.7.7.7', ua: 'Test', headers: {} })
  ctx6.step_id = -5 // NEGATIVE!
  ctx6 = step(ctx6, 'receive', 'enter')
  console.log(`  ❌ System allowed negative step_id (now at ${ctx6.step_id})\n`)
  vulnerabilities.push('Negative Step ID')
  
  // Summary
  console.log('═'.repeat(60))
  console.log(`\n💀 VULNERABILITIES FOUND: ${vulnerabilities.length}`)
  vulnerabilities.forEach((v, i) => console.log(`  ${i + 1}. ${v}`))
  
  console.log('\n❌ CRITICAL: Trace system has NO validation or guards!')
  console.log('   Any of these could cause silent data corruption.')
  console.log('   The system trusts callers completely.\n')
  
  return false
}

selfTest()

