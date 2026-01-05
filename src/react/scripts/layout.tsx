import '../styles/layout.css'
import { WebhookProvider } from '../contexts/WebhookContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import Header from './header'
import Sidebar from './sidebar'
import Content from './content'
import Requests from './requests'
import Footer from './footer'

function Layout() {
  return (
    <NotificationProvider>
      <WebhookProvider>
        <div className="layout-grid">
          {/* Header Section */}
          <Header />

          {/* Sidebar - Contains URL/Test Sender */}
          <Sidebar />

          {/* Main Content Area */}
          <Content />

          {/* Requests List */}
          <Requests />

          {/* Footer */}
          <Footer />
        </div>
      </WebhookProvider>
    </NotificationProvider>
  )
}

export default Layout
