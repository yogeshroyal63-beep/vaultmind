import { useState, useEffect } from 'react'
import { api } from '../api'
import { Key, Trash2, Clock, Shield, RefreshCw } from 'lucide-react'
import './TokenVaultPage.css'

export default function TokenVaultPage() {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(Date.now())

  const load = async () => {
    try {
      const data = await api.getTokens()
      setTokens(data)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Tick every second so expiry countdown is live
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const revoke = async (id) => {
    await api.revokeToken(id)
    setTokens(prev => prev.filter(t => t.id !== id))
  }

  const timeAgo = (iso) => {
    if (!iso) return ''
    const diff = Math.floor((now - new Date(iso)) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`
    return `${Math.floor(diff/3600)}h ago`
  }

  const expiresIn = (iso) => {
    if (!iso) return ''
    const diff = Math.floor((new Date(iso) - now) / 1000)
    if (diff <= 0) return 'expired'
    if (diff < 60) return `${diff}s`
    return `${Math.floor(diff/60)}m ${diff%60}s`
  }

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 className="page-title">Token vault</h1>
          <span className="badge badge-blue">{tokens.length} active</span>
          <button className="btn" style={{ marginLeft: 'auto' }} onClick={load}>
            <RefreshCw size={13} /> refresh
          </button>
        </div>
        <p className="page-sub">Every live token issued by Auth0 Token Vault. Intent-bound, single-use, auto-expiring.</p>
      </div>

      {error && <div style={{ color: 'var(--red)', padding: 20 }}>{error}</div>}

      <div className="vault-note card" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Shield size={16} color="var(--blue)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>No agent ever holds a token</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
            Tokens are issued by Auth0 Token Vault per approved intent, scoped to minimum required permissions, and expire automatically. Agents receive only a signed receipt — not the credential itself.
          </div>
        </div>
      </div>

      {loading ? <div style={{ color: 'var(--text3)', padding: 20 }}>Loading tokens...</div> : (
        <div className="token-list">
          {tokens.map(token => (
            <div key={token.id} className="token-card card animate-in">
              <div className="token-header">
                <div className="token-id-wrap">
                  <Key size={13} color="var(--blue)" />
                  <span className="mono token-id">{token.id}</span>
                  <span className="badge badge-green">active</span>
                </div>
                <button className="btn btn-red" onClick={() => revoke(token.id)}>
                  <Trash2 size={12} /> revoke
                </button>
              </div>
              <hr className="divider" />
              <div className="token-grid">
                <div className="token-field">
                  <div className="token-label">agent</div>
                  <span className="mono" style={{ fontSize: 13, color: 'var(--blue)' }}>{token.agent_name}</span>
                </div>
                <div className="token-field">
                  <div className="token-label">service</div>
                  <span className="mono" style={{ fontSize: 13 }}>{token.service}</span>
                </div>
                <div className="token-field">
                  <div className="token-label">issued</div>
                  <span style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} /> {timeAgo(token.issued_at)}
                  </span>
                </div>
                <div className="token-field">
                  <div className="token-label">expires in</div>
                  <span style={{ fontSize: 13, color: 'var(--amber)', fontFamily: 'var(--mono)' }}>{expiresIn(token.expires_at)}</span>
                </div>
              </div>
              <div className="token-scope">
                <div className="token-label">scope</div>
                <div className="scope-string mono">{token.scope}</div>
              </div>
              <div className="token-field" style={{ marginTop: 10 }}>
                <div className="token-label">bound to intent</div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{token.intent_id}</span>
              </div>
            </div>
          ))}
          {tokens.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '60px', color: 'var(--text3)', fontSize: 13 }}>
              <Key size={20} color="var(--text3)" />
              <span>No active tokens</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
