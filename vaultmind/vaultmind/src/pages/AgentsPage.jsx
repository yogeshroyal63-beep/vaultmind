import { useState, useEffect } from 'react'
import { api } from '../api'
import { RotateCcw, Trash2, RefreshCw, Plus, X, PauseCircle, PlayCircle, Shield } from 'lucide-react'
import './AgentsPage.css'

const statusConfig = {
  active:    { label: 'active',    cls: 'badge-green' },
  dormant:   { label: 'dormant',   cls: 'badge-amber' },
  suspended: { label: 'suspended', cls: 'badge-red' },
}

const POLICY_RULES = [
  { keyword: 'cannot send',   desc: 'removes mail:send scope' },
  { keyword: 'cannot delete', desc: 'removes delete scopes' },
  { keyword: 'read only',     desc: 'restricts to read scopes only' },
  { keyword: 'read-only',     desc: 'restricts to read scopes only' },
  { keyword: 'cannot push',   desc: 'removes repo:write scope' },
  { keyword: 'feature/*',     desc: 'limits writes to feature/* branches' },
  { keyword: 'draft only',    desc: 'replaces mail:send with mail:draft' },
  { keyword: 'no deploy',     desc: 'removes deployments:write scope' },
]

function matchedRules(policy) {
  const lower = policy.toLowerCase()
  return POLICY_RULES.filter(r => lower.includes(r.keyword))
}

function TrustBar({ value, wide }) {
  const color = value > 70 ? 'var(--green)' : value > 40 ? 'var(--amber)' : 'var(--red)'
  return (
    <div className="trust-bar-wrap">
      <div className="trust-bar-track" style={{ width: wide ? 160 : 80 }}>
        <div className="trust-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="mono trust-val" style={{ color }}>{value}</span>
    </div>
  )
}

const ALL_SERVICES = ['github', 'linear', 'notion', 'gmail', 'sheets', 'web', 'vercel', 'calendar']

