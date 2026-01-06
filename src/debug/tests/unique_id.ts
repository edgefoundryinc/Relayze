import { createEnv } from '../trace'

function selfTest() {
  const contexts = []
  const traceIds = new Set<string>()
  const envIds = new Set<string>()
  
  // Create 100 envs rapidly
  for (let i = 0; i < 100; i++) {
    const ctx = createEnv({
      ip: `192.168.1.${i}`,
      ua: 'TestAgent/1.0',
      headers: { 'test-header': `test-${i}` }
    })
    contexts.push(ctx)
    traceIds.add(ctx.trace_id)
    envIds.add(ctx.env_id)
  }
  
  // Verify no duplicates
  const traceIdCollisions = contexts.length - traceIds.size
  const envIdCollisions = contexts.length - envIds.size
  
  console.log(`Created ${contexts.length} environments`)
  console.log(`Unique trace_ids: ${traceIds.size}`)
  console.log(`Unique env_ids: ${envIds.size}`)
  console.log(`Trace ID collisions: ${traceIdCollisions}`)
  console.log(`Env ID collisions: ${envIdCollisions}`)
  
  if (traceIdCollisions === 0 && envIdCollisions === 0) {
    console.log('\n✅ PASS: All IDs are unique!')
    return true
  } else {
    console.log('\n❌ FAIL: Duplicate IDs detected!')
    return false
  }
}

selfTest()

