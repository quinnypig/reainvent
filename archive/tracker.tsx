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
const viewTitles: Record<View, string> = { sessions: "All sessions", new: "What’s new", removed: "Pulled sessions", activity: "Change log" };
const fmtTime = (timestamp: number) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(timestamp * 1000);
const fmtDate = (timestamp: number) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(timestamp * 1000);
const isAiFlagged = (session: Session) => session.pangram?.label === "AI" || session.pangram?.label === "Mixed";
const formatScore = (score: number | null | undefined) => {
  if (score == null) return "—";
  const rounded = Math.round(score * 100);
  return rounded >= 100 ? "99+" : String(rounded);
};

function SessionCard({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`session-row ${open ? "is-open" : ""}`}>
      <button className="session-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="session-copy">
          <span className="session-code">{session.code || "TBA"}</span>
          <span className="session-title">{session.title}</span>
          <span className="session-tags">
            {session.status === "removed" && <span className="removed-tag">Pulled</span>}
            {session.changed_recently && <span className="changed">Recently edited</span>}
            {session.level && <span>{session.level.split(" ")[0]}</span>}
            {session.type && <span>{session.type}</span>}
            {session.topics.slice(0, 1).map((topic) => <span key={topic}>{topic}</span>)}
          </span>
        </span>
        <span className={`ai-verdict ${session.pangram?.label?.toLowerCase().replace(" ", "-") || "unscored"}`}>
          <strong>{formatScore(session.pangram?.ai)}</strong>
          <span>{session.pangram?.label || "unscored"}</span>
        </span>
        <span className="open-indicator" aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="session-detail">
          <p className="abstract">{session.abstract || "No abstract has been published."}</p>
          <dl>
            {session.services.length > 0 && <div><dt>Services</dt><dd>{session.services.join(", ")}</dd></div>}
            {session.areas.length > 0 && <div><dt>Areas</dt><dd>{session.areas.join(", ")}</dd></div>}
            {session.roles.length > 0 && <div><dt>For</dt><dd>{session.roles.join(", ")}</dd></div>}
            {session.length && <div><dt>Length</dt><dd>{session.length} minutes</dd></div>}
            <div><dt>{session.removed_at ? "Pulled" : "First seen"}</dt><dd>{fmtDate(session.removed_at || session.first_seen)}</dd></div>
            {session.pangram?.ai != null && <div><dt>Pangram score</dt><dd>{formatScore(session.pangram.ai)} / 100 · {session.pangram.label}</dd></div>}
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
  const [sort, setSort] = useState("code");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(20);
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
  const selectView = (next: View) => { setView(next); setLimit(20); window.location.hash = "catalog"; };
  const clearFilters = () => { setQuery(""); setTopic(""); setLevel(""); setFormat(""); setAuthorship(""); setSort("code"); };
  const filterCount = [topic, level, format, authorship, sort !== "code" ? sort : ""].filter(Boolean).length;
  const counts = data ? { sessions: data.sessions.length, new: data.new.length, removed: data.removed.length, activity: data.events.length } : { sessions: 0, new: 0, removed: 0, activity: 0 };
  const aiStats = data ? {
    ai: data.sessions.filter((s) => s.pangram?.label === "AI").length,
    mixed: data.sessions.filter((s) => s.pangram?.label === "Mixed").length,
    human: data.sessions.filter((s) => s.pangram?.label === "Human").length,
    signal: data.sessions.filter(isAiFlagged).length,
  } : null;
  const aiSignalPercent = aiStats && data ? (aiStats.signal / data.sessions.length * 100).toFixed(1) : null;
  const classPercent = (count: number | undefined) => count != null && data ? `${(count / data.sessions.length * 100).toFixed(1)}%` : "—";

  return (
    <main>
      <header className="masthead">
        <a className="reinvent-mark" href="#top" aria-label="re:AInvent unofficial catalog audit home">
          <span className="logo-aws">AWS?</span>
          <span className="logo-event">re:<b>AI</b>nvent</span>
        </a>
        <div className="masthead-meta">
          <span className="audit-label">Unofficial catalog audit</span>
          <span className="event-date">Nov 30—Dec 4 · Las Vegas</span>
          <a href="#catalog">Browse sessions</a>
        </div>
      </header>
      <section className="brand-hero" id="top">
        <div className="brand-orbit" aria-hidden="true" />
        <div className="hero-inner">
          <div className="lead-copy">
            <p className="eyebrow"><span>AWS re:Invent 2026 catalog</span> Pangram 4 audit</p>
            <h1><mark>{aiSignalPercent ?? "—"}%</mark><span>of session descriptions show an AI-writing signal.</span></h1>
            <p className="dek">Pangram flagged {aiStats?.signal.toLocaleString() ?? "—"} of {data?.sessions.length.toLocaleString() ?? "—"} active descriptions as AI or mixed.</p>
          </div>
          <aside className="hero-proof">
            <p className="proof-label">The finding</p>
            <p className="aside">Automate everything—apparently including the event copy.</p>
            <p className="caveat">AI-text detection is probabilistic, not proof of authorship. <a href="https://www.pangram.com/research/model-card/pangram-4" target="_blank" rel="noreferrer">Pangram 4 model card ↗</a> · <a href="https://aws.amazon.com/events/reinvent/agenda/" target="_blank" rel="noreferrer">AWS event catalog ↗</a></p>
            <details className="method">
              <summary>Methodology and caveats</summary>
              <p>Pangram 4 scores each title and description. Changed descriptions are rescored. All {data?.sessions.length.toLocaleString() ?? "—"} active sessions currently have a verdict.</p>
            </details>
            {data && <p className="dateline">Catalog checked {fmtTime(data.stats.last_scrape)}</p>}
          </aside>
        </div>
      </section>
      <section className="scoreboard" aria-label="Pangram authorship results">
        <div className="distribution-bar" aria-hidden="true">
          <span className="bar-ai" style={{ width: `${data ? aiStats!.ai / data.sessions.length * 100 : 0}%` }} />
          <span className="bar-mixed" style={{ width: `${data ? aiStats!.mixed / data.sessions.length * 100 : 0}%` }} />
          <span className="bar-human" style={{ width: `${data ? aiStats!.human / data.sessions.length * 100 : 0}%` }} />
        </div>
        <div className="score-grid">
          <button className="signal-total" onClick={() => { selectView("sessions"); setAuthorship("signal"); }}><strong>{aiSignalPercent ?? "—"}%</strong><span>AI-writing signal</span><small>AI + mixed</small></button>
          <button onClick={() => { selectView("sessions"); setAuthorship("AI"); }}><strong>{aiStats?.ai.toLocaleString() ?? "—"}</strong><span>Classified AI</span><small>{classPercent(aiStats?.ai)}</small></button>
          <button className="mixed-total" onClick={() => { selectView("sessions"); setAuthorship("Mixed"); }}><strong>{aiStats?.mixed.toLocaleString() ?? "—"}</strong><span>Classified mixed</span><small>{classPercent(aiStats?.mixed)}</small></button>
          <button className="human-total" onClick={() => { selectView("sessions"); setAuthorship("Human"); }}><strong>{aiStats?.human.toLocaleString() ?? "—"}</strong><span>Classified human</span><small>{classPercent(aiStats?.human)}</small></button>
        </div>
      </section>
      <section className="catalog" id="catalog">
        <div className="section-heading"><h2>{viewTitles[view]}</h2><p>{data?.stats.total.toLocaleString() ?? "—"} active · {data?.stats.new_14d ?? "—"} added in 14 days · {data?.stats.removed ?? "—"} pulled</p></div>
        <nav className="view-tabs" aria-label="Catalog views">
          {views.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => selectView(item.id)}>{item.label}<sup>{counts[item.id]}</sup></button>)}
        </nav>
        {view !== "activity" ? <>
          <label className="search"><span>Search</span><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setLimit(20); }} placeholder="Title, code, service, or description" /><kbd>⌘ K</kbd></label>
          <button className="filter-toggle" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}>Filters{filterCount > 0 ? ` (${filterCount})` : ""}<span>{filtersOpen ? "−" : "+"}</span></button>
          <div className={`filters ${filtersOpen ? "is-open" : ""}`}>
            <select aria-label="Filter by topic" value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">All topics</option>{filterOptions.topics.map((x) => <option key={x}>{x}</option>)}</select>
            <select aria-label="Filter by level" value={level} onChange={(e) => setLevel(e.target.value)}><option value="">All levels</option>{filterOptions.levels.map((x) => <option key={x}>{x}</option>)}</select>
            <select aria-label="Filter by format" value={format} onChange={(e) => setFormat(e.target.value)}><option value="">All formats</option>{filterOptions.formats.map((x) => <option key={x}>{x}</option>)}</select>
            <select aria-label="Filter by authorship signal" value={authorship} onChange={(e) => setAuthorship(e.target.value)}><option value="">Any authorship</option><option value="signal">AI signal</option><option value="AI">AI</option><option value="Mixed">Mixed</option><option value="Human">Human</option></select>
            <select aria-label="Sort sessions" value={sort} onChange={(e) => setSort(e.target.value)}><option value="code">Session code</option><option value="ai-desc">Pangram score: high to low</option><option value="ai-asc">Pangram score: low to high</option></select>
            {(query || topic || level || format || authorship || sort !== "code") && <button className="clear" onClick={clearFilters}>Clear all</button>}
          </div>
          <div className="results-meta"><span>{sessions.length.toLocaleString()} {sessions.length === 1 ? "session" : "sessions"} · {view === "new" ? "added in the last 14 days" : view === "removed" ? "confirmed after two checks" : "updated every 30 minutes"}</span><span>Pangram score / 100</span><i aria-hidden="true" /></div>
          <div className="session-list">
            {loadError ? <div className="empty-state"><strong>Catalog unavailable.</strong><span>Reload the page to try again.</span></div> : sessions.slice(0, limit).map((session) => <SessionCard session={session} key={session.sid} />)}
            {!loadError && data && sessions.length === 0 && <div className="empty-state"><strong>No sessions found.</strong><span>Try a broader search or clear your filters.</span></div>}
          </div>
          {sessions.length > limit && <button className="load-more" onClick={() => setLimit(limit + 20)}>Show the next {Math.min(20, sessions.length - limit)} sessions <span>↓</span></button>}
        </> : <div className="activity-list">
          {data?.events.map((event) => <article className="activity-row" key={`${event.id}-${event.ts}`}><time>{fmtTime(event.ts)}</time><span className={`event-type ${event.type}`}>{event.type.replace("_", " ")}</span><div><b>{event.code}</b> {event.title}{event.detail && <small>{event.detail}</small>}</div></article>)}
        </div>}
      </section>
      <footer>
        <div className="footer-mark"><span>AWS?</span><b>re:<em>AI</em>nvent</b></div>
        <p>Independent catalog audit. Pangram scores are probabilistic.<br />A parody—not affiliated with or endorsed by AWS.</p>
        <a href="#top">Top ↑</a>
      </footer>
    </main>
  );
}
