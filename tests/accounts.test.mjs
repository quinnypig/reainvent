import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { accountRequest } from "../worker/accounts.mjs";
const schema = await readFile(new URL("../migrations/0001_accounts.sql", import.meta.url), "utf8");
function database() {
 const sqlite = new DatabaseSync(":memory:"); sqlite.exec(schema);
 return { sqlite, prepare(sql) { return { bind(...values) { return { async first() { return sqlite.prepare(sql).get(...values) || null; }, async run() { return sqlite.prepare(sql).run(...values); } }; } }; }, async batch(statements) { sqlite.exec("BEGIN"); try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; } catch (error) { sqlite.exec("ROLLBACK"); throw error; } } };
}
function request(path, body, cookie = "", origin = "https://example.com") {
 return new Request(`https://example.com/api/account${path}`, { method: body ? "POST" : "GET", headers: { origin, "content-type": "application/json", cookie, "cf-connecting-ip": "192.0.2.1" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
const credentials = { username: "example_user", password: "a-long-test-passphrase" };
test("signup, session restore, logout, login, account deletion", async () => {
 const db = database();
 const signup = await accountRequest(request("/signup", credentials), db);
 assert.equal(signup.status, 201);
 assert.deepEqual(await signup.json(), { user: { username: "example_user" } });
 const cookie = signup.headers.get("set-cookie");
 assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Lax/);
 const stored = db.sqlite.prepare("SELECT * FROM users").get();
 assert.notEqual(stored.password_hash, credentials.password);
 assert.equal(stored.password_hash.includes(credentials.password), false);
 const restore = await accountRequest(request("", null, cookie), db);
 assert.equal((await restore.json()).user.username, "example_user");
 assert.equal((await accountRequest(request("/signup", credentials), db)).status, 409);
 assert.equal((await accountRequest(request("/login", { ...credentials, password: "wrong-password-long-enough" }), db)).status, 401);
 await accountRequest(request("/logout", {}, cookie), db);
 assert.equal((await (await accountRequest(request("", null, cookie), db)).json()).user, null);
 const login = await accountRequest(request("/login", credentials), db);
 assert.equal(login.status, 200);
 const fresh = login.headers.get("set-cookie");
 assert.notEqual(fresh, cookie);
 await accountRequest(request("/delete", {}, fresh), db);
 assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM users").get().n, 0);
 assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM sessions").get().n, 0);
 db.sqlite.close();
});
test("rejects cross-origin writes, weak passwords, unavailable storage and expired sessions", async () => {
 const db = database();
 assert.equal((await accountRequest(request("/signup", credentials, "", "https://attacker.example"), db)).status, 403);
 assert.equal((await accountRequest(request("/signup", { ...credentials, password: "short" }), db)).status, 400);
 assert.equal((await accountRequest(request("/signup", credentials), undefined)).status, 503);
 const signup = await accountRequest(request("/signup", credentials), db);
 db.sqlite.exec("UPDATE sessions SET expires_at = 0");
 assert.equal((await (await accountRequest(request("", null, signup.headers.get("set-cookie")), db)).json()).user, null);
 db.sqlite.close();
});
test("throttles authentication attempts", async () => {
 const db = database();
 // Populate the counter through requests; duplicate registration is deliberately still limited.
 await accountRequest(request("/signup", credentials), db);
 for (let i = 0; i < 9; i++) await accountRequest(request("/signup", credentials), db);
 const response = await accountRequest(request("/signup", credentials), db);
 assert.equal(response.status, 429); assert.ok(Number(response.headers.get("retry-after")) > 0);
 db.sqlite.close();
});
