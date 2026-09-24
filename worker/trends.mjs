import { createHash } from "node:crypto";
import catalog from "../data/trend-sessions.json" with { type: "json" };
const HOUR = 3600,
  DAY = 86400;
const json = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
export async function trendsRequest(
  request,
  db,
  now = Math.floor(Date.now() / 1000),
) {
  if (!db)
    return json({ error: "Session interest is temporarily unavailable." }, 503);
  if (request.method === "POST") {
    if (
      request.headers.get("origin") !== new URL(request.url).origin ||
      !request.headers.get("content-type")?.startsWith("application/json")
    )
      return json({ error: "Invalid request." }, 403);
    if (Number(request.headers.get("content-length")) > 512)
      return json({ error: "Request too large." }, 413);
    const body = await request.text();
    if (body.length > 512) return json({ error: "Request too large." }, 413);
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return json({ error: "Invalid request." }, 400);
    }
    if (!catalog.sessions.some((s) => s.id === data?.sessionId))
      return json({ error: "Unknown session." }, 400);
    const day = Math.floor(now / DAY);
    // Daily network deduplication bounds each network to one signal per session.
    // Never retain raw addresses. Hashes rotate daily and expire with the history.
    const network = request.headers.get("cf-connecting-ip") || "local";
    const hash = createHash("sha256").update(`${day}:${network}`).digest("hex");
    const result = await db.batch([
      db
        .prepare(
          "INSERT OR IGNORE INTO session_interest (session_id,day,network_hash,created_at) VALUES (?,?,?,?)",
        )
        .bind(data.sessionId, day, hash, now),
      db
        .prepare("DELETE FROM session_interest WHERE created_at < ?")
        .bind(now - 8 * DAY),
    ]);
    return json({
      recorded: Number(result[0].meta?.changes ?? result[0].changes) > 0,
    });
  }
  if (request.method !== "GET")
    return json({ error: "Method not allowed." }, 405);
  const rows = await db
    .prepare(
      "SELECT session_id, CAST(created_at / 3600 AS INTEGER) AS hour, COUNT(*) AS count FROM session_interest WHERE created_at >= ? GROUP BY session_id, hour",
    )
    .bind(Math.floor(now / DAY) * DAY - 6 * DAY)
    .all();
  const today = Math.floor(now / DAY),
    currentHour = Math.floor(now / HOUR);
  const sessions = catalog.sessions
    .map((session) => {
      const history = Array.from({ length: 7 }, (_, i) => ({
        time: (today - 6 + i) * DAY,
        count: 0,
      }));
      const hourly = Array.from({ length: 24 }, (_, i) => ({
        time: (currentHour - 23 + i) * HOUR,
        count: 0,
      }));
      for (const row of rows.results.filter(
        (row) => row.session_id === session.id,
      )) {
        const dayIndex = Math.floor(row.hour / 24) - (today - 6);
        if (dayIndex >= 0 && dayIndex < 7) history[dayIndex].count += row.count;
        const hourIndex = row.hour - (currentHour - 23);
        if (hourIndex >= 0 && hourIndex < 24)
          hourly[hourIndex].count += row.count;
      }
      return {
        ...session,
        history,
        hourly,
        total: history.reduce((n, x) => n + x.count, 0),
        today: history[6].count,
        change: history[6].count - history[5].count,
      };
    })
    .sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));
  return json({
    sessions,
    updatedAt: now,
    eventId: catalog.eventId,
    catalogUpdatedAt: catalog.updatedAt,
  });
}
