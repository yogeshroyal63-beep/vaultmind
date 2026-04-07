import { useState, useEffect } from 'react'
import { api } from '../api'
import { RefreshCw } from 'lucide-react'
import './IntentGraphPage.css'

const NODE_R = { agent: 28, intent: 20, service: 18 }

const COLORS = {
  agent:           { fill: '#1a1916', text: '#f8f7f4', stroke: 'none' },
  intent_approved: { fill: '#edfaf3', text: '#0d7a4e', stroke: '#b8edd4' },
  intent_pending:  { fill: '#eef3ff', text: '#1e6cff', stroke: '#c2d4ff' },
  intent_denied:   { fill: '#fff1ee', text: '#c8311a', stroke: '#ffd0c8' },
  intent_blocked:  { fill: '#fff1ee', text: '#c8311a', stroke: '#ffd0c8' },
  intent_medium:   { fill: '#fff8ee', text: '#b05c00', stroke: '#ffd99e' },
  service:         { fill: '#f2f1ee', text: '#6b6860', stroke: '#d4d1cb' },
}

function getIntentColor(intent) {
  if (intent.status === 'approved') return COLORS.intent_approved
  if (intent.status === 'pending')  return COLORS.intent_pending
  if (intent.status === 'denied' || intent.status === 'blocked') return COLORS.intent_denied
  if (intent.risk === 'medium')     return COLORS.intent_medium
  return COLORS.intent_pending
}

function buildGraph(agents, intents) {
  const nodes = []
  const edges = []
  const serviceSet = new Set()

  const visibleIntents = intents.slice(0, 12)

  visibleIntents.forEach(i => serviceSet.add(i.service))
  const services = [...serviceSet]

  const agentY   = (i, total) => 80 + i * (Math.max(500, total * 90) / Math.max(total, 1))
  const intentY  = (i, total) => 60 + i * (Math.max(520, total * 55) / Math.max(total, 1))
  const serviceY = (i, total) => 80 + i * (Math.max(400, total * 80) / Math.max(total, 1))

  agents.forEach((a, i) => {
    nodes.push({ id: a.id, type: 'agent', label: a.name, x: 120, y: agentY(i, agents.length), data: a })
  })

  visibleIntents.forEach((intent, i) => {
    nodes.push({
      id: intent.id, type: 'intent',
      label: intent.action.replace('_', ' '),
      x: 380, y: intentY(i, visibleIntents.length),
      data: intent
    })
    edges.push({ from: intent.agent_id, to: intent.id })
    edges.push({ from: intent.id, to: 'svc-' + intent.service })

    if (intent.parent_intent_id) {
      edges.push({ from: intent.parent_intent_id, to: intent.id, delegation: true })
    }
  })

  services.forEach((svc, i) => {
    nodes.push({
      id: 'svc-' + svc, type: 'service',
      label: svc, x: 620, y: serviceY(i, services.length)
    })
  })

  return { nodes, edges }
}

