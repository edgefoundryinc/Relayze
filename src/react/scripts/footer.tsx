import { Link } from 'react-router-dom'
import '../styles/footer.css'
import root from '../styles/root.css'

function Footer() {
  return (
    <footer className="layout-footer">
      <div className="footer-content">
        <div className="footer-usage">
          <span className="usage-label">Free Tier Usage</span>
          <span className="usage-percentage">24%</span>
        </div>
        <Link to="/upgrade" className="btn-upgrade">UPGRADE PLAN →</Link>
      </div>
    </footer>
  )
}

export default Footer
