"use client";

import Trending from "./trending";
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
  level: string;
};
const listings: Listing[] = [
  {
    code: "AGT101",
    title: "Getting started with AI agents",
    category: "Agents & AI",
    venue: "Venetian",
    day: "MON · NOV 30",
    time: "10:00 AM",
    price: 420,
    level: "100 · Foundational",
  },
  {
    code: "SRV302",
    title: "Building serverless applications",
    category: "Infrastructure",
    venue: "MGM Grand",
    day: "TUE · DEC 01",
    time: "11:30 AM",
    price: 185,
    level: "300 · Advanced",
  },
  {
    code: "AIM401",
    title: "Designing multi-agent systems",
    category: "Agents & AI",
    venue: "Caesars Forum",
    day: "WED · DEC 02",
    time: "2:00 PM",
    price: 650,
    level: "400 · Expert",
  },
  {
    code: "DAT301",
    title: "Designing distributed databases",
    category: "Data & Analytics",
    venue: "Venetian",
    day: "TUE · DEC 01",
    time: "3:00 PM",
    price: 240,
    level: "300 · Advanced",
  },
  {
    code: "CLD201",
    title: "Optimizing your AWS costs",
    category: "Infrastructure",
    venue: "MGM Grand",
    day: "THU · DEC 03",
    time: "9:00 AM",
    price: 95,
    level: "200 · Intermediate",
  },
  {
    code: "AGT202",
    title: "Deploying AI applications",
    category: "Agents & AI",
    venue: "Caesars Forum",
    day: "THU · DEC 03",
    time: "1:00 PM",
    price: 310,
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
export default function Marketplace() {
  const [category, setCategory] = useState("All sessions");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("topic");
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
          : a.title.localeCompare(b.title),
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
    setOrders((previous) => [
      { code: selected.code, amount, mode },
      ...previous,
    ]);
    setNotice(
      mode === "sell"
        ? `Seller quote saved: ${money(amount)} asking price, ${money(amount * 0.1)} fee, ${money(amount * 0.9)} to you on a successful sale.`
        : `Buyer quote saved for ${selected.code}: ${money(amount)} total. No charge today.`,
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
        <Link className="wordmark" href="/" aria-label="re:AInvent home">
          re:<b>AI</b>nvent
          <span>↗</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#trending">Trending</a>
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
          Price my reservation <span>↗</span>
        </button>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="tiny-cross">✳</span> LAS VEGAS · NOV 30 — DEC 4,
              2026
            </p>
            <h1>
              Buy and sell
              <br />
              <span>re:Invent session reservations.</span>
            </h1>
            <div className="hero-description">
              <p>
                <strong>Buying?</strong> Find someone willing to release a
                reservation for a session you want.
              </p>
              <p>
                <strong>Selling?</strong> Use AI to find and reserve in-demand
                sessions, then list your reservations to help cover your trip.
              </p>
            </div>
            <p className="hero-footnote">
              Individual session reservations. Both attendees need their own
              re:Invent conference pass.
            </p>
            <p className="preview-status">
              <strong>Marketplace preview</strong> · Example listings and a
              price calculator. Booking and payments aren’t open yet.
            </p>
            <div className="hero-actions">
              <a className="primary" href="#market">
                Find a session <span>↗</span>
              </a>
              <button
                className="secondary-action"
                onClick={() => openTrade(listings[0], "sell")}
              >
                Price my reservation ↗
              </button>
            </div>
          </div>
          <div className="feature-wrap">
            <div className="orbit-text">
              PUT A RESERVATION TOWARD YOUR TRAVEL BILL
            </div>
            <article className="feature-ticket">
              <div className="ticket-top">
                <span className="pill">EXAMPLE SALE</span>
                <span>↗</span>
              </div>
              <p className="ticket-code">ONE SESSION RESERVATION</p>
              <h2>
                You set the price.
                <br />
                You keep 90%.
              </h2>
              <p className="ticket-joke">
                Here’s the proposed breakdown for a $100 sale.
              </p>
              <dl className="sale-example">
                <div>
                  <dt>Buyer pays</dt>
                  <dd>$100</dd>
                </div>
                <div>
                  <dt>Service fee · 10%</dt>
                  <dd>−$10</dd>
                </div>
                <div className="seller-net">
                  <dt>Seller receives</dt>
                  <dd>$90</dd>
                </div>
              </dl>
              <p className="ticket-joke">
                Seller payout follows a confirmed buyer reservation. If booking
                fails, the buyer gets a full refund.
              </p>
              <button onClick={() => openTrade(listings[0], "sell")}>
                Try your own price
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 19 19 5M5 5h14v14" />
                </svg>
              </button>
            </article>
            <div className="ticket-caption">
              A successful sale could help cover your trip.
            </div>
          </div>
        </section>
        <section className="metrics" aria-label="Booking dates and seller fees">
          <div>
            <span>DIRECT AWS BOOKING</span>
            <strong>Oct 6</strong>
            <small>Book through AWS’s website or app.</small>
          </div>
          <div>
            <span>AI-ASSISTED AWS BOOKING</span>
            <strong>Oct 8</strong>
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
        <Trending />
        <section id="how" className="getting-started">
          <p className="eyebrow">START HERE</p>
          <h2>
            One marketplace.
            <br />
            Two ways to use it.
          </h2>
          <p className="section-intro">
            The planned marketplace connects attendees who want a session
            reservation with attendees willing to sell one. Here’s how each side
            would work.
          </p>
          <div className="journey-grid">
            <article>
              <span className="eyebrow">I WANT TO BUY</span>
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
                    Review the seller’s asking price and your total before
                    committing. You’ll need your own re:Invent registration to
                    attend.
                  </p>
                </li>
                <li>
                  <strong>Attempt the reservation handoff.</strong>
                  <p>
                    The planned handoff releases the seller’s reservation and
                    attempts to book it for you. The service would hold your
                    payment during the attempt and pay the seller only after
                    your reservation is confirmed.
                  </p>
                </li>
              </ol>
              <a className="primary" href="#market">
                Explore sessions ↗
              </a>
            </article>
            <article>
              <span className="eyebrow">I WANT TO SELL</span>
              <h3>For sellers</h3>
              <ol>
                <li>
                  <strong>Find and reserve sessions with AI.</strong>
                  <p>
                    Use an assistant to identify sessions people may want and
                    request reservations through AWS on your own registration.
                    AI-assisted booking opens October 8.
                  </p>
                </li>
                <li>
                  <strong>Set your asking price.</strong>
                  <p>
                    Offer a reservation you’ve secured and are willing to
                    release. The proposed seller fee is 10%: on a $100 sale,
                    you’d receive $90.
                  </p>
                </li>
                <li>
                  <strong>Release when the buyer is ready.</strong>
                  <p>
                    The planned service coordinates your cancellation with the
                    buyer’s booking attempt. You’d receive payment only if their
                    reservation is confirmed.
                  </p>
                </li>
              </ol>
              <button
                className="primary"
                onClick={() => openTrade(listings[0], "sell")}
              >
                Try the seller calculator ↗
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
                Browse AWS’s session catalog and save favorites. On re:AInvent,
                explore sample prices and calculate a potential sale’s
                contribution to your trip.
              </p>
            </article>
            <article>
              <time className="timeline-date" dateTime="2026-10-06">
                OCTOBER 6
              </time>
              <h3>Book directly with AWS</h3>
              <p>
                Session reservations open for people booking through AWS’s
                attendee website or app. This gives direct booking a two-day
                head start.
              </p>
            </article>
            <article>
              <time className="timeline-date" dateTime="2026-10-08">
                OCTOBER 8
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
            These are AWS’s booking dates, not a re:AInvent trading launch date.
            Exact opening times aren’t listed here; check your AWS attendee
            account for details.
          </p>
          <a
            href="https://docs.aws.amazon.com/events/latest/devguide/what-is-events-api.html"
            target="_blank"
            rel="noreferrer"
          >
            AWS booking dates and API details ↗
          </a>
        </section>
        <section id="market" className="market-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">EXPLORE EXAMPLE LISTINGS</p>
              <h2>Find a session. See the price.</h2>
            </div>
            <span className="market-badge">
              <i /> EXAMPLE LISTINGS
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
                  <option value="topic">Session title: A–Z</option>
                  <option value="low">Price: low to high</option>
                  <option value="high">Price: high to low</option>
                </select>
              </div>
              <div className="table-heading">
                <span>SESSION</span>
                <span>ASKING PRICE</span>
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
                      <span>per reservation</span>
                    </div>
                    <button
                      className="trade"
                      aria-label={`View quote for ${item.code}`}
                      onClick={() => openTrade(item)}
                    >
                      View quote ↗
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
                Example sessions and prices, not the AWS catalog. Stars and
                quotes are kept for this visit only.
              </p>
            </div>
            <aside className="market-sidebar">
              <div className="agent-card">
                <div className="agent-icon">⌘</div>
                <span className="eyebrow">AI FOR SELLERS</span>
                <h3>
                  Find demand.
                  <br />
                  Plan reservations.
                </h3>
                <p>
                  An AI assistant can help identify sessions to reserve and
                  offer for sale. AWS’s MCP connection enables AI-assisted
                  booking from October 8.
                </p>
                <button onClick={() => setAgent((value) => !value)}>
                  {agent ? "Hide the steps" : "See the AI booking steps"}{" "}
                  <span>↗</span>
                </button>
                {agent && (
                  <div className="agent-output">
                    <p>1. Compare sessions and likely demand.</p>
                    <p>2. Sign in to AWS with your Builder ID.</p>
                    <p>3. Ask your assistant to request reservations.</p>
                    <p className="positive">
                      4. Check which reservations AWS confirmed.
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
        <section id="questions" className="getting-started common-questions">
          <p className="eyebrow">COMMON QUESTIONS</p>
          <h2>Before you get started.</h2>
          <details>
            <summary>Does this include a re:Invent conference pass?</summary>
            <p>
              No. The marketplace is for reservations to individual sessions.
              Buyers and sellers each need their own conference registration.
            </p>
          </details>
          <details>
            <summary>
              Why would I pay for a session that’s included in my pass?
            </summary>
            <p>
              Your pass includes session access, but a reservation for a
              particular session may be hard to get. The proposed marketplace
              pays another attendee to release their reservation while
              attempting to book it for you. You can also look for availability
              directly through AWS.
            </p>
          </details>
          <details>
            <summary>Does October 8 mean re:AInvent trading opens?</summary>
            <p>
              No. October 8 is the opening date for AI-assisted booking through
              AWS. re:AInvent’s buying and selling launch date hasn’t been
              announced.
            </p>
          </details>
          <details>
            <summary>Can I use the calculator without an account?</summary>
            <p>
              Yes. Open a quote to see the buyer’s price or calculate seller
              proceeds. Saved quotes last for this visit and reset when you
              reload.
            </p>
          </details>
        </section>
      </main>
      <footer>
        <Link className="wordmark" href="/">
          re:<b>AI</b>nvent
          <span>↗</span>
        </Link>
        <p>Your agent. Your seats. Your travel fund.</p>
        <span>re:AInvent · 2026</span>
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
          aria-label="Close quote"
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
        <span className="eyebrow">RESERVATION PRICE CALCULATOR</span>
        <h2 id="trade-title">
          {mode === "buy"
            ? "Review your buyer quote."
            : "Calculate your seller proceeds."}
        </h2>
        <p className="dialog-session">
          {selected?.code} · {selected?.title}
        </p>
        <div className="mode-tabs">
          <button
            aria-pressed={mode === "buy"}
            onClick={() => {
              setMode("buy");
              setBid(String(selected?.price || 0));
            }}
          >
            Buyer quote
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
            {mode === "buy"
              ? "Seller’s asking price (USD)"
              : "Asking price (USD)"}
          </label>
          <input
            id="bid"
            type="number"
            min="1"
            max="10000"
            step="1"
            required
            value={bid}
            readOnly={mode === "buy"}
            onChange={(event) => setBid(event.target.value)}
          />
          <div className="order-summary">
            {mode === "buy" ? (
              <>
                <span>You would pay</span>
                <b>{money(Number(bid) || 0)}</b>
                <span>Buyer fee</span>
                <b>$0</b>
              </>
            ) : (
              <>
                <span>Asking price</span>
                <b>{money(Number(bid) || 0)}</b>
                <span>Seller fee · 10%</span>
                <b>−{money((Number(bid) || 0) * 0.1)}</b>
                <span>You would receive</span>
                <b>{money((Number(bid) || 0) * 0.9)}</b>
              </>
            )}
            <span>Charged today</span>
            <b>$0</b>
          </div>
          <div className="escrow-preview">
            <strong>Planned payment and reservation handoff</strong>
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
            Save quote for this visit ↗
          </button>
        </form>
      </dialog>
    </div>
  );
}
