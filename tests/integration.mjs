import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

class Statement {
  constructor(statement, values = []) { this.statement = statement; this.values = values; }
  bind(...values) { return new Statement(this.statement, values); }
  async first() { return this.statement.get(...this.values); }
  async all() { return { results: this.statement.all(...this.values) }; }
  async run() { return this.statement.run(...this.values); }
}

class D1Mock {
  constructor(database) { this.database = database; }
  prepare(sql) { return new Statement(this.database.prepare(sql)); }
  async batch(statements) {
    this.database.exec("BEGIN");
    try {
      const result = [];
      for (const statement of statements) result.push(await statement.run());
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

const database = new DatabaseSync(":memory:");
database.exec(await readFile("drizzle/0000_initial.sql", "utf8"));
const env = { DB: new D1Mock(database), INVITE_CODE: "260903", ADMIN_PASSWORD: "yezi666", SESSION_SECRET: "integration-test-secret-with-more-than-32-characters" };
const worker = (await import("../dist/server/index.js?test=" + Date.now())).default;

function client() {
  let cookie = "";
  return {
    async request(path, method = "GET", body) {
      const response = await worker.fetch(new Request("https://voltforge.test" + path, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined }), env);
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0];
      const data = await response.json();
      if (!response.ok) throw new Error(`${response.status}: ${data.error}`);
      return data;
    },
  };
}

const alpha = client(), beta = client(), admin = client();
await alpha.request("/api/register", "POST", { invite: "260903", name: "青岚能源", members: "甲、乙", password: "alpha123" });
await beta.request("/api/register", "POST", { invite: "260903", name: "新脉电力", members: "丙、丁", password: "beta123" });
assert.equal((await alpha.request("/api/state")).role, "team");
await admin.request("/api/admin/login", "POST", { password: "yezi666" });
assert.equal((await admin.request("/api/state")).teams.length, 2);

const decision = { plan: 500, price: 6000, wage: 30000, equipment: 300000, research: 300000, marketing: 300000, loan: 0, repay: 0, reason: "先稳定生产并投入研发。" };
await alpha.request("/api/decision", "POST", decision);
await beta.request("/api/decision", "POST", { ...decision, price: 6200, marketing: 400000 });
let adminState = await admin.request("/api/state");
assert.equal(adminState.teams.filter(t => t.decisions[1]?.submitted).length, 2);
await admin.request("/api/admin/settle", "POST", {});
await admin.request("/api/admin/publish", "POST", {});
const alphaState = await alpha.request("/api/state");
const result = alphaState.me.results[1];
assert.ok(result.revenue > 0);
assert.equal(result.assets, result.debt + result.equity);
assert.equal(result.cash, result.beginCash + result.loan + result.revenue - result.materialBuy - result.payroll - result.equipBuy - result.rd - result.marketing - result.intel - result.repay - result.interest);

await admin.request("/api/admin/next", "POST", {});
const next = await alpha.request("/api/state");
const target = next.ranking.find(t => t.id !== next.me.id);
await alpha.request("/api/intel", "POST", { targetId: target.id });
const intelState = await alpha.request("/api/state");
assert.equal(intelState.round, 2);
assert.equal(intelState.me.intel.length, 1);
assert.equal(intelState.me.availableCash, intelState.me.cash - 50000);

console.log("Multiplayer registration, sessions, settlement, reports, next round, and intel passed.");
