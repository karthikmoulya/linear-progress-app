import { subjectStyle } from "../lib/subjects";
import { formatDate, splitWeekName } from "../lib/time";

const DOT = {
  done: { className: "bg-ink", label: "Done" },
  today: { className: "bg-progress", label: "In progress" },
  missed: { className: "bg-[#B42318]", label: "Missed" },
  planned: { className: "border-[1.5px] border-[#A3A8B4]", label: "Planned" },
};

export function DayStrip({ days, compact = false }) {
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
      {days.map((d) => {
        const isToday = d.status === "today";
        const dot = DOT[d.status] ?? DOT.planned;
        return (
          <a
            key={d.identifier}
            href={d.url}
            target="_blank"
            rel="noreferrer"
            title={d.title}
            className={`flex flex-col items-center gap-1.5 rounded-[10px] no-underline ${compact ? "py-2" : "py-2.5"} ${
              isToday ? "bg-ink text-white" : "bg-ground text-ink"
            }`}
          >
            <span className={`text-xs ${isToday ? "text-[#C9CDD5]" : "text-muted"}`}>{formatDate(d.date, { weekday: "short" })}</span>
            <span className="font-mono font-semibold">{formatDate(d.date, { day: "numeric" })}</span>
            <span className={`box-border h-2 w-2 rounded-full ${dot.className}`} aria-label={dot.label} />
          </a>
        );
      })}
    </div>
  );
}

export default function ThisWeek({ week }) {
  if (!week) return null;
  const { label, dates } = splitWeekName(week.name);
  return (
    <div id="week" className="flex min-w-0 flex-[5_1_380px] scroll-mt-4 flex-col gap-[18px] rounded-xl border border-line bg-white p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <h2 className="m-0 text-lg font-bold tracking-[-0.01em]">This week</h2>
        <span className="text-[13px] text-muted">
          {label}
          {dates && ` · ${dates}`}
        </span>
        <div className="flex-1" />
        <span className="font-mono text-[13px] font-semibold">{Math.round(week.checklist_pct)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-line-2">
        <div className="h-full rounded bg-accent" style={{ width: `${week.checklist_pct}%` }} />
      </div>

      <DayStrip days={week.days} />

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {week.issues.map((issue) => {
          const s = subjectStyle(issue.subject);
          return (
            <li key={issue.identifier}>
              <a
                href={issue.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-[10px] border border-line-2 p-3 text-ink no-underline hover:border-line"
              >
                <span
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[11px] font-bold"
                  style={{ background: s.tint, color: s.color }}
                >
                  {s.code}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{issue.topic}</div>
                  <div className="text-xs text-muted">
                    {s.short}
                    {issue.due_date && ` · ${formatDate(issue.due_date, { weekday: "short" })}`}
                  </div>
                </div>
                <span
                  className={`rounded-xl border px-[9px] py-0.5 text-xs font-medium ${
                    issue.done ? "border-transparent bg-ink text-white" : "border-[#DADDE3] text-muted"
                  }`}
                >
                  {issue.state || (issue.done ? "Done" : "Todo")}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
