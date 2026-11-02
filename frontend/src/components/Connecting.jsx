function Step({ state, children, meta }) {
  const icon =
    state === "done" ? (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#16A34A] text-white" aria-label="Done">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12l5 5L20 7" />
        </svg>
      </span>
    ) : state === "active" ? (
      <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-line border-t-ink" aria-label="In progress" />
    ) : (
      <span className="h-6 w-6 rounded-full border-[1.5px] border-[#C9CDD5]" aria-label="Waiting" />
    );
  return (
    <li className={`flex items-center gap-3 ${state === "waiting" ? "text-faint" : ""}`}>
      {icon}
      <span className={`flex-1 ${state === "active" ? "font-semibold" : ""}`}>{children}</span>
      {meta && <span className="font-mono text-xs text-muted">{meta}</span>}
    </li>
  );
}

const METHOD = { oauth: "OAuth", key: "API key", local: "Local key" };

// Shown while the first sync runs after signing in.
export default function Connecting({ user, project }) {
  const steps = [
    { state: "done", text: "Authorised Plan Tracker", meta: METHOD[user?.method] },
    project
      ? { state: "done", text: `Found project "${project.name}"` }
      : { state: "active", text: "Finding your project" },
    { state: project ? "active" : "waiting", text: "Syncing milestones and issues" },
    { state: "waiting", text: "Building your dashboard" },
  ];
  return (
    <div className="flex min-h-screen items-center justify-center bg-ground px-4 py-12">
      <div className="flex w-full max-w-[460px] flex-col gap-6 rounded-2xl border border-line bg-white p-8">
        <div>
          <h1 className="m-0 text-2xl font-bold tracking-[-0.02em]">Connecting to Linear…</h1>
          {user && !user.auth_disabled && (
            <p className="mt-1.5 mb-0 text-muted">
              Signed in as {user.name}
              {user.workspace && (
                <>
                  {" "}· workspace <b className="text-ink">{user.workspace}</b>
                </>
              )}
            </p>
          )}
        </div>
        <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
          {steps.map((s) => (
            <Step key={s.text} state={s.state} meta={s.meta}>
              {s.text}
            </Step>
          ))}
        </ol>
      </div>
    </div>
  );
}
