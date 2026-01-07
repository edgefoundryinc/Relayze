import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import { useTheme } from '../contexts/ThemeContext'
import '../styles/header.css'
import logoDark from '../assets/img/logo_dark.png'
import logoLight from '../assets/img/logo.png'
import githubDark from '../assets/img/github.png'
import githubLight from '../assets/img/github-light.png'

// Check if Clerk is available (normalize the key)
const rawKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const CLERK_AVAILABLE = !!(rawKey && rawKey.trim().replace(/^['"]|['"]$/g, ''))

function Header() {
  const { theme, toggleTheme } = useTheme()

  return (
    <nav className="layout-nav">
        <Link to="/" className="nav-logo">
          <img 
            src={theme === 'dark' ? logoDark : logoLight} 
            alt="Posthook" 
            className="logo-image" 
          />
        </Link>
        <nav className="nav-links">
          <Link to="/docs">Docs</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/api">API</Link>
        </nav>
        <div className="nav-auth">
          {/*<span className="live-indicator">
            <span className="live-dot"></span>
            Systems Operational
          </span>*/}
          
          {/* Theme Toggle */}
          <button 
            className="theme-toggle" 
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <div className={`toggle-switch ${theme}`}>
              <div className="toggle-circle"></div>
            </div>
          </button>

          <a href="https://github.com/edgefoundryinc/Posthook" target="_blank" rel="noopener noreferrer" className="github-link">
            <img 
              src={theme === 'dark' ? githubDark : githubLight} 
              alt="GitHub" 
              className="github-icon" 
            />
          </a>
          
          {/* Clerk Authentication - only render if Clerk is configured */}
          {CLERK_AVAILABLE ? (
            <>
              <SignedOut>
                <Link to="/login">
                  <button className="btn-login">Log in</button>
                </Link>
                <Link to="/signup">
                  <button className="btn-signup">Sign up</button>
                </Link>
              </SignedOut>
              <SignedIn>
                <UserButton 
                  appearance={{
                    elements: {
                      avatarBox: "w-10 h-10"
                    }
                  }}
                />
              </SignedIn>
            </>
          ) : (
            /* Fallback buttons when Clerk is not configured */
            <>
              <Link to="/login">
                <button className="btn-login">Log in</button>
              </Link>
              <Link to="/signup">
                <button className="btn-signup">Sign up</button>
              </Link>
            </>
          )}
        </div>
      </nav>
  )
}

export default Header
