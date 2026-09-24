"use client";

import Link from "next/link";
import { useAccount } from "./managed-auth";
import { useRef, useState } from "react";

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
  const {
    user,
    ready: accountReady,
    error: accountError,
    openAccount,
  } = useAccount();
  const [handoff, setHandoff] = useState<"success" | "failure">("success");
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
      if (accountError) setNotice(accountError);
      else if (accountReady) openAccount();
      else setNotice("Sign-in is loading. Please try again in a moment.");
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
        <span>Your agent. Your seats. Your travel fund.</span>
        <a href="#timeline">See the timeline ↗</a>
      </div>
      <header className="header">
        <Link className="wordmark" href="/" aria-label="reAInvent home">
          re<b>AI</b>nvent
          <span>↗</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#market">Marketplace</a>
          <a href="#how">How it works</a>
          <a href="#timeline">Key dates</a>
        </nav>
        <button
          className="account-button"
          onClick={() => {
            if (accountError) setNotice(accountError);
            else if (accountReady) openAccount();
            else setNotice("Sign-in is loading. Please try again in a moment.");
          }}
        >
          {user ? user.username : "Sign up / Log in"}
        </button>
        <button
          className="sell-button"
          onClick={() => openTrade(listings[0], "sell")}
        >
          Sell a seat <span>↗</span>
        </button>
      </header>
      <div className="ticker" aria-label="Illustrative market prices">
        <span className="ticker-label">THE TRIP ECONOMY</span>
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
              The trip costs.
              <br />
              <span>Put AI to work.</span>
            </h1>
            <p className="hero-description">
              Use AI to find in-demand sessions and price your seats.
              <br />
              Turn conference demand into a plan to subsidize your trip.
            </p>
            <div className="hero-actions">
              <a className="primary" href="#market">
                Explore the market <span>↗</span>
              </a>
              <span className="hero-aside">
                Flights. Hotels. Conference passes.
                <br />
                Give your agent a stretch goal.
              </span>
            </div>
            <p className="hero-footnote">
              Learn about AI. Put it on the travel budget.
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
        <section className="metrics" aria-label="Booking dates and seller fees">
          <div>
            <span>DIRECT AWS BOOKING</span>
            <strong>Oct 4</strong>
            <small>Book through AWS’s website or app.</small>
          </div>
          <div>
            <span>AI-ASSISTED AWS BOOKING</span>
            <strong>Oct 6</strong>
            <small>Booking through MCP opens two days later.</small>
          </div>
          <div>
            <span>PROPOSED SERVICE FEE</span>
            <strong>10%</strong>
            <small>Applied only to a successful sale.</small>
          </div>
          <div>
            <span>PROPOSED SELLER SHARE</span>
            <strong className="green">90%</strong>
            <small>$90 to you on a $100 sale.</small>
          </div>
        </section>
        <section id="how" className="getting-started">
          <p className="eyebrow">START HERE</p>
          <h2>
            A seat for your schedule.
            <br />A contribution to your trip.
          </h2>
          <p className="section-intro">
            reAInvent brings buyers and sellers together around in-demand
            conference sessions. Buyers look for a session they want to attend.
            Sellers price a reservation they’re willing to give up. AI helps
            with discovery and planning.
          </p>
          <div className="journey-grid">
            <article>
              <span className="eyebrow">I WANT A SEAT</span>
              <h3>For buyers</h3>
              <ol>
                <li>
                  <strong>Find your session.</strong>
                  <p>
                    Browse by topic and compare prices. Check the date, time,
                    and venue against your conference plans.
                  </p>
                </li>
                <li>
                  <strong>Review the total.</strong>
                  <p>
                    Choose a price and review the quote before committing.
                    You’ll need your own re:Invent registration to attend.
                  </p>
                </li>
                <li>
                  <strong>Get a confirmed reservation.</strong>
                  <p>
                    The planned handoff releases the seller’s reservation and
                    attempts to book it for you. Payment would settle only after
                    your reservation is confirmed.
                  </p>
                </li>
              </ol>
              <a className="primary" href="#market">
                Explore sessions ↗
              </a>
            </article>
            <article>
              <span className="eyebrow">I HAVE A SEAT</span>
              <h3>For sellers</h3>
              <ol>
                <li>
                  <strong>Choose a reservation.</strong>
                  <p>
                    Start with a session you’ve reserved and are willing to give
                    up. A favorite or a place on your wish list isn’t a reserved
                    seat.
                  </p>
                </li>
                <li>
                  <strong>Set your asking price.</strong>
                  <p>
                    See what you’d receive after the proposed 10% service fee. A
                    $100 sale would contribute $90 toward your trip.
                  </p>
                </li>
                <li>
                  <strong>Complete the handoff.</strong>
                  <p>
                    Under the planned flow, your payout follows confirmation of
                    the buyer’s reservation. If the buyer doesn’t get the seat,
                    there’s no payout or service fee.
                  </p>
                </li>
              </ol>
              <button
                className="primary"
                onClick={() => openTrade(listings[0], "sell")}
              >
                Calculate seller proceeds ↗
              </button>
            </article>
          </div>
          <div className="handoff-explainer">
            <h3>What happens if the handoff fails?</h3>
            <p>
              AWS doesn’t offer a direct seat-transfer feature. Once a seller
              releases a seat, another attendee may reserve it first. The
              proposed payment flow would refund the buyer in full if their
              booking fails. The seller could lose the original reservation;
              getting it back isn’t guaranteed.
            </p>
          </div>
        </section>
        <section id="timeline" className="booking-timeline">
          <p className="eyebrow">YOUR 2026 PLANNING TIMELINE</p>
          <h2>People first. AI two days later.</h2>
          <div className="timeline-grid">
            <article>
              <span className="timeline-date">NOW</span>
              <h3>Build your shortlist</h3>
              <p>
                Browse AWS’s session catalog and save favorites. On reAInvent,
                explore sample prices and calculate a potential sale’s
                contribution to your trip.
              </p>
            </article>
            <article>
              <time className="timeline-date" dateTime="2026-10-04">
                OCTOBER 4
              </time>
              <h3>Book directly with AWS</h3>
              <p>
                Session reservations open for people booking through AWS’s
                attendee website or app. This gives direct booking a two-day
                head start.
              </p>
            </article>
            <article>
              <time className="timeline-date" dateTime="2026-10-06">
                OCTOBER 6
              </time>
              <h3>AI-assisted booking opens</h3>
              <p>
                Booking through the AWS Events MCP server opens. MCP is the
                connection that lets an AI assistant use AWS’s event tools on
                your behalf. You’ll need to sign in with the AWS Builder ID
                linked to your registration.
              </p>
            </article>
            <article>
              <span className="timeline-date">NOVEMBER 30 – DECEMBER 4</span>
              <h3>See you in Las Vegas</h3>
              <p>
                Attend re:Invent 2026. Leave time between sessions to travel
                between venues.
              </p>
            </article>
          </div>
          <p className="timeline-note">
            These are AWS’s booking dates, not a reAInvent trading launch date.
            Exact opening times aren’t listed here; check your AWS attendee
            account for details.
          </p>
          <a
            href="https://aws.amazon.com/events/reinvent/faqs/"
            target="_blank"
            rel="noreferrer"
          >
            AWS registration and session details ↗
          </a>
        </section>
        <section className="availability-panel">
          <div>
            <p className="eyebrow">WHAT YOU CAN DO TODAY</p>
            <h2>Explore now. Plan your next move.</h2>
            <p>
              Browse the example listings, star sessions for this visit, and use
              the quote calculator. Purchases, seller payouts, and reservation
              handoffs aren’t open yet.
            </p>
          </div>
          <a className="primary" href="#market">
            Browse the marketplace ↗
          </a>
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
                  See how an assistant could compare sessions and help you plan.
                  AI-assisted booking through AWS opens October 6.
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
                    <p>02 → Compare example prices</p>
                    <p>03 → AIM401 leads at $650</p>
                    <p className="positive">
                      04 → Review your options before booking.
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
                    Your quotes will appear here. Choose a session to compare
                    the asking price and seller proceeds.
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
          re<b>AI</b>nvent
          <span>↗</span>
        </Link>
        <p>Your agent. Your seats. Your travel fund.</p>
        <span>reAInvent · 2026</span>
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
            ? "Review your buyer quote."
            : "Calculate your seller proceeds."}
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
              The proposed flow holds the buyer’s payment until their
              reservation is confirmed, then pays the seller 90% of the sale
              price. If booking fails, the buyer gets a full refund and the
              seller receives no payout. A released seat may be taken by someone
              else.
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
    </div>
  );
}
