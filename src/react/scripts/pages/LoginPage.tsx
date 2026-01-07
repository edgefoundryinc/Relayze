import { SignIn } from '@clerk/clerk-react'

function LoginPage() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      overflow: 'visible',
    }}>
      <SignIn />
    </div>
  )
}

export default LoginPage

