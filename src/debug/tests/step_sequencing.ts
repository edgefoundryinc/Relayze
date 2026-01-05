import { createEnv, step } from '../trace'

function selfTest() {
  let ctx = createEnv({
    ip: '192.168.1.1',
    ua: 'TestAgent/1.0',
    headers: { 'test-header': 'test' }
  })
  
  console.log(`Initial context step_id: ${ctx.step_id}`)
  
  const expectedSequence = [0, 1, 2, 3, 4, 5]
  const actualSequence = [ctx.step_id]
  
  // Perform multiple steps
  ctx = step(ctx, 'receive', 'enter')
  actualSequence.push(ctx.step_id)
  
  ctx = step(ctx, 'receive', 'exit')
  actualSequence.push(ctx.step_id)
  
  ctx = step(ctx, 'parse', 'enter')
  actualSequence.push(ctx.step_id)
  
  ctx = step(ctx, 'parse', 'exit')
  actualSequence.push(ctx.step_id)
  
  ctx = step(ctx, 'store', 'enter')
  actualSequence.push(ctx.step_id)
  
  ctx = step(ctx, 'store', 'exit')
  actualSequence.push(ctx.step_id)
  
  console.log(`Expected sequence: ${expectedSequence.join(' → ')}`)
  console.log(`Actual sequence:   ${actualSequence.join(' → ')}`)
  
  // Verify sequence
  const isCorrect = expectedSequence.every((val, idx) => val === actualSequence[idx])
  
  if (isCorrect) {
    console.log('\n✅ PASS: Step IDs increment correctly!')
    return true
  } else {
    console.log('\n❌ FAIL: Step ID sequence is incorrect!')
    return false
  }
}

selfTest()

