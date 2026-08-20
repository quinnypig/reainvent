"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Pangram = { ai: number | null; assisted: number; label: string; ts: number } | null;
type Session = {
  sid: string; code: string; title: string; abstract: string; type: string; level: string;
  topics: string[]; services: string[]; areas: string[]; roles: string[]; length: number | string | null;
  status: "active" | "removed"; first_seen: number; last_seen: number; removed_at: number | null;
  seed: number; changed_recently?: boolean; pangram: Pangram; take?: string | null;
};
type Event = { id: number; ts: number; type: string; code: string; title: string; detail: string; sid: string };
type TrackerData = { stats: { total: number; new_14d: number; removed: number; last_scrape: number }; sessions: Session[]; new: Session[]; removed: Session[]; events: Event[] };
type View = "sessions" | "new" | "removed" | "activity";

const views: { id: View; label: string }[] = [
  { id: "sessions", label: "All sessions" }, { id: "new", label: "What’s new" },
  { id: "removed", label: "Pulled" }, { id: "activity", label: "Change log" },
];
const fmtTime = (timestamp: number) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(timestamp * 1000);
const fmtDate = (timestamp: number) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(timestamp * 1000);
const isAiFlagged = (session: Session) => session.pangram?.label === "AI" || session.pangram?.label === "Mixed";

function SessionCard({ session, index }: { session: Session; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`session-row ${open ? "is-open" : ""}`}>
      <div className="session-number">{String(index + 1).padStart(2, "0")}</div>
      <button className="session-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="session-code">{session.code || "TBA"}</span>
        <span className="session-title">{session.title}</span>
        <span className="session-tags">
          {session.status === "removed" && <span className="removed-tag">PULLED</span>}
          {session.changed_recently && <span className="changed">RECENTLY EDITED</span>}
          {session.level && <span>{session.level.split(" ")[0]}</span>}
          {session.type && <span>{session.type}</span>}
          {session.topics.slice(0, 1).map((topic) => <span key={topic}>{topic}</span>)}
        </span>
      </button>
      <button className="open-button" onClick={() => setOpen(!open)} aria-label={`${open ? "Close" : "Open"} ${session.code}`}>↗</button>
      {open && (
        <div className="session-detail">
          {session.take && <div className="field-note"><span>FIELD NOTE · AI-GENERATED SPECULATION</span><p>{session.take}</p></div>}
          <p className="abstract">{session.abstract || "No abstract has been published."}</p>
          <dl>
            {session.services.length > 0 && <div><dt>Services</dt><dd>{session.services.join(", ")}</dd></div>}
            {session.areas.length > 0 && <div><dt>Areas</dt><dd>{session.areas.join(", ")}</dd></div>}
            {session.roles.length > 0 && <div><dt>For</dt><dd>{session.roles.join(", ")}</dd></div>}
            {session.length && <div><dt>Length</dt><dd>{session.length} minutes</dd></div>}
            <div><dt>{session.removed_at ? "Pulled" : "First seen"}</dt><dd>{fmtDate(session.removed_at || session.first_seen)}</dd></div>
            {session.pangram?.ai != null && <div><dt>AI-writing signal</dt><dd>{session.pangram.label} · {Math.round(session.pangram.ai * 100)}%</dd></div>}
          </dl>
        </div>
      )}
    </article>
  );
}

