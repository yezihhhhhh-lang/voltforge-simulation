PRAGMA foreign_keys = ON;

CREATE TABLE game_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  round INTEGER NOT NULL DEFAULT 1,
  open INTEGER NOT NULL DEFAULT 1,
  settled INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO game_state (id, round, open, settled, published) VALUES (1, 1, 1, 0, 0);

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  members TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE decisions (
  team_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  submitted INTEGER NOT NULL DEFAULT 1,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, round),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE results (
  team_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, round),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE intel (
  team_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  target_id TEXT NOT NULL,
  cost INTEGER NOT NULL DEFAULT 50000,
  purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, round, target_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX idx_decisions_round ON decisions(round, submitted);
CREATE INDEX idx_results_round ON results(round);
CREATE INDEX idx_intel_round ON intel(round, team_id);
