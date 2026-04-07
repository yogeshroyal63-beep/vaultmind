const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function call(fn) {
  try {
    return await fn()
  } catch (e) {
    throw new Error('Backend unreachable — make sure the FastAPI server is running')
  }
}

export const api = {
  // Agents
  getAgents:    ()     => call(() => fetch(`${BASE}/agents`).then(r => r.json())),
  getAgent:     (id)   => call(() => fetch(`${BASE}/agents/${id}`).then(r => r.json())),
  createAgent:  (body) => call(() => fetch(`${BASE}/agents`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json())),
  revokeAgent:  (id)   => call(() => fetch(`${BASE}/agents/${id}/revoke`, { method: 'PATCH' }).then(r => r.json())),
  restoreAgent: (id)   => call(() => fetch(`${BASE}/agents/${id}/restore`, { method: 'PATCH' }).then(r => r.json())),
  pauseAll:     ()     => call(() => fetch(`${BASE}/agents/all/pause`, { method: 'PATCH' }).then(r => r.json())),
  resumeAll:    ()     => call(() => fetch(`${BASE}/agents/all/resume`, { method: 'PATCH' }).then(r => r.json())),

  // Intents
  getIntents:    ()     => call(() => fetch(`${BASE}/intents`).then(r => r.json())),
  submitIntent:  (body) => call(() => fetch(`${BASE}/intents`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json())),
  approveIntent: (id)   => call(() => fetch(`${BASE}/intents/${id}/approve`, { method: 'POST' }).then(r => r.json())),
  denyIntent:    (id)   => call(() => fetch(`${BASE}/intents/${id}/deny`,    { method: 'POST' }).then(r => r.json())),
  stepUpIntent:  (id)   => call(() => fetch(`${BASE}/intents/${id}/stepup`,  { method: 'POST' }).then(r => r.json())),

  // Receipts
  getReceipt: (intentId) => call(() => fetch(`${BASE}/receipts/${intentId}`).then(r => {
    if (!r.ok) throw new Error(`Receipt not found (${r.status})`)
    return r.json()
  })),

  // Tokens
  getTokens:   ()   => call(() => fetch(`${BASE}/tokens`).then(r => r.json())),
  revokeToken: (id) => call(() => fetch(`${BASE}/tokens/${id}`, { method: 'DELETE' }).then(r => r.json())),

  // Stats
  getStats: () => call(() => fetch(`${BASE}/stats`).then(r => r.json())),
}

export function createWebSocket(onMessage) {
  const wsBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/^http/, 'ws')
  const ws = new WebSocket(`${wsBase}/ws`)
  ws.onmessage = (e) => onMessage(JSON.parse(e.data))
  ws.onerror   = (e) => console.warn('WS error', e)
  return ws
}
