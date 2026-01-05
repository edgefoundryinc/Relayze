import '../styles/footer.css'

function Footer() {
  return (
    <footer className="layout-footer">
      <div className="footer-content">
        <div className="footer-usage">
          <span className="usage-label">Free Tier Usage</span>
          <span className="usage-percentage">24%</span>
        </div>
        <button className="btn-upgrade">UPGRADE PLAN →</button>
      </div>
    </footer>
  )
}

export default Footer
