import { useState } from 'react'
import { AlertTriangle, Shield, X, Check, Loader, FileText } from 'lucide-react'
import { api } from '../api'
import './StepUpModal.css'

export default function StepUpModal({ intent, onClose, onApproved }) {
  const [step, setStep] = useState('review') // review | verifying | done | error
  const [receipt, setReceipt] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handleVerify = async () => {
    setStep('verifying')
    try {
      const result = await api.stepUpIntent(intent.id)
      setReceipt(result.receipt)
      setStep('done')
      if (onApproved) onApproved(intent.id, result.token_id)
    } catch (e) {
      setErrorMsg(e.message || 'Auth0 Token Vault could not issue token')
      setStep('error')
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-in">
        <div className="modal-top">
          <div className="modal-icon-wrap">
            <AlertTriangle size={18} color="var(--red)" />
          </div>
          <button className="modal-close" onClick={onClose}><X size={15} /></button>
        </div>

        {step === 'review' && <>
          <h2 className="modal-title">Step-up authentication required</h2>
          <p className="modal-sub">
            This high-risk action requires your explicit verification before Auth0 Token Vault will issue a credential.
          </p>

          <div className="modal-intent-card">
            <div className="modal-field">
              <span className="modal-label">agent</span>
              <span className="mono" style={{ color: 'var(--blue)', fontSize: 13 }}>{intent.agent_name}</span>
            </div>
            <div className="modal-field">
              <span className="modal-label">action</span>
              <span className="mono" style={{ fontSize: 13 }}>{intent.action} → {intent.service}</span>
            </div>
            <div className="modal-field">
              <span className="modal-label">detail</span>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{intent.detail}</span>
            </div>
            <div className="modal-field">
              <span className="modal-label">risk</span>
              <span className="badge badge-red">{intent.risk} risk</span>
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16, lineHeight: 1.6 }}>
            The agent is paused until you verify. Your approval will be recorded as a signed receipt in the authorization log. Denying reduces this agent's trust score.
          </p>

          <div className="modal-actions">
            <button className="btn btn-red" style={{ flex: 1 }} onClick={onClose}>
              <X size={13} /> deny intent
            </button>
            <button className="btn btn-blue" style={{ flex: 1 }} onClick={handleVerify}>
              <Shield size={13} /> verify with Auth0
            </button>
          </div>
        </>}

        {step === 'verifying' && (
          <div className="modal-verify">
            <div className="verify-spinner">
              <Loader size={24} color="var(--blue)" className="spin" />
            </div>
            <div className="modal-title" style={{ fontSize: 16 }}>Verifying with Auth0...</div>
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>Token Vault is issuing a scoped, intent-bound credential</p>
          </div>
        )}

        {step === 'done' && receipt && (
          <div className="modal-verify" style={{ alignItems: 'flex-start', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, alignSelf: 'center' }}>
              <div className="verify-check">
                <Check size={22} color="var(--green)" />
              </div>
            </div>
            <div className="modal-title" style={{ fontSize: 15, alignSelf: 'center' }}>
              Verified — token issued by Auth0
            </div>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, alignSelf: 'center' }}>
              Step-up auth complete. Authorization receipt recorded.
            </p>

            {/* Real receipt from Auth0 Token Vault */}
            <div style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <FileText size={12} color="var(--text3)" />
                <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Authorization Receipt
                </span>
                {receipt.step_up_verified && (
                  <span className="badge badge-blue" style={{ fontSize: 9, padding: '2px 6px' }}>step-up verified</span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['token id',  receipt.vault_token_id],
                  ['scope',     receipt.scope],
                  ['service',   receipt.service],
                  ['issued by', receipt.issued_by],
                  ['expires',   receipt.expires_at?.slice(11,19) + ' UTC'],
                  ['policy',    receipt.policy_applied || '—'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text)', wordBreak: 'break-all' }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            <button className="btn btn-green" style={{ width: '100%' }} onClick={onClose}>
              <Check size={13} /> done
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="modal-verify">
            <div className="modal-icon-wrap" style={{ alignSelf: 'center' }}>
              <X size={18} color="var(--red)" />
            </div>
            <div className="modal-title" style={{ fontSize: 15 }}>Token Vault error</div>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>{errorMsg}</p>
            <button className="btn" style={{ width: '100%' }} onClick={() => setStep('review')}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
