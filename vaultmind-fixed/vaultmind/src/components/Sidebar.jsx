import { useState, useEffect } from 'react'
import { Shield, Zap, GitBranch, Key, Bot, LogOut } from 'lucide-react'
import './Sidebar.css'

const nav = [
  { id: 'intents', label: 'Intent feed', icon: Zap },
  { id: 'agents',  label: 'Agents',      icon: Bot },
  { id: 'graph',   label: 'Intent graph', icon: GitBranch },
  { id: 'tokens',  label: 'Token vault',  icon: Key },
]

export default function Sidebar({ page, setPage, user, onLogout }) {
  const [online, setOnline] = useState(false)

  useEffect(() => {
    const check = () => {
      fetch((import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/stats')
        .then(() => setOnline(true))
        .catch(() => setOnline(false))
    }
    check()
    const t = setInterval(check, 10000)
    return () => clearInterval(t)
  }, [])

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Shield size={16} strokeWidth={2} />
        </div>
        <div>
          <div className="logo-name">VaultMind</div>
          <div className="logo-sub">Auth0 · Token Vault</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${page === id ? 'active' : ''}`}
            onClick={() => setPage(id)}
          >
            <Icon size={15} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className={online ? 'status-dot active' : 'status-dot'} />
        <span className="mono" style={{ fontSize: 11, color: online ? 'var(--green)' : 'var(--red)', flex: 1 }}>
          {online ? 'online' : 'offline'}
        </span>
        {user && (
          <button
            onClick={onLogout}
            title="Sign out"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
          >
            <LogOut size={13} />
          </button>
        )}
      </div>

      {user && (
        <div style={{ padding: '10px 20px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>signed in as</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email || user.name}
          </div>
        </div>
      )}
    </aside>
  )
}
