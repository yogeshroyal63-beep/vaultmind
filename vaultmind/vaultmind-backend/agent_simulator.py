"""
Simulated AI agent — submits real intents to VaultMind backend.
Run this separately to simulate an OpenClaw-style agent making requests.

Includes a delegation chain demo: coder-prime spawns a sub-intent
under a narrowed scope, showing the parent_intent_id chain.
"""
import httpx, random, asyncio

BASE = "http://localhost:8000"

# ag-003 (mail-scribe) is dormant — excluded so the backend rejects it correctly.
# ag-004 (deploy-bot) is suspended — excluded.
AGENT_INTENTS = [
    {"agent_id": "ag-001", "action": "push_branch",  "service": "github",  "detail": "Push 3 commits to feature/vault-integration"},
    {"agent_id": "ag-001", "action": "read_issues",  "service": "linear",  "detail": "Fetch all open issues in VaultMind sprint"},
    {"agent_id": "ag-002", "action": "web_search",   "service": "web",     "detail": "Search: Auth0 Token Vault best practices 2026"},
    {"agent_id": "ag-002", "action": "write_page",   "service": "notion",  "detail": "Create research summary page in workspace"},
    {"agent_id": "ag-005", "action": "write_sheet",  "service": "sheets",  "detail": "Update agent metrics dashboard row 12-40"},
    {"agent_id": "ag-001", "action": "read_issues",  "service": "linear",  "detail": "Check for newly assigned issues before push"},
]

async def run():
    print("Agent simulator running — submitting intents to VaultMind...")
    print("Delegation chain demo: coder-prime will spawn sub-intents after approval.")
    async with httpx.AsyncClient() as client:
        tick = 0
        while True:
            intent = random.choice(AGENT_INTENTS)
            try:
                r = await client.post(f"{BASE}/intents", json=intent)
                data = r.json()
                intent_id = data.get("intent_id")
                print(f"[AGENT] {intent['action']} → {intent['service']} | risk: {data.get('risk')} | id: {intent_id}")

                # Every 5th intent: demo delegation chain
                if tick % 5 == 4 and intent_id and data.get("status") != "blocked":
                    sub = {
                        "agent_id": "ag-001",
                        "action":   "read_issues",
                        "service":  "linear",
                        "detail":   f"Sub-agent read: checking Linear for context (delegated from {intent_id})",
                        "parent_intent_id": intent_id,
                    }
                    sr = await client.post(f"{BASE}/intents", json=sub)
                    sd = sr.json()
                    print(f"[DELEGATION] Sub-intent spawned → {sd.get('intent_id')} (parent: {intent_id})")

            except Exception as e:
                print(f"[AGENT] Error: {e}")
            tick += 1
            await asyncio.sleep(random.uniform(8, 20))

if __name__ == "__main__":
    asyncio.run(run())
