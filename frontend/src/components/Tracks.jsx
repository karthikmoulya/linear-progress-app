import { subjectStyle } from "../lib/subjects";
import { formatDate, splitWeekName } from "../lib/time";

// For each subject, its weekly issue in every week (or null where a week has none).
function subjectWeeks(weeks, subject) {
  return weeks.map((w) => ({ week: w, issue: w.issues.find((i) => i.subject === subject) ?? null }));
}

// done | current | missed (a past week whose issue is still open) | future
function cellState({ week, issue }, todayIso) {
  if (issue?.done) return "done";
  if (week.is_current) return "current";
  const past = todayIso && week.target_date && week.target_date < todayIso;
  return past && issue ? "missed" : "future";
}

export function SubjectCards({ subjects, weeks, summary, today }) {
  if (!subjects || !weeks) return null;
  return (
    <section aria-label="Subjects" className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
      {subjects.map((subj) => {
        const s = subjectStyle(subj.subject);
        const done = subj.subject === "DSA" && summary ? `${summary.dsa_solved} / ${summary.dsa_total}` : `${subj.weekly_done} / ${subj.weekly_total}`;
        return (
          <div key={subj.subject} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden="true" />
              <span className="font-bold">{subj.subject}</span>
              <div className="flex-1" />
              <span className="font-mono text-[13px] text-muted" title={subj.subject === "DSA" ? "Problems solved" : "Weekly issues done"}>
                {done}
              </span>
            </div>
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
              {subjectWeeks(weeks, subj.subject).map((cell) => {
                const state = cellState(cell, today?.date);
                const style =
                  state === "done"
                    ? { background: s.color }
                    : state === "current"
                      ? { background: s.tint, boxShadow: `inset 0 0 0 1.5px ${s.color}` }
                      : state === "missed"
                        ? { background: "#F4B8B0" }
                        : { background: "#ECEEF2" };
                return <span key={cell.week.name} title={`${cell.week.name}: ${cell.issue?.topic ?? "—"}`} className="h-3.5 rounded-[3px]" style={style} />;
              })}
            </div>
            <div className="text-[13px] text-muted">
              {Math.round(subj.checklist_pct)}% of checklist
              {subj.next_topic && ` · next: ${subj.next_topic}`}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function Roadmap({ weeks, subjects, today }) {
  if (!weeks || !subjects) return null;
  const first = weeks[0]?.days[0]?.date;
  const last = weeks.at(-1)?.target_date;
  const cols = `120px repeat(${weeks.length}, minmax(0, 1fr))`;

  return (
    <section id="roadmap" className="flex scroll-mt-4 flex-col gap-4 rounded-xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 text-lg font-bold tracking-[-0.01em]">{weeks.length}-week roadmap</h2>
        {first && last && (
          <span className="text-[13px] text-muted">
            {formatDate(first, { month: "short", day: "numeric" })} → {formatDate(last, { month: "short", day: "numeric" })} · one Linear milestone per week
          </span>
        )}
        <div className="flex-1" />
        <div className="flex gap-3.5 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px] bg-ink" aria-hidden="true" />
            Done
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px] shadow-[inset_0_0_0_1.5px_#12141A]" aria-hidden="true" />
            This week
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px] bg-line-2" aria-hidden="true" />
            Planned
          </span>
        </div>
      </div>
      <div className="overflow-x-auto pb-1.5">
        <div className="flex min-w-[1720px] flex-col gap-1.5">
          <div className="grid gap-1.5 font-mono text-[11px] text-muted" style={{ gridTemplateColumns: cols }}>
            <span />
            {weeks.map((w) => {
              const { n } = splitWeekName(w.name);
              return (
                <span key={w.name} className="flex flex-col px-1">
                  <span className={`font-semibold ${w.is_current ? "text-progress" : "text-ink"}`}>W{n}</span>
                  <span>{w.days[0] ? formatDate(w.days[0].date, { month: "short", day: "numeric" }) : ""}</span>
                </span>
              );
            })}
          </div>
          {subjects.map((subj) => {
            const s = subjectStyle(subj.subject);
            return (
              <div key={subj.subject} className="grid gap-1.5" style={{ gridTemplateColumns: cols }}>
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} aria-hidden="true" />
                  {s.short}
                </span>
                {subjectWeeks(weeks, subj.subject).map((cell) => {
                  const state = cellState(cell, today?.date);
                  const base = "min-h-14 rounded-lg p-2 text-[11.5px] leading-[1.3] no-underline";
                  const style =
                    state === "done"
                      ? { className: `${base} bg-ink text-white`, style: {} }
                      : state === "current"
                        ? { className: `${base} font-semibold text-ink`, style: { background: s.tint, boxShadow: `inset 0 0 0 1.5px ${s.color}` } }
                        : state === "missed"
                          ? { className: `${base} bg-[#FDECEA] text-[#7F1D1D]`, style: {} }
                          : { className: `${base} bg-ground text-[#444A58]`, style: {} };
                  return cell.issue ? (
                    <a key={cell.week.name} href={cell.issue.url} target="_blank" rel="noreferrer" className={style.className} style={style.style}>
                      {cell.issue.topic}
                    </a>
                  ) : (
                    <span key={cell.week.name} className={`${base} bg-ground`} />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
