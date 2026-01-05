import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'deploy.ts'],
      exclude: ['**/*.d.ts', '**/*.test.ts', '**/*.spec.ts', 'tests/**']
    }
  }
})

