import sqlite3
import json
from datetime import datetime

DB_PATH = "vaultmind.db"

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        model TEXT DEFAULT 'openclaw-3.5',
        status TEXT DEFAULT 'active',
        trust INTEGER DEFAULT 100,
        services TEXT DEFAULT '[]',
        policy TEXT DEFAULT '',
        created_at TEXT,
        last_seen TEXT,
        intent_count INTEGER DEFAULT 0
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS intents (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        action TEXT NOT NULL,
        service TEXT NOT NULL,
        detail TEXT NOT NULL,
        risk TEXT DEFAULT 'low',
        status TEXT DEFAULT 'pending',
        token_id TEXT,
        created_at TEXT,
        resolved_at TEXT,
        receipt TEXT,
        parent_intent_id TEXT
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS tokens (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        service TEXT NOT NULL,
        scope TEXT NOT NULL,
        intent_id TEXT NOT NULL,
        issued_at TEXT,
        expires_at TEXT,
        status TEXT DEFAULT 'active',
        auth0_token TEXT
    )''')

    agents = [
        ('ag-001', 'coder-prime',  'openclaw-3.5', 'active',    92, '["github","linear"]',        'can read any repo, push only to feature/* branches, cannot delete'),
        ('ag-002', 'research-owl', 'openclaw-3.5', 'active',    78, '["web","notion"]',            'can search web, read/write notion pages, cannot send anything'),
        ('ag-003', 'mail-scribe',  'openclaw-2',   'dormant',   34, '["gmail","calendar"]',        'can read emails, draft only — cannot send without step-up auth'),
        ('ag-004', 'deploy-bot',   'openclaw-3.5', 'suspended',  0, '["github","vercel"]',         'suspended — anomaly detected: attempted unauthorized service access'),
        ('ag-005', 'data-miner',   'openclaw-2',   'active',    88, '["sheets","notion"]',         'read/write google sheets, read-only notion'),
    ]
    now = datetime.utcnow().isoformat()
    for a in agents:
        c.execute('INSERT OR IGNORE INTO agents VALUES (?,?,?,?,?,?,?,?,?,?)',
                  (*a, now, now, 0))

    conn.commit()
    conn.close()

def reset_db():
    conn = get_db()
    conn.execute("DROP TABLE IF EXISTS agents")
    conn.execute("DROP TABLE IF EXISTS intents")
    conn.execute("DROP TABLE IF EXISTS tokens")
    conn.commit()
    conn.close()
    init_db()
