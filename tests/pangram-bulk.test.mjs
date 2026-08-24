import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scorePending } from "../scripts/pangram-bulk.mjs";

const session = () => ({
  sid: "session-1",
  title: "A sufficiently descriptive session title",
  abstract: "This abstract contains enough words for the Pangram scoring threshold and gives the detector a useful amount of prose to classify correctly.",
  pangram: null,
});

const quietLogger = { log() {}, warn() {} };

test("persists and resumes a slow Pangram bulk job without failing the catalog run", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "reainvent-pangram-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const statePath = join(directory, "job.json");
  const sessions = [session()];
  const firstCalls = [];

  const first = await scorePending(sessions, {
    apiKey: "test-key",
    baseUrl: "https://pangram.test",
    statePath,
    pollBudgetMs: 0,
    fetchImpl: async (url, options = {}) => {
      firstCalls.push({ url, options });
      if (options.method === "POST") return Response.json({ bulk_id: "blk_slow" }, { status: 202 });
      return Response.json({ status: "running", succeeded: 0, failed: 0 });
    },
    now: () => 100_000,
    sleep: async () => {},
    logger: quietLogger,
  });

  assert.equal(first.status, "pending");
  assert.equal(firstCalls.filter((call) => call.options.method === "POST").length, 1);
  assert.ok(firstCalls[0].options.headers["idempotency-key"]);
  const pendingState = JSON.parse(await readFile(statePath, "utf8"));
  assert.equal(pendingState.status, "active");
  assert.equal(pendingState.bulk_id, "blk_slow");
  assert.match(pendingState.request_hash, /^[a-f0-9]{64}$/);

  const resumedCalls = [];
  const resumed = await scorePending(sessions, {
    apiKey: "test-key",
    baseUrl: "https://pangram.test",
    statePath,
    fetchImpl: async (url, options = {}) => {
      resumedCalls.push({ url, options });
      if (url.includes("/results?")) {
        return Response.json({
          total_items: 1,
          items: [{ id: "session-1", result: { fraction_ai: 0.91, fraction_ai_assisted: 0.04, prediction_short: "AI" } }],
        });
      }
      return Response.json({ status: "succeeded", succeeded: 1, failed: 0, completed_at: "100.1" });
    },
    now: () => 120_000,
    sleep: async () => {},
    logger: quietLogger,
  });

  assert.equal(resumed.status, "complete");
  assert.equal(resumedCalls.some((call) => call.options.method === "POST"), false);
  assert.equal(sessions[0].pangram.ai, 0.91);
  assert.deepEqual(JSON.parse(await readFile(statePath, "utf8")), { version: 1, status: "idle" });
});

test("abandons a job that has made no progress and submits a new idempotency window", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "reainvent-pangram-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const statePath = join(directory, "job.json");
  const sessions = [session()];
  const submitted = [];
  let clock = 10_000;
  let bulk = 0;
  const fetchImpl = async (url, options = {}) => {
    if (options.method === "POST") {
      submitted.push(options.headers["idempotency-key"]);
      bulk += 1;
      return Response.json({ bulk_id: `blk_${bulk}` }, { status: 202 });
    }
    return Response.json({ status: "running", succeeded: 0, failed: 0 });
  };
  const options = {
    apiKey: "test-key",
    baseUrl: "https://pangram.test",
    statePath,
    pollBudgetMs: 0,
    staleAfterMs: 60_000,
    fetchImpl,
    now: () => clock,
    sleep: async () => {},
    logger: quietLogger,
  };

  await scorePending(sessions, options);
  clock += 61_000;
  await scorePending(sessions, options);

  assert.equal(submitted.length, 2);
  assert.notEqual(submitted[0], submitted[1]);
  assert.equal(JSON.parse(await readFile(statePath, "utf8")).bulk_id, "blk_2");
});

test("defers a transient Pangram submission failure instead of failing the catalog run", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "reainvent-pangram-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let attempts = 0;

  const result = await scorePending([session()], {
    apiKey: "test-key",
    baseUrl: "https://pangram.test",
    statePath: join(directory, "job.json"),
    fetchImpl: async () => {
      attempts += 1;
      return new Response("temporary failure", { status: 500 });
    },
    now: () => 100_000,
    sleep: async () => {},
    logger: quietLogger,
  });

  assert.equal(attempts, 3);
  assert.equal(result.status, "deferred");
  assert.equal(result.scored, 0);
});
