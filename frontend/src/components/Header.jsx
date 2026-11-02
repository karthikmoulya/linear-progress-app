import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import { initials } from "../lib/time";

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5A6070" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// Closes a popover on outside click or Escape.
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const menu = "absolute z-20 top-[52px] w-[280px] rounded-xl border border-line bg-white p-2 shadow-[0_12px_32px_rgba(18,20,26,0.12)] flex flex-col";
const item = "flex min-h-10 w-full cursor-pointer items-center rounded-lg border-0 bg-transparent px-2.5 text-left font-[inherit] text-ink no-underline hover:bg-ground";

function ProjectSwitcher({ project, onSelect, popover }) {
  const { open, setOpen, ref } = popover;
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    fetch("/api/projects")
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.detail || "Couldn't load projects");
        setProjects(body);
      })
      .catch((err) => setError(err.message));
  }, [open]);

  async function choose(id) {
    setOpen(false);
    if (id !== project?.id) await onSelect(id);
  }

  return (
    // On phones the switcher drops to its own full-width row under the logo and buttons.
    <div className="relative order-last min-w-0 basis-full sm:order-none sm:basis-auto" ref={ref}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-9 max-w-full cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-3 font-[inherit] font-medium text-ink"
      >
        <span className="truncate">{project?.name ?? "Choose project"}</span>
        <Chevron />
      </button>
      {open && (
        <div className={`${menu} left-0`}>
          <div className="px-2.5 pt-1.5 pb-2 text-xs font-semibold tracking-[0.04em] text-muted uppercase">Linear projects</div>
          {error && <p className="m-0 px-2.5 py-2 text-[13px] text-[#B42318]">{error}</p>}
          {!projects && !error && <p className="m-0 px-2.5 py-2 text-[13px] text-muted">Loading…</p>}
          {projects?.map((p) => (
            <button key={p.id} type="button" className={`${item} justify-between gap-2`} aria-current={p.id === project?.id} onClick={() => choose(p.id)}>
              <span className="truncate">{p.name}</span>
              {p.id === project?.id && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#12141A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="Current project">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const METHOD = {
  oauth: "Connected via OAuth · read-only",
  key: "Connected with an API key · read-only",
  local: "Local dev · personal API key",
};

function AccountMenu({ user, onSwitchProject, onSignOut }) {
  const { open, setOpen, ref } = usePopover();
  if (!user) return null;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-11 cursor-pointer items-center gap-2 rounded-[22px] border border-line bg-white py-0 pr-2 pl-1 font-[inherit]"
      >
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-white">
          {initials(user.name) || "?"}
        </span>
        <Chevron />
      </button>
      {open && (
        <div role="menu" className={`${menu} right-0`}>
          <div className="mb-1.5 border-b border-line-2 px-2.5 pt-2 pb-2.5">
            <div className="font-semibold">{user.name}</div>
            {user.workspace && <div className="text-xs text-muted">Linear · {user.workspace} workspace</div>}
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#166534]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" aria-hidden="true" />
              {METHOD[user.method] ?? METHOD.oauth}
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              onSwitchProject();
            }}
          >
            Switch project
          </button>
          {!user.auth_disabled && (
            <>
              <a role="menuitem" href="/auth/login" className={item}>
                Reconnect Linear
              </a>
              <button type="button" role="menuitem" className={`${item} font-medium text-[#B42318]`} onClick={onSignOut}>
                Sign out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Header({ user, project, summary, refreshing, onRefresh, onSelectProject, onSignOut }) {
  const switcher = usePopover();
  const synced = summary?.last_synced
    ? new Date(summary.last_synced).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-base font-bold tracking-[-0.01em]">Plan Tracker</span>
        </div>
        <span className="hidden text-[#C5C8D0] sm:inline" aria-hidden="true">
          /
        </span>
        <ProjectSwitcher project={project} onSelect={onSelectProject} popover={switcher} />
        <div className="flex-1" />
        {synced && (
          <div className="hidden items-center gap-2 text-[13px] text-muted md:flex">
            <span className="h-2 w-2 rounded-full bg-[#16A34A]" aria-hidden="true" />
            <span>Synced with Linear · {synced}</span>
          </div>
        )}
        <button
          type="button"
          aria-label="Sync now"
          title="Sync now"
          onClick={onRefresh}
          disabled={refreshing}
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-line bg-white disabled:opacity-50"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#12141A"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={refreshing ? "animate-spin" : ""}
          >
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
        <AccountMenu user={user} onSwitchProject={() => switcher.setOpen(true)} onSignOut={onSignOut} />
      </div>
    </header>
  );
}
