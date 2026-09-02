import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const TERMINAL_SUCCESS = new Set(["succeeded", "completed", "partial"]);
const TERMINAL_FAILURE = new Set(["failed", "error"]);
const CREDENTIAL_FAILURE = new Set([401, 402, 403]);

const digest = (value) => createHash("sha256").update(value).digest("hex");
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const isRetryableStatus = (status) => status === 429 || status >= 500;

async function requestWithRetry(url, options, { fetchImpl, sleep, attempts = 3 }) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, options);
      if (response.ok || !isRetryableStatus(response.status) || attempt === attempts - 1) return response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) {
        error.retryable = true;
        throw error;
      }
    }
    await sleep(1000 * 2 ** attempt);
  }
  lastError.retryable = true;
  throw lastError;
}

async function readState(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return { version: 1, status: "idle" };
    throw error;
  }
}

async function writeState(path, state) {
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`);
}

async function fetchResults({ baseUrl, bulkId, headers, request }) {
  const results = new Map();
  const failures = [];
  let offset = 0;

  while (true) {
    const response = await request(`${baseUrl}/bulk/${bulkId}/results?offset=${offset}&limit=1000`, { headers });
    if (!response.ok) {
      const error = new Error(`Pangram results returned HTTP ${response.status}`);
      error.retryable = isRetryableStatus(response.status);
      throw error;
    }
    const page = await response.json();
    const items = page.items || [];
    for (const item of items) {
      if (item.id && item.result?.fraction_ai != null) results.set(item.id, item.result);
    }
    failures.push(...(page.failed_items || []));
    offset += items.length;
    if (!items.length || offset >= (page.total_items || 0)) break;
  }

  return { results, failures };
}

export async function scorePending(sessions, {
  apiKey = process.env.PANGRAM_API_KEY,
  baseUrl = process.env.PANGRAM_URL || "https://text.external-api.pangram.com",
  model = process.env.PANGRAM_MODEL || "pangram-4",
  statePath = new URL("../state/pangram-job.json", import.meta.url),
  pollBudgetMs = Number(process.env.PANGRAM_POLL_BUDGET_MS || 8 * 60 * 1000),
  pollIntervalMs = Number(process.env.PANGRAM_POLL_INTERVAL_MS || 5000),
  staleAfterMs = Number(process.env.PANGRAM_STALE_AFTER_MS || 60 * 60 * 1000),
  fetchImpl = fetch,
  now = () => Date.now(),
  sleep = wait,
  logger = console,
} = {}) {
  const pending = sessions.filter((session) => !session.pangram && `${session.title}\n\n${session.abstract}`.trim().split(/\s+/).length >= 20);
  if (!pending.length) {
    await writeState(statePath, { version: 1, status: "idle" });
    return { status: "complete", scored: 0 };
  }
  if (!apiKey) {
    logger.warn(`${pending.length} descriptions need Pangram scores; set PANGRAM_API_KEY to score them`);
    return { status: "skipped", scored: 0 };
  }

  const headers = { "x-api-key": apiKey, "content-type": "application/json" };
  const request = (url, options) => requestWithRetry(url, options, { fetchImpl, sleep });
  const body = JSON.stringify({ model, items: pending.map((session) => ({ id: session.sid, text: `${session.title}\n\n${session.abstract}`.trim() })) });
  const requestHash = digest(body);
  let state = await readState(statePath);
  const lastProgressAt = state.last_progress_at || state.submitted_at || 0;
  const reusable = state.status === "active" && state.request_hash === requestHash && now() - lastProgressAt < staleAfterMs;
  let bulkId = reusable ? state.bulk_id : null;

  if (!bulkId) {
    const idempotencyWindow = Math.floor(now() / staleAfterMs);
    headers["idempotency-key"] = digest(`${requestHash}:${idempotencyWindow}`);
    let submitted;
    try {
      submitted = await request(`${baseUrl}/bulk`, { method: "POST", headers, body });
    } catch (error) {
      if (!error.retryable) throw error;
      logger.warn(`Pangram bulk submission is temporarily unavailable: ${error.message}`);
      return { status: "deferred", scored: 0 };
    }
    if (!submitted.ok) {
      if (isRetryableStatus(submitted.status)) {
        logger.warn(`Pangram bulk submission returned HTTP ${submitted.status}; a later catalog run will retry`);
        return { status: "deferred", scored: 0 };
      }
      if (CREDENTIAL_FAILURE.has(submitted.status)) {
        logger.warn(`Pangram scoring is unavailable (HTTP ${submitted.status}); publishing the catalog without new scores`);
        return { status: "skipped", scored: 0 };
      }
      throw new Error(`Pangram bulk submission returned HTTP ${submitted.status}`);
    }
    ({ bulk_id: bulkId } = await submitted.json());
    if (!bulkId) throw new Error("Pangram bulk submission returned no bulk_id");
    state = {
      version: 1,
      status: "active",
      request_hash: requestHash,
      bulk_id: bulkId,
      submitted_at: now(),
      last_progress_at: now(),
      succeeded: 0,
      failed: 0,
    };
    await writeState(statePath, state);
    logger.log(`Submitted Pangram bulk job ${bulkId} for ${pending.length} descriptions`);
  } else {
    logger.log(`Resuming Pangram bulk job ${bulkId} for ${pending.length} descriptions`);
  }

  const deadline = now() + pollBudgetMs;
  let status;
  while (true) {
    let response;
    try {
      response = await request(`${baseUrl}/bulk/${bulkId}`, { headers });
    } catch (error) {
      if (!error.retryable) throw error;
      await writeState(statePath, state);
      logger.warn(`Pangram bulk status is temporarily unavailable; a later catalog run will resume ${bulkId}`);
      return { status: "pending", bulkId, succeeded: state.succeeded || 0, failed: state.failed || 0 };
    }
    if (!response.ok) {
      if (isRetryableStatus(response.status)) {
        await writeState(statePath, state);
        logger.warn(`Pangram bulk status returned HTTP ${response.status}; a later catalog run will resume ${bulkId}`);
        return { status: "pending", bulkId, succeeded: state.succeeded || 0, failed: state.failed || 0 };
      }
      throw new Error(`Pangram bulk status returned HTTP ${response.status}`);
    }
    status = await response.json();
    const name = String(status.status || "").toLowerCase();
    if (TERMINAL_FAILURE.has(name)) throw new Error(`Pangram bulk job ${bulkId} failed`);
    if (TERMINAL_SUCCESS.has(name) || status.completed_at) {
      state = {
        ...state,
        succeeded: Number(status.succeeded || state.succeeded || 0),
        failed: Number(status.failed || state.failed || 0),
        last_progress_at: now(),
      };
      break;
    }

    const succeeded = Number(status.succeeded || 0);
    const failed = Number(status.failed || 0);
    if (succeeded > (state.succeeded || 0) || failed > (state.failed || 0)) {
      state = { ...state, succeeded, failed, last_progress_at: now() };
    }
    if (now() >= deadline) {
      await writeState(statePath, state);
      logger.warn(`Pangram bulk job ${bulkId} is still ${name || "pending"}; a later catalog run will resume it`);
      return { status: "pending", bulkId, succeeded, failed };
    }
    await sleep(pollIntervalMs);
  }

  let resultPage;
  try {
    resultPage = await fetchResults({ baseUrl, bulkId, headers, request });
  } catch (error) {
    if (!error.retryable) throw error;
    await writeState(statePath, state);
    logger.warn(`Pangram results for ${bulkId} are temporarily unavailable; a later catalog run will retry them`);
    return { status: "pending", bulkId, succeeded: Number(status.succeeded || 0), failed: Number(status.failed || 0) };
  }
  const { results, failures } = resultPage;
  const missing = pending.filter((session) => !results.has(session.sid));
  if (missing.length) {
    const detail = failures.slice(0, 3).map((item) => `${item.id || item.index}: ${item.error || "failed"}`).join("; ");
    throw new Error(`Pangram bulk job ${bulkId} returned ${results.size}/${pending.length} results${detail ? ` (${detail})` : ""}`);
  }

  const scoredAt = Math.floor(now() / 1000);
  for (const session of pending) {
    const result = results.get(session.sid);
    session.pangram = {
      ai: result.fraction_ai,
      assisted: result.fraction_ai_assisted || 0,
      label: result.prediction_short,
      ts: scoredAt,
    };
  }
  await writeState(statePath, { version: 1, status: "idle" });
  logger.log(`Pangram scored ${results.size}/${pending.length} new or changed descriptions`);
  return { status: "complete", bulkId, scored: results.size };
}
