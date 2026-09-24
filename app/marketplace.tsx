"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Listing = {
  code: string;
  title: string;
  category: string;
  venue: string;
  day: string;
  time: string;
  price: number;
  change: number;
  seats: number;
  level: string;
};
const listings: Listing[] = [
  {
    code: "AGT101",
    title: "Your first agent. Someone else’s fiftieth.",
    category: "Agents & AI",
    venue: "Venetian",
    day: "MON · NOV 30",
    time: "10:00 AM",
    price: 420,
    change: 38.2,
    seats: 3,
    level: "100 · Foundational",
  },
  {
    code: "SRV302",
    title: "Serverless, except for the middleman",
    category: "Infrastructure",
    venue: "MGM Grand",
    day: "TUE · DEC 01",
    time: "11:30 AM",
    price: 185,
    change: 12.4,
    seats: 8,
    level: "300 · Advanced",
  },
  {
    code: "AIM401",
    title: "Multi-agent systems. Single-seat availability.",
    category: "Agents & AI",
    venue: "Caesars Forum",
    day: "WED · DEC 02",
    time: "2:00 PM",
    price: 650,
    change: 64.8,
    seats: 1,
    level: "400 · Expert",
  },
  {
    code: "DAT301",
    title: "Eventually consistent. Immediately sold out.",
    category: "Data & Analytics",
    venue: "Venetian",
    day: "TUE · DEC 01",
    time: "3:00 PM",
    price: 240,
    change: 18.6,
    seats: 5,
    level: "300 · Advanced",
  },
  {
    code: "CLD201",
    title: "Cost optimization starts after this purchase",
    category: "Infrastructure",
    venue: "MGM Grand",
    day: "THU · DEC 03",
    time: "9:00 AM",
    price: 95,
    change: -4.2,
    seats: 12,
    level: "200 · Intermediate",
  },
  {
    code: "AGT202",
    title: "Democratizing AI, subject to availability",
    category: "Agents & AI",
    venue: "Caesars Forum",
    day: "THU · DEC 03",
    time: "1:00 PM",
    price: 310,
    change: 26.1,
    seats: 4,
    level: "200 · Intermediate",
  },
];
const money = (value: number) => `$${value.toLocaleString("en-US")}`;
const categories = [
  "All sessions",
  "Agents & AI",
  "Infrastructure",
  "Data & Analytics",
  "Watchlist",
];
function Sparkline({ down = false }: { down?: boolean }) {
  return (
    <svg
      className={`spark ${down ? "down" : ""}`}
      viewBox="0 0 100 32"
      aria-hidden="true"
    >
      <path
        d={
          down
            ? "M1 5L12 9L23 6L34 16L45 12L56 20L67 15L78 24L89 21L99 29"
            : "M1 29L12 22L23 25L34 15L45 19L56 10L67 15L78 6L89 9L99 1"
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
export default function Marketplace() {
  const [category, setCategory] = useState("All sessions");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("trending");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [bid, setBid] = useState("");
  const [orders, setOrders] = useState<
    { code: string; amount: number; mode: string }[]
  >([]);
  const [notice, setNotice] = useState("");
  const [agent, setAgent] = useState(false);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [handoff, setHandoff] = useState<"success" | "failure">("success");
  const accountDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    fetch("/api/account")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        setUser(data.user);
      })
      .catch(() => setUser(null));
  }, []);
  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/account/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sign in.");
      setUser(result.user);
      accountDialog.current?.close();
      setNotice(`Welcome, ${result.user.username}. Your account is active.`);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Unable to connect.",
      );
    } finally {
      setAuthBusy(false);
    }
  }
  async function accountAction(action: "logout" | "delete") {
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await fetch(`/api/account/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok)
        throw new Error("Could not update your account. Try again.");
      setUser(null);
      accountDialog.current?.close();
      setOrders([]);
      setWatchlist([]);
      setNotice(
        action === "delete"
          ? "Your account and sign-in sessions were deleted."
          : "You have been signed out.",
      );
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Unable to connect.",
      );
    } finally {
      setAuthBusy(false);
    }
  }
  const dialog = useRef<HTMLDialogElement>(null);
  const visible = listings
    .filter(
      (item) =>
        (category === "All sessions" ||
          (category === "Watchlist"
            ? watchlist.includes(item.code)
            : item.category === category)) &&
        `${item.title} ${item.code} ${item.venue}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "low"
        ? a.price - b.price
        : sort === "high"
          ? b.price - a.price
          : b.change - a.change,
    );
  function openTrade(item: Listing, action: "buy" | "sell" = "buy") {
    setSelected(item);
    setMode(action);
    setBid(String(item.price));
    dialog.current?.showModal();
  }
  function toggleWatch(code: string) {
    setWatchlist((previous) =>
      previous.includes(code)
        ? previous.filter((x) => x !== code)
        : [...previous, code],
    );
  }
  function placeOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(bid);
    if (!selected || !Number.isFinite(amount) || amount < 1 || amount > 10000)
      return;
    if (!user) {
      dialog.current?.close();
      setAuthError("");
      accountDialog.current?.showModal();
      return;
    }
    setOrders((previous) => [
      { code: selected.code, amount, mode },
      ...previous,
    ]);
    setNotice(
      mode === "sell"
        ? `Seller quote saved for ${selected.code}. Proposed fee: ${money(amount * 0.1)}; seller proceeds: ${money(amount * 0.9)}. Nothing charged.`
        : handoff === "success"
          ? `Quote saved for ${selected.code}. Seller proceeds on successful settlement: ${money(amount * 0.9)} after the 10% fee.`
          : `Quote saved for ${selected.code}. Failed acquisition terms: full buyer refund, no seller payout or fee.`,
    );
    dialog.current?.close();
  }
  return (
    <div className="exchange">
      <div className="demo-strip">
        <span>
          <i /> THE CONFERENCE SEAT EXCHANGE
        </span>
        <span>Supply. Demand. A place to sit.</span>
        <a href="#thesis">Read the thesis ↗</a>
      </div>
      <header className="header">
        <Link className="wordmark" href="/" aria-label="re:Sell home">
          re:<b>Sell</b>
          <span>↗</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#market">Marketplace</a>
          <a href="#how">How it works</a>
          <a href="#thesis">Why this exists</a>
        </nav>
        <button
          className="account-button"
          onClick={() => {
            setAuthError("");
            accountDialog.current?.showModal();
          }}
        >
          {user ? `@${user.username}` : "Sign up / Log in"}
        </button>
        <button
          className="sell-button"
          onClick={() => openTrade(listings[0], "sell")}
        >
          Sell a seat <span>↗</span>
        </button>
      </header>
      <div className="ticker" aria-label="Illustrative market prices">
        <span className="ticker-label">THE LEARNING ECONOMY</span>
        {listings.slice(0, 4).map((item) => (
          <span key={item.code}>
            <b>{item.code}</b> {money(item.price)} <em>↗ {item.change}%</em>
          </span>
        ))}
        <span className="ticker-note">ILLUSTRATIVE PRICES</span>
      </div>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="tiny-cross">✳</span> LAS VEGAS · NOV 30 — DEC 4,
              2026
            </p>
            <h1>
              Your next
              <br />
              breakthrough.
              <br />
              <span>At market price.</span>
            </h1>
            <p className="hero-description">
              The conference is for everyone.
              <br />
              The good seats are for the highest bidder.
            </p>
            <div className="hero-actions">
              <a className="primary" href="#market">
                Explore the market <span>↗</span>
              </a>
              <span className="hero-aside">
                Learning has a new
                <br />
                price discovery mechanism.
              </span>
            </div>
            <p className="hero-footnote">
              Conference access meets price discovery.
            </p>
          </div>
          <div className="feature-wrap">
            <div className="orbit-text">SCARCITY IS A FEATURE. APPARENTLY.</div>
            <article className="feature-ticket">
              <div className="ticket-top">
                <span className="pill">THE MOST VALUABLE PREREQUISITE</span>
                <span>↗</span>
              </div>
              <p className="ticket-code">AGT101 / FOUNDATIONAL</p>
              <h2>
                Introduction
                <br />
                to agents.
              </h2>
              <p className="ticket-joke">Prerequisite: already owning one.</p>
              <div className="ticket-chart">
                <span>ILLUSTRATIVE ASK HISTORY</span>
                <svg viewBox="0 0 360 95" aria-hidden="true">
                  <defs>
                    <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#b9f56d" stopOpacity=".32" />
                      <stop offset="100%" stopColor="#b9f56d" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 85L25 80L48 83L70 65L100 71L130 48L155 54L179 34L203 41L230 25L255 30L282 12L311 18L338 4L360 7V95H0Z"
                    fill="url(#chart-fill)"
                  />
                  <path
                    d="M0 85L25 80L48 83L70 65L100 71L130 48L155 54L179 34L203 41L230 25L255 30L282 12L311 18L338 4L360 7"
                    stroke="#b9f56d"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
              </div>
              <div className="ticket-price">
                <div>
                  <span>ILLUSTRATIVE ASK</span>
                  <strong>
                    $420<small> / seat</small>
                  </strong>
                </div>
                <span className="positive">↗ 38.2%</span>
              </div>
              <button onClick={() => openTrade(listings[0])}>
                Preview purchase <span>↗</span>
              </button>
              <div className="ticket-bottom">
                <span>PREVIEW INVENTORY</span>
                <span className="barcode" aria-hidden="true" />
              </div>
            </article>
            <div className="ticket-caption">
              <span>01 /</span> The invisible hand has an API key.
            </div>
          </div>
        </section>
        <section className="metrics" aria-label="Market premise">
          <div>
            <span>THE UNDERLYING ASSET</span>
            <strong>A chair.</strong>
            <small>Now with a convenience premium.</small>
          </div>
          <div>
            <span>ADMISSION REQUIREMENT</span>
            <strong>An agent.</strong>
            <small>To learn how to build an agent.</small>
          </div>
          <div>
            <span>ACTUAL TRANSACTIONS</span>
            <strong>Zero.</strong>
            <small>Let’s keep this hypothetical.</small>
          </div>
          <div>
            <span>MARKET STATUS</span>
            <strong className="green">Entirely avoidable.</strong>
            <small>There is still time to design for people.</small>
          </div>
        </section>
        <section id="market" className="market-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                THE SECONDARY MARKET FOR FIRST-HAND KNOWLEDGE
              </p>
              <h2>Find your edge. Or a chair.</h2>
            </div>
            <span className="market-badge">
              <i /> PREVIEW INVENTORY
            </span>
          </div>
          <div className="market-layout">
            <div className="listings">
              <div className="tabs" aria-label="Filter sessions">
                {categories.map((tab) => (
                  <button
                    key={tab}
                    aria-pressed={category === tab}
                    className={category === tab ? "active" : ""}
                    onClick={() => setCategory(tab)}
                  >
                    {tab}
                    {tab === "Watchlist" ? ` (${watchlist.length})` : ""}
                  </button>
                ))}
              </div>
              <div className="search-row">
                <label className="search-box">
                  <span aria-hidden="true">⌕</span>
                  <input
                    aria-label="Search sessions"
                    placeholder="Search sessions, codes, or venues"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <select
                  aria-label="Sort sessions"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="trending">Trending first</option>
                  <option value="low">Price: low to high</option>
                  <option value="high">Price: high to low</option>
                </select>
              </div>
              <div className="table-heading">
                <span>SESSION / UNDERLYING OPPORTUNITY</span>
                <span>ILLUSTRATIVE ASK</span>
              </div>
              <div className="session-list">
                {visible.map((item) => (
                  <article className="session" key={item.code}>
                    <button
                      className={`watch ${watchlist.includes(item.code) ? "watched" : ""}`}
                      aria-label={`${watchlist.includes(item.code) ? "Unwatch" : "Watch"} ${item.code}`}
                      aria-pressed={watchlist.includes(item.code)}
                      onClick={() => toggleWatch(item.code)}
                    >
                      {watchlist.includes(item.code) ? "★" : "☆"}
                    </button>
                    <div className="session-info">
                      <div className="session-meta">
                        <b>{item.code}</b>
                        <span>{item.level}</span>
                        {item.seats <= 3 && (
                          <span className="scarce">
                            {item.seats} SEAT{item.seats === 1 ? "" : "S"}
                          </span>
                        )}
                      </div>
                      <h3>
                        <button onClick={() => openTrade(item)}>
                          {item.title}
                        </button>
                      </h3>
                      <p>
                        {item.venue} <span>·</span> {item.day} <span>·</span>{" "}
                        {item.time}
                      </p>
                    </div>
                    <div className="price-cell">
                      <strong>{money(item.price)}</strong>
                      <span
                        className={item.change < 0 ? "negative" : "positive"}
                      >
                        {item.change < 0 ? "↘" : "↗"} {Math.abs(item.change)}%
                      </span>
                    </div>
                    <Sparkline down={item.change < 0} />
                    <button
                      className="trade"
                      aria-label={`Trade ${item.code}`}
                      onClick={() => openTrade(item)}
                    >
                      Trade ↗
                    </button>
                  </article>
                ))}
                {visible.length === 0 && (
                  <div className="empty">
                    {category === "Watchlist"
                      ? "Your watchlist is empty. Star a session to follow it."
                      : "No sessions match. Try a different search or category."}
                  </div>
                )}
              </div>
              <p className="data-note">
                All session titles, codes, listings, prices, quantities, and
                price changes above are invented for this demonstration. They
                are not AWS catalog records or demand forecasts.
              </p>
            </div>
            <aside className="market-sidebar">
              <div className="agent-card">
                <div className="agent-icon">⌘</div>
                <span className="eyebrow">AUTOMATE YOUR ADVANTAGE</span>
                <h3>
                  You’re here to learn.
                  <br />
                  Your agent is here to earn.
                </h3>
                <p>
                  Why wait in line when you can illustrate the consequences of
                  bypassing it?
                </p>
                <button onClick={() => setAgent((value) => !value)}>
                  {agent ? "Pause agent preview" : "Preview agent mode"}{" "}
                  <span>↗</span>
                </button>
                <div className="agent-status">
                  {agent ? "AGENT PREVIEW" : "NO API CONNECTION REQUIRED"}
                </div>
                {agent && (
                  <div className="agent-output">
                    <p>01 → Scan inventory</p>
                    <p>02 → Rank by invented premium</p>
                    <p>03 → AIM401 leads at $650</p>
                    <p className="positive">
                      04 → Reserve nothing. Make a point.
                    </p>
                  </div>
                )}
              </div>
              <div className="activity">
                <div className="activity-heading">
                  <h3>Your quotes</h3>
                  <span>{orders.length.toString().padStart(2, "0")}</span>
                </div>
                {orders.length === 0 ? (
                  <p>
                    No activity yet. Preview a trade to try the market. No money
                    or seats change hands.
                  </p>
                ) : (
                  <ul>
                    {orders.map((order, index) => (
                      <li key={`${order.code}-${index}`}>
                        <span>
                          {order.mode === "buy"
                            ? "BUYER QUOTE"
                            : "SELLER QUOTE"}
                          <b>{order.code}</b>
                        </span>
                        <strong>{money(order.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
                <small>Quotes reset when you leave this page.</small>
              </div>
            </aside>
          </div>
        </section>
        <section id="how" className="how">
          <div>
            <p className="eyebrow">AN ENTIRELY UNNECESSARY VALUE CHAIN</p>
            <h2>
              From knowledge
              <br />
              to asset class.
            </h2>
          </div>
          <article>
            <span>01 / DISCOVER</span>
            <h3>Find a session.</h3>
            <p>
              Someone wrote a talk to help you learn. We added a price chart.
            </p>
          </article>
          <article>
            <span>02 / SPECULATE</span>
            <h3>Price the privilege.</h3>
            <p>Compare asking prices and calculate your potential return.</p>
          </article>
          <article>
            <span>03 / SETTLE</span>
            <h3>A cut above.</h3>
            <p>
              A proposed 10% service fee. Seller proceeds calculated before you
              commit.
            </p>
          </article>
        </section>
        <section id="thesis" className="thesis">
          <span className="thesis-symbol" aria-hidden="true">
            ↗
          </span>
          <div>
            <p className="eyebrow">THE FUTURE OF CONFERENCE ACCESS.</p>
            <h2>
              You shouldn’t need an agent
              <br />
              to get into “Intro to agents.”
            </h2>
            <p>
              A conference should reward curiosity. Automated reservations raise
              a question: how will people booking manually compete with
              software? What happens when a seat becomes an asset?
            </p>
            <p>
              The AWS Events API exposes reservation and cancellation
              operations. Its published interface does not expose a
              seat-transfer operation. Release-and-reserve requires both steps
              to succeed.
            </p>
            <a
              href="https://docs.aws.amazon.com/events/latest/devguide/mcp-server.html"
              target="_blank"
              rel="noreferrer"
            >
              Inspect the documented capabilities ↗
            </a>
          </div>
        </section>
      </main>
      <footer>
        <Link className="wordmark" href="/">
          re:<b>Sell</b>
          <span>↗</span>
        </Link>
        <p>Supply. Demand. A place to sit.</p>
        <span>re:Sell · 2026</span>
      </footer>
      <div className="toast" role="status" aria-live="polite">
        {notice && (
          <>
            <span>{notice}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </>
        )}
      </div>
      <dialog
        ref={dialog}
        className="trade-dialog"
        aria-labelledby="trade-title"
      >
        <button
          className="close-dialog"
          aria-label="Close trade preview"
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
        <span className="eyebrow">PRICE A SEAT</span>
        <h2 id="trade-title">
          {mode === "buy"
            ? "Acquire an unfair advantage."
            : "Become the middleman."}
        </h2>
        <p className="dialog-session">
          {selected?.code} · {selected?.title}
        </p>
        <div className="mode-tabs">
          <button aria-pressed={mode === "buy"} onClick={() => setMode("buy")}>
            Place a bid
          </button>
          <button
            aria-pressed={mode === "sell"}
            onClick={() => setMode("sell")}
          >
            Seller quote
          </button>
        </div>
        <form onSubmit={placeOrder}>
          <label htmlFor="bid">
            {mode === "buy" ? "Your bid (USD)" : "Asking price (USD)"}
          </label>
          <input
            id="bid"
            type="number"
            min="1"
            max="10000"
            step="1"
            required
            value={bid}
            onChange={(event) => setBid(event.target.value)}
          />
          <div className="order-summary">
            <span>Sale price</span>
            <b>{money(Number(bid) || 0)}</b>
            <span>Proposed service fee · 10%</span>
            <b>{money((Number(bid) || 0) * 0.1)}</b>
            <span>Proposed seller proceeds</span>
            <b>{money((Number(bid) || 0) * 0.9)}</b>
            <span>Actual amount charged</span>
            <b>$0</b>
          </div>
          {mode === "buy" && (
            <label className="handoff-label">
              Calculate settlement if
              <select
                value={handoff}
                onChange={(event) =>
                  setHandoff(event.target.value as "success" | "failure")
                }
              >
                <option value="success">Reservation succeeds</option>
                <option value="failure">
                  Reservation fails → full refund model
                </option>
              </select>
            </label>
          )}
          <div className="escrow-preview">
            <strong>Escrow model · not activated</strong>
            <p>
              Proposed flow: hold buyer funds → seller releases → buyer reserves
              → verify → pay seller less 10%. If reservation fails: refund buyer
              in full; no payout or fee. Release does not guarantee acquisition.
            </p>
          </div>
          <p className="transaction-note">
            Trading is not open. Inventory and prices are illustrative; escrow
            and booking are not activated. Saving a quote records it for this
            browser session.
          </p>
          <button className="primary confirm" type="submit">
            {!user
              ? "Create an account to continue"
              : mode === "buy"
                ? "Save quote"
                : "Save seller quote"}{" "}
            ↗
          </button>
        </form>
      </dialog>
      <dialog
        ref={accountDialog}
        className="trade-dialog"
        aria-labelledby="account-title"
      >
        <button
          className="close-dialog"
          aria-label="Close account dialog"
          onClick={() => accountDialog.current?.close()}
        >
          ×
        </button>
        <span className="eyebrow">RE:SELL / EARLY ACCESS</span>
        <h2 id="account-title">
          {user
            ? `Hello, ${user.username}.`
            : authMode === "signup"
              ? "Get a seat at the market."
              : "Welcome back."}
        </h2>
        {user ? (
          <div>
            <p className="transaction-note">
              Your account is real. Marketplace inventory, handoffs, escrow, and
              payouts are not activated. Your quotes reset on reload.
            </p>
            <button
              className="primary confirm"
              disabled={authBusy}
              onClick={() => accountAction("logout")}
            >
              Sign out
            </button>
            <details className="delete-account">
              <summary>Delete my account</summary>
              <p>
                This permanently removes your username, password hash, and
                sign-in sessions.
              </p>
              <button
                disabled={authBusy}
                onClick={() => accountAction("delete")}
              >
                Permanently delete account
              </button>
            </details>
          </div>
        ) : (
          <>
            <div className="mode-tabs">
              <button
                aria-pressed={authMode === "signup"}
                onClick={() => {
                  setAuthMode("signup");
                  setAuthError("");
                }}
              >
                Create account
              </button>
              <button
                aria-pressed={authMode === "login"}
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                }}
              >
                Log in
              </button>
            </div>
            <form onSubmit={authenticate}>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                pattern="[a-zA-Z0-9_]{3,24}"
                minLength={3}
                maxLength={24}
                placeholder="your_handle"
                required
              />
              <label htmlFor="password" className="password-label">
                Password · 12 characters minimum
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  authMode === "signup" ? "new-password" : "current-password"
                }
                minLength={12}
                maxLength={128}
                required
              />
              {authMode === "signup" && (
                <p className="transaction-note">
                  Your account stores a username and a protected password hash.
                  No email or AWS credentials required. Save your password:
                  email recovery is not available. You can delete your account
                  at any time.
                </p>
              )}
              <button
                className="primary confirm"
                disabled={authBusy}
                type="submit"
              >
                {authBusy
                  ? "Connecting…"
                  : authMode === "signup"
                    ? "Create account ↗"
                    : "Log in ↗"}
              </button>
            </form>
          </>
        )}
        {authError && (
          <p className="auth-error" role="alert">
            {authError}
          </p>
        )}
      </dialog>
    </div>
  );
}
