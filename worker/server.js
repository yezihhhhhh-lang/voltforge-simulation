const INDEX_HTML = __INDEX_HTML__;
const CLIENT_JS = __CLIENT_JS__;

const EVENTS = [
  ["公司起步", "市场平稳，第一次制定生产与定价方案。", 2200, 3000, 30000, 0.03],
  ["需求升温", "储能项目增加，市场总需求上升。", 2700, 3050, 30500, 0.03],
  ["原料涨价", "上游供应紧张，材料价格明显上涨。", 2600, 3900, 31000, 0.04],
  ["大型订单", "公共储能项目集中采购，需求快速扩大。", 3400, 3700, 31500, 0.04],
  ["消费降温", "市场进入调整期，库存风险上升。", 2100, 3450, 32000, 0.045],
  ["自动化浪潮", "新设备上市，设备提高产能的效果增强。", 2500, 3350, 33000, 0.045],
  ["价格竞争", "各公司争夺客户，市场对售价更敏感。", 2900, 3500, 33500, 0.05],
  ["年度决战", "年末采购释放，确定最终估值与排名。", 3600, 3650, 34000, 0.05],
];

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...jsonHeaders, ...extra } });
}

function fail(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function nameKey(value) {
  return normalizeName(value).toLocaleLowerCase("zh-CN");
}

function number(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("决策中包含无效数字。");
  return Math.round(Math.max(min, Math.min(max, n)));
}

function parseJson(value, fallback = {}) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function b64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64url(value) {
  const base = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(base);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function makeSession(payload, secret) {
  const body = b64url(encoder.encode(JSON.stringify({ ...payload, exp: Date.now() + 7 * 86400000 })));
  return `${body}.${b64url(await hmac(body, secret))}`;
}

async function readSession(request, secret) {
  const cookie = request.headers.get("cookie") || "";
  const raw = cookie.split(/;\s*/).find(x => x.startsWith("vf_session="))?.slice(11);
  if (!raw || !secret) return null;
  const [body, signature] = raw.split(".");
  if (!body || !signature) return null;
  const expected = await hmac(body, secret);
  const actual = fromB64url(signature);
  if (expected.length !== actual.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
  if (diff) return null;
  const data = JSON.parse(decoder.decode(fromB64url(body)));
  return data.exp > Date.now() ? data : null;
}

function sessionCookie(token) {
  return `vf_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;
}

function clearCookie() {
  return "vf_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

async function passwordHash(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 120000 }, key, 256));
  return `${b64url(salt)}.${b64url(bits)}`;
}

async function passwordMatches(password, stored) {
  const [saltPart, hashPart] = String(stored || "").split(".");
  if (!saltPart || !hashPart) return false;
  const salt = fromB64url(saltPart);
  const expected = fromB64url(hashPart);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const actual = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 120000 }, key, 256));
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

function initialState() {
  return { cash: 4000000, invUnits: 0, invValue: 0, equipment: 0, debt: 0, research: 0, equity: 4000000, value: 4000000 };
}

function assets(state) {
  return Math.round(state.cash + state.invValue + state.equipment);
}

function decisionInput(body) {
  return {
    plan: number(body.plan, 0, 20000),
    price: number(body.price, 1000, 50000),
    wage: number(body.wage, 0, 200000),
    equipment: number(body.equipment, 0, 20000000),
    research: number(body.research, 0, 20000000),
    marketing: number(body.marketing, 0, 20000000),
    loan: number(body.loan, 0, 20000000),
    repay: number(body.repay, 0, 20000000),
    reason: String(body.reason || "").trim().slice(0, 500),
    submitted: true,
  };
}

function preview(state, decision, round, intelCost = 0) {
  const event = EVENTS[round - 1];
  const efficiency = Math.max(0.72, Math.min(1.18, 0.65 + decision.wage / event[4] * 0.35));
  const boost = round === 6 ? 1.35 : 1;
  const capacity = Math.floor((500 + state.equipment / 10000 + decision.equipment / 10000 * boost) * efficiency);
  const discount = Math.min(0.18, state.research / 5000000 * 0.18) + Math.min(0.12, state.equipment / 6000000 * 0.12);
  const unit = Math.round(event[3] * (1 - discount));
  const produced = Math.min(decision.plan, capacity);
  const material = produced * unit;
  const payroll = decision.wage * 20;
  const interest = Math.round((state.debt + decision.loan) * event[5]);
  const need = material + payroll + decision.equipment + decision.research + decision.marketing + decision.repay + interest + intelCost;
  const remain = state.cash + decision.loan - need;
  return { capacity, unit, produced, material, payroll, interest, need, remain };
}

async function game(DB) {
  const row = await DB.prepare("SELECT round, open, settled, published FROM game_state WHERE id = 1").first();
  if (!row) throw new Error("数据库尚未初始化。");
  return { round: Number(row.round), open: !!row.open, settled: !!row.settled, published: !!row.published };
}

async function rows(DB, sql, ...bind) {
  return (await DB.prepare(sql).bind(...bind).all()).results || [];
}

function makeTeam(row) {
  return { id: row.id, name: row.name, members: row.members, ...parseJson(row.state_json, initialState()), decisions: {}, results: {}, intel: [], history: [{ r: 0, a: 4000000, v: 4000000 }] };
}

async function hydrateTeams(DB, teamRows, includeAll = true) {
  const teams = teamRows.map(makeTeam);
  const map = new Map(teams.map(t => [t.id, t]));
  if (!teams.length) return teams;
  const ids = teams.map(t => t.id);
  const placeholders = ids.map(() => "?").join(",");
  const decisions = await rows(DB, `SELECT team_id, round, data_json, submitted FROM decisions WHERE team_id IN (${placeholders})`, ...ids);
  const results = await rows(DB, `SELECT team_id, round, data_json FROM results WHERE team_id IN (${placeholders}) ORDER BY round`, ...ids);
  for (const row of decisions) {
    const t = map.get(row.team_id); if (!t) continue;
    t.decisions[row.round] = { ...parseJson(row.data_json), submitted: !!row.submitted };
  }
  for (const row of results) {
    const t = map.get(row.team_id); if (!t) continue;
    const result = parseJson(row.data_json);
    t.results[row.round] = result;
    t.history.push({ r: Number(row.round), a: result.assets, v: result.value });
  }
  if (includeAll) {
    const intelRows = await rows(DB, `SELECT i.team_id, i.round, i.target_id, i.cost, t.name AS target_name, r.data_json AS result_json FROM intel i JOIN teams t ON t.id=i.target_id LEFT JOIN results r ON r.team_id=i.target_id AND r.round=i.round-1 WHERE i.team_id IN (${placeholders})`, ...ids);
    for (const row of intelRows) {
      const t = map.get(row.team_id); if (!t) continue;
      const result = parseJson(row.result_json, null);
      t.intel.push({ r: Number(row.round), target: row.target_id, targetName: row.target_name, cost: Number(row.cost), data: result ? { price: result.price, sold: result.sold, value: result.value } : null });
    }
  }
  return teams;
}

function rankingFrom(teams) {
  return teams.map(t => ({ id: t.id, name: t.name, value: t.value, equity: t.equity, assets: assets(t) })).sort((a, b) => b.value - a.value);
}

async function stateResponse(request, env, session) {
  const current = await game(env.DB);
  if (!session) return json({ ok: true, role: null, ...current });
  if (session.role === "team") {
    const ownRows = await rows(env.DB, "SELECT * FROM teams WHERE id = ?", session.teamId);
    if (!ownRows.length) return json({ ok: true, role: null, ...current }, 200, { "set-cookie": clearCookie() });
    const [team] = await hydrateTeams(env.DB, ownRows);
    const allRows = await rows(env.DB, "SELECT id, name, members, state_json FROM teams");
    const allTeams = allRows.map(makeTeam);
    const pendingIntelCost = team.intel.filter(i => i.r === current.round).reduce((sum, i) => sum + i.cost, 0);
    team.pendingIntelCost = pendingIntelCost;
    team.availableCash = team.cash - pendingIntelCost;
    return json({ ok: true, role: "team", ...current, me: team, ranking: rankingFrom(allTeams) });
  }
  if (session.role === "admin") {
    const allRows = await rows(env.DB, "SELECT * FROM teams ORDER BY created_at");
    const teams = await hydrateTeams(env.DB, allRows);
    return json({ ok: true, role: "admin", ...current, teams, ranking: rankingFrom(teams) });
  }
  return json({ ok: true, role: null, ...current });
}

async function register(request, env) {
  const body = await request.json();
  if (String(body.invite || "").trim() !== String(env.INVITE_CODE || "")) return fail("邀请码不正确。", 403);
  const name = normalizeName(body.name);
  const members = normalizeName(body.members);
  const password = String(body.password || "");
  if (!name || name.length > 20) return fail("公司名称需为1—20个字。");
  if (!members || members.length > 100) return fail("请填写团队成员。");
  if (password.length < 6 || password.length > 100) return fail("团队密码至少6位。");
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare("INSERT INTO teams (id, name, name_key, members, password_hash, state_json) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, name, nameKey(name), members, await passwordHash(password), JSON.stringify(initialState())).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) return fail("公司名称已经被使用。", 409);
    throw error;
  }
  const token = await makeSession({ role: "team", teamId: id }, env.SESSION_SECRET);
  return json({ ok: true }, 201, { "set-cookie": sessionCookie(token) });
}

async function teamLogin(request, env) {
  const body = await request.json();
  const row = await env.DB.prepare("SELECT id, password_hash FROM teams WHERE name_key = ?").bind(nameKey(body.name)).first();
  if (!row || !(await passwordMatches(String(body.password || ""), row.password_hash))) return fail("公司名称或团队密码不正确。", 401);
  const token = await makeSession({ role: "team", teamId: row.id }, env.SESSION_SECRET);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(token) });
}

async function adminLogin(request, env) {
  const body = await request.json();
  if (!env.ADMIN_PASSWORD || String(body.password || "") !== env.ADMIN_PASSWORD) return fail("管理员密码不正确。", 401);
  const token = await makeSession({ role: "admin" }, env.SESSION_SECRET);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(token) });
}

async function requireTeam(env, session) {
  if (session?.role !== "team" || !session.teamId) throw Object.assign(new Error("请先登录团队账号。"), { status: 401 });
  const row = await env.DB.prepare("SELECT * FROM teams WHERE id = ?").bind(session.teamId).first();
  if (!row) throw Object.assign(new Error("公司不存在。"), { status: 404 });
  return row;
}

function requireAdmin(session) {
  if (session?.role !== "admin") throw Object.assign(new Error("需要管理员权限。"), { status: 403 });
}

async function submitDecision(request, env, session) {
  const row = await requireTeam(env, session);
  const current = await game(env.DB);
  if (!current.open || current.settled) return fail("本轮现在不能提交。", 409);
  const existing = await env.DB.prepare("SELECT submitted FROM decisions WHERE team_id=? AND round=?").bind(row.id, current.round).first();
  if (existing?.submitted) return fail("本轮方案已经提交。", 409);
  const decision = decisionInput(await request.json());
  if (!decision.reason) return fail("请填写决策理由。");
  const intelRow = await env.DB.prepare("SELECT COALESCE(SUM(cost),0) AS total FROM intel WHERE team_id=? AND round=?").bind(row.id, current.round).first();
  const state = parseJson(row.state_json, initialState());
  const calculation = preview(state, decision, current.round, Number(intelRow?.total || 0));
  if (decision.repay > state.debt + decision.loan) return fail("还款金额超过公司负债。");
  if (calculation.remain < 0) return fail("资金不足，请减少支出或贷款。", 409);
  await env.DB.prepare("INSERT INTO decisions (team_id, round, data_json, submitted, submitted_at) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP) ON CONFLICT(team_id, round) DO UPDATE SET data_json=excluded.data_json, submitted=1, submitted_at=CURRENT_TIMESTAMP")
    .bind(row.id, current.round, JSON.stringify(decision)).run();
  return json({ ok: true });
}

async function buyIntel(request, env, session) {
  const row = await requireTeam(env, session);
  const current = await game(env.DB);
  if (current.round <= 1) return fail("第2轮开始才能购买竞争情报。", 409);
  if (current.settled) return fail("本轮已经结算。", 409);
  const targetId = String((await request.json()).targetId || "");
  if (!targetId || targetId === row.id) return fail("请选择其他公司。");
  const target = await env.DB.prepare("SELECT id FROM teams WHERE id=?").bind(targetId).first();
  const previous = await env.DB.prepare("SELECT data_json FROM results WHERE team_id=? AND round=?").bind(targetId, current.round - 1).first();
  if (!target || !previous) return fail("该公司还没有可购买的上一轮数据。", 404);
  const count = await env.DB.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(cost),0) AS total FROM intel WHERE team_id=? AND round=?").bind(row.id, current.round).first();
  if (Number(count.count) >= 2) return fail("本轮最多购买两份情报。", 409);
  const state = parseJson(row.state_json, initialState());
  if (state.cash - Number(count.total) < 50000) return fail("现金不足。", 409);
  try {
    await env.DB.prepare("INSERT INTO intel (team_id, round, target_id, cost) VALUES (?, ?, ?, 50000)").bind(row.id, current.round, targetId).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) return fail("已经购买过这家公司的情报。", 409);
    throw error;
  }
  return json({ ok: true });
}

async function settle(env) {
  const current = await game(env.DB);
  if (current.settled) return fail("本轮已经结算。", 409);
  const teamRows = await rows(env.DB, "SELECT * FROM teams ORDER BY created_at");
  if (!teamRows.length) return fail("还没有公司参加。", 409);
  const decisionRows = await rows(env.DB, "SELECT team_id, data_json FROM decisions WHERE round=? AND submitted=1", current.round);
  if (decisionRows.length !== teamRows.length) return fail("仍有公司没有提交。", 409);
  const decisionMap = new Map(decisionRows.map(r => [r.team_id, parseJson(r.data_json)]));
  const intelRows = await rows(env.DB, "SELECT team_id, COALESCE(SUM(cost),0) AS total FROM intel WHERE round=? GROUP BY team_id", current.round);
  const intelMap = new Map(intelRows.map(r => [r.team_id, Number(r.total)]));
  const event = EVENTS[current.round - 1];
  const scores = new Map();
  let totalScore = 0;
  for (const row of teamRows) {
    const state = parseJson(row.state_json, initialState());
    const d = decisionMap.get(row.id);
    const sensitivity = current.round === 7 ? 2 : 1.5;
    const score = (100 + Math.sqrt(d.marketing / 10000) * 7) * Math.pow(6000 / Math.max(2500, d.price), sensitivity) * (1 + Math.min(0.22, state.research / 5000000 * 0.22));
    scores.set(row.id, score); totalScore += score;
  }
  const statements = [];
  for (const row of teamRows) {
    const state = parseJson(row.state_json, initialState());
    const d = decisionMap.get(row.id);
    const intelCost = intelMap.get(row.id) || 0;
    const p = preview(state, d, current.round, intelCost);
    const share = scores.get(row.id) / totalScore;
    const demand = Math.floor(event[2] * share);
    const beginCash = state.cash;
    const beginDebt = state.debt;
    const beginEquipment = state.equipment;
    const beginUnits = state.invUnits;
    const beginInvValue = state.invValue;
    const produced = Math.min(d.plan, p.capacity);
    const materialBuy = produced * p.unit;
    const available = beginUnits + produced;
    const averageCost = available ? (beginInvValue + materialBuy) / available : 0;
    const sold = Math.min(available, demand);
    const cogs = Math.round(sold * averageCost);
    const invUnits = available - sold;
    const invValue = Math.round(invUnits * averageCost);
    const revenue = sold * d.price;
    const payroll = d.wage * 20;
    const repay = Math.min(d.repay, beginDebt + d.loan);
    const depreciation = Math.round((beginEquipment + d.equipment) * 0.1);
    const interest = Math.round((beginDebt + d.loan) * event[5]);
    const cash = Math.round(beginCash + d.loan + revenue - materialBuy - payroll - d.equipment - d.research - d.marketing - intelCost - repay - interest);
    const equipment = Math.max(0, beginEquipment + d.equipment - depreciation);
    const debt = beginDebt + d.loan - repay;
    const totalAssets = Math.round(cash + invValue + equipment);
    const equity = totalAssets - debt;
    const profit = Math.round(revenue - cogs - payroll - d.research - d.marketing - intelCost - depreciation - interest);
    const research = state.research + d.research;
    const value = Math.round(equity + research * 0.35 + Math.max(0, profit) * 0.5);
    const result = { price: d.price, plan: d.plan, capacity: p.capacity, produced, sold, demand, share, revenue, cogs, payroll, rd: d.research, marketing: d.marketing, intel: intelCost, dep: depreciation, interest, profit, beginCash, loan: d.loan, repay, materialBuy, equipBuy: d.equipment, cash, invUnits, invValue, equipment, debt, assets: totalAssets, equity, unit: p.unit, research, value };
    const nextState = { cash, invUnits, invValue, equipment, debt, research, equity, value };
    statements.push(env.DB.prepare("UPDATE teams SET state_json=? WHERE id=?").bind(JSON.stringify(nextState), row.id));
    statements.push(env.DB.prepare("INSERT INTO results (team_id, round, data_json) VALUES (?, ?, ?) ON CONFLICT(team_id, round) DO UPDATE SET data_json=excluded.data_json").bind(row.id, current.round, JSON.stringify(result)));
  }
  statements.push(env.DB.prepare("UPDATE game_state SET open=0, settled=1, published=0, updated_at=CURRENT_TIMESTAMP WHERE id=1"));
  await env.DB.batch(statements);
  return json({ ok: true });
}

async function adminAction(path, request, env, session) {
  requireAdmin(session);
  const current = await game(env.DB);
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  if (path === "/api/admin/open") {
    if (current.settled) return fail("本轮已经结算。", 409);
    await env.DB.prepare("UPDATE game_state SET open=?, updated_at=CURRENT_TIMESTAMP WHERE id=1").bind(body.open ? 1 : 0).run();
    return json({ ok: true });
  }
  if (path === "/api/admin/unlock") {
    if (current.settled) return fail("结算后不能解锁。", 409);
    await env.DB.prepare("UPDATE decisions SET submitted=0 WHERE team_id=? AND round=?").bind(String(body.teamId), current.round).run();
    return json({ ok: true });
  }
  if (path === "/api/admin/reset-password") {
    const password = String(body.password || "");
    if (password.length < 6) return fail("密码至少6位。");
    await env.DB.prepare("UPDATE teams SET password_hash=? WHERE id=?").bind(await passwordHash(password), String(body.teamId)).run();
    return json({ ok: true });
  }
  if (path === "/api/admin/delete-team") {
    await env.DB.prepare("DELETE FROM teams WHERE id=?").bind(String(body.teamId)).run();
    return json({ ok: true });
  }
  if (path === "/api/admin/settle") return settle(env);
  if (path === "/api/admin/publish") {
    if (!current.settled) return fail("请先统一结算。", 409);
    await env.DB.prepare("UPDATE game_state SET published=1, updated_at=CURRENT_TIMESTAMP WHERE id=1").run();
    return json({ ok: true });
  }
  if (path === "/api/admin/next") {
    if (!current.published || current.round >= 8) return fail("请先公布结果，或活动已经结束。", 409);
    await env.DB.prepare("UPDATE game_state SET round=round+1, open=1, settled=0, published=0, updated_at=CURRENT_TIMESTAMP WHERE id=1").run();
    return json({ ok: true });
  }
  if (path === "/api/admin/reset") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM intel"), env.DB.prepare("DELETE FROM decisions"), env.DB.prepare("DELETE FROM results"), env.DB.prepare("DELETE FROM teams"),
      env.DB.prepare("UPDATE game_state SET round=1, open=1, settled=0, published=0, updated_at=CURRENT_TIMESTAMP WHERE id=1"),
    ]);
    return json({ ok: true });
  }
  return fail("未知管理员操作。", 404);
}

async function exportData(request, env, session) {
  requireAdmin(session);
  const allRows = await rows(env.DB, "SELECT * FROM teams ORDER BY created_at");
  const teams = await hydrateTeams(env.DB, allRows);
  const type = new URL(request.url).searchParams.get("type");
  if (type === "csv") {
    const ranked = rankingFrom(teams);
    const content = "\ufeff排名,公司,现金,库存,负债,总资产,净资产,估值\n" + ranked.map((x, index) => {
      const t = teams.find(team => team.id === x.id);
      return [index + 1, `"${t.name.replace(/"/g, '""')}"`, t.cash, t.invValue, t.debt, assets(t), t.equity, t.value].join(",");
    }).join("\n");
    return new Response(content, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=voltforge-ranking.csv" } });
  }
  return new Response(JSON.stringify({ game: await game(env.DB), teams }, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": "attachment; filename=voltforge-data.json" } });
}

async function api(request, env) {
  if (!env.DB) return fail("共享数据库尚未连接。", 503);
  if (!env.SESSION_SECRET || !env.INVITE_CODE || !env.ADMIN_PASSWORD) return fail("服务器环境变量尚未配置。", 503);
  const url = new URL(request.url);
  const session = await readSession(request, env.SESSION_SECRET);
  if (request.method === "GET" && url.pathname === "/api/state") return stateResponse(request, env, session);
  if (request.method === "POST" && url.pathname === "/api/register") return register(request, env);
  if (request.method === "POST" && url.pathname === "/api/login") return teamLogin(request, env);
  if (request.method === "POST" && url.pathname === "/api/admin/login") return adminLogin(request, env);
  if (request.method === "POST" && url.pathname === "/api/logout") return json({ ok: true }, 200, { "set-cookie": clearCookie() });
  if (request.method === "POST" && url.pathname === "/api/decision") return submitDecision(request, env, session);
  if (request.method === "POST" && url.pathname === "/api/intel") return buyIntel(request, env, session);
  if (request.method === "GET" && url.pathname === "/api/admin/export") return exportData(request, env, session);
  if (request.method === "POST" && url.pathname.startsWith("/api/admin/")) return adminAction(url.pathname, request, env, session);
  return fail("接口不存在。", 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await api(request, env);
      if (url.pathname === "/client.js") return new Response(CLIENT_JS, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" } });
      if (url.pathname === "/" || url.pathname === "/index.html") return new Response(INDEX_HTML, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", "x-content-type-options": "nosniff", "referrer-policy": "same-origin" } });
      return new Response("Not found", { status: 404 });
    } catch (error) {
      console.error(error);
      return fail(error?.message || "服务器处理失败，请稍后重试。", error?.status || 500);
    }
  },
};
