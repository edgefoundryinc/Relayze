import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ClerkProvider } from '@clerk/clerk-react'

// Import your Clerk publishable key (optional - app works without it)
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

console.log('ENV CHECK:', {
  key: PUBLISHABLE_KEY ? 'EXISTS' : 'MISSING (running without auth)',
  allEnv: import.meta.env
})

// Render app with or without Clerk based on key availability
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {PUBLISHABLE_KEY ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <App />
      </ClerkProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)

