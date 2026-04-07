# VaultMind Backend

FastAPI backend with real Auth0 Token Vault integration.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env
# Add your real Auth0 credentials to .env
```

## Run

```bash
# Terminal 1 — backend
python main.py

# Terminal 2 — agent simulator (generates live intents + delegation chain demo)
python agent_simulator.py

# Terminal 3 — frontend
cd ../vaultmind && npm run dev
```

## Architecture

- `main.py` — FastAPI app, policy compiler, all routes
- `auth0.py` — Real Auth0 M2M token issuance via Token Vault
- `database.py` — SQLite: agents, intents, tokens tables
- `agent_simulator.py` — Simulates OpenClaw-style agents submitting intents, includes delegation chain demo

## What makes this backend different

- **Policy compiler** — plain-English agent policies are compiled into real OAuth scope strings before every Token Vault issuance call
- **Auto anomaly detection** — runs inline on every `POST /intents`, auto-suspends agents accessing unauthorized services
- **Receipt layer** — every approved intent generates a signed JSON receipt stored separately from the token; `GET /receipts/:id` returns it
- **Delegation chains** — sub-intents inherit the intersection of their parent's scopes, enforced at issuance
- **Token auto-expiry** — `GET /tokens` auto-marks expired tokens before returning results
- **Global kill switch** — `PATCH /agents/all/pause` suspends all agents + revokes all tokens in one call

## All endpoints

| Method | Route | Description |
|---|---|---|
| GET | /agents | List all agents |
| POST | /agents | Register new agent |
| PATCH | /agents/:id/revoke | Revoke agent + all active tokens |
| PATCH | /agents/:id/restore | Restore suspended agent |
| PATCH | /agents/all/pause | Global kill switch |
| PATCH | /agents/all/resume | Resume all agents |
| GET | /intents | List all intents |
| POST | /intents | Submit intent (auto anomaly check inline) |
| POST | /intents/:id/approve | Compile policy → Token Vault issues token |
| POST | /intents/:id/deny | Deny, reduce trust score |
| POST | /intents/:id/stepup | Step-up auth approval, receipt flagged |
| GET | /receipts/:intent_id | Get authorization receipt |
| GET | /tokens | List active tokens (auto-expires stale) |
| DELETE | /tokens/:id | Revoke token |
| WS | /ws | Real-time event stream |
