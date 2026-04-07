# VaultMind

**The first authorization primitive for multi-agent AI systems.**

VaultMind makes every agent action a signed, timestamped, human-authorized receipt. Built on Auth0 Token Vault — every token is intent-bound, policy-scoped, and auto-expiring. Agents never hold raw credentials.

---

## The Problem

When an AI agent acts on your behalf today, there is no receipt. No cryptographic proof that *you* authorized *this specific action* at *this specific moment* with *this specific scope*. If your agent sends an email or deletes a file, you have a log — but not a contract.

VaultMind separates two things every existing system conflates:
- **Access** — handled by Auth0 Token Vault (scoped, expiring credentials)
- **Accountability** — handled by VaultMind's receipt layer (signed intent proofs)

---

## Architecture

```
Agent → submits intent → VaultMind backend
                              ↓
                    Human reviews in UI
                              ↓
                    Policy compiler narrows scope
                              ↓
                    Auth0 Token Vault issues token
                              ↓
                    Agent receives receipt (not token)
                    Receipt stored permanently
```

---

## Key Features

| Feature | What it does |
|---|---|
| **Intent-bound tokens** | Every token is scoped to one action, issued fresh, expires after execution |
| **Policy compiler** | Plain-English rules ("cannot send", "read only") compile into real OAuth scopes at issuance |
| **Authorization receipts** | Every approved intent produces a signed JSON receipt — the accountability layer |
| **Step-up authentication** | High-risk actions require explicit human verification before Auth0 issues credentials |
| **Auto anomaly detection** | Agents accessing unauthorized services are auto-suspended in real time |
| **Trust decay** | Denied intents reduce agent trust scores; approved ones rebuild it |
| **Delegation chains** | Sub-agents inherit narrowed scopes from parent intent tokens |
| **Global kill switch** | One click suspends all agents and revokes all active tokens |
| **Live WebSocket feed** | Real-time intent stream — approve, deny, or escalate without polling |

---

## Setup

### Backend

```bash
cd vaultmind-backend
pip install -r requirements.txt
cp .env.example .env
# Fill in your Auth0 credentials in .env
python main.py
```

### Frontend

```bash
cd vaultmind
npm install
npm run dev
```

### Agent Simulator (generates live intents for demo)

```bash
cd vaultmind-backend
python agent_simulator.py
```

Open http://localhost:5173

---

## Auth0 Configuration

1. Create a tenant at https://auth0.com/signup
2. Create a **Machine-to-Machine application** for the backend
3. Create an **API** with identifier `https://vaultmind.api`
4. Enable the M2M app to call your API with all custom scopes
5. Copy credentials to `.env`

### Required scopes to configure in your Auth0 API
```
repo:read  repo:write  repo:write:feature/*
issues:read  issues:write
pages:read  pages:write
mail:read  mail:draft  mail:send
spreadsheets:read  spreadsheets:write
search:read
deployments:read  deployments:write
calendar:read
```

---

## API Reference

| Method | Route | Description |
|---|---|---|
| GET | /agents | List all agents |
| POST | /agents | Register new agent |
| PATCH | /agents/:id/revoke | Revoke agent + all tokens |
| PATCH | /agents/:id/restore | Restore suspended agent |
| PATCH | /agents/all/pause | Global kill switch |
| PATCH | /agents/all/resume | Resume all agents |
| GET | /intents | List all intents |
| POST | /intents | Submit intent (auto anomaly check runs here) |
| POST | /intents/:id/approve | Approve → compile policy → Token Vault issues token |
| POST | /intents/:id/deny | Deny, reduce trust score |
| POST | /intents/:id/stepup | Step-up auth approval |
| GET | /receipts/:intent_id | Get authorization receipt |
| GET | /tokens | List active tokens (auto-expires stale) |
| DELETE | /tokens/:id | Revoke token |
| WS | /ws | Real-time event stream |

---

## What We Discovered Building With Token Vault

The `client_credentials` grant carries an important constraint: the issued token has no `sub` claim tied to a human user. The token proves *application authorization* — not *human intent*.

This clarifies a split responsibility:
- **Token Vault handles access** (enforcement)
- **VaultMind handles accountability** (receipts)

We built the receipt layer specifically because of this boundary. Every receipt captures `agent_id`, `intent_id`, `issued_at`, `scope`, `policy_applied`, and `step_up_verified` — fields the token itself cannot carry.

We also discovered Token Vault's scope parameter is underused. VaultMind's policy compiler reads plain-English agent policies and narrows the scope string dynamically before each issuance call. The same M2M application issues different scopes to different agents based on their policy — no separate Auth0 applications per agent required.

---

## Bonus Blog Post

### The Token Is Not the Receipt: What Building VaultMind Taught Me About Agent Authorization

When I started VaultMind, I assumed Auth0 Token Vault would solve the full authorization problem for AI agents. Issue a scoped token, agent uses it, done. What I discovered while building is that token issuance and authorization accountability are two completely different problems — and conflating them is the reason nobody trusts AI agents today.

Token Vault's `client_credentials` grant is powerful — it lets you issue tightly scoped, short-lived tokens without exposing raw credentials to the agent. But the token itself carries no record of human intent. It proves the *application* was authorized. It doesn't prove *you* approved *this specific action* at *this specific moment*. If your agent sends an email using a valid token, the Auth0 log shows a valid request. It doesn't show that you said yes.

VaultMind separates these two layers deliberately. Every token issuance is preceded by a human approval event — the intent — and followed by a signed receipt stored independently of the token. The agent receives the receipt, not the raw token. Auth0 handles access. VaultMind handles the paper trail. Together they produce something neither could alone: a provable, human-authorized action log that survives token expiry.

We also discovered that Token Vault's scope parameter is underused by most implementations. Most developers pass a fixed scope string. VaultMind's policy compiler reads plain-English agent policies ("cannot send", "read only", "feature/* only") and narrows the scope dynamically before each Auth0 issuance call. The same M2M application issues different scopes to different agents based on their policy — no separate Auth0 applications needed per agent.

If you're building agentic systems with Token Vault, treat the token as the enforcement mechanism and build your accountability layer on top. Store intent, approval, scope, and timestamp together in a receipt. The token expires. The receipt doesn't. That distinction is everything.
