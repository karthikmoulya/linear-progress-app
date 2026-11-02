import { useEffect, useState } from "react";
import { subjectStyle } from "../lib/subjects";
import { formatClock, formatDate, nowMinutes, parseBlockTime } from "../lib/time";

const card = "flex min-w-0 flex-col gap-[18px] rounded-xl border border-line bg-white p-5 sm:p-6";

function useClock() {
  const [now, setNow] = useState(() => nowMinutes());
  useEffect(() => {
    const id = setInterval(() => setNow(nowMinutes()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Turns the blocks into a timeline, inserting a break wherever one block ends before the next starts.
export function timeline(blocks) {
  const rows = [];
  blocks.forEach((block, i) => {
    const time = parseBlockTime(block.time);
    const prev = i > 0 ? parseBlockTime(blocks[i - 1].time) : null;
    if (time && prev && time.start > prev.end) {
      rows.push({ kind: "break", start: prev.end, end: time.start });
    }
    rows.push({ kind: "block", block, start: time?.start, end: time?.end });
  });
  return rows;
}

export function nowLabel(rows, now) {
  const timed = rows.filter((r) => r.start != null);
  if (!timed.length) return null;
  const minutesTo = (t) => `${t - now} min`;
  const current = timed.find((r) => now >= r.start && now < r.end);
  const next = timed.find((r) => r.kind === "block" && r.start > now);
  if (current?.kind === "block") {
    return { title: current.block.subject, detail: `${current.block.topic} · until ${formatClock(current.end)} (${minutesTo(current.end)} left)` };
  }
  if (next) {
    const title = current ? "Break" : now < timed[0].start ? "Before study" : "Break";
    return { title, detail: `next: ${next.block.subject} at ${formatClock(next.start)} (${minutesTo(next.start)})` };
  }
  return { title: "Study blocks done", detail: "nothing left on today's plan" };
}

function Checklist({ items }) {
  if (!items.length) return null;
  return (
    <ul className="mt-2 mb-0 flex list-none flex-col gap-1.5 p-0">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-[13px]">
          {/* Read-only: ticks come from Linear and are changed there. */}
          <input type="checkbox" checked={item.done} readOnly tabIndex={-1} aria-label={item.text} className="mt-0.5 h-4 w-4 flex-none accent-ink" />
          <span className={item.done ? "text-faint line-through" : ""}>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

function BlockRow({ row, isNow, last }) {
  const border = last ? "" : "border-b border-line-2";
  if (row.kind === "break") {
    return (
      <li className={`flex gap-4 py-3.5 opacity-75 ${border}`}>
        <div className="w-[92px] flex-none pt-0.5 font-mono text-xs text-muted">
          {formatClock(row.start).replace(/ (AM|PM)$/, "")}–{formatClock(row.end).replace(/ (AM|PM)$/, "")}
        </div>
        <div className="w-1 flex-none rounded-sm bg-[#C9CDD5]" />
        <div className="flex-1 text-[15px] font-medium">Break</div>
      </li>
    );
  }
  const { block } = row;
  const style = subjectStyle(block.subject);
  const done = block.items.filter((i) => i.done).length;
  return (
    <li className={`flex gap-3 py-3.5 sm:gap-4 ${border}`}>
      <div className="w-[76px] flex-none pt-0.5 font-mono text-xs text-muted sm:w-[92px]">{block.time}</div>
      <div className="w-1 flex-none rounded-sm" style={{ background: style.color }} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold tracking-[0.04em] uppercase" style={{ color: style.color }}>
          {isNow && "Now · "}
          {block.subject}
        </div>
        <div className="mt-0.5 text-[15px] font-semibold">{block.topic}</div>
        <div className="mt-0.5 text-[13px] text-muted">
          {done} / {block.items.length} done
        </div>
        <Checklist items={block.items} />
      </div>
    </li>
  );
}

function Plan({ plan, isToday }) {
  const now = useClock();
  const rows = timeline(plan.blocks);
  const label = isToday ? nowLabel(rows, now) : null;
  const nowRow = isToday ? rows.find((r) => r.kind === "block" && now >= r.start && now < r.end) : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 text-lg font-bold tracking-[-0.01em]">{isToday ? "Today's plan" : plan.title}</h2>
        <span className="font-mono text-xs text-muted">{plan.url.split("/issue/")[1]?.split("/")[0]}</span>
        <span
          className={`inline-flex h-6 items-center rounded-xl px-2.5 text-xs font-semibold ${
            plan.done ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FDF0E4] text-[#9A3412]"
          }`}
        >
          {plan.done ? "Done" : "Open"}
        </span>
        <div className="flex-1" />
        <a href={plan.url} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-link no-underline hover:underline">
          Open in Linear ↗
        </a>
      </div>

      {label && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] bg-ground px-3.5 py-3">
          <span className="rounded-md bg-ink px-2 py-[3px] font-mono text-xs font-semibold text-white">NOW {formatClock(now)}</span>
          <span className="font-medium">{label.title}</span>
          <span className="text-muted">· {label.detail}</span>
        </div>
      )}

      {plan.raw_description != null ? (
        <pre className="m-0 font-sans text-sm whitespace-pre-wrap text-muted">{plan.raw_description}</pre>
      ) : (
        <ol className="m-0 flex list-none flex-col p-0">
          {rows.map((row, i) => (
            <BlockRow key={i} row={row} isNow={row === nowRow} last={i === rows.length - 1} />
          ))}
        </ol>
      )}
      <div className="border-t border-dashed border-[#DADDE3] pt-3 text-[13px] text-muted">
        Read-only · tick checklist items in Linear, then sync.
      </div>
    </>
  );
}

function CatchUp({ days }) {
  return (
    <>
      <div>
        <h2 className="m-0 text-lg font-bold tracking-[-0.01em]">Weekend catch-up</h2>
        <p className="mt-1 mb-0 text-[13px] text-muted">
          {days.length} missed {days.length === 1 ? "day" : "days"} still open
        </p>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {days.map((d) => {
          const left = d.blocks.flatMap((b) => b.items).filter((i) => !i.done).length;
          return (
            <li key={d.url} className="flex items-center justify-between gap-3 border-b border-line-2 py-3 last:border-0">
              <a href={d.url} target="_blank" rel="noreferrer" className="font-medium text-ink no-underline hover:underline">
                {d.title}
              </a>
              <span className="text-[13px] text-muted">{left} items left</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function TodayPlan({ data }) {
  let body;
  if (!data) body = <p className="m-0 text-muted">Loading today's plan…</p>;
  else if (data.today) body = <Plan plan={data.today} isToday={data.today.date === data.date} />;
  else if (data.catch_up.length) body = <CatchUp days={data.catch_up} />;
  else
    body = (
      <div>
        <h2 className="m-0 text-lg font-bold tracking-[-0.01em]">Rest day</h2>
        <p className="mt-1 mb-0 text-muted">
          No daily issue for {formatDate(data.date, { weekday: "long", day: "numeric", month: "long" })} and nothing to catch up on.
        </p>
      </div>
    );
  return <div className={`${card} flex-[7_1_520px]`}>{body}</div>;
}
