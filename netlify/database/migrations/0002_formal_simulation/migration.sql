CREATE TABLE IF NOT EXISTS vf_game_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  round INTEGER NOT NULL DEFAULT 1,
  open INTEGER NOT NULL DEFAULT 1,
  settled INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO vf_game_state (id, round, open, settled, published)
VALUES (1, 1, 1, 0, 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS vf_teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  members TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  state_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vf_decisions (
  team_id TEXT NOT NULL REFERENCES vf_teams(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  submitted INTEGER NOT NULL DEFAULT 1,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, round)
);

CREATE TABLE IF NOT EXISTS vf_results (
  team_id TEXT NOT NULL REFERENCES vf_teams(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, round)
);

CREATE TABLE IF NOT EXISTS vf_intel (
  team_id TEXT NOT NULL REFERENCES vf_teams(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  target_id TEXT NOT NULL REFERENCES vf_teams(id) ON DELETE CASCADE,
  cost INTEGER NOT NULL DEFAULT 50000,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, round, target_id)
);

CREATE INDEX IF NOT EXISTS idx_vf_decisions_round ON vf_decisions(round, submitted);
CREATE INDEX IF NOT EXISTS idx_vf_results_round ON vf_results(round);
CREATE INDEX IF NOT EXISTS idx_vf_intel_round ON vf_intel(round, team_id);