export default function AgentsPage() {
  const [agents, setAgents]         = useState([])
  const [selected, setSelected]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [globalPaused, setGlobalPaused] = useState(false)
  const [pausing, setPausing]       = useState(false)
  const [form, setForm] = useState({ name: '', model: 'openclaw-3.5', services: [], policy: '' })

  const load = async () => {
    try {
      const data = await api.getAgents()
      setAgents(data)
      setGlobalPaused(data.every(a => a.status === 'suspended'))
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const revoke = async (id) => {
    await api.revokeAgent(id)
    setAgents(prev => prev.map(a => a.id === id ? { ...a, status: 'suspended', trust: 0 } : a))
  }

  const restore = async (id) => {
    await api.restoreAgent(id)
    setAgents(prev => prev.map(a => a.id === id ? { ...a, status: 'active', trust: 50 } : a))
  }

  const handleGlobalPause = async () => {
    setPausing(true)
    try {
      if (globalPaused) {
        await api.resumeAll()
        setAgents(prev => prev.map(a => ({ ...a, status: 'active', trust: Math.max(a.trust, 50) })))
        setGlobalPaused(false)
      } else {
        await api.pauseAll()
        setAgents(prev => prev.map(a => ({ ...a, status: 'suspended' })))
        setGlobalPaused(true)
      }
    } finally {
      setPausing(false)
    }
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return
    const result = await api.createAgent(form)
    setAgents(prev => [result, ...prev])
    setShowCreate(false)
    setForm({ name: '', model: 'openclaw-3.5', services: [], policy: '' })
  }

  const toggleService = (svc) => {
    setForm(f => ({
      ...f,
      services: f.services.includes(svc)
        ? f.services.filter(s => s !== svc)
        : [...f.services, svc]
    }))
  }

  const agent = selected ? agents.find(a => a.id === selected) : null
  const rules = agent ? matchedRules(agent.policy) : []

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="page-title">Agents</h1>

          <button
            className={`btn ${globalPaused ? 'btn-green' : 'btn-red'}`}
            onClick={handleGlobalPause}
            disabled={pausing}
            title={globalPaused ? 'Resume all agents' : 'Pause all agents'}
          >
            {globalPaused
              ? <><PlayCircle size={13} /> {pausing ? 'resuming…' : 'resume all'}</>
              : <><PauseCircle size={13} /> {pausing ? 'pausing…' : 'pause all'}</>}
          </button>

          <button className="btn btn-blue" onClick={() => setShowCreate(v => !v)}>
            <Plus size={13} /> new agent
          </button>
          <button className="btn" style={{ marginLeft: 'auto' }} onClick={load}>
            <RefreshCw size={13} /> refresh
          </button>
        </div>
        <p className="page-sub">Registered agents, trust scores, and permission policies.</p>
      </div>

      {error && <div style={{ color: 'var(--red)', padding: 20 }}>{error}</div>}

      {showCreate && (
        <div className="card animate-in" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Register new agent</span>
            <button className="modal-close" onClick={() => setShowCreate(false)}><X size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <div className="detail-label" style={{ marginBottom: 6 }}>Agent name</div>
              <input
                className="form-input"
                placeholder="e.g. my-coder-agent"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <div className="detail-label" style={{ marginBottom: 6 }}>Model</div>
              <select
                className="form-input"
                value={form.model}
                onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
              >
                <option value="openclaw-3.5">openclaw-3.5</option>
                <option value="openclaw-2">openclaw-2</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div className="detail-label" style={{ marginBottom: 6 }}>Allowed services</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ALL_SERVICES.map(svc => (
                <button
                  key={svc}
                  className={`badge mono ${form.services.includes(svc) ? 'badge-blue' : 'badge-gray'}`}
                  style={{ cursor: 'pointer', border: 'none' }}
                  onClick={() => toggleService(svc)}
                >{svc}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div className="detail-label" style={{ marginBottom: 6 }}>Natural language policy</div>
            <textarea
              className="form-input"
              style={{ resize: 'vertical', minHeight: 60 }}
              placeholder='e.g. "can read any repo, push only to feature/* branches, cannot delete"'
              value={form.policy}
              onChange={e => setForm(f => ({ ...f, policy: e.target.value }))}
            />
            {form.policy && matchedRules(form.policy).length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div className="detail-label" style={{ marginBottom: 4 }}>Policy compiler preview</div>
                {matchedRules(form.policy).map(r => (
                  <div key={r.keyword} style={{ fontSize: 11, color: 'var(--green)', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                    <Shield size={10} />
                    <span className="mono">"{r.keyword}"</span>
                    <span style={{ color: 'var(--text3)' }}>→ {r.desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-blue" onClick={handleCreate}>
            <Plus size={13} /> register agent
          </button>
        </div>
      )}

      {loading ? <div style={{ color: 'var(--text3)', padding: 20 }}>Loading agents...</div> : (
        <div className="agents-layout">
          <div className="agents-list">
            {agents.map(a => {
              const sc = statusConfig[a.status] || statusConfig.dormant
              return (
                <div key={a.id}
                  className={`agent-row ${selected === a.id ? 'selected' : ''} ${a.status}`}
                  onClick={() => setSelected(selected === a.id ? null : a.id)}
                >
                  <div className="agent-row-left">
                    <div className={`agent-dot ${a.status}`} />
                    <div>
                      <div className="agent-name mono">{a.name}</div>
                      <div className="agent-model">{a.model} · {a.last_seen ? new Date(a.last_seen).toLocaleTimeString() : 'never'}</div>
                    </div>
                  </div>
                  <div className="agent-row-right">
                    <TrustBar value={a.trust} />
                    <span className={`badge ${sc.cls}`}>{sc.label}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {agent && (
            <div className="agent-detail card animate-in">
              <div className="agent-detail-header">
                <div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 500 }}>{agent.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{agent.id}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {agent.status === 'suspended' ? (
                    <button className="btn btn-blue" onClick={() => restore(agent.id)}>
                      <RotateCcw size={13} /> restore
                    </button>
                  ) : (
                    <button className="btn btn-red" onClick={() => revoke(agent.id)}>
                      <Trash2 size={13} /> revoke all
                    </button>
                  )}
                </div>
              </div>
              <hr className="divider" />
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">Trust score</div>
                  <TrustBar value={agent.trust} wide />
                </div>
                <div className="detail-item">
                  <div className="detail-label">Status</div>
                  <span className={`badge ${(statusConfig[agent.status] || statusConfig.dormant).cls}`}>{agent.status}</span>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Total intents</div>
                  <span className="mono" style={{ fontSize: 14 }}>{agent.intent_count || 0}</span>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Registered</div>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>{agent.created_at?.slice(0, 10)}</span>
                </div>
              </div>
              <hr className="divider" />
              <div className="detail-item" style={{ marginBottom: 12 }}>
                <div className="detail-label">Connected services</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {(agent.services || []).map(s => <span key={s} className="badge badge-gray mono">{s}</span>)}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Natural language policy</div>
                <div className="policy-text">{agent.policy || '—'}</div>
                {rules.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div className="detail-label" style={{ marginBottom: 4 }}>Compiled scope restrictions</div>
                    {rules.map(r => (
                      <div key={r.keyword} style={{ fontSize: 11, color: 'var(--green)', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                        <Shield size={10} />
                        <span className="mono">"{r.keyword}"</span>
                        <span style={{ color: 'var(--text3)' }}>→ {r.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
