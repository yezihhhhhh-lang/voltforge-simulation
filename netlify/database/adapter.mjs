import { getDatabase } from "@netlify/database";

const tableNames = {
  game_state: "vf_game_state",
  teams: "vf_teams",
  decisions: "vf_decisions",
  results: "vf_results",
  intel: "vf_intel",
};

export function postgresSql(source) {
  let index = 0;
  let sql = source.replace(/\?/g, () => `$${++index}`).replace(/`/g, '"');
  for (const [from, to] of Object.entries(tableNames)) {
    sql = sql.replace(new RegExp(`\\b${from}\\b`, "gi"), to);
  }
  return sql;
}

class PreparedStatement {
  constructor(sql, values = [], converted = false) {
    this.sql = converted ? sql : postgresSql(sql);
    this.values = values;
  }

  bind(...values) {
    return new PreparedStatement(this.sql, values, true);
  }

  async first() {
    const result = await getDatabase().pool.query(this.sql, this.values);
    return result.rows[0] ?? null;
  }

  async all() {
    const result = await getDatabase().pool.query(this.sql, this.values);
    return { results: result.rows };
  }

  async run() {
    const result = await getDatabase().pool.query(this.sql, this.values);
    return { success: true, meta: { changes: result.rowCount ?? 0 } };
  }
}

export const DB = {
  prepare(sql) {
    return new PreparedStatement(sql);
  },

  async batch(statements) {
    const client = await getDatabase().pool.connect();
    try {
      await client.query("BEGIN");
      const output = [];
      for (const statement of statements) {
        const result = await client.query(statement.sql, statement.values);
        output.push({ success: true, meta: { changes: result.rowCount ?? 0 } });
      }
      await client.query("COMMIT");
      return output;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

