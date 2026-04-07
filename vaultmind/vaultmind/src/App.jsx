import { useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import Sidebar from './components/Sidebar'
import AgentsPage from './pages/AgentsPage'
import IntentFeedPage from './pages/IntentFeedPage'
import IntentGraphPage from './pages/IntentGraphPage'
import TokenVaultPage from './pages/TokenVaultPage'
import StepUpModal from './components/StepUpModal'
import './index.css'
import './App.css'

export default function App() {
  const { isAuthenticated, isLoading, loginWithRedirect, user, logout } = useAuth0()
  const [page, setPage] = useState('intents')
  const [stepUp, setStepUp] = useState(null)

  if (isLoading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg)', fontFamily: 'var(--sans)',
        color: 'var(--text3)', fontSize: 14
      }}>
        Loading...
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', fontFamily: 'var(--sans)', gap: 16
      }}>
        <div style={{
          width: 48, height: 48, background: 'var(--text)',
          borderRadius: 12, display: 'flex', alignItems: 'center',
          justifyContent: 'center', marginBottom: 8
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z"/>
          </svg>
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.5 }}>
          VaultMind
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 8 }}>
          Authorization runtime for AI agents
        </div>
        <button
          onClick={() => loginWithRedirect()}
          style={{
            background: 'var(--text)', color: 'white', border: 'none',
            borderRadius: 8, padding: '10px 28px', fontSize: 14,
            fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--sans)'
          }}
        >
          Sign in with Auth0
        </button>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} user={user} onLogout={() => logout({ logoutParams: { returnTo: window.location.origin } })} />
      <main className="app-main">
        {page === 'agents'  && <AgentsPage />}
        {page === 'intents' && <IntentFeedPage onStepUp={setStepUp} />}
        {page === 'graph'   && <IntentGraphPage />}
        {page === 'tokens'  && <TokenVaultPage />}
      </main>
      {stepUp && (
        <StepUpModal
          intent={stepUp}
          onClose={() => setStepUp(null)}
          onApproved={() => setStepUp(null)}
        />
      )}
    </div>
  )
}