import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the re:AInvent parody page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>AWS re:AInvent — 85% AI<\/title>/i);
  assert.match(html, /Prompt what’s next/);
  assert.match(html, /2026 SESSION CATALOG/);
  assert.match(html, /\/og-reainvent\.png/);
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
