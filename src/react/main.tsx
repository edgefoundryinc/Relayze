import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ClerkProvider } from '@clerk/clerk-react'
import { ThemeProvider } from './contexts/ThemeContext'

// Normalize the Clerk key: remove quotes, trim whitespace
const rawKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const PUBLISHABLE_KEY = rawKey 
  ? rawKey.trim().replace(/^['"]|['"]$/g, '') 
  : undefined

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {PUBLISHABLE_KEY ? (
        <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
          <App />
        </ClerkProvider>
      ) : (
        <App />
      )}
    </ThemeProvider>
  </StrictMode>
)

