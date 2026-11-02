import { useState } from "react";
import Logo from "./Logo";

function LinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  );
}

const PERMS = [
  { ok: true, text: "Read projects, milestones, labels and issues" },
  { ok: false, text: "Change, delete or comment on anything" },
];

function KeyForm({ onSignedIn }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/auth/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `Sign-in failed (HTTP ${res.status})`);
      }
      onSignedIn();
    } catch (err) {
      setError(err instanceof TypeError ? "Can't reach the backend" : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5 rounded-xl border border-line bg-white p-[18px]">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="apikey" className="text-[13px] font-semibold">
          Personal API key
        </label>
        <input
          id="apikey"
          type="password"
          required
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="lin_api_••••••••••••"
          autoComplete="off"
          className="h-11 rounded-lg border border-[#C9CDD5] bg-white px-3 font-mono text-[13px]"
        />
        <span className="text-xs text-muted">Linear → Settings → Security &amp; access → Personal API keys</span>
      </div>
      {error && (
        <p role="alert" className="m-0 rounded-lg bg-[#FDECEA] px-3 py-2.5 text-[13px] text-[#7F1D1D]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !key}
        className="h-11 cursor-pointer rounded-lg border border-ink bg-white font-semibold text-ink disabled:cursor-default disabled:opacity-50"
      >
        {busy ? "Checking…" : "Connect with key"}
      </button>
      <div className="flex gap-2 rounded-lg bg-[#FDF0E4] px-3 py-2.5 text-xs text-[#7C2D12]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px flex-none">
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
        <span>
          The key is checked with Linear, then kept only inside your encrypted session cookie. Revoke it in Linear anytime.
        </span>
      </div>
    </form>
  );
}

function WeekPreview() {
  return (
    <div className="flex flex-col gap-3.5 rounded-[14px] border border-ink-3 bg-ink-2 p-5" aria-hidden="true">
      <div className="grid grid-cols-16 gap-[3px]">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className={`h-3 rounded-[3px] ${i === 0 ? "bg-progress" : "bg-ink-3"}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-[#B9BECB]">
        {[
          ["DSA", "#6B93F0"],
          ["Agentic AI", "#EA8A3B"],
          ["System Design", "#3BB3A4"],
          ["Project", "#A98BF5"],
        ].map(([name, color]) => (
          <span key={name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SignIn({ onSignedIn }) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="flex min-h-screen flex-wrap bg-ground">
      <aside className="flex min-w-0 flex-[1_1_520px] flex-col gap-10 bg-ink p-6 text-white sm:p-12">
        <div className="flex items-center gap-2.5">
          <Logo inverted />
          <span className="text-base font-bold">Plan Tracker</span>
        </div>
        <div className="flex max-w-[520px] flex-auto flex-col justify-center gap-7">
          <h1 className="m-0 text-[34px] leading-[1.08] font-bold tracking-[-0.03em] sm:text-[44px]">
            See your study plan, not just your issues.
          </h1>
          <p className="m-0 text-base text-[#B9BECB]">
            Plan Tracker reads your Linear project and turns milestones, labels and daily issues into one view of where you stand.
          </p>
          <WeekPreview />
        </div>
        <div className="text-xs text-faint">Read-only · your Linear token never leaves the server</div>
      </aside>

      <main className="flex min-w-0 flex-[1_1_480px] items-center justify-center px-4 py-12 sm:px-8">
        <div className="flex w-full max-w-[400px] flex-col gap-6">
          <div>
            <h2 className="m-0 text-[28px] font-bold tracking-[-0.02em]">Sign in</h2>
            <p className="mt-1.5 mb-0 text-muted">Connect the Linear workspace that holds your study plan.</p>
          </div>

          <a
            href="/auth/login"
            className="flex h-12 items-center justify-center gap-2.5 rounded-[10px] bg-ink text-[15px] font-semibold text-white no-underline hover:bg-ink-2"
          >
            <LinkIcon />
            Continue with Linear
          </a>

          <div className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-white px-4 py-3.5 text-[13px] text-[#444A58]">
            <div className="font-semibold text-ink">Plan Tracker will be able to</div>
            {PERMS.map((p) => (
              <div key={p.text} className="flex gap-2">
                <span className={p.ok ? "text-[#16A34A]" : "text-faint"} aria-hidden="true">
                  {p.ok ? "✓" : "✕"}
                </span>
                {p.ok ? p.text : `Not: ${p.text.toLowerCase()}`}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs text-faint">
            <span className="h-px flex-1 bg-[#DADDE3]" />
            or
            <span className="h-px flex-1 bg-[#DADDE3]" />
          </div>

          {showKey ? (
            <KeyForm onSignedIn={onSignedIn} />
          ) : (
            <button
              type="button"
              onClick={() => setShowKey(true)}
              className="h-11 cursor-pointer rounded-[10px] border border-[#DADDE3] bg-white font-medium text-ink"
            >
              Use a personal API key instead
            </button>
          )}

          <p className="m-0 text-xs text-muted">Single-user app · signing in creates a session cookie (HttpOnly, 7 days).</p>
        </div>
      </main>
    </div>
  );
}
