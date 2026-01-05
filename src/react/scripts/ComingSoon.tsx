import { Link } from 'react-router-dom'
import '../styles/comingsoon.css'
import logoDark from '../../assets/img/logo_dark.png'

interface ComingSoonProps {
  title: string
  description: string
}

function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="coming-soon-container">
      <div className="coming-soon-content">
        <img src={logoDark} alt="Posthook" className="coming-soon-logo" />
        <h1 className="coming-soon-title">{title}</h1>
        <p className="coming-soon-description">{description}</p>
        <div className="coming-soon-status">
          <span className="status-dot-large"></span>
          <span>Coming Soon</span>
        </div>
        <Link to="/" className="btn-back-home">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

export default ComingSoon

