#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const RF_URL = process.env.RF_URL || "https://catalog.awsevents.com/api/sessions";
const RF_PROFILE_ID = process.env.RF_PROFILE_ID || "mSEPBdEOSHwzxJwd7H8MfSWVylSYQsS4";
const RF_WIDGET_ID = process.env.RF_WIDGET_ID || "nbNFIlUhukEGI22KvPEwpPdWgK6FoPsi";
const PAGE_SIZE = 50;
const PANGRAM_URL = process.env.PANGRAM_URL || "https://text.external-api.pangram.com";
const PANGRAM_MODEL = process.env.PANGRAM_MODEL || "pangram-4";
const DATA_PATH = new URL("../public/data.json", import.meta.url);
const MISSING_PATH = new URL("../state/missing.json", import.meta.url);

const attrs = (item, id) => (item.attributevalues || []).filter((x) => x.attribute_id === id).map((x) => x.value || "").filter(Boolean).sort();
const sidFor = (item) => item.sessionID || item.externalID || item.code;
const normalize = (item, now, previous = null) => ({
  pangram: previous?.title === (item.title || "Untitled session") && previous?.abstract === (item.abstract || "") ? previous.pangram : null,
  sid: sidFor(item), code: item.code || "TBA", title: item.title || "Untitled session",
  status: "active", first_seen: previous?.first_seen || now, last_seen: now,
  removed_at: null, seed: previous?.seed ?? 0, abstract: item.abstract || "",
  length: item.length || null, type: attrs(item, "Type").join(", "),
  level: attrs(item, "Level").join(", "), topics: attrs(item, "Topic"),
  services: attrs(item, "Services"), areas: attrs(item, "AreaofInterest"), roles: attrs(item, "Role"),
});
const comparison = (session) => JSON.stringify({ title: session.title, abstract: session.abstract, type: session.type, level: session.level, topics: session.topics, services: session.services });

