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
  const aiScore = session.pangram?.ai == null ? null : Math.round(session.pangram.ai * 100);
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
      <div className={`ai-verdict ${session.pangram?.label?.toLowerCase().replace(" ", "-") || "unscored"}`}>
        <strong>{aiScore == null ? "—" : `${aiScore}%`}</strong>
        <span>{session.pangram?.label || "unscored"}</span>
      </div>
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
  const [sort, setSort] = useState("ai-desc");
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
    const filtered = source.filter((session) =>
      (!topic || session.topics.includes(topic)) && (!level || session.level === level) && (!format || session.type === format) &&
      (!authorship || (authorship === "signal" ? isAiFlagged(session) : session.pangram?.label === authorship)) &&
      (!needle || [session.code, session.title, session.abstract, ...session.topics, ...session.services].join(" ").toLowerCase().includes(needle)),
    );
    return filtered.sort((a, b) => sort === "code" ? a.code.localeCompare(b.code) : sort === "ai-asc" ? (a.pangram?.ai ?? -1) - (b.pangram?.ai ?? -1) : (b.pangram?.ai ?? -1) - (a.pangram?.ai ?? -1));
  }, [source, query, topic, level, format, authorship, sort]);
  const selectView = (next: View) => { setView(next); setLimit(80); window.location.hash = next === "sessions" ? "index" : next; };
  const clearFilters = () => { setQuery(""); setTopic(""); setLevel(""); setFormat(""); setAuthorship(""); setSort("ai-desc"); };
  const counts = data ? { sessions: data.sessions.length, new: data.new.length, removed: data.removed.length, activity: data.events.length } : { sessions: 0, new: 0, removed: 0, activity: 0 };
  const aiStats = data ? {
    ai: data.sessions.filter((s) => s.pangram?.label === "AI").length,
    mixed: data.sessions.filter((s) => s.pangram?.label === "Mixed").length,
    human: data.sessions.filter((s) => s.pangram?.label === "Human").length,
    signal: data.sessions.filter(isAiFlagged).length,
  } : null;
  const aiSignalPercent = aiStats && data ? Math.round(aiStats.signal / data.sessions.length * 100) : null;

  return (
    <main>
      <header className="masthead">
        <a className="reinvent-mark" href="#top" aria-label="re:AInvent unofficial catalog audit home">
          <span className="logo-aws">AWS?</span>
          <span className="logo-event">re:<b>AI</b>nvent</span>
        </a>
        <div className="masthead-meta"><span>UNOFFICIAL CATALOG AUDIT</span><span>NOV 30—DEC 4 · LAS VEGAS</span></div>
      </header>
      <section className="hero" id="top">
        <div className="hero-grid" aria-hidden="true" />
        <div className="eyebrow"><span>2026 SESSION CATALOG</span> Audited by Pangram</div>
        <h1><span>Prompt what’s next.</span><em>{aiSignalPercent ?? "—"}% AI</em></h1>
        <p className="dek">AWS invited builders. Its session catalog brought a language model. Pangram flags {aiStats?.signal.toLocaleString() ?? "—"} of {data?.sessions.length.toLocaleString() ?? "—"} descriptions for AI involvement.</p>
        {data && <div className="dateline"><span className="pulse" /> Last checked {fmtTime(data.stats.last_scrape)}</div>}
      </section>
      <section className="scoreboard ai-scoreboard" aria-label="Pangram authorship results">
        <button className="ai-total" onClick={() => { selectView("sessions"); setAuthorship("signal"); }}><strong>{aiSignalPercent ?? "—"}%</strong><span>AI signal · AI + mixed</span></button>
        <button onClick={() => { selectView("sessions"); setAuthorship("AI"); }}><strong>{aiStats?.ai.toLocaleString() ?? "—"}</strong><span>classified AI</span></button>
        <button onClick={() => { selectView("sessions"); setAuthorship("Mixed"); }}><strong>{aiStats?.mixed.toLocaleString() ?? "—"}</strong><span>classified mixed</span></button>
        <button className="human-total" onClick={() => { selectView("sessions"); setAuthorship("Human"); }}><strong>{aiStats?.human.toLocaleString() ?? "—"}</strong><span>classified human</span></button>
      </section>
      <section className="receipts" aria-labelledby="receipts-title">
        <div className="receipts-copy">
          <span className="section-kicker">01 / THE RECEIPTS</span>
          <h2 id="receipts-title">The humans were<br />outnumbered.</h2>
          <p>For every description Pangram classifies as Human, it flags 5.5 with an AI signal. Automate everything—even describing the talks about automation.</p>
        </div>
        <div className="distribution" aria-label="Pangram classification distribution">
          <div className="distribution-bar">
            <span className="bar-ai" style={{ width: `${data ? aiStats!.ai / data.sessions.length * 100 : 0}%` }} />
            <span className="bar-mixed" style={{ width: `${data ? aiStats!.mixed / data.sessions.length * 100 : 0}%` }} />
            <span className="bar-human" style={{ width: `${data ? aiStats!.human / data.sessions.length * 100 : 0}%` }} />
          </div>
          <div className="distribution-key">
            <button onClick={() => { selectView("sessions"); setAuthorship("AI"); }}><i className="key-ai" /><span>AI</span><strong>{aiStats?.ai ?? "—"}<small>76.6%</small></strong></button>
            <button onClick={() => { selectView("sessions"); setAuthorship("Mixed"); }}><i className="key-mixed" /><span>Mixed</span><strong>{aiStats?.mixed ?? "—"}<small>8.0%</small></strong></button>
            <button onClick={() => { selectView("sessions"); setAuthorship("Human"); }}><i className="key-human" /><span>Human</span><strong>{aiStats?.human ?? "—"}<small>15.3%</small></strong></button>
          </div>
          <p className="method"><b>How this works:</b> Pangram 4 scores each title and abstract. Changed descriptions are rescored; results are probabilistic signals, not proof of authorship. All {data?.sessions.length.toLocaleString() ?? "—"} active sessions currently have a verdict.</p>
        </div>
      </section>
      <section className="catalog" id="index">
        <div className="section-heading"><div><span className="section-kicker">02 / THE INDEX</span><h2>See every score</h2></div><p>{data?.stats.total.toLocaleString() ?? "—"} live sessions · {data?.stats.new_14d ?? "—"} new in 14 days · {data?.stats.removed ?? "—"} pulled</p></div>
        <nav className="view-tabs" aria-label="Catalog views">
          {views.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => selectView(item.id)}>{item.label}<sup>{counts[item.id]}</sup></button>)}
        </nav>
        {view !== "activity" ? <>
          <label className="search"><span>SEARCH</span><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setLimit(80); }} placeholder="Try “Bedrock”, “security”, or “ARC…”" /><kbd>⌘ K</kbd></label>
          <div className="filters">
            <select aria-label="Filter by topic" value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">All topics</option>{filterOptions.topics.map((x) => <option key={x}>{x}</option>)}</select>
            <select aria-label="Filter by level" value={level} onChange={(e) => setLevel(e.target.value)}><option value="">All levels</option>{filterOptions.levels.map((x) => <option key={x}>{x}</option>)}</select>
            <select aria-label="Filter by format" value={format} onChange={(e) => setFormat(e.target.value)}><option value="">All formats</option>{filterOptions.formats.map((x) => <option key={x}>{x}</option>)}</select>
            <select aria-label="Filter by authorship signal" value={authorship} onChange={(e) => setAuthorship(e.target.value)}><option value="">Any authorship</option><option value="signal">AI signal</option><option value="AI">AI</option><option value="Mixed">Mixed</option><option value="Human">Human</option></select>
            <select aria-label="Sort sessions" value={sort} onChange={(e) => setSort(e.target.value)}><option value="ai-desc">AI score: high to low</option><option value="ai-asc">AI score: low to high</option><option value="code">Session code</option></select>
            {(query || topic || level || format || authorship || sort !== "ai-desc") && <button className="clear" onClick={clearFilters}>Clear all</button>}
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
      <footer>
        <div className="footer-mark"><span>AWS?</span><b>re:<em>AI</em>nvent</b></div>
        <p>A parody and independent catalog audit.<br />Not affiliated with or endorsed by AWS.</p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
