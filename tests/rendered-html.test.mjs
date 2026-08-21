import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const password = "test-password";
  const token = createHash("sha256").update(`reainvent:${password}`).digest("hex");
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", cookie: `reainvent_access=${token}` } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, SITE_PASSWORD: password },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("protects the catalog behind the private-preview login", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("auth-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://localhost/data.json"), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, SITE_PASSWORD: "test-password" }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 302);
  assert.match(response.headers.get("location") || "", /^\/__login\?next=/);
  assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
  const login = await worker.fetch(new Request("http://localhost/__login"), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, SITE_PASSWORD: "test-password" }, { waitUntil() {}, passThroughOnException() {} });
  const loginHtml = await login.text();
  assert.match(loginHtml, /Nov 30—Dec 4 · Las Vegas/i);
  assert.match(loginHtml, /overflow-y:auto/);
  assert.match(loginHtml, /input:focus-visible/);
});

test("renders the re:AInvent parody page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const html = await response.text();
  const data = JSON.parse(await readFile(new URL("../public/data.json", import.meta.url), "utf8"));
  const signal = data.sessions.filter((session) => ["AI", "Mixed"].includes(session.pangram?.label)).length;
  const percent = (signal / data.sessions.length * 100).toFixed(1).replace(".", "\\.");
  assert.match(html, new RegExp(`<title>re:AInvent catalog audit — ${percent}% show an AI signal<\\/title>`, "i"));
  assert.match(html, /session descriptions show an AI-writing signal/i);
  assert.match(html, /AWS re:Invent 2026 catalog/i);
  assert.match(html, /class="brand-hero"/i);
  assert.match(html, /Nov 30—Dec 4 · Las Vegas/i);
  assert.match(html, /class="scoreboard"/i);
  assert.doesNotMatch(html, /THE RECEIPTS|THE INDEX|See every score|The humans were outnumbered/i);
  assert.match(html, /\/og-reainvent-v3\.png/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Your site is taking shape/i);
});

test("ships a fully scored Kubernetes catalog snapshot", async () => {
  const data = JSON.parse(await readFile(new URL("../public/data.json", import.meta.url), "utf8"));
  assert.equal(data.sessions.length, data.stats.total);
  assert.equal(data.sessions.filter((session) => session.pangram?.ai != null).length, data.sessions.length);
  const labels = Object.groupBy(data.sessions, (session) => session.pangram.label);
  assert.equal((labels.AI?.length || 0) + (labels.Mixed?.length || 0) + (labels.Human?.length || 0), data.sessions.length);
  assert.ok((labels.AI.length + labels.Mixed.length) / data.sessions.length > 0.5);
});