export default function IntentGraphPage() {
  const [agents, setAgents]   = useState([])
  const [intents, setIntents] = useState([])
  const [hovered, setHovered] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [error, setError]     = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [a, i] = await Promise.all([api.getAgents(), api.getIntents()])
      setAgents(a)
      setIntents(i)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const { nodes, edges } = buildGraph(agents, intents)
  const height = Math.max(500, nodes.length * 45)
  const svgWidth = Math.max(760, nodes.length * 20)

  function getNode(id) { return nodes.find(n => n.id === id) }

  function getNodeStyle(node) {
    if (node.type === 'agent')   return COLORS.agent
    if (node.type === 'service') return COLORS.service
    if (node.type === 'intent')  return getIntentColor(node.data)
    return COLORS.service
  }

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 className="page-title">Intent graph</h1>
          <button className="btn" style={{ marginLeft: 'auto' }} onClick={load}>
            <RefreshCw size={13} /> refresh
          </button>
        </div>
        <p className="page-sub">Live view of every agent action — agents → intents → services. Updates on refresh.</p>
      </div>

      {error && <div style={{ color: 'var(--red)', padding: 20 }}>{error}</div>}

      <div className="graph-legend">
        <div className="legend-item"><div className="legend-dot" style={{ background: '#1a1916' }} /><span>agent</span></div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#eef3ff', border: '1.5px solid #c2d4ff' }} /><span>pending</span></div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#edfaf3', border: '1.5px solid #b8edd4' }} /><span>approved</span></div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#fff1ee', border: '1.5px solid #ffd0c8' }} /><span>denied / blocked</span></div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#f2f1ee', border: '1.5px solid #d4d1cb' }} /><span>service</span></div>
        <div className="legend-item"><div style={{ width: 24, height: 2, background: '#c2d4ff', borderTop: '2px dashed #c2d4ff' }} /><span>delegation</span></div>
      </div>

      <div
        className="graph-container card"
        style={{ position: 'relative', overflowX: 'auto' }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text3)', fontSize: 13 }}>
            Loading live graph...
          </div>
        ) : nodes.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text3)', fontSize: 13, gap: 8 }}>
            <span>No agents or intents yet.</span>
            <span>Run the agent simulator to generate live data.</span>
            <code style={{ fontSize: 11, background: 'var(--surface2)', padding: '4px 8px', borderRadius: 6 }}>python agent_simulator.py</code>
          </div>
        ) : (
          <svg width={svgWidth} viewBox={`0 0 760 ${height}`} className="graph-svg">
            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#d4d1cb" />
              </marker>
              <marker id="arrow-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#c2d4ff" />
              </marker>
            </defs>

            {edges.map((edge, i) => {
              const from = getNode(edge.from)
              const to   = getNode(edge.to)
              if (!from || !to) return null
              const fr = NODE_R[from.type] || 20
              const tr = NODE_R[to.type]   || 20
              const dx = to.x - from.x, dy = to.y - from.y
              const len = Math.sqrt(dx*dx + dy*dy) || 1
              const ux = dx/len, uy = dy/len
              return (
                <line key={i}
                  x1={from.x + ux*fr} y1={from.y + uy*fr}
                  x2={to.x - ux*(tr+6)} y2={to.y - uy*(tr+6)}
                  stroke={edge.delegation ? '#c2d4ff' : '#d4d1cb'}
                  strokeWidth={edge.delegation ? 1.5 : 1}
                  strokeDasharray={edge.delegation ? '5 3' : 'none'}
                  markerEnd={`url(#${edge.delegation ? 'arrow-blue' : 'arrow'})`}
                />
              )
            })}

            {nodes.map(node => {
              const style = getNodeStyle(node)
              const r = NODE_R[node.type] || 20
              const isHovered = hovered === node.id
              const label = node.label.length > 10 ? node.label.slice(0, 9) + '…' : node.label

              return (
                <g key={node.id}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={node.x} cy={node.y} r={r + (isHovered ? 3 : 0)}
                    fill={style.fill}
                    stroke={style.stroke || 'none'}
                    strokeWidth="1.5"
                    style={{ transition: 'r 0.15s' }}
                  />
                  <text x={node.x} y={node.y + 1}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={node.type === 'agent' ? 9 : 8}
                    fontFamily="DM Mono, monospace"
                    fontWeight="500"
                    fill={style.text}
                  >{label}</text>
                </g>
              )
            })}
          </svg>
        )}

        {hovered && (() => {
          const node = nodes.find(n => n.id === hovered)
          if (!node) return null
          return (
            <div className="graph-tooltip" style={{ position: 'absolute', left: mousePos.x + 14, top: mousePos.y - 10, pointerEvents: 'none' }}>
              <div className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{node.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {node.type} · {node.id}
              </div>
              {node.data?.risk && (
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                  risk: {node.data.risk} · {node.data.status}
                </div>
              )}
              {node.data?.trust !== undefined && (
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                  trust: {node.data.trust} · {node.data.status}
                </div>
              )}
              {node.data?.parent_intent_id && (
                <div style={{ fontSize: 11, color: 'var(--blue)', marginTop: 2 }}>
                  ↳ delegated from {node.data.parent_intent_id}
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
