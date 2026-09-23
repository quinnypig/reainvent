import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { Buffer } from "node:buffer";
const COOKIE = "resell_session";
const WEEK = 7 * 24 * 60 * 60;
const digest = value => createHash("sha256").update(value).digest("hex");
const derive = (password, salt) => new Promise((resolve, reject) => scrypt(password, salt, 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await derive(password, salt)).toString("hex")}`;
}
async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const derived = await derive(password, salt);
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
function json(body, status = 200, extra = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra } });
}
function sessionToken(request) {
  return (request.headers.get("cookie") || "").split(";").map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || "";
}
function cookie(request, token, maxAge = WEEK) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export async function accountRequest(request, db) {
  const { pathname, origin } = new URL(request.url);
  if (!db) return json({ error: "Accounts are not available yet. Please try again later." }, 503);
  if (request.method !== "GET" && (request.headers.get("origin") !== origin || !request.headers.get("content-type")?.startsWith("application/json"))) return json({ error: "Invalid request origin or content type." }, 403);
  const now = Math.floor(Date.now() / 1000);
  const token = sessionToken(request);
  const user = token ? await db.prepare("SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?").bind(digest(token), now).first() : null;
  if (pathname === "/api/account" && request.method === "GET") return json({ user: user ? { username: user.username } : null });
  if (pathname === "/api/account/logout" && request.method === "POST") {
    if (token) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(digest(token)).run();
    return json({ user: null }, 200, { "set-cookie": cookie(request, "", 0) });
  }
  if (pathname === "/api/account/delete" && request.method === "POST") {
    if (!user) return json({ error: "Sign in first." }, 401);
    await db.batch([db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id), db.prepare("DELETE FROM users WHERE id = ?").bind(user.id)]);
    return json({ user: null }, 200, { "set-cookie": cookie(request, "", 0) });
  }
  const signup = pathname === "/api/account/signup";
  if ((!signup && pathname !== "/api/account/login") || request.method !== "POST") return json({ error: "Not found." }, 404);
  if (Number(request.headers.get("content-length")) > 4096) return json({ error: "Request too large." }, 413);
  const text = await request.text();
  if (text.length > 4096) return json({ error: "Request too large." }, 413);
  let data;
  try { data = JSON.parse(text); } catch { return json({ error: "Invalid JSON." }, 400); }
  const username = typeof data?.username === "string" ? data.username.trim().toLowerCase() : "";
  const password = typeof data?.password === "string" ? data.password : "";
  if (!/^[a-z0-9_]{3,24}$/.test(username) || password.length < 12 || password.length > 128) return json({ error: "Use a username of 3–24 letters, numbers, or underscores and a password of 12–128 characters." }, 400);
  const period = signup ? 3600 : 900;
  const ip = request.headers.get("cf-connecting-ip") || "local";
  for (const scope of [ip, `account:${username}`]) {
    const key = digest(`${pathname}:${scope}:${Math.floor(now / period)}`);
    const limit = await db.prepare("INSERT INTO auth_limits (key, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts").bind(key, now + period).first();
    if (limit.attempts > (signup ? 10 : 20)) return json({ error: "Too many attempts. Please try again later." }, 429, { "retry-after": String(period - now % period) });
  }
  let account = await db.prepare("SELECT id, username, password_hash FROM users WHERE username = ?").bind(username).first();
  if (signup) {
    if (account) return json({ error: "That username is unavailable." }, 409);
    const passwordHash = await hashPassword(password);
    account = { id: crypto.randomUUID(), username };
    try { await db.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)").bind(account.id, username, passwordHash, now).run(); }
    catch (error) { if (String(error).includes("UNIQUE")) return json({ error: "That username is unavailable." }, 409); throw error; }
  } else {
    // Do the expensive derivation for nonexistent accounts as well.
    const fallback = `${"0".repeat(32)}:${"0".repeat(64)}`;
    const valid = await verifyPassword(password, account?.password_hash || fallback);
    if (!account || !valid) return json({ error: "Incorrect username or password." }, 401);
  }
  const freshToken = randomBytes(32).toString("hex");
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    db.prepare("DELETE FROM auth_limits WHERE expires_at <= ?").bind(now),
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(digest(freshToken), account.id, now + WEEK),
  ]);
  return json({ user: { username } }, signup ? 201 : 200, { "set-cookie": cookie(request, freshToken) });
}
