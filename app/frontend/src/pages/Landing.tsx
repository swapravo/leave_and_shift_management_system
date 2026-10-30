import { ArrowLeftRight, CalendarDays, Inbox, Scale, Settings, Smartphone } from "lucide-react";
import { Link } from "react-router";

// Facts only: each line is something the app really does. There are no stats or testimonials yet, so none are shown.
const PROOF = [
  "Weekends never count against you",
  "Cover gets checked before you hit send",
  "Every change is logged, and nobody can edit the log",
];

const PROBLEMS = [
  "Asking for one day off shouldn't take five messages.",
  "“Wait, who's covering Friday?” Nobody knows.",
  "You swapped shifts in the chat. Did anyone tell your manager?",
];

const STEPS = [
  { title: "Pick your dates", body: "Tap the first and last day. You see what it costs and what you'll have left." },
  { title: "We check the rules", body: "If a shift would run short without you, you hear about it now. Not after a week of waiting." },
  { title: "The right person says yes", body: "It goes to whoever approves it. You can see who it's waiting on, and the answer lands in your inbox." },
];

const BENEFITS = [
  { icon: Smartphone, title: "Your next shift, front and center", body: "Sign in and it's the first thing you see. No digging." },
  { icon: ArrowLeftRight, title: "Swaps that don't get lost", body: "Your teammate says yes first, then your approver decides. You can see every step." },
  { icon: Scale, title: "Balances that actually add up", body: "Leave builds month by month, and every day has a reason attached." },
  { icon: CalendarDays, title: "One calendar for everything", body: "Shifts, leave and gaps on the same month. Just you, or the whole team." },
];

const LEADS = [
  { icon: Inbox, title: "Approving? One inbox.", body: "Leave and swaps wait in the same place. Approve or reject right there." },
  { icon: Settings, title: "Running HR? Set it up once.", body: "People, teams, leave types and shifts live in one Settings area, and every change is on record." },
];

const FAQ = [
  { q: "Do I need to sign up?", a: "Nope. HR sets you up. Sign in with the email and password they gave you." },
  { q: "Will my time off leave the team short?", a: "It checks first. If a shift would drop below its minimum, you see which one before you send." },
  { q: "Who approves my leave?", a: "Your manager. Managers' leave goes to HR." },
  { q: "Can I take a request back?", a: "Yes. Withdraw it while it's pending, or cancel approved leave and the days are refunded." },
  { q: "What if my teammate says no to a swap?", a: "Nothing changes. Your shifts stay exactly as they were." },
  { q: "Does it work on my phone?", a: "Yes. It's built phone-first." },
];

/** The public front door: what the product does, in plain words, with a single way in. */
export default function Landing() {
  return (
    <div className="landing">
      <main>
        <section className="landing-hero">
          <div className="landing-copy">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">L</span>
              <span>Leave &amp; Shifts</span>
            </div>
            <h1>Time off and shift swaps, minus the group chat.</h1>
            <p className="lede">
              Ask for leave, swap a shift and see who's covering, all in one place. You always know where it stands, and
              no shift gets left short.
            </p>
            <Link className="button primary large" to="/login">Sign in to my shifts</Link>
            <p className="reassure">No sign-up. HR already set you up, so use the email and password they gave you.</p>
          </div>

          <div className="landing-art" aria-hidden="true">
            <div className="hero-card">
              <div className="eyebrow">Your next shift</div>
              <div className="big">Today · Evening</div>
              <div>14:00–22:00 · Customer Support</div>
            </div>
            <div className="summary">
              <dl>
                <dt>Dates</dt><dd>Wed 04 Nov – Fri 06 Nov</dd>
                <dt>Working days</dt><dd>3 days</dd>
                <dt>Balance after</dt><dd>17 left</dd>
                <dt>Decided by</dt><dd>Your manager</dd>
              </dl>
            </div>
            <div className="item-card needs">
              <div>
                <div className="title">Swap offer</div>
                <div className="meta">Evening Sat 31 Oct for Morning Sun 01 Nov</div>
              </div>
              <span className="badge badge-warn">Waiting for you</span>
            </div>
          </div>
        </section>

        <ul className="landing-proof" aria-label="What you can count on">
          {PROOF.map((p) => <li key={p}>{p}</li>)}
        </ul>

        <section className="landing-section" aria-labelledby="problem">
          <h2 id="problem">Sound familiar?</h2>
          <ul className="landing-problems">
            {PROBLEMS.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="how">
          <h2 id="how">Time off in about a minute</h2>
          <ol className="landing-steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="step-n" aria-hidden="true">{i + 1}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p className="muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-section" aria-labelledby="why">
          <h2 id="why">Less chasing, more actual days off</h2>
          <div className="landing-grid two">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="promise">
                <span className="tile-icon" aria-hidden="true"><Icon size={22} /></span>
                <div>
                  <h3>{title}</h3>
                  <p className="muted">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section" aria-labelledby="leads">
          <h2 id="leads">Got a team to look after?</h2>
          <div className="landing-grid two">
            {LEADS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="promise">
                <span className="tile-icon" aria-hidden="true"><Icon size={22} /></span>
                <div>
                  <h3>{title}</h3>
                  <p className="muted">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section" aria-labelledby="faq">
          <h2 id="faq">Quick questions</h2>
          <div className="landing-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p className="muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-section landing-close" aria-label="Closing">
          <p className="close-line">Your next day off is about a minute away.</p>
        </section>
      </main>
      <footer className="landing-foot">
        <span>Leave &amp; Shifts</span>
        <span className="muted">Leave, rosters and shift swaps in one place.</span>
      </footer>
    </div>
  );
}