export default function Tracker() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<View>("sessions");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("");
  const [format, setFormat] = useState("");
  const [authorship, setAuthorship] = useState("");
  const [limit, setLimit] = useState(80);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/data.json").then((response) => { if (!response.ok) throw new Error("Catalog unavailable"); return response.json(); }).then(setData).catch(() => setLoadError(true));
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key === "Escape" && document.activeElement === searchRef.current) searchRef.current?.blur();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const source = useMemo(() => data ? (view === "new" ? data.new : view === "removed" ? data.removed : data.sessions) : [], [data, view]);
  const filterOptions = useMemo(() => data ? {
    topics: [...new Set(data.sessions.flatMap((s) => s.topics))].sort(),
    levels: [...new Set(data.sessions.map((s) => s.level).filter(Boolean))].sort(),
    formats: [...new Set(data.sessions.map((s) => s.type).filter(Boolean))].sort(),
  } : { topics: [], levels: [], formats: [] }, [data]);
  const sessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return source.filter((session) =>
      (!topic || session.topics.includes(topic)) && (!level || session.level === level) && (!format || session.type === format) &&
      (!authorship || (authorship === "flagged") === isAiFlagged(session)) &&
      (!needle || [session.code, session.title, session.abstract, ...session.topics, ...session.services].join(" ").toLowerCase().includes(needle)),
    );
  }, [source, query, topic, level, format, authorship]);
  const selectView = (next: View) => { setView(next); setLimit(80); window.location.hash = next === "sessions" ? "index" : next; };
  const clearFilters = () => { setQuery(""); setTopic(""); setLevel(""); setFormat(""); setAuthorship(""); };
  const counts = data ? { sessions: data.sessions.length, new: data.new.length, removed: data.removed.length, activity: data.events.length } : { sessions: 0, new: 0, removed: 0, activity: 0 };

  return (
    <main>
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="Catalog Watch home"><span className="signal-dot" />CATALOG WATCH</a>
        <div className="masthead-meta"><span>AWS re:Invent 2026</span><span>Las Vegas · Nov 30—Dec 4</span></div>
      </header>
      <section className="hero" id="top">
        <div className="eyebrow"><span>LIVE INDEX</span> The catalog, minus the guesswork</div>
        <h1>What changed at<br />re:Invent?</h1>
        <p className="dek">A living record of every session AWS adds, edits, and quietly pulls from the 2026 catalog.</p>
        {data && <div className="dateline"><span className="pulse" /> Last checked {fmtTime(data.stats.last_scrape)}</div>}
      </section>
      <section className="scoreboard" aria-label="Catalog summary">
        <button onClick={() => selectView("sessions")}><strong>{data?.stats.total.toLocaleString() ?? "—"}</strong><span>live sessions</span></button>
        <button className="positive" onClick={() => selectView("new")}><strong>+{data?.stats.new_14d ?? "—"}</strong><span>added in 14 days</span></button>
        <button className="negative" onClick={() => selectView("removed")}><strong>{data?.stats.removed ?? "—"}</strong><span>pulled so far</span></button>
        <button onClick={() => selectView("activity")}><strong>{data?.sessions.filter((s) => s.changed_recently).length ?? "—"}</strong><span>edited this week</span></button>
      </section>
      <section className="catalog" id="index">
        <div className="section-heading"><div><span className="section-kicker">01 / THE INDEX</span><h2>Follow the catalog</h2></div><p>Search the full index, inspect recent arrivals, and see exactly what moved.</p></div>
        <nav className="view-tabs" aria-label="Catalog views">
          {views.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => selectView(item.id)}>{item.label}<sup>{counts[item.id]}</sup></button>)}
        </nav>
        {view !== "activity" ? <>
          <label className="search"><span>SEARCH</span><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setLimit(80); }} placeholder="Try “Bedrock”, “security”, or “ARC…”" /><kbd>⌘ K</kbd></label>
          <div className="filters">
            <select aria-label="Filter by topic" value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">All topics</option>{filterOptions.topics.map((x) => <option key={x}>{x}</option>)}</select>
            <select aria-label="Filter by level" value={level} onChange={(e) => setLevel(e.target.value)}><option value="">All levels</option>{filterOptions.levels.map((x) => <option key={x}>{x}</option>)}</select>
            <select aria-label="Filter by format" value={format} onChange={(e) => setFormat(e.target.value)}><option value="">All formats</option>{filterOptions.formats.map((x) => <option key={x}>{x}</option>)}</select>
            <select aria-label="Filter by authorship signal" value={authorship} onChange={(e) => setAuthorship(e.target.value)}><option value="">Any authorship</option><option value="flagged">AI signal</option><option value="unflagged">No AI signal</option></select>
            {(query || topic || level || format || authorship) && <button className="clear" onClick={clearFilters}>Clear all</button>}
          </div>
          <div className="results-meta"><span>{sessions.length.toLocaleString()} {sessions.length === 1 ? "session" : "sessions"}</span><span>{view === "new" ? "ADDED IN THE LAST 14 DAYS" : view === "removed" ? "CONFIRMED AFTER TWO CHECKS" : "UPDATED EVERY 30 MINUTES"}</span></div>
          <div className="session-list">
            {loadError ? <div className="empty-state"><strong>The catalog missed its cue.</strong><span>Reload the page to try again.</span></div> : sessions.slice(0, limit).map((session, index) => <SessionCard session={session} index={index} key={session.sid} />)}
            {!loadError && data && sessions.length === 0 && <div className="empty-state"><strong>No sessions found.</strong><span>Try a broader search or clear your filters.</span></div>}
          </div>
          {sessions.length > limit && <button className="load-more" onClick={() => setLimit(limit + 100)}>Show the next {Math.min(100, sessions.length - limit)} sessions <span>↓</span></button>}
        </> : <div className="activity-list">
          {data?.events.map((event) => <article className="activity-row" key={`${event.id}-${event.ts}`}><time>{fmtTime(event.ts)}</time><span className={`event-type ${event.type}`}>{event.type.replace("_", " ")}</span><div><b>{event.code}</b> {event.title}{event.detail && <small>{event.detail}</small>}</div></article>)}
        </div>}
      </section>
      <footer><div><span className="signal-dot" />CATALOG WATCH</div><p>Independent catalog tracking. Not affiliated with or endorsed by AWS.</p><a href="#top">Back to top ↑</a></footer>
    </main>
  );
}
