#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const RF_URL = process.env.RF_URL || "https://catalog.awsevents.com/api/sessions";
const RF_PROFILE_ID = process.env.RF_PROFILE_ID || "mSEPBdEOSHwzxJwd7H8MfSWVylSYQsS4";
const RF_WIDGET_ID = process.env.RF_WIDGET_ID || "nbNFIlUhukEGI22KvPEwpPdWgK6FoPsi";
const PAGE_SIZE = 50;
const DATA_PATH = new URL("../public/data.json", import.meta.url);
const MISSING_PATH = new URL("../state/missing.json", import.meta.url);

const attrs = (item, id) => (item.attributevalues || []).filter((x) => x.attribute_id === id).map((x) => x.value || "").filter(Boolean).sort();
const sidFor = (item) => item.sessionID || item.externalID || item.code;
const normalize = (item, now, previous = null) => ({
  pangram: previous?.pangram || null,
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
const removed = [...removedById.values()].sort((a, b) => (b.removed_at || 0) - (a.removed_at || 0));
const cutoff14d = now - 14 * 86400;
const cutoff7d = now - 7 * 86400;
const changedRecently = new Set(events.filter((event) => event.type === "changed" && event.ts > cutoff7d).map((event) => event.sid));
for (const session of active) session.changed_recently = changedRecently.has(session.sid);

const next = {
  stats: { ...data.stats, total: active.length, new_14d: active.filter((s) => !s.seed && s.first_seen > cutoff14d).length, removed: removed.length, last_scrape: now },
  sessions: active,
  new: active.filter((session) => !session.seed && session.first_seen > cutoff14d).sort((a, b) => b.first_seen - a.first_seen),
  removed,
  events: events.slice(0, 300),
};
await writeFile(DATA_PATH, `${JSON.stringify(next)}\n`);
await writeFile(MISSING_PATH, `${JSON.stringify(missing, null, 2)}\n`);
console.log(`Catalog updated: ${active.length} live, ${next.new.length} new in 14d, ${removed.length} removed`);
