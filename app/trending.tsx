"use client";
import { useEffect, useState } from "react";
import catalog from "../data/trend-sessions.json";
type Point = { time: number; count: number };
type Session = (typeof catalog.sessions)[number] & {
  history: Point[];
  hourly: Point[];
  total: number;
  today: number;
  change: number;
};
function line(points: Point[], width = 600, height = 180) {
  const max = Math.max(1, ...points.map((p) => p.count));
  return points
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${12 + (i * (width - 24)) / Math.max(1, points.length - 1)} ${height - 12 - (p.count / max) * (height - 24)}`,
    )
    .join(" ");
}
export default function Trending() {
  const [sessions, setSessions] = useState<Session[]>(
    catalog.sessions.map((s) => ({
      ...s,
      history: [],
      hourly: [],
      total: 0,
      today: 0,
      change: 0,
    })),
  );
  const [selected, setSelected] = useState(catalog.sessions[0].id);
  const [range, setRange] = useState<"7d" | "24h">("7d");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [watched, setWatched] = useState<string[]>([]);
  async function refresh(signal?: AbortSignal) {
    const response = await fetch("/api/trends", { signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setSessions(result.sessions);
    setLoaded(true);
    setError("");
  }
  useEffect(() => {
    const controller = new AbortController();
    const poll = () =>
      refresh(controller.signal).catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    void poll();
    const interval = setInterval(() => {
      if (!document.hidden) void poll();
    }, 60000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);
  const active = sessions.find((s) => s.id === selected) || sessions[0];
  const points = range === "7d" ? active.history : active.hourly;
  const count = points.reduce((sum, p) => sum + p.count, 0);
  const total = sessions.reduce((sum, s) => sum + s.total, 0);
  async function watch() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: active.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setWatched((old) => [...old, active.id]);
      setMessage(
        result.recorded
          ? "Your interest was counted. This does not reserve a seat."
          : "Interest in this session has already been counted from your network today.",
      );
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="trending" className="trending-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">REAL SESSIONS · REAINVENT INTEREST</p>
          <h2>Trending on re:AInvent</h2>
        </div>
        <span className="trend-live">
          {loaded && !error ? "Updates every minute" : "Collecting interest"}
        </span>
      </div>
      <p className="trend-intro">
        Which sessions are people watching? Explore interest over time and add
        the sessions you’re following. Rankings reflect activity here, not AWS
        reservations or resale prices.
      </p>
      <div className="trending-layout">
        <div className="trending-ranks" aria-label="Session interest rankings">
          {sessions.map((s, i) => (
            <button
              className={s.id === active.id ? "selected" : ""}
              key={s.id}
              onClick={() => {
                setSelected(s.id);
                setMessage("");
              }}
              aria-pressed={s.id === active.id}
            >
              <span className="rank-number">
                {total ? String(i + 1).padStart(2, "0") : "—"}
              </span>
              <span className="rank-title">
                <small>{s.code}</small>
                <strong>{s.title}</strong>
              </span>
              <span className="rank-interest">
                <b>{loaded ? s.total : "—"}</b>
                <small>7d watches</small>
                <svg viewBox="0 0 100 36" aria-hidden="true">
                  <path
                    d={line(s.history, 100, 36)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </span>
            </button>
          ))}
        </div>
        <article className="trend-chart-card">
          <div className="trend-chart-top">
            <span className="eyebrow">
              {active.code} · {active.type}
            </span>
            <div className="trend-ranges">
              {(["24h", "7d"] as const).map((r) => (
                <button
                  key={r}
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <h3>{active.title}</h3>
          <div className="trend-value">
            <strong>{loaded ? count : "—"}</strong>
            <span>
              watch signals in {range === "7d" ? "7 days" : "24 hours"}
            </span>
          </div>
          <p className="trend-change">
            {loaded
              ? `${active.change > 0 ? "+" : ""}${active.change} today vs. yesterday (UTC)`
              : "Loading interest…"}
          </p>
          <div className="trend-plot">
            <svg
              viewBox="0 0 600 180"
              role="img"
              aria-label={`${active.title}: ${count} watch signals over ${range}`}
            >
              <path
                d="M12 12H588M12 90H588M12 168H588"
                stroke="#d9e4d3"
                fill="none"
              />
              {points.length > 0 && (
                <path
                  d={line(points)}
                  fill="none"
                  stroke="#4579ef"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
              )}
              <text x="12" y="10" fontSize="11" fill="#52604f">
                {Math.max(1, ...points.map((p) => p.count))}
              </text>
              <text x="12" y="164" fontSize="11" fill="#52604f">
                0
              </text>
            </svg>
            {loaded && count === 0 && (
              <p className="trend-empty">
                No watches in this period yet.
                <br />
                Be the first to register interest.
              </p>
            )}
          </div>
          <div className="trend-axis">
            <span>
              {points[0]
                ? new Date(points[0].time * 1000).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    ...(range === "24h" ? { hour: "numeric" as const } : {}),
                    timeZone: "UTC",
                  })
                : ""}
            </span>
            <span>
              {range === "7d"
                ? "Daily watch activity"
                : "Hourly watch activity"}{" "}
              · UTC
            </span>
            <span>Now</span>
          </div>
          <button
            className="primary trend-watch"
            disabled={busy || watched.includes(active.id) || !loaded || !!error}
            onClick={watch}
          >
            {busy
              ? "Counting…"
              : watched.includes(active.id)
                ? "Interest counted"
                : "Watch this session"}
          </button>
          <p className="trend-message" role="status">
            {error || message}
          </p>
          <p className="trend-detail">
            {active.venue}
            {active.date ? ` · ${active.date}` : ""} · {active.level}
          </p>
        </article>
      </div>
      <details className="trend-method">
        <summary>How are these trends measured?</summary>
        <p>
          Watch buttons add interest signals on re:AInvent. We count at most one
          signal per session, per network, per UTC day, so repeated clicks don’t
          inflate the chart. Shared networks may count as one. Rankings use the
          last seven calendar days; today is still in progress. These signals
          are not unique attendees, AWS favorites, seat availability, or
          predictions. No history is filled in before tracking began.
        </p>
        <p>
          We do not store raw IP addresses. A daily-changing hash is used to
          prevent repeat signals and deleted on new activity once it is more
          than eight days old. Session details are a curated selection from the
          AWS catalog, last checked {catalog.updatedAt.slice(0, 10)}.
        </p>
      </details>
    </section>
  );
}
