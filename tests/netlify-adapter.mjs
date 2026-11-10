import assert from "node:assert/strict";
import { postgresSql } from "../netlify/database/adapter.mjs";

assert.equal(
  postgresSql("SELECT * FROM teams WHERE id=?"),
  "SELECT * FROM vf_teams WHERE id=$1",
);
assert.equal(
  postgresSql("SELECT team_id, round FROM decisions WHERE team_id IN (?,?,?)"),
  "SELECT team_id, round FROM vf_decisions WHERE team_id IN ($1,$2,$3)",
);
assert.equal(
  postgresSql("UPDATE game_state SET round=round+1 WHERE id=1"),
  "UPDATE vf_game_state SET round=round+1 WHERE id=1",
);
assert.equal(
  postgresSql("SELECT i.team_id FROM intel i JOIN teams t ON t.id=i.target_id LEFT JOIN results r ON r.team_id=i.target_id"),
  "SELECT i.team_id FROM vf_intel i JOIN vf_teams t ON t.id=i.target_id LEFT JOIN vf_results r ON r.team_id=i.target_id",
);

console.log("Netlify Postgres query adapter passed.");