async function fetchPage(offset) {
  const body = new URLSearchParams({ type: "session", browserTimezone: "America/Los_Angeles", catalogDisplay: "list", from: String(offset), size: String(PAGE_SIZE) });
  const response = await fetch(RF_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8", referer: "https://registration.awsevents.com/", rfApiProfileId: RF_PROFILE_ID, rfWidgetId: RF_WIDGET_ID }, body });
  if (!response.ok) throw new Error(`RainFocus returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.responseCode !== "0") throw new Error(`RainFocus error: ${payload.responseMessage || "unknown"}`);
  const items = (payload.sectionList || [payload]).flatMap((section) => section.items || []);
  return { items, total: Math.max(payload.total || 0, payload.totalSearchItems || 0) };
}

async function scrape() {
  const all = new Map();
  let offset = 0;
  let total = 0;
  do {
    const page = await fetchPage(offset);
    total = page.total;
    for (const item of page.items) if (sidFor(item)) all.set(sidFor(item), item);
    offset += PAGE_SIZE;
    if (!page.items.length || offset > 10000) break;
  } while (offset < total);
  return { all, total };
}

async function scorePending(sessions) {
  const apiKey = process.env.PANGRAM_API_KEY;
  const pending = sessions.filter((session) => !session.pangram && `${session.title}\n\n${session.abstract}`.trim().split(/\s+/).length >= 20);
  if (!pending.length) return;
  if (!apiKey) {
    console.warn(`${pending.length} descriptions need Pangram scores; set PANGRAM_API_KEY to score them`);
    return;
  }
  const headers = { "x-api-key": apiKey, "content-type": "application/json" };
  const body = JSON.stringify({ model: PANGRAM_MODEL, items: pending.map((session) => ({ id: session.sid, text: `${session.title}\n\n${session.abstract}`.trim() })) });
  headers["idempotency-key"] = createHash("sha1").update(body).digest("hex");
  const submitted = await fetch(`${PANGRAM_URL}/bulk`, { method: "POST", headers, body });
  if (!submitted.ok) throw new Error(`Pangram bulk submission returned HTTP ${submitted.status}`);
  const { bulk_id: bulkId } = await submitted.json();
  const deadline = Date.now() + 30 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const response = await fetch(`${PANGRAM_URL}/bulk/${bulkId}`, { headers });
    if (!response.ok) throw new Error(`Pangram bulk status returned HTTP ${response.status}`);
    const status = await response.json();
    if (status.completed_at || ["completed", "succeeded"].includes(status.status)) break;
    if (["failed", "error"].includes(status.status)) throw new Error(`Pangram bulk job ${bulkId} failed`);
  }
  if (Date.now() >= deadline) throw new Error(`Pangram bulk job ${bulkId} timed out`);
  const results = new Map();
  let offset = 0;
  while (true) {
    const response = await fetch(`${PANGRAM_URL}/bulk/${bulkId}/results?offset=${offset}&limit=100`, { headers });
    if (!response.ok) throw new Error(`Pangram results returned HTTP ${response.status}`);
    const page = await response.json();
    const items = page.items || [];
    for (const item of items) if (item.id && item.result?.fraction_ai != null) results.set(item.id, item.result);
    offset += items.length;
    if (!items.length || offset >= (page.total_items || 0)) break;
  }
  const scoredAt = Math.floor(Date.now() / 1000);
  for (const session of pending) {
    const result = results.get(session.sid);
    if (result) session.pangram = { ai: result.fraction_ai, assisted: result.fraction_ai_assisted || 0, label: result.prediction_short, ts: scoredAt };
  }
  console.log(`Pangram scored ${results.size}/${pending.length} new or changed descriptions`);
}

const data = JSON.parse(await readFile(DATA_PATH, "utf8"));
const missing = JSON.parse(await readFile(MISSING_PATH, "utf8"));
const { all: scraped, total } = await scrape();
const now = Math.floor(Date.now() / 1000);
if (data.sessions.length && scraped.size < data.sessions.length * 0.5) throw new Error(`Refusing implausible scrape: ${scraped.size} sessions vs ${data.sessions.length} active`);
if (total && scraped.size < total * 0.9) throw new Error(`Refusing incomplete scrape: ${scraped.size} sessions vs API total ${total}`);

let nextEventId = Math.max(0, ...data.events.map((event) => event.id || 0)) + 1;
const events = [...data.events];
const addEvent = (type, session, detail = "") => events.unshift({ id: nextEventId++, ts: now, type, sid: session.sid, code: session.code, title: session.title, detail });
const activeById = new Map(data.sessions.map((session) => [session.sid, session]));
const removedById = new Map(data.removed.map((session) => [session.sid, session]));
const active = [];

for (const [sid, item] of scraped) {
  const previous = activeById.get(sid) || removedById.get(sid);
  const session = normalize(item, now, previous);
  if (!previous) addEvent("added", session);
  else if (previous.status === "removed") { addEvent("readded", session); removedById.delete(sid); }
  else if (comparison(session) !== comparison(previous)) {
    const fields = ["title", "abstract", "type", "level", "topics", "services"].filter((key) => JSON.stringify(session[key]) !== JSON.stringify(previous[key]));
    addEvent("changed", session, fields.join(", "));
  }
  delete missing[sid];
  active.push(session);
}

for (const previous of data.sessions) {
  if (scraped.has(previous.sid)) continue;
  if (!missing[previous.sid]) { missing[previous.sid] = now; active.push(previous); continue; }
  const removed = { ...previous, status: "removed", removed_at: now };
  removedById.set(previous.sid, removed);
  delete missing[previous.sid];
  addEvent("removed", removed);
}

active.sort((a, b) => a.code.localeCompare(b.code));
await scorePending(active);
const removed = [...removedById.values()].sort((a, b) => (b.removed_at || 0) - (a.removed_at || 0));
const cutoff14d = now - 14 * 86400;
const cutoff7d = now - 7 * 86400;
const changedRecently = new Set(events.filter((event) => event.type === "changed" && event.ts > cutoff7d).map((event) => event.sid));
for (const session of active) session.changed_recently = changedRecently.has(session.sid);

const next = {
  stats: { ...data.stats, total: active.length, new_14d: active.filter((s) => !s.seed && s.first_seen > cutoff14d).length, removed: removed.length, last_scrape: now, pangram: { ...data.stats.pangram, scored: active.filter((s) => s.pangram?.ai != null).length, skipped: active.filter((s) => s.pangram?.ai == null).length, sessions: active.length } },
  sessions: active,
  new: active.filter((session) => !session.seed && session.first_seen > cutoff14d).sort((a, b) => b.first_seen - a.first_seen),
  removed,
  events: events.slice(0, 300),
};
await writeFile(DATA_PATH, `${JSON.stringify(next)}\n`);
await writeFile(MISSING_PATH, `${JSON.stringify(missing, null, 2)}\n`);
console.log(`Catalog updated: ${active.length} live, ${next.new.length} new in 14d, ${removed.length} removed`);
