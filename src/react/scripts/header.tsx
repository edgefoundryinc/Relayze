import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react'
import '../styles/header.css'
import logoDark from '../assets/img/logo_dark.png'
import githubLogo from '../assets/img/github.png'

// Check if Clerk is available
const CLERK_AVAILABLE = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

function Header() {
  return (
    <nav className="layout-nav">
        <Link to="/" className="nav-logo">
          <img src={logoDark} alt="Posthook" className="logo-image" />
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
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="github-link">
            <img src={githubLogo} alt="GitHub" className="github-icon" />
          </a>
          
          {/* Clerk Authentication - only render if Clerk is configured */}
          {CLERK_AVAILABLE ? (
            <>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="btn-login">Log in</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="btn-signup">Sign up</button>
                </SignUpButton>
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
