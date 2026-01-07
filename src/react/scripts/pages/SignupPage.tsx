import { SignUp } from '@clerk/clerk-react'

function SignupPage() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      overflow: 'visible',
    }}>
      <SignUp />
    </div>
  )
}

export default SignupPage

