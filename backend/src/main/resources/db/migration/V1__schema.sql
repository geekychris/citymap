-- TOGAF-style city map schema. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS component (
    id           TEXT PRIMARY KEY,
    parent_id    TEXT REFERENCES component(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    type         TEXT NOT NULL,          -- CITY | DISTRICT | NEIGHBORHOOD | BUILDING | ROOM | free-form
    level        INTEGER NOT NULL,        -- L0..Ln
    x            REAL NOT NULL DEFAULT 0,
    y            REAL NOT NULL DEFAULT 0,
    width        REAL NOT NULL DEFAULT 320,
    height       REAL NOT NULL DEFAULT 200,
    color        TEXT,
    icon         TEXT,
    description  TEXT,
    notes        TEXT,                    -- markdown
    metadata     TEXT NOT NULL DEFAULT '{}', -- json blob
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_component_parent ON component(parent_id);
CREATE INDEX IF NOT EXISTS idx_component_type   ON component(type);
CREATE INDEX IF NOT EXISTS idx_component_level  ON component(level);

CREATE TABLE IF NOT EXISTS connection (
    id           TEXT PRIMARY KEY,
    source_id    TEXT NOT NULL REFERENCES component(id) ON DELETE CASCADE,
    target_id    TEXT NOT NULL REFERENCES component(id) ON DELETE CASCADE,
    kind         TEXT NOT NULL DEFAULT 'uses',   -- uses | depends_on | publishes_to | ...
    label        TEXT,
    metadata     TEXT NOT NULL DEFAULT '{}',
    created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_conn_source ON connection(source_id);
CREATE INDEX IF NOT EXISTS idx_conn_target ON connection(target_id);
