import { formatDate } from "../lib/time";

const SQUARE = {
  done: "bg-ink",
  today: "bg-progress shadow-[0_0_0_2px_#FFFFFF,0_0_0_3.5px_#12141A]",
  missed: "bg-missed",
  planned: "bg-line-2",
};

export function DailyLog({ log }) {
  if (!log) return null;
  return (
    <div id="days" className="flex min-w-0 flex-[7_1_520px] scroll-mt-4 flex-col gap-4 rounded-xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 text-lg font-bold tracking-[-0.01em]">Daily log</h2>
        <span className="text-[13px] text-muted">{log.days.length} study days · 1 square per "Day N" issue</span>
        <div className="flex-1" />
        <span className="font-mono text-[13px]">
          Streak <b>{log.streak}</b> · Best <b>{log.best}</b>
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex min-w-[560px] gap-2.5">
          <div className="grid grid-rows-[repeat(5,22px)] gap-[5px] text-[11px] leading-[22px] text-muted">
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid flex-1 grid-flow-col auto-cols-[minmax(22px,1fr)] grid-rows-[repeat(5,22px)] gap-[5px]">
            {log.days.map((d) => (
              <a
                key={d.identifier}
                href={d.url}
                target="_blank"
                rel="noreferrer"
                title={`${d.title} · ${d.status}`}
                aria-label={`${d.title}: ${d.status}`}
                className={`rounded-[5px] ${SQUARE[d.status] ?? SQUARE.planned}`}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        {[
          ["bg-ink", "Done"],
          ["bg-progress", "Today"],
          ["bg-missed", "Missed"],
          ["bg-line-2", "Planned"],
        ].map(([cls, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-[3px] ${cls}`} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ComingUp({ items, today }) {
  if (!items) return null;
  return (
    <div className="flex min-w-0 flex-[5_1_380px] flex-col gap-3.5 rounded-xl border border-line bg-white p-5 sm:p-6">
      <h2 className="m-0 text-lg font-bold tracking-[-0.01em]">Coming up</h2>
      {!items.length && <p className="m-0 text-muted">Nothing scheduled.</p>}
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((u) => {
          const days = today ? Math.round((new Date(`${u.date}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000) : null;
          const title = u.url ? (
            <a href={u.url} target="_blank" rel="noreferrer" className="font-semibold text-ink no-underline hover:underline">
              {u.title}
            </a>
          ) : (
            <div className="font-semibold">{u.title}</div>
          );
          return (
            <li key={`${u.date}-${u.title}`} className="flex gap-3.5 border-b border-line-2 py-3 last:border-0">
              <div className="w-12 flex-none text-center">
                <div className="text-[11px] text-muted uppercase">{formatDate(u.date, { month: "short" })}</div>
                <div className="font-mono text-xl font-semibold">{formatDate(u.date, { day: "numeric" })}</div>
              </div>
              <div className="min-w-0 flex-1">
                {title}
                <div className="text-xs text-muted">
                  {[u.identifier, u.meta, days != null && `${days} days`].filter(Boolean).join(" · ")}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
