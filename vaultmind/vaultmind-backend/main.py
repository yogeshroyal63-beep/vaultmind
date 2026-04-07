import os, json, uuid
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Header, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from dotenv import load_dotenv
from database import init_db, get_db, reset_db
from auth0 import issue_scoped_token, verify_token

load_dotenv()

app = FastAPI(title="VaultMind API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", os.getenv("FRONTEND_URL", "")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

connected_clients: list[WebSocket] = []


@app.on_event("startup")
async def startup():
    init_db()


# ── AUTH DEPENDENCY ──────────────────────────────────────

async def require_auth(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ")[1]
    return await verify_token(token)


# ── WEBSOCKET ────────────────────────────────────────────

async def broadcast(event: dict):
    dead = []
    for ws in connected_clients:
        try:
            await ws.send_json(event)
        except Exception:
            dead.append(ws)
    connected_clients[:] = [ws for ws in connected_clients if ws not in dead]


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        connected_clients[:] = [ws for ws in connected_clients if ws is not websocket]


# ── POLICY COMPILER ──────────────────────────────────────

POLICY_RULES = [
    ("cannot send",   lambda s: s.replace("mail:send", "").strip()),
    ("cannot delete", lambda s: s.replace("repo:delete", "").replace("spreadsheets:delete", "").strip()),
    ("read only",     lambda s: " ".join(p for p in s.split() if "read" in p or "search" in p)),
    ("read-only",     lambda s: " ".join(p for p in s.split() if "read" in p or "search" in p)),
    ("cannot push",   lambda s: s.replace("repo:write", "").strip()),
    ("feature/*",     lambda s: s.replace("repo:write", "repo:write:feature/*")),
    ("draft only",    lambda s: s.replace("mail:send", "mail:draft")),
    ("no deploy",     lambda s: s.replace("deployments:write", "").strip()),
]

def compile_policy(policy: str, raw_scope: str) -> str:
    scope = raw_scope
    policy_lower = policy.lower()
    for keyword, transformer in POLICY_RULES:
        if keyword in policy_lower:
            scope = transformer(scope)
    return " ".join(scope.split()) or "read"


SERVICE_SCOPES = {
    "github":   "repo:read repo:write",
    "linear":   "issues:read issues:write",
    "notion":   "pages:read pages:write",
    "gmail":    "mail:read mail:draft mail:send",
    "sheets":   "spreadsheets:read spreadsheets:write",
    "web":      "search:read",
    "vercel":   "deployments:read deployments:write",
    "calendar": "calendar:read",
}

RISK_MAP = {
    "send_email": "high", "delete": "high", "push_main": "critical",
    "push_branch": "low", "read_issues": "low", "write_page": "low",
    "web_search": "low", "write_sheet": "low", "delete_draft": "medium",
    "deploy": "high", "read_email": "low", "create_issue": "low",
}


# ── ADMIN ────────────────────────────────────────────────

@app.post("/admin/reset")
def admin_reset():
    reset_db()
    return {"status": "reset"}


# ── AGENTS ──────────────────────────────────────────────

@app.get("/agents")
def list_agents():
    db = get_db()
    rows = db.execute("SELECT * FROM agents ORDER BY created_at DESC").fetchall()
    db.close()
    agents = []
    for r in rows:
        a = dict(r)
        a["services"] = json.loads(a["services"])
        agents.append(a)
    return agents

@app.get("/agents/{agent_id}")
def get_agent(agent_id: str):
    db = get_db()
    row = db.execute("SELECT * FROM agents WHERE id=?", (agent_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(404, "Agent not found")
    a = dict(row)
    a["services"] = json.loads(a["services"])
    return a

class AgentCreate(BaseModel):
    name: str
    model: str = "openclaw-3.5"
    services: list[str] = []
    policy: str = ""

@app.post("/agents")
def create_agent(body: AgentCreate):
    db = get_db()
    # Use uuid for sufficient uniqueness (no 1000-ID collision)
    agent_id = "ag-" + uuid.uuid4().hex[:8]
    now = datetime.utcnow().isoformat()
    db.execute(
        "INSERT INTO agents VALUES (?,?,?,?,?,?,?,?,?,?)",
        (agent_id, body.name, body.model, "active", 100,
         json.dumps(body.services), body.policy, now, now, 0)
    )
    db.commit()
    db.close()
    return {"id": agent_id, "name": body.name, "status": "active", "trust": 100,
            "services": body.services, "policy": body.policy,
            "model": body.model, "intent_count": 0, "created_at": now, "last_seen": now}


# Literal path segments MUST come before parameterised ones to avoid /all being
# matched as an agent_id.
@app.patch("/agents/all/pause")
async def pause_all_agents():
    """Global kill switch — suspends every active agent and revokes all tokens."""
    db = get_db()
    db.execute("UPDATE agents SET status='suspended' WHERE status='active'")
    db.execute("UPDATE tokens SET status='revoked' WHERE status='active'")
    db.commit()
    db.close()
    await broadcast({"type": "global_pause"})
    return {"status": "all_suspended"}

@app.patch("/agents/all/resume")
async def resume_all_agents():
    db = get_db()
    db.execute("UPDATE agents SET status='active', trust=50 WHERE status='suspended'")
    db.commit()
    db.close()
    await broadcast({"type": "global_resume"})
    return {"status": "all_resumed"}

@app.patch("/agents/{agent_id}/revoke", dependencies=[Depends(require_auth)])
async def revoke_agent(agent_id: str):
    db = get_db()
    db.execute("UPDATE agents SET status='suspended', trust=0 WHERE id=?", (agent_id,))
    db.execute("UPDATE tokens SET status='revoked' WHERE agent_id=? AND status='active'", (agent_id,))
    db.commit()
    db.close()
    await broadcast({"type": "agent_revoked", "agent_id": agent_id})
    return {"status": "suspended"}

@app.patch("/agents/{agent_id}/restore")
async def restore_agent(agent_id: str):
    db = get_db()
    db.execute("UPDATE agents SET status='active', trust=50 WHERE id=?", (agent_id,))
    db.commit()
    db.close()
    await broadcast({"type": "agent_restored", "agent_id": agent_id})
    return {"status": "active", "trust": 50}


# ── INTENTS ──────────────────────────────────────────────

class IntentSubmit(BaseModel):
    agent_id: str
    action: str  = Field(..., max_length=100)
    service: str = Field(..., max_length=50)
    detail: str  = Field(..., max_length=500)
    parent_intent_id: Optional[str] = None

@app.get("/intents")
def list_intents():
    db = get_db()
    rows = db.execute("SELECT * FROM intents ORDER BY created_at DESC LIMIT 100").fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.post("/intents")
async def submit_intent(body: IntentSubmit):
    db = get_db()
    agent = db.execute("SELECT * FROM agents WHERE id=?", (body.agent_id,)).fetchone()
    if not agent:
        raise HTTPException(404, "Agent not found")
    agent = dict(agent)
    if agent["status"] in ("suspended", "dormant"):
        raise HTTPException(403, "Agent is suspended or dormant")

    # Longer ID prefix — 12 hex chars for sufficient uniqueness
    intent_id = "int-" + uuid.uuid4().hex[:12]
    risk = RISK_MAP.get(body.action, "low")
    now = datetime.utcnow().isoformat()

    db.execute(
        "INSERT INTO intents VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (intent_id, body.agent_id, agent["name"], body.action,
         body.service, body.detail, risk, "pending", None, now, None, None,
         body.parent_intent_id)
    )
    db.execute("UPDATE agents SET intent_count=intent_count+1, last_seen=? WHERE id=?",
               (now, body.agent_id))
    db.commit()

    allowed_services = json.loads(agent["services"])
    anomaly_detected = False
    if body.service not in allowed_services and allowed_services:
        db.execute("UPDATE agents SET status='suspended', trust=0 WHERE id=?", (body.agent_id,))
        db.execute("UPDATE intents SET status='blocked' WHERE id=?", (intent_id,))
        db.commit()
        anomaly_detected = True
        await broadcast({
            "type": "anomaly_detected",
            "agent_id": body.agent_id,
            "agent_name": agent["name"],
            "reason": f"Accessed unauthorized service: {body.service}",
        })

    db.close()

    await broadcast({
        "type": "new_intent",
        "intent": {
            "id": intent_id, "agent_id": body.agent_id,
            "agent_name": agent["name"], "action": body.action,
            "service": body.service, "detail": body.detail,
            "risk": risk, "status": "blocked" if anomaly_detected else "pending",
            "time": "just now", "parent_intent_id": body.parent_intent_id,
        }
    })

    if anomaly_detected:
        return {"intent_id": intent_id, "risk": risk, "status": "blocked",
                "anomaly": True, "reason": f"Unauthorized service: {body.service}"}
    return {"intent_id": intent_id, "risk": risk, "status": "pending"}


async def _issue_and_store_token(intent: dict, db) -> dict:
    """Token Vault core: compile policy → issue scoped token → store receipt."""
    agent = db.execute("SELECT * FROM agents WHERE id=?", (intent["agent_id"],)).fetchone()
    agent = dict(agent) if agent else {}
    policy = agent.get("policy", "")
    raw_scope = SERVICE_SCOPES.get(intent["service"], "read")
    compiled_scope = compile_policy(policy, raw_scope)

    if intent.get("parent_intent_id"):
        parent_token = db.execute(
            "SELECT scope FROM tokens WHERE intent_id=?", (intent["parent_intent_id"],)
        ).fetchone()
        if parent_token:
            parent_scopes  = set(parent_token["scope"].split())
            compiled_scopes = set(compiled_scope.split())
            compiled_scope = " ".join(parent_scopes & compiled_scopes) or "read"

    try:
        token_data = await issue_scoped_token(compiled_scope, intent["agent_id"])
        auth0_token = token_data["access_token"]
        expires_in  = token_data.get("expires_in", 900)
    except Exception as e:
        raise HTTPException(500, f"Token Vault error: {str(e)}")

    token_id   = "tvt_" + uuid.uuid4().hex[:12]
    now        = datetime.utcnow().isoformat()
    expires_at = (datetime.utcnow() + timedelta(seconds=expires_in)).isoformat()

    receipt = {
        "vault_token_id":      token_id,
        "scope":               compiled_scope,
        "raw_scope_requested": raw_scope,
        "policy_applied":      policy,
        "service":             intent["service"],
        "intent_id":           intent["id"],
        "agent_id":            intent["agent_id"],
        "issued_at":           now,
        "expires_at":          expires_at,
        "issued_by":           "auth0_token_vault",
        "parent_intent_id":    intent.get("parent_intent_id"),
        "delegation_chain":    bool(intent.get("parent_intent_id")),
    }

    db.execute(
        "INSERT INTO tokens VALUES (?,?,?,?,?,?,?,?,?,?)",
        (token_id, intent["agent_id"], intent["agent_name"],
         intent["service"], compiled_scope, intent["id"],
         now, expires_at, "active", auth0_token)
    )
    db.execute(
        "UPDATE intents SET status='approved', token_id=?, resolved_at=?, receipt=? WHERE id=?",
        (token_id, now, json.dumps(receipt), intent["id"])
    )
    db.execute("UPDATE agents SET trust=MIN(100,trust+2) WHERE id=?", (intent["agent_id"],))
    return {"token_id": token_id, "receipt": receipt, "scope": compiled_scope}


@app.post("/intents/{intent_id}/approve", dependencies=[Depends(require_auth)])
async def approve_intent(intent_id: str):
    db = get_db()
    intent = db.execute("SELECT * FROM intents WHERE id=?", (intent_id,)).fetchone()
    if not intent:
        raise HTTPException(404)
    intent = dict(intent)
    if intent["status"] != "pending":
        raise HTTPException(400, "Intent already resolved")
    result = await _issue_and_store_token(intent, db)
    db.commit()
    db.close()
    await broadcast({"type": "intent_approved", "intent_id": intent_id,
                     "token_id": result["token_id"]})
    return {"status": "approved", **result}


@app.post("/intents/{intent_id}/deny", dependencies=[Depends(require_auth)])
async def deny_intent(intent_id: str):
    db = get_db()
    intent = db.execute("SELECT * FROM intents WHERE id=?", (intent_id,)).fetchone()
    if not intent:
        raise HTTPException(404)
    intent = dict(intent)
    now = datetime.utcnow().isoformat()
    db.execute("UPDATE intents SET status='denied', resolved_at=? WHERE id=?", (now, intent_id))
    db.execute("UPDATE agents SET trust=MAX(0,trust-5) WHERE id=?", (intent["agent_id"],))
    db.commit()
    db.close()
    await broadcast({"type": "intent_denied", "intent_id": intent_id})
    return {"status": "denied"}


@app.post("/intents/{intent_id}/stepup", dependencies=[Depends(require_auth)])
async def stepup_approve(intent_id: str):
    """Step-up auth gate: human clicking 'Verify with Auth0' is the MFA step."""
    db = get_db()
    intent = db.execute("SELECT * FROM intents WHERE id=?", (intent_id,)).fetchone()
    if not intent:
        raise HTTPException(404)
    intent = dict(intent)
    if intent["status"] != "pending":
        raise HTTPException(400, "Intent already resolved")

    result  = await _issue_and_store_token(intent, db)
    receipt = result["receipt"]
    receipt["step_up_verified"] = True
    receipt["step_up_at"]       = datetime.utcnow().isoformat()
    db.execute("UPDATE intents SET receipt=? WHERE id=?",
               (json.dumps(receipt), intent_id))
    db.commit()
    db.close()

    await broadcast({"type": "intent_approved", "intent_id": intent_id,
                     "token_id": result["token_id"], "step_up": True})
    return {"status": "approved", "step_up_verified": True, **result}


# ── RECEIPTS ─────────────────────────────────────────────

@app.get("/receipts/{intent_id}")
def get_receipt(intent_id: str):
    db = get_db()
    row = db.execute("SELECT receipt, status FROM intents WHERE id=?", (intent_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(404, "Intent not found")
    row = dict(row)
    if not row["receipt"]:
        raise HTTPException(404, "No receipt — intent not yet approved")
    return {"intent_id": intent_id, "status": row["status"],
            "receipt": json.loads(row["receipt"])}


# ── TOKENS ───────────────────────────────────────────────

def _expire_tokens():
    """Background task — moves expired tokens to 'expired' status."""
    db = get_db()
    now = datetime.utcnow().isoformat()
    db.execute("UPDATE tokens SET status='expired' WHERE expires_at < ? AND status='active'", (now,))
    db.commit()
    db.close()

@app.get("/tokens")
def list_tokens(background_tasks: BackgroundTasks):
    background_tasks.add_task(_expire_tokens)
    db = get_db()
    rows = db.execute(
        "SELECT id,agent_id,agent_name,service,scope,intent_id,issued_at,expires_at,status "
        "FROM tokens WHERE status='active' ORDER BY issued_at DESC"
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]

@app.delete("/tokens/{token_id}", dependencies=[Depends(require_auth)])
async def revoke_token(token_id: str):
    db = get_db()
    db.execute("UPDATE tokens SET status='revoked' WHERE id=?", (token_id,))
    db.commit()
    db.close()
    await broadcast({"type": "token_revoked", "token_id": token_id})
    return {"status": "revoked"}


# ── STATS ─────────────────────────────────────────────────

@app.get("/stats")
def get_stats(background_tasks: BackgroundTasks):
    background_tasks.add_task(_expire_tokens)
    db = get_db()
    total_agents    = db.execute("SELECT COUNT(*) FROM agents").fetchone()[0]
    active_agents   = db.execute("SELECT COUNT(*) FROM agents WHERE status='active'").fetchone()[0]
    pending_intents = db.execute("SELECT COUNT(*) FROM intents WHERE status='pending'").fetchone()[0]
    active_tokens   = db.execute("SELECT COUNT(*) FROM tokens WHERE status='active'").fetchone()[0]
    total_intents   = db.execute("SELECT COUNT(*) FROM intents").fetchone()[0]
    db.close()
    return {"total_agents": total_agents, "active_agents": active_agents,
            "pending_intents": pending_intents, "active_tokens": active_tokens,
            "total_intents": total_intents}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
