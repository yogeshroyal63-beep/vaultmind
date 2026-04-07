import { useState, useEffect } from 'react'
import { api, createWebSocket } from '../api'
import { Check, X, AlertTriangle, Clock, Zap, RefreshCw, FileText, ChevronDown, ChevronUp, Shield } from 'lucide-react'
import './IntentFeedPage.css'

const riskConfig = {
  low:      { label: 'low risk',    cls: 'badge-green' },
  medium:   { label: 'medium risk', cls: 'badge-amber' },
  high:     { label: 'high risk',   cls: 'badge-red' },
  critical: { label: 'critical',    cls: 'badge-red' },
}

// Two-letter abbreviations instead of Unicode chars that break on Windows
const serviceIcons = {
  github: 'GH', notion: 'NT', gmail: 'GM', linear: 'LN',
  sheets: 'SH', web: 'WB', vercel: 'VL', calendar: 'CA'
}

function ReceiptDrawer({ intentId }) {
  const [open, setOpen] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [receiptError, setReceiptError] = useState(null)

  const loadReceipt = async () => {
    if (receipt) { setOpen(v => !v); return }
    setLoading(true)
    setReceiptError(null)
    try {
      const data = await api.getReceipt(intentId)
      setReceipt(data.receipt)
      setOpen(true)
    } catch (e) {
      setReceiptError('Receipt not available')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button
        className="btn"
        style={{ fontSize: 11, padding: '4px 10px', gap: 5 }}
        onClick={loadReceipt}
      >
        <FileText size={11} />
        {loading ? 'loading receipt…' : 'view receipt'}
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {receiptError && (
        <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>{receiptError}</div>
      )}

      {open && receipt && (
        <div className="receipt-drawer animate-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Shield size={11} color="var(--blue)" />
            <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Authorization Receipt
            </span>
            {receipt.step_up_verified && (
              <span className="badge badge-blue" style={{ fontSize: 9, padding: '1px 5px' }}>step-up</span>
            )}
            {receipt.delegation_chain && (
              <span className="badge badge-amber" style={{ fontSize: 9, padding: '1px 5px' }}>delegated</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              ['token id',   receipt.vault_token_id],
              ['scope',      receipt.scope],
              ['raw scope',  receipt.raw_scope_requested],
              ['policy',     receipt.policy_applied || '—'],
              ['issued at',  receipt.issued_at?.slice(0,19).replace('T',' ')],
              ['expires at', receipt.expires_at?.slice(0,19).replace('T',' ')],
              ['issued by',  receipt.issued_by],
              ['service',    receipt.service],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--text)', wordBreak: 'break-all' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function IntentCard({ intent, onApprove, onDeny, onStepUp, processing }) {
  const risk = riskConfig[intent.risk] || riskConfig.low
  const isHigh = intent.risk === 'high' || intent.risk === 'critical'
  const isPending = intent.status === 'pending'
  const isApproved = intent.status === 'approved'
  const time = intent.time || (intent.created_at ? new Date(intent.created_at).toLocaleTimeString() : '')
  const isProcessing = processing[intent.id]

  return (
    <div className={`intent-card ${intent.status} ${isHigh ? 'high-risk' : ''} ${intent.isNew ? 'animate-in' : ''}`}>
      <div className="intent-left">
        <div className="intent-service-icon" style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--text2)' }}>
          {serviceIcons[intent.service] || 'XX'}
        </div>
        <div className="intent-info">
          <div className="intent-top">
            <span className="mono intent-action">{intent.action}</span>
            <span className="intent-arrow">→</span>
            <span className="mono intent-service">{intent.service}</span>
            <span className={`badge ${risk.cls}`}>{risk.label}</span>
            {intent.token_id && <span className="badge badge-blue mono" style={{ fontSize: 10 }}>{intent.token_id}</span>}
            {intent.parent_intent_id && <span className="badge badge-amber" style={{ fontSize: 10 }}>delegated</span>}
          </div>
          <div className="intent-detail">{intent.detail}</div>
          <div className="intent-meta">
            <span className="intent-agent mono">{intent.agent_name}</span>
            <span className="intent-time"><Clock size={11} />{time}</span>
          </div>
          {isApproved && intent.token_id && (
            <ReceiptDrawer intentId={intent.id} />
          )}
        </div>
      </div>
      <div className="intent-right">
        {isPending ? (
          <div className="intent-actions">
            {isHigh ? (
              <button className="btn btn-red" onClick={() => onStepUp(intent)} disabled={isProcessing}>
                <AlertTriangle size={13} /> {isProcessing ? '…' : 'step-up auth'}
              </button>
            ) : (
              <button className="btn btn-green" onClick={() => onApprove(intent.id)} disabled={isProcessing}>
                <Check size={13} /> {isProcessing ? '…' : 'approve'}
              </button>
            )}
            <button className="btn btn-red" onClick={() => onDeny(intent.id)} disabled={isProcessing}>
              <X size={13} /> {isProcessing ? '…' : 'deny'}
            </button>
          </div>
        ) : (
          <div className={`intent-status-badge ${intent.status}`}>
            {intent.status === 'approved' && <><Check size={12} /> approved</>}
            {(intent.status === 'blocked' || intent.status === 'denied') && <><X size={12} /> {intent.status}</>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function IntentFeedPage({ onStepUp }) {
  const [intents, setIntents] = useState([])
  const [filter, setFilter]   = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [processing, setProcessing] = useState({})

  const load = async () => {
    try {
      const data = await api.getIntents()
      setIntents(data)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const ws = createWebSocket((event) => {
      if (event.type === 'new_intent') {
        setIntents(prev => [{ ...event.intent, isNew: true }, ...prev])
      } else if (event.type === 'intent_approved') {
        setIntents(prev => prev.map(i => i.id === event.intent_id
          ? { ...i, status: 'approved', token_id: event.token_id } : i))
      } else if (event.type === 'intent_denied') {
        setIntents(prev => prev.map(i => i.id === event.intent_id ? { ...i, status: 'denied' } : i))
      } else if (event.type === 'anomaly_detected') {
        setIntents(prev => prev.map(i => i.agent_id === event.agent_id && i.status === 'pending'
          ? { ...i, status: 'blocked' } : i))
      } else if (event.type === 'global_pause') {
        setIntents(prev => prev.map(i => i.status === 'pending' ? { ...i, status: 'blocked' } : i))
      }
    })
    return () => ws.close()
  }, [])

  const approve = async (id) => {
    setProcessing(p => ({ ...p, [id]: true }))
    try {
      const result = await api.approveIntent(id)
      setIntents(prev => prev.map(i => i.id === id
        ? { ...i, status: 'approved', token_id: result.token_id } : i))
    } finally {
      setProcessing(p => ({ ...p, [id]: false }))
    }
  }

  const deny = async (id) => {
    setProcessing(p => ({ ...p, [id]: true }))
    try {
      await api.denyIntent(id)
      setIntents(prev => prev.map(i => i.id === id ? { ...i, status: 'denied' } : i))
    } finally {
      setProcessing(p => ({ ...p, [id]: false }))
    }
  }

  const filtered = filter === 'all' ? intents : intents.filter(i => i.status === filter)
  const pending = intents.filter(i => i.status === 'pending').length

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 className="page-title">Intent feed</h1>
          {pending > 0 && <span className="badge badge-amber">{pending} pending</span>}
          <button className="btn" style={{ marginLeft: 'auto' }} onClick={load}>
            <RefreshCw size={13} /> refresh
          </button>
        </div>
        <p className="page-sub">Every action every agent wants to take — approve, deny, or escalate. Click "view receipt" on approved intents to see the Auth0 authorization proof.</p>
      </div>

      {error && <div style={{ color: 'var(--red)', padding: 20 }}>{error}</div>}

      <div className="feed-filters">
        {['all', 'pending', 'approved', 'denied', 'blocked'].map(f => (
          <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="feed-empty"><Zap size={20} color="var(--text3)" /><span>Loading intents...</span></div>
      ) : (
        <div className="intent-feed">
          {filtered.map(intent => (
            <IntentCard key={intent.id} intent={intent} onApprove={approve} onDeny={deny} onStepUp={onStepUp} processing={processing} />
          ))}
          {filtered.length === 0 && (
            <div className="feed-empty">
              <Zap size={20} color="var(--text3)" />
              <span>No intents yet</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Run <code style={{ background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4 }}>python agent_simulator.py</code> to generate live intents</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
