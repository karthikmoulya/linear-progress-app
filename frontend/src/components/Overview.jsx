import { daysBetween, formatDate, splitWeekName } from "../lib/time";

const card = "flex flex-col gap-2.5 rounded-xl border border-line bg-white p-5";
const big = "font-mono text-[34px] font-semibold tracking-[-0.03em]";

export function Hero({ today, currentWeek, weekCount, project }) {
  const week = splitWeekName(currentWeek?.name);
  const plan = today?.today;
  const heading = plan
    ? `Day ${plan.day} · ${formatDate(plan.date, { weekday: "long", day: "numeric", month: "long" })}`
    : today
      ? formatDate(today.date, { weekday: "long", day: "numeric", month: "long" })
      : "";
  return (
    <section className="flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-[999_1_480px]">
        {currentWeek && (
          <div className="font-mono text-xs font-medium tracking-[0.04em] text-muted uppercase">
            {week.label} of {weekCount}
            {week.dates && ` · ${week.dates}`}
          </div>
        )}
        <h1 className="mt-1.5 mb-0 text-[28px] leading-[1.15] font-bold tracking-[-0.02em] sm:text-4xl">{heading}</h1>
        {project && <p className="mt-1.5 mb-0 text-[15px] text-muted">{project.name}</p>}
      </div>
      <nav aria-label="Sections" className="hidden gap-1 rounded-[10px] bg-[#E7E9ED] p-1 md:flex">
        {[
          ["#today", "Overview"],
          ["#roadmap", "Roadmap"],
          ["#days", "Daily log"],
        ].map(([href, label], i) => (
          <a
            key={href}
            href={href}
            className={`flex h-9 items-center rounded-[7px] px-3.5 no-underline ${
              i === 0 ? "bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(18,20,26,0.08)]" : "font-medium text-[#444A58]"
            }`}
          >
            {label}
          </a>
        ))}
      </nav>
    </section>
  );
}

export function KpiTiles({ summary, today, project, upcoming }) {
  if (!summary) return null;
  const todayIso = today?.date;
  const plan = today?.today;
  const nextStep = upcoming?.find((u) => u.identifier);
  const target = project?.target_date;

  return (
    <section aria-label="Key numbers" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
      <div className={card}>
        <div className="text-[13px] font-medium text-muted">Plan complete</div>
        <div className="flex items-baseline gap-2">
          <span className={big}>{Math.round(summary.overall_pct)}%</span>
          <span className="text-[13px] text-muted">
            {summary.issues_done} of {summary.issues_total} issues done
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-[3px] bg-line-2">
          <div className="h-full rounded-[3px] bg-accent" style={{ width: `${Math.max(summary.overall_pct, 1)}%` }} />
        </div>
      </div>

      <div className={card}>
        <div className="text-[13px] font-medium text-muted">Study day</div>
        <div className="flex items-baseline gap-2">
          <span className={big}>
            {summary.current_day}
            <span className="text-[22px] text-faint">/{summary.total_days}</span>
          </span>
          <span className="text-[13px] text-muted">weekdays only</span>
        </div>
        {summary.days_behind > 0 ? (
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#B42318]">
            <span className="h-2 w-2 rounded-full bg-[#B42318]" aria-hidden="true" />
            {summary.days_behind} {summary.days_behind === 1 ? "day" : "days"} behind
          </div>
        ) : plan ? (
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#9A3412]">
            <span className="h-2 w-2 rounded-full bg-progress" aria-hidden="true" />
            {plan.done ? "Today done" : "Today in progress"}
          </div>
        ) : (
          <div className="text-[13px] text-muted">On track</div>
        )}
      </div>

      {nextStep && todayIso && (
        <div className={card}>
          <div className="text-[13px] font-medium text-muted">Next job-search step</div>
          <div className="flex items-baseline gap-2">
            <span className={big}>{daysBetween(todayIso, nextStep.date)}</span>
            <span className="text-[13px] text-muted">days · {formatDate(nextStep.date, { weekday: "short", day: "numeric", month: "short" })}</span>
          </div>
          <a href={nextStep.url} target="_blank" rel="noreferrer" className="truncate text-[13px] text-muted no-underline hover:underline">
            {nextStep.title}
          </a>
        </div>
      )}

      {target && todayIso && (
        <div className="flex flex-col gap-2.5 rounded-xl bg-ink p-5 text-white">
          <div className="text-[13px] font-medium text-[#B9BECB]">Project target</div>
          <div className="flex items-baseline gap-2">
            <span className={big}>{daysBetween(todayIso, target)}</span>
            <span className="text-[13px] text-[#B9BECB]">days · {formatDate(target, { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
          <div className="text-[13px] text-[#B9BECB]">{project.name}</div>
        </div>
      )}
    </section>
  );
}
