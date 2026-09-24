import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import catalog from "../data/trend-sessions.json" with { type: "json" };
import { trendsRequest } from "../worker/trends.mjs";
function database() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    readFileSync(
      new URL("../migrations/trends/0001_interest.sql", import.meta.url),
      "utf8",
    ),
  );
  return {
    sql,
    prepare(query) {
      return {
        bind(...values) {
          return {
            async all() {
              return { results: sql.prepare(query).all(...values) };
            },
            async run() {
              return sql.prepare(query).run(...values);
            },
          };
        },
      };
    },
    async batch(statements) {
      sql.exec("BEGIN");
      try {
        const results = [];
        for (const s of statements) results.push(await s.run());
        sql.exec("COMMIT");
        return results;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
const now = Date.UTC(2026, 8, 24, 12) / 1000;
const get = () => new Request("https://reainvent.com/api/trends");
function post(
  id = catalog.sessions[0].id,
  ip = "192.0.2.1",
  origin = "https://reainvent.com",
) {
  return new Request("https://reainvent.com/api/trends", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "cf-connecting-ip": ip,
    },
    body: JSON.stringify({ sessionId: id }),
  });
}
test("interest starts empty, deduplicates daily, and charts only recorded activity", async () => {
  const db = database();
  let result = await (await trendsRequest(get(), db, now)).json();
  assert.equal(
    result.sessions.every((s) => s.total === 0),
    true,
  );
  assert.equal(
    (await (await trendsRequest(post(), db, now)).json()).recorded,
    true,
  );
  assert.equal(
    (await (await trendsRequest(post(), db, now + 10)).json()).recorded,
    false,
  );
  await trendsRequest(post(catalog.sessions[0].id, "192.0.2.2"), db, now);
  result = await (await trendsRequest(get(), db, now)).json();
  assert.equal(result.sessions[0].total, 2);
  assert.equal(result.sessions[0].hourly.at(-1).count, 2);
  assert.equal(
    result.sessions[0].history.slice(0, 6).every((p) => p.count === 0),
    true,
  );
  assert.equal(JSON.stringify(result).includes("network_hash"), false);
  assert.equal(
    db.sql
      .prepare("SELECT network_hash FROM session_interest")
      .get()
      .network_hash.includes("192.0.2"),
    false,
  );
  await trendsRequest(post(), db, now + 86400);
  result = await (await trendsRequest(get(), db, now + 86400)).json();
  assert.equal(result.sessions[0].change, -1);
  assert.equal(result.sessions[0].total, 3);
  db.sql.close();
});
test("invalid sessions and cross-origin writes are rejected; old data is excluded and cleaned", async () => {
  const db = database();
  assert.equal((await trendsRequest(post("unknown"), db, now)).status, 400);
  assert.equal(
    (
      await trendsRequest(
        post(catalog.sessions[0].id, "192.0.2.1", "https://other.example"),
        db,
        now,
      )
    ).status,
    403,
  );
  assert.equal((await trendsRequest(get(), undefined, now)).status, 503);
  await trendsRequest(post(), db, now - 9 * 86400);
  await trendsRequest(post(), db, now);
  assert.equal(
    db.sql.prepare("SELECT COUNT(*) AS n FROM session_interest").get().n,
    1,
  );
  const data = await (await trendsRequest(get(), db, now)).json();
  assert.equal(data.sessions[0].total, 1);
  db.sql.close();
});
