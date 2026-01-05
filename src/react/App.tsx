import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './scripts/pages/HomePage'
import DocsPage from './scripts/pages/DocsPage'
import PricingPage from './scripts/pages/PricingPage'
import APIPage from './scripts/pages/APIPage'
import LoginPage from './scripts/pages/LoginPage'
import SignupPage from './scripts/pages/SignupPage'
import './styles/root.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/api" element={<APIPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Routes>
    </Router>
  )
}

export default App

